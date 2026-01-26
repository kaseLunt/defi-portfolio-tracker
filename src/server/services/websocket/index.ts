/**
 * Alchemy WebSocket Service
 *
 * Central orchestrator for real-time on-chain event monitoring.
 * Manages per-chain WebSocket connections and user subscriptions.
 */

import { ChainWebSocketManager } from "./chain-manager";
import { subscriptionStore } from "./subscription-store";
import { processTransferEvent, serializeEnrichedEvent } from "./event-processor";
import { isAlchemyConfigured, getSupportedChainIds } from "@/server/lib/alchemy";
import { websocketEventQueue } from "@/server/jobs/queues";
import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";
import type { TransferEvent, UserSubscription, ChainConnectionState } from "./types";

// EtherFi tokens to auto-track on all chains
const ETHERFI_TOKENS: Record<number, Address[]> = {
  1: [
    "0x35fa164735182de50811e8e2e824cfb9b6118ac2" as Address, // eETH
    "0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee" as Address, // weETH
  ],
  42161: [
    "0x35751007a407ca6feffe80b3cb397736d2cf4dbe" as Address, // weETH on Arbitrum
  ],
  10: [
    "0x346e03f8cce9fe01dcb3d0da3e9d00dc2c0e08f0" as Address, // weETH on Optimism
  ],
  8453: [
    "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a" as Address, // weETH on Base
  ],
};

class AlchemyWebSocketService {
  private chainManagers: Map<SupportedChainId, ChainWebSocketManager> = new Map();
  private isRunning = false;

  /**
   * Initialize the WebSocket service
   */
  async initialize(): Promise<void> {
    if (!isAlchemyConfigured()) {
      console.log("[WS] Alchemy not configured, skipping WebSocket initialization");
      return;
    }

    console.log("[WS] Initializing Alchemy WebSocket service...");

    // Create chain managers
    const chainIds = getSupportedChainIds();
    for (const chainId of chainIds) {
      const manager = new ChainWebSocketManager(chainId, (event) =>
        this.handleEvent(event)
      );
      this.chainManagers.set(chainId, manager);
    }

    // Restore subscriptions from Redis
    await this.restoreSubscriptions();

    // Connect all chains that have tokens to track
    await this.connectActiveChains();

    this.isRunning = true;
    console.log("[WS] Alchemy WebSocket service initialized");
  }

  /**
   * Subscribe a user to receive events for their wallet
   */
  async subscribeUser(
    userId: string,
    walletAddress: Address,
    tokenAddresses?: Map<SupportedChainId, Address[]>
  ): Promise<void> {
    const normalizedWallet = walletAddress.toLowerCase() as Address;

    // Build token map with EtherFi tokens as default
    const tokenMap = new Map<SupportedChainId, Set<Address>>();

    // Add EtherFi tokens for all chains
    for (const [chainId, tokens] of Object.entries(ETHERFI_TOKENS)) {
      const chainIdNum = Number(chainId) as SupportedChainId;
      tokenMap.set(chainIdNum, new Set(tokens));
    }

    // Add any additional tokens specified
    if (tokenAddresses) {
      for (const [chainId, tokens] of tokenAddresses) {
        const existing = tokenMap.get(chainId) || new Set();
        for (const token of tokens) {
          existing.add(token.toLowerCase() as Address);
        }
        tokenMap.set(chainId, existing);
      }
    }

    const subscription: UserSubscription = {
      walletAddress: normalizedWallet,
      userId,
      tokenAddresses: tokenMap,
      subscribedAt: new Date(),
    };

    await subscriptionStore.saveSubscription(subscription);

    // Refresh chain connections to include new tokens
    await this.refreshChainConnections();

    console.log(`[WS] Subscribed user ${userId} for wallet ${normalizedWallet}`);
  }

  /**
   * Unsubscribe a user from events
   */
  async unsubscribeUser(walletAddress: Address): Promise<void> {
    const normalizedWallet = walletAddress.toLowerCase() as Address;
    await subscriptionStore.removeSubscription(normalizedWallet);

    // Check if we need to update chain connections
    await this.refreshChainConnections();

    console.log(`[WS] Unsubscribed wallet ${normalizedWallet}`);
  }

