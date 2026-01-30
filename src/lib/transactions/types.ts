/**
 * DeFi Transaction Builder - Type Definitions
 *
 * Types for building, simulating, and executing DeFi transactions.
 */

import type { Address, Hash, Hex } from "viem";
import type { AssetType, BlockType, LendProtocol, StakeProtocol } from "../strategy/types";

// ============================================================================
// Transaction Actions
// ============================================================================

export type TransactionAction =
  | "approve"
  | "deposit"
  | "withdraw"
  | "stake"
  | "unstake"
  | "wrap"
  | "unwrap"
  | "borrow"
  | "repay"
  | "swap"
  | "claim";

// ============================================================================
// Protocol-Specific Parameters
// ============================================================================

export interface ApproveParams {
  token: Address;
  spender: Address;
  amount: bigint;
}

export interface DepositParams {
  protocol: LendProtocol;
  asset: Address;
  amount: bigint;
  onBehalfOf?: Address;
}

export interface WithdrawParams {
  protocol: LendProtocol;
  asset: Address;
  amount: bigint; // Use MaxUint256 for max
  to?: Address;
}

export interface BorrowParams {
  protocol: LendProtocol;
  asset: Address;
  amount: bigint;
  interestRateMode: 1 | 2; // 1 = stable, 2 = variable
  onBehalfOf?: Address;
}

export interface RepayParams {
  protocol: LendProtocol;
  asset: Address;
  amount: bigint; // Use MaxUint256 for max
  interestRateMode: 1 | 2;
  onBehalfOf?: Address;
}

export interface StakeParams {
  protocol: StakeProtocol;
  amount: bigint;
  referral?: Address;
}

export interface UnstakeParams {
  protocol: StakeProtocol;
  amount: bigint;
}

export interface WrapParams {
  protocol: StakeProtocol;
  amount: bigint;
}

export interface SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  slippageBps: number; // Basis points (e.g., 50 = 0.5%)
}

export interface ClaimParams {
  protocol: string;
  assets?: Address[];
}

export type ActionParams =
  | { action: "approve"; params: ApproveParams }
  | { action: "deposit"; params: DepositParams }
  | { action: "withdraw"; params: WithdrawParams }
  | { action: "borrow"; params: BorrowParams }
  | { action: "repay"; params: RepayParams }
  | { action: "stake"; params: StakeParams }
  | { action: "unstake"; params: UnstakeParams }
  | { action: "wrap"; params: WrapParams }
  | { action: "unwrap"; params: WrapParams }
  | { action: "swap"; params: SwapParams }
  | { action: "claim"; params: ClaimParams };

// ============================================================================
// Transaction Step (single tx in a plan)
// ============================================================================

export interface TransactionStep {
  id: string;
  action: TransactionAction;
  protocol: string;
  chainId: number;
  description: string;

  // Raw transaction data
  to: Address;
  data: Hex;
  value: bigint;

  // Metadata for display
  tokenIn?: {
    address: Address;
    symbol: string;
    amount: bigint;
    decimals: number;
  };
  tokenOut?: {
    address: Address;
    symbol: string;
    amount: bigint;
    decimals: number;
  };

  // Gas estimate (before simulation)
  estimatedGas?: bigint;

  // Link to strategy block that generated this
  sourceBlockId?: string;

  // Approval status (for approve actions)
  approvalStatus?: {
    isApproved: boolean;
    currentAllowance: bigint;
    requiredAmount: bigint;
    /** Step can be skipped due to existing approval */
    canSkip: boolean;
  };
}

// ============================================================================
// Transaction Plan (ordered list of steps)
// ============================================================================

export interface TransactionPlan {
  id: string;
  chainId: number;
  fromAddress: Address;
  steps: TransactionStep[];

  // Summary
  totalSteps: number;
  estimatedTotalGas: bigint;
  estimatedTotalGasUsd: number;

  // Source
  strategyId?: string;
  strategyName?: string;

  // Timestamps
  createdAt: number;
  expiresAt: number; // Plans expire after price changes
}

// ============================================================================
// Tenderly Simulation Types
// ============================================================================

export interface SimulationRequest {
  chainId: number;
  from: Address;
  transactions: Array<{
    to: Address;
    data: Hex;
    value: string; // Hex string
  }>;
  blockNumber?: number;
  stateOverrides?: Record<Address, StateOverride>;
}

export interface StateOverride {
  balance?: string;
  nonce?: number;
  code?: Hex;
  storage?: Record<string, string>;
}

// ============================================================================
// Simulation Results
// ============================================================================

export interface TokenBalanceChange {
  token: Address;
  symbol: string;
  decimals: number;
  before: bigint;
  after: bigint;
  change: bigint;
  changeUsd: number;
}

export interface SimulationStepResult {
  stepId: string;
  success: boolean;
  gasUsed: bigint;
  gasPrice: bigint;
  gasCostWei: bigint;
  gasCostUsd: number;

  // Decoded events/logs
  logs: DecodedLog[];

  // Balance changes from this step
  balanceChanges: TokenBalanceChange[];

  // Error if failed
  error?: string;
  revertReason?: string;
}

export interface DecodedLog {
  address: Address;
  name: string;
  args: Record<string, unknown>;
  raw: {
    topics: Hex[];
    data: Hex;
  };
}

export interface TenderlySimulationResult {
  // Overall result
  success: boolean;
  totalGasUsed: bigint;
  totalGasCostUsd: number;

  // Per-step results
  steps: SimulationStepResult[];

  // Net balance changes across all steps
  netBalanceChanges: TokenBalanceChange[];

  // Warnings (non-fatal issues)
  warnings: string[];

  // If any step failed
  failedAtStep?: number;
  errorMessage?: string;

  // Tenderly-specific
  simulationId?: string;
  simulationUrl?: string; // Link to view in Tenderly dashboard
}

// ============================================================================
// Transaction Execution Status
// ============================================================================

export type TransactionStatus =
  | "pending" // Awaiting user signature
  | "submitted" // Sent to network
  | "confirming" // Awaiting confirmations
  | "confirmed" // Successfully confirmed
  | "failed" // Reverted or dropped
  | "cancelled"; // User cancelled

export interface ExecutedTransaction {
  stepId: string;
  hash: Hash;
  status: TransactionStatus;
  confirmations: number;
  blockNumber?: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  error?: string;
  timestamp: number;
}

export interface TransactionPlanExecution {
  planId: string;
  status: "idle" | "executing" | "completed" | "failed" | "partial";
  currentStep: number;
  transactions: ExecutedTransaction[];
  startedAt?: number;
  completedAt?: number;
}

// ============================================================================
// Transaction Builder Input (from strategy)
// ============================================================================

export interface StrategyExecutionInput {
  strategyId: string;
  blocks: Array<{
    id: string;
    type: BlockType;
    protocol?: string;
    chainId: number;
    params: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    flowPercent: number;
  }>;
  inputAmount: bigint;
  inputAsset: AssetType;
  walletAddress: Address;
}

// ============================================================================
// Gas Price Info
// ============================================================================

export interface GasPriceInfo {
  chainId: number;
  baseFee: bigint;
  maxPriorityFee: bigint;
  maxFee: bigint;
  ethPriceUsd: number;
  timestamp: number;
}
