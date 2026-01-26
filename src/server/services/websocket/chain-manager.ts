/**
 * Per-chain WebSocket manager for Alchemy event subscriptions
 *
 * Manages WebSocket connection, subscriptions, and reconnection for a single chain.
 */

import { getAlchemyInstance, CHAIN_NAMES } from "@/server/lib/alchemy";
import type { SupportedChainId } from "@/lib/constants";
import { subscriptionStore } from "./subscription-store";
import type { Address } from "viem";
import type { ChainConnectionState, TransferEvent, AlchemyLogEvent } from "./types";

// ERC20 Transfer event topic (keccak256("Transfer(address,address,uint256)"))
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export class ChainWebSocketManager {
  private chainId: SupportedChainId;
  private chainName: string;
  private state: ChainConnectionState;
  private onEvent: (event: TransferEvent) => void;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isSubscribed = false;

  constructor(
    chainId: SupportedChainId,
    onEvent: (event: TransferEvent) => void
  ) {
    this.chainId = chainId;
    this.chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
    this.onEvent = onEvent;
    this.state = {
      chainId,
      isConnected: false,
      reconnectAttempts: 0,
      subscriptionCount: 0,
    };
  }

  /**
   * Connect and subscribe to Transfer events for tracked tokens
   */
  async connect(): Promise<void> {
    try {
      // Get all tokens being tracked on this chain
      const tokens = await subscriptionStore.getChainTokens(this.chainId);

      if (tokens.size === 0) {
        console.log(
          `[WS:${this.chainName}] No tokens to track, skipping connection`
        );
        return;
      }

      const tokenAddresses = Array.from(tokens);
      console.log(
        `[WS:${this.chainName}] Subscribing to ${tokenAddresses.length} tokens`
      );

      const alchemy = getAlchemyInstance(this.chainId);

      // Subscribe to logs for Transfer events on these tokens
      // Using ethers.js filter format (Alchemy SDK extends ethers WebSocketProvider)
      // Note: We subscribe to each token individually since SDK expects single address
      for (const tokenAddress of tokenAddresses) {
        const filter = {
          address: tokenAddress as string,
          topics: [TRANSFER_TOPIC],
        };

        alchemy.ws.on(filter, (log: AlchemyLogEvent) => this.handleLog(log));
      }

      this.isSubscribed = true;
      this.state.isConnected = true;
      this.state.lastConnectedAt = new Date();
      this.state.reconnectAttempts = 0;
      this.state.subscriptionCount = tokenAddresses.length;

      console.log(`[WS:${this.chainName}] Connected successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[WS:${this.chainName}] Connection failed:`, errorMessage);
      this.state.isConnected = false;
      this.state.lastError = errorMessage;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming log event
   */
  private handleLog(log: AlchemyLogEvent): void {
    try {
      // Skip removed logs (reorgs)
      if (log.removed) {
        return;
      }

      // Parse Transfer event
      // topics[0] = Transfer signature
      // topics[1] = from address (indexed, padded to 32 bytes)
      // topics[2] = to address (indexed, padded to 32 bytes)
      // data = value (uint256)

      if (log.topics.length < 3) {
        return; // Invalid Transfer event
      }

      const event: TransferEvent = {
        chainId: this.chainId,
        tokenAddress: log.address.toLowerCase() as Address,
        from: ("0x" + log.topics[1].slice(26)).toLowerCase() as Address,
        to: ("0x" + log.topics[2].slice(26)).toLowerCase() as Address,
        value: BigInt(log.data || "0"),
        blockNumber: BigInt(log.blockNumber),
        transactionHash: log.transactionHash,
        logIndex: parseInt(log.logIndex, 16),
      };

      this.onEvent(event);
    } catch (error) {
      console.error(`[WS:${this.chainName}] Failed to parse log:`, error);
    }
  }

  /**
   * Disconnect WebSocket
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.isSubscribed) {
        const alchemy = getAlchemyInstance(this.chainId);
        alchemy.ws.removeAllListeners();
        this.isSubscribed = false;
      }
      this.state.isConnected = false;
      console.log(`[WS:${this.chainName}] Disconnected`);
    } catch (error) {
      console.error(`[WS:${this.chainName}] Disconnect error:`, error);
    }
  }

  /**
   * Reconnect with subscription updates
   */
  async refresh(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.state.reconnectAttempts),
      60000 // Max 1 minute
    );
    this.state.reconnectAttempts++;

    console.log(
      `[WS:${this.chainName}] Reconnecting in ${delay}ms (attempt ${this.state.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  getState(): ChainConnectionState {
    return { ...this.state };
  }

  getChainId(): SupportedChainId {
    return this.chainId;
  }
}