  /**
   * Handle incoming Transfer event
   */
  private async handleEvent(event: TransferEvent): Promise<void> {
    try {
      // Process event and match to users
      const enrichedEvents = await processTransferEvent(event);

      // Queue each matched event for processing
      for (const enrichedEvent of enrichedEvents) {
        const serialized = serializeEnrichedEvent(enrichedEvent);
        await websocketEventQueue.add("process-event", serialized, {
          removeOnComplete: 100,
          removeOnFail: 50,
        });
      }

      if (enrichedEvents.length > 0) {
        console.log(
          `[WS] Queued ${enrichedEvents.length} events for processing (tx: ${event.transactionHash.slice(0, 10)}...)`
        );
      }
    } catch (error) {
      console.error("[WS] Failed to handle event:", error);
    }
  }

  /**
   * Restore subscriptions from Redis on startup
   */
  private async restoreSubscriptions(): Promise<void> {
    const wallets = await subscriptionStore.getActiveWallets();
    console.log(`[WS] Restored ${wallets.length} subscriptions from Redis`);
  }

  /**
   * Connect chains that have tokens to track
   */
  private async connectActiveChains(): Promise<void> {
    const chainIds = getSupportedChainIds();

    for (const chainId of chainIds) {
      const tokens = await subscriptionStore.getChainTokens(chainId);
      if (tokens.size > 0) {
        const manager = this.chainManagers.get(chainId);
        if (manager) {
          await manager.connect();
        }
      }
    }
  }

  /**
   * Refresh all chain connections (call after subscription changes)
   */
  private async refreshChainConnections(): Promise<void> {
    const chainIds = getSupportedChainIds();

    for (const chainId of chainIds) {
      const tokens = await subscriptionStore.getChainTokens(chainId);
      const manager = this.chainManagers.get(chainId);

      if (!manager) continue;

      if (tokens.size > 0) {
        await manager.refresh();
      } else {
        await manager.disconnect();
      }
    }
  }

  /**
   * Add tokens to an existing user subscription
   */
  async addTokensToSubscription(
    walletAddress: Address,
    chainId: SupportedChainId,
    tokens: Address[]
  ): Promise<void> {
    await subscriptionStore.addTokens(walletAddress, chainId, tokens);
    await this.refreshChainConnections();
  }

  /**
   * Get connection states for all chains
   */
  getConnectionStates(): ChainConnectionState[] {
    const states: ChainConnectionState[] = [];
    for (const manager of this.chainManagers.values()) {
      states.push(manager.getState());
    }
    return states;
  }

  /**
   * Get subscription count
   */
  async getSubscriptionCount(): Promise<number> {
    return subscriptionStore.getSubscriptionCount();
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log("[WS] Shutting down Alchemy WebSocket service...");

    for (const manager of this.chainManagers.values()) {
      await manager.disconnect();
    }

    this.chainManagers.clear();
    this.isRunning = false;

    console.log("[WS] Alchemy WebSocket service shut down");
  }
}

// Singleton instance
let wsService: AlchemyWebSocketService | null = null;

/**
 * Initialize the Alchemy WebSocket service
 */
export async function initializeWebSocketService(): Promise<void> {
  if (wsService) {
    console.log("[WS] Service already initialized");
    return;
  }

  wsService = new AlchemyWebSocketService();
  await wsService.initialize();
}

/**
 * Get the WebSocket service instance
 */
export function getWebSocketService(): AlchemyWebSocketService {
  if (!wsService) {
    throw new Error("WebSocket service not initialized");
  }
  return wsService;
}

/**
 * Shutdown the WebSocket service
 */
export async function shutdownWebSocketService(): Promise<void> {
  if (wsService) {
    await wsService.shutdown();
    wsService = null;
  }
}

// Re-export for convenience
export { subscriptionStore } from "./subscription-store";
export type { TransferEvent, EnrichedEvent, UserSubscription } from "./types";
