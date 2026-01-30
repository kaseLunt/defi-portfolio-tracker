/**
 * DeFi Strategy Builder - Type Definitions
 *
 * Types for blocks, edges, strategies, and simulation results.
 */

import type { Node, Edge } from "@xyflow/react";

// ============================================================================
// Block Types
// ============================================================================

export type BlockType =
  | "input"
  | "stake"
  | "lend"
  | "borrow"
  | "swap"
  | "lp"
  | "loop"
  | "auto-wrap";

export type AssetType = "ETH" | "USDC" | "USDT" | "DAI" | "stETH" | "eETH" | "weETH" | "wstETH" | "rETH" | "cbETH" | "sfrxETH";

export type StakeProtocol = "lido" | "etherfi" | "rocketpool" | "frax" | "coinbase";
export type LendProtocol = "aave-v3" | "compound-v3" | "morpho" | "spark";

// ============================================================================
// Base Block Data (shared fields)
// ============================================================================

export interface BaseBlockData {
  label: string;
  icon?: string;
  isConfigured: boolean;
  isValid: boolean;
  errorMessage?: string;
  [key: string]: unknown; // Allow index signature for React Flow compatibility
}

// ============================================================================
// Block Data
// ============================================================================

export interface InputBlockData extends BaseBlockData {
  type: "input";
  asset: AssetType;
  amount: number;
}

export interface StakeBlockData extends BaseBlockData {
  type: "stake";
  protocol: StakeProtocol;
  inputAsset: AssetType;
  outputAsset: AssetType;
  apy: number | null; // Fetched from DefiLlama
}

export interface LendBlockData extends BaseBlockData {
  type: "lend";
  protocol: LendProtocol;
  chain: number;
  supplyApy: number | null;
  maxLtv: number;
  liquidationThreshold: number;
}

export interface BorrowBlockData extends BaseBlockData {
  type: "borrow";
  asset: AssetType;
  ltvPercent: number; // User configurable (e.g., 75%)
  borrowApy: number | null; // Fetched (negative yield)
}

export interface SwapBlockData extends BaseBlockData {
  type: "swap";
  fromAsset: AssetType;
  toAsset: AssetType;
  slippage: number; // Default 0.5%
  estimatedOutput: number | null;
}

export interface LoopBlockData extends BaseBlockData {
  type: "loop";
  iterations: number; // 2-5x leverage
  targetLtv: number;
}

export type BlockData =
  | InputBlockData
  | StakeBlockData
  | LendBlockData
  | BorrowBlockData
  | SwapBlockData
  | LoopBlockData;

// ============================================================================
// Strategy Block (React Flow Node)
// ============================================================================

export type StrategyBlock = Node<BlockData, BlockType>;

// ============================================================================
// Strategy Edge (React Flow Edge)
// ============================================================================

export interface StrategyEdgeData {
  asset?: AssetType;
  amount?: number;
  label?: string;
  flowPercent: number; // 0-100, default 100
  flowAmount?: number; // Calculated based on source block
  [key: string]: unknown;
}

export type StrategyEdge = Edge<StrategyEdgeData>;

// ============================================================================
// Strategy
// ============================================================================

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  blocks: StrategyBlock[];
  edges: StrategyEdge[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Simulation Results
// ============================================================================

export type RiskLevel = "low" | "medium" | "high" | "extreme";

export interface YieldSource {
  protocol: string;
  type: "supply" | "borrow" | "stake" | "lp";
  apy: number;
  weight: number; // Contribution to total
}

export interface SimulationResult {
  // Is simulation valid?
  isValid: boolean;
  errorMessage?: string;

  // Yields
  grossApy: number; // Before costs
  netApy: number; // After costs

  // Projections
  initialValue: number;
  projectedValue1Y: number;
  projectedYield1Y: number;

  // Costs
  gasCostUsd: number;
  protocolFees: number;

  // Risk metrics
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  liquidationPrice: number | null;
  healthFactor: number | null;
  maxDrawdown: number;
  leverage: number;

  // Breakdown
  yieldSources: YieldSource[];

  // Per-block computed values (for value propagation display)
  blockValues: Record<string, ComputedBlockValue>;
}

// ============================================================================
// Computed Block Values (for value propagation)
// ============================================================================

export interface ComputedBlockValue {
  inputAsset: AssetType | null;
  inputAmount: number;
  inputValueUsd: number;
  outputAsset: AssetType | null;
  outputAmount: number;
  outputValueUsd: number;
  gasCostUsd: number;
  apy: number;
}

// ============================================================================
// Protocol Data
// ============================================================================

export interface ProtocolYield {
  protocol: string;
  chain: string;
  chainId: number;
  asset: string;
  symbol: string;
  supplyApy: number;
  borrowApy?: number;
  tvl: number;
  ltv?: number;
  liquidationThreshold?: number;
}

export interface StakeProtocolInfo {
  id: StakeProtocol;
  name: string;
  inputAsset: AssetType;
  outputAsset: AssetType;
  apy: number | null;
  tvl: number;
  logo: string;
}

export interface LendProtocolInfo {
  id: LendProtocol;
  name: string;
  markets: ProtocolYield[];
  logo: string;
}

// ============================================================================
// Template
// ============================================================================

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  estimatedApy: string; // e.g., "3-4%"
  blocks: Partial<StrategyBlock>[];
  edges: Partial<StrategyEdge>[];
  tags: string[];
}

// ============================================================================
// Saved Systems (User-created reusable loops)
// ============================================================================

export interface SavedSystem {
  id: string;
  name: string;
  description?: string;
  blocks: StrategyBlock[]; // Positions relative to first block
  edges: StrategyEdge[];
  blockCount: number;
  createdAt: number;
  updatedAt: number;
}
