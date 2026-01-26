/**
 * TypeScript interfaces for Alchemy WebSocket event monitoring
 */

import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";

/** User subscription configuration */
export interface UserSubscription {
  walletAddress: Address;
  userId: string;
  tokenAddresses: Map<SupportedChainId, Set<Address>>;
  subscribedAt: Date;
  lastEventAt?: Date;
}

/** Serializable version for Redis storage */
export interface SerializedUserSubscription {
  walletAddress: string;
  userId: string;
  tokenAddresses: Record<number, string[]>;
  subscribedAt: string;
  lastEventAt?: string;
}

/** Parsed ERC20 Transfer event */
export interface TransferEvent {
  chainId: SupportedChainId;
  tokenAddress: Address;
  from: Address;
  to: Address;
  value: bigint;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  timestamp?: number;
}

/** Event types for internal routing */
export type WebSocketEventType =
  | "transfer_in" // User received tokens
  | "transfer_out" // User sent tokens
  | "pending_tx"; // User has pending transaction

/** Enriched event with user context */
export interface EnrichedEvent {
  type: WebSocketEventType;
  event: TransferEvent;
  userId: string;
  walletAddress: Address;
  tokenSymbol?: string;
  tokenDecimals?: number;
  valueFormatted?: number;
  valueUsd?: number;
}

/** Serializable version for job queue */
export interface SerializedEnrichedEvent {
  type: WebSocketEventType;
  event: {
    chainId: number;
    tokenAddress: string;
    from: string;
    to: string;
    value: string; // BigInt as string
    blockNumber: string; // BigInt as string
    transactionHash: string;
    logIndex: number;
    timestamp?: number;
  };
  userId: string;
  walletAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  valueFormatted?: number;
  valueUsd?: number;
}

/** Chain connection state */
export interface ChainConnectionState {
  chainId: SupportedChainId;
  isConnected: boolean;
  lastConnectedAt?: Date;
  lastError?: string;
  reconnectAttempts: number;
  subscriptionCount: number;
}

/** Alchemy log event from WebSocket */
export interface AlchemyLogEvent {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}
