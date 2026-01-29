/**
 * DeFi Strategy Builder - Simulation Engine
 *
 * Calculates yields, risks, and projections for a strategy.
 * Processes blocks in topological order to simulate flow through the strategy.
 */

import type {
  StrategyBlock,
  StrategyEdge,
  StrategyEdgeData,
  SimulationResult,
  RiskLevel,
  YieldSource,
  InputBlockData,
  StakeBlockData,
  LendBlockData,
  BorrowBlockData,
  SwapBlockData,
  AssetType,
  ComputedBlockValue,
} from "./types";
import {
  getStakingProtocol,
  getLendingProtocol,
  getLendingMarket,
  getDefaultApy,
  GAS_COSTS,
} from "./protocols";

// ============================================================================
// Types
// ============================================================================

interface BlockState {
  value: number; // USD value at this block (output)
  asset: string; // Output asset
  apy: number; // Cumulative APY at this point
  leverage: number;
  isCollateral: boolean;
  healthFactor: number | null;
  liquidationPrice: number | null;
  // For value propagation display
  inputAsset: string | null;
  inputAmount: number;
  inputValueUsd: number;
  outputAmount: number;
  gasCostUsd: number;
}

interface SimulationContext {
  initialValue: number;
  blockStates: Map<string, BlockState>;
  yieldSources: YieldSource[];
  totalGasCost: number;
  protocolFees: number;
  riskScore: number;
  leverage: number;
  healthFactor: number | null;
  liquidationPrice: number | null;
}

// ============================================================================
// Constants
// ============================================================================

const ETH_PRICE = 3300; // Demo price - would fetch from API in production

// ============================================================================
// Graph Utilities
// ============================================================================

/**
 * Build adjacency list from edges
 */
function buildAdjacencyList(
  edges: StrategyEdge[]
): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  for (const edge of edges) {
    const sources = adj.get(edge.source) ?? [];
    sources.push(edge.target);
    adj.set(edge.source, sources);
  }

  return adj;
}

/**
 * Build reverse adjacency (incoming edges)
 */
function buildReverseAdjacency(
  edges: StrategyEdge[]
): Map<string, string[]> {
  const adj = new Map<string, string[]>();

  for (const edge of edges) {
    const targets = adj.get(edge.target) ?? [];
    targets.push(edge.source);
    adj.set(edge.target, targets);
  }

  return adj;
}

/**
 * Get the flow percent for an edge (default 100%)
 */
function getEdgeFlowPercent(edges: StrategyEdge[], sourceId: string, targetId: string): number {
  const edge = edges.find(e => e.source === sourceId && e.target === targetId);
  if (!edge) return 100;
  const data = edge.data as StrategyEdgeData | undefined;
  return data?.flowPercent ?? 100;
}

/**
 * Detect if graph has cycles using DFS
 */
function hasCycle(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): boolean {
  const adj = buildAdjacencyList(edges);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adj.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const block of blocks) {
    if (!visited.has(block.id)) {
      if (dfs(block.id)) return true;
    }
  }

  return false;
}

/**
 * Topological sort of blocks (Kahn's algorithm)
 * Only works on acyclic graphs
 */
