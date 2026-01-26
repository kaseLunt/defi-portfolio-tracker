/**
 * Event processor for Alchemy WebSocket events
 *
 * Matches Transfer events to subscribed users, enriches with token data,
 * and queues for background processing.
 */

import { subscriptionStore } from "./subscription-store";
import type { Address } from "viem";
import type { TransferEvent, EnrichedEvent, WebSocketEventType, SerializedEnrichedEvent } from "./types";

/**
 * Process a Transfer event and match to subscribed users
 */
export async function processTransferEvent(
  event: TransferEvent
): Promise<EnrichedEvent[]> {
  const enrichedEvents: EnrichedEvent[] = [];

  // Get all active wallets to check for matches
  const activeWallets = await subscriptionStore.getActiveWallets();

  for (const walletAddress of activeWallets) {
    const normalizedWallet = walletAddress.toLowerCase();
    const fromMatch = event.from.toLowerCase() === normalizedWallet;
    const toMatch = event.to.toLowerCase() === normalizedWallet;

    if (!fromMatch && !toMatch) continue;

    // Get user ID for this wallet
    const userId = await subscriptionStore.findUserByWallet(walletAddress);
    if (!userId) continue;

    // Determine event type
    const type: WebSocketEventType = toMatch ? "transfer_in" : "transfer_out";

    const enrichedEvent: EnrichedEvent = {
      type,
      event,
      userId,
      walletAddress: walletAddress as Address,
    };

    enrichedEvents.push(enrichedEvent);

    // Update last event time
    await subscriptionStore.updateLastEventTime(walletAddress);
  }

  return enrichedEvents;
}

/**
 * Serialize an enriched event for queue storage
 */
export function serializeEnrichedEvent(
  event: EnrichedEvent
): SerializedEnrichedEvent {
  return {
    type: event.type,
    event: {
      chainId: event.event.chainId,
      tokenAddress: event.event.tokenAddress,
      from: event.event.from,
      to: event.event.to,
      value: event.event.value.toString(),
      blockNumber: event.event.blockNumber.toString(),
      transactionHash: event.event.transactionHash,
      logIndex: event.event.logIndex,
      timestamp: event.event.timestamp,
    },
    userId: event.userId,
    walletAddress: event.walletAddress,
    tokenSymbol: event.tokenSymbol,
    tokenDecimals: event.tokenDecimals,
    valueFormatted: event.valueFormatted,
    valueUsd: event.valueUsd,
  };
}

/**
 * Deserialize an enriched event from queue storage
 */
export function deserializeEnrichedEvent(
  data: SerializedEnrichedEvent
): EnrichedEvent {
  return {
    type: data.type,
    event: {
      chainId: data.event.chainId as EnrichedEvent["event"]["chainId"],
      tokenAddress: data.event.tokenAddress as Address,
      from: data.event.from as Address,
      to: data.event.to as Address,
      value: BigInt(data.event.value),
      blockNumber: BigInt(data.event.blockNumber),
      transactionHash: data.event.transactionHash,
      logIndex: data.event.logIndex,
      timestamp: data.event.timestamp,
    },
    userId: data.userId,
    walletAddress: data.walletAddress as Address,
    tokenSymbol: data.tokenSymbol,
    tokenDecimals: data.tokenDecimals,
    valueFormatted: data.valueFormatted,
    valueUsd: data.valueUsd,
  };
}

/**
 * Format a value with decimals
 */
export function formatTokenValue(value: bigint, decimals: number): number {
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  // Convert to number with precision
  return Number(wholePart) + Number(fractionalPart) / Number(divisor);
}