function topologicalSort(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): StrategyBlock[] {
  const inDegree = new Map<string, number>();
  const adj = buildAdjacencyList(edges);

  // Initialize in-degrees
  for (const block of blocks) {
    inDegree.set(block.id, 0);
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sorted: StrategyBlock[] = [];
  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  while (queue.length > 0) {
    const id = queue.shift()!;
    const block = blockMap.get(id);
    if (block) {
      sorted.push(block);
    }

    const neighbors = adj.get(id) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted;
}

// ============================================================================
// Block Processors
// ============================================================================

function processInputBlock(
  block: StrategyBlock,
  ctx: SimulationContext
): BlockState {
  const data = block.data as InputBlockData;
  const value = data.asset === "ETH" ? data.amount * ETH_PRICE : data.amount;
  ctx.initialValue = value;

  return {
    value,
    asset: data.asset,
    apy: 0,
    leverage: 1,
    isCollateral: false,
    healthFactor: null,
    liquidationPrice: null,
    // Value propagation
    inputAsset: null,
    inputAmount: 0,
    inputValueUsd: 0,
    outputAmount: data.amount,
    gasCostUsd: 0,
  };
}

function processStakeBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as StakeBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  let inputValue = 0;
  let inputLeverage = 1;
  let inputAsset: string | null = null;
  let inputAmount = 0;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState) {
      // Apply edge flow percentage
      const flowPercent = getEdgeFlowPercent(edges, inputId, block.id);
      const flowMultiplier = flowPercent / 100;

      inputValue += inputState.value * flowMultiplier;
      inputLeverage = Math.max(inputLeverage, inputState.leverage);
      inputAsset = inputState.asset;
      inputAmount += inputState.outputAmount * flowMultiplier;
    }
  }

  const protocol = getStakingProtocol(data.protocol);
  const apy = data.apy ?? getDefaultApy(data.protocol);
  const gasCost = GAS_COSTS.stake;

  ctx.yieldSources.push({
    protocol: protocol?.name ?? data.protocol,
    type: "stake",
    apy,
    weight: ctx.initialValue > 0 ? (inputValue / ctx.initialValue) * 100 : 100,
  });

  ctx.totalGasCost += gasCost;
  ctx.riskScore += (protocol?.riskScore ?? 30) * 0.3;

  // Output amount is roughly 1:1 for staking (minus small gas)
  const outputValue = inputValue - gasCost;
  const outputAmount = inputAmount; // LSTs are ~1:1 with ETH

  return {
    value: outputValue,
    asset: data.outputAsset,
    apy,
    leverage: inputLeverage,
    isCollateral: false,
    healthFactor: null,
    liquidationPrice: null,
    // Value propagation
    inputAsset,
    inputAmount,
    inputValueUsd: inputValue,
    outputAmount,
    gasCostUsd: gasCost,
  };
}

function processLendBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as LendBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  let inputValue = 0;
  let inputAsset = "ETH";
  let inputLeverage = 1;
  let inputApy = 0;
  let inputAmount = 0;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState) {
      // Apply edge flow percentage
      const flowPercent = getEdgeFlowPercent(edges, inputId, block.id);
      const flowMultiplier = flowPercent / 100;

      inputValue += inputState.value * flowMultiplier;
      inputAsset = inputState.asset;
      inputLeverage = Math.max(inputLeverage, inputState.leverage);
      inputApy = Math.max(inputApy, inputState.apy);
      inputAmount += inputState.outputAmount * flowMultiplier;
    }
  }

  const protocol = getLendingProtocol(data.protocol);
  const market = getLendingMarket(data.protocol, inputAsset as AssetType, data.chain);
  const supplyApy = data.supplyApy ?? market?.supplyApy ?? getDefaultApy(`${data.protocol}:${inputAsset.toLowerCase()}`);
  const gasCost = GAS_COSTS.lend;

  ctx.yieldSources.push({
    protocol: protocol?.name ?? data.protocol,
    type: "supply",
    apy: supplyApy,
    weight: ctx.initialValue > 0 ? (inputValue / ctx.initialValue) * 100 : 100,
  });

  ctx.totalGasCost += gasCost;
  ctx.riskScore += (protocol?.riskScore ?? 20) * 0.25;

  const outputValue = inputValue - gasCost;

  return {
    value: outputValue,
    asset: inputAsset,
    apy: inputApy + supplyApy,
    leverage: inputLeverage,
    isCollateral: true,
    healthFactor: 999,
    liquidationPrice: null,
    // Value propagation
    inputAsset,
    inputAmount,
    inputValueUsd: inputValue,
    outputAmount: inputAmount, // Collateral is same amount
    gasCostUsd: gasCost,
  };
}

function processBorrowBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as BorrowBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  let collateralValue = 0;
  let inputApy = 0;
  let inputLeverage = 1;
  let inputAsset: string | null = null;
  let inputAmount = 0;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState && inputState.isCollateral) {
      // Apply edge flow percentage
      const flowPercent = getEdgeFlowPercent(edges, inputId, block.id);
      const flowMultiplier = flowPercent / 100;

      collateralValue += inputState.value * flowMultiplier;
      inputApy = inputState.apy;
      inputLeverage = inputState.leverage;
      inputAsset = inputState.asset;
      inputAmount += inputState.outputAmount * flowMultiplier;
    }
  }

  const borrowValue = collateralValue * (data.ltvPercent / 100);
  const borrowApy = data.borrowApy ?? getDefaultApy(`aave-v3:${data.asset.toLowerCase()}:borrow`);
  const gasCost = GAS_COSTS.borrow;

  ctx.yieldSources.push({
    protocol: "Borrow",
    type: "borrow",
    apy: -borrowApy,
    weight: ctx.initialValue > 0 ? (borrowValue / ctx.initialValue) * 100 : 100,
  });

  const liqThreshold = 0.825;
  const healthFactor = borrowValue > 0 ? (collateralValue * liqThreshold) / borrowValue : Infinity;
  const liquidationPrice = ETH_PRICE * (borrowValue / (collateralValue * liqThreshold));

  const newLeverage = ctx.initialValue > 0
    ? inputLeverage + (borrowValue / ctx.initialValue)
    : inputLeverage;
  ctx.leverage = Math.max(ctx.leverage, newLeverage);

  ctx.healthFactor = ctx.healthFactor === null
    ? healthFactor
    : Math.min(ctx.healthFactor, healthFactor);
  ctx.liquidationPrice = liquidationPrice;

  ctx.totalGasCost += gasCost;

  if (data.ltvPercent >= 80) ctx.riskScore += 30;
  else if (data.ltvPercent >= 70) ctx.riskScore += 20;
  else if (data.ltvPercent >= 60) ctx.riskScore += 10;

  // Calculate borrowed amount in the borrowed asset
  const borrowedAmount = data.asset === "ETH" ? borrowValue / ETH_PRICE : borrowValue;

  return {
    value: borrowValue,
    asset: data.asset,
    apy: inputApy - borrowApy,
    leverage: newLeverage,
    isCollateral: false,
    healthFactor,
    liquidationPrice,
    // Value propagation
    inputAsset,
    inputAmount,
    inputValueUsd: collateralValue,
    outputAmount: borrowedAmount,
    gasCostUsd: gasCost,
  };
}

function processSwapBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as SwapBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  let inputValue = 0;
  let inputApy = 0;
  let inputLeverage = 1;
  let inputAsset: string | null = null;
  let inputAmount = 0;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState) {
      // Apply edge flow percentage
      const flowPercent = getEdgeFlowPercent(edges, inputId, block.id);
      const flowMultiplier = flowPercent / 100;

      inputValue += inputState.value * flowMultiplier;
      inputApy = inputState.apy;
      inputLeverage = inputState.leverage;
      inputAsset = inputState.asset;
      inputAmount += inputState.outputAmount * flowMultiplier;
    }
  }

  const gasCost = GAS_COSTS.swap;
  const outputValue = inputValue * (1 - data.slippage / 100) - gasCost;
  ctx.protocolFees += inputValue * 0.003;
  ctx.totalGasCost += gasCost;

  // Calculate output amount in the target asset
  const outputAmount = data.toAsset === "ETH" ? outputValue / ETH_PRICE : outputValue;

  return {
    value: outputValue,
    asset: data.toAsset,
    apy: inputApy,
    leverage: inputLeverage,
    isCollateral: false,
    healthFactor: null,
    liquidationPrice: null,
    // Value propagation
    inputAsset,
    inputAmount,
    inputValueUsd: inputValue,
    outputAmount,
    gasCostUsd: gasCost,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createErrorResult(message: string): SimulationResult {
  return {
    isValid: false,
    errorMessage: message,
    grossApy: 0,
    netApy: 0,
    initialValue: 0,
    projectedValue1Y: 0,
    projectedYield1Y: 0,
    gasCostUsd: 0,
    protocolFees: 0,
    riskLevel: "low",
    riskScore: 0,
    liquidationPrice: null,
    healthFactor: null,
    maxDrawdown: 0,
    leverage: 1,
    yieldSources: [],
    blockValues: {},
  };
}

// ============================================================================
// Main Simulation Function
// ============================================================================

/**
 * Run simulation on a strategy
 * Processes blocks in topological order to simulate flow
 */
export function simulateStrategy(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): SimulationResult {
  // Validate strategy
  if (blocks.length === 0) {
    return createErrorResult("Strategy has no blocks");
  }

  const hasInput = blocks.some((b) => b.type === "input");
  if (!hasInput) {
    return createErrorResult("Strategy needs an Input block");
  }

  // Check for cycles (not supported - duplicate blocks manually for leverage)
  if (hasCycle(blocks, edges)) {
    return createErrorResult("Strategy contains a cycle. For leverage loops, duplicate blocks instead of connecting back.");
  }

  // Process blocks in topological order
  try {
    const sortedBlocks = topologicalSort(blocks, edges);

    const ctx: SimulationContext = {
      initialValue: 0,
      blockStates: new Map(),
      yieldSources: [],
      totalGasCost: 0,
      protocolFees: 0,
      riskScore: 0,
      leverage: 1,
      healthFactor: null,
      liquidationPrice: null,
    };

    for (const block of sortedBlocks) {
      let state: BlockState;

      switch (block.type) {
        case "input":
          state = processInputBlock(block, ctx);
          break;
        case "stake":
          state = processStakeBlock(block, ctx, edges);
          break;
        case "lend":
          state = processLendBlock(block, ctx, edges);
          break;
        case "borrow":
          state = processBorrowBlock(block, ctx, edges);
          break;
        case "swap":
          state = processSwapBlock(block, ctx, edges);
          break;
        default:
          state = {
            value: 0,
            asset: "ETH",
            apy: 0,
            leverage: 1,
            isCollateral: false,
            healthFactor: null,
            liquidationPrice: null,
            inputAsset: null,
            inputAmount: 0,
            inputValueUsd: 0,
            outputAmount: 0,
            gasCostUsd: 0,
          };
      }

      ctx.blockStates.set(block.id, state);
    }

    // Calculate total APY
    const grossApy = ctx.yieldSources.reduce((sum, s) => sum + s.apy * (s.weight / 100), 0);

    // Net APY after costs
    const gasCostAsPercent = ctx.initialValue > 0
      ? (ctx.totalGasCost / ctx.initialValue) * 100
      : 0;
    const feesAsPercent = ctx.initialValue > 0
      ? (ctx.protocolFees / ctx.initialValue) * 100
      : 0;
    const netApy = grossApy - gasCostAsPercent - feesAsPercent;

    // Projections
    const projectedValue1Y = ctx.initialValue * (1 + netApy / 100);
    const projectedYield1Y = projectedValue1Y - ctx.initialValue;

    // Risk level
    let riskLevel: RiskLevel = "low";
    if (ctx.riskScore >= 70 || ctx.leverage >= 4) riskLevel = "extreme";
    else if (ctx.riskScore >= 50 || ctx.leverage >= 3) riskLevel = "high";
    else if (ctx.riskScore >= 30 || ctx.leverage >= 2) riskLevel = "medium";

    const maxDrawdown = ctx.leverage > 1
      ? Math.min(100, 20 * ctx.leverage)
      : 10;

    // Convert blockStates to blockValues for UI display
    const blockValues: Record<string, ComputedBlockValue> = {};
    for (const [blockId, state] of ctx.blockStates) {
      blockValues[blockId] = {
        inputAsset: state.inputAsset as AssetType | null,
        inputAmount: state.inputAmount,
        inputValueUsd: state.inputValueUsd,
        outputAsset: state.asset as AssetType,
        outputAmount: state.outputAmount,
        outputValueUsd: state.value,
        gasCostUsd: state.gasCostUsd,
        apy: state.apy,
      };
    }

    return {
      isValid: true,
      grossApy,
      netApy,
      initialValue: ctx.initialValue,
      projectedValue1Y,
      projectedYield1Y: ctx.initialValue > 0 ? projectedYield1Y / ctx.initialValue : 0,
      gasCostUsd: ctx.totalGasCost,
      protocolFees: ctx.protocolFees,
      riskLevel,
      riskScore: Math.min(100, ctx.riskScore),
      liquidationPrice: ctx.liquidationPrice,
      healthFactor: ctx.healthFactor,
      maxDrawdown,
      leverage: ctx.leverage,
      yieldSources: ctx.yieldSources,
      blockValues,
    };
  } catch (error) {
    return createErrorResult(error instanceof Error ? error.message : "Simulation failed");
  }
}
