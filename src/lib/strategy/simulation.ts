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
  ethPrice: number;
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

// Default ETH price as fallback - will be overridden by live price
const DEFAULT_ETH_PRICE = 2700;

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
 * Detect cycles and return info about the loop
 */
interface LoopInfo {
  hasCycle: boolean;
  loopBackEdge: StrategyEdge | null; // The edge that creates the cycle
  ltv: number; // LTV from the borrow block in the loop
  borrowBlockId: string | null;
}

function detectLoop(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): LoopInfo {
  const adj = buildAdjacencyList(edges);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const parent = new Map<string, string>();
  let loopBackEdge: StrategyEdge | null = null;
  let cycleEnd: string | null = null;

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adj.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        parent.set(neighbor, nodeId);
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        // Found cycle - the edge from nodeId to neighbor creates it
        loopBackEdge = edges.find(e => e.source === nodeId && e.target === neighbor) || null;
        cycleEnd = neighbor;
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const block of blocks) {
    if (!visited.has(block.id)) {
      if (dfs(block.id)) break;
    }
  }

  if (!loopBackEdge) {
    return { hasCycle: false, loopBackEdge: null, ltv: 0, borrowBlockId: null };
  }

  // Find the borrow block in the cycle to get the LTV
  // Look through all blocks to find a borrow block (simpler approach)
  const borrowBlock = blocks.find(b => b.type === "borrow");

  const ltv = borrowBlock
    ? (borrowBlock.data as BorrowBlockData).ltvPercent / 100
    : 0.7; // Default 70% if not found

  return {
    hasCycle: true,
    loopBackEdge,
    ltv,
    borrowBlockId: borrowBlock?.id || null,
  };
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
  const value = data.asset === "ETH" ? data.amount * ctx.ethPrice : data.amount;
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
  // Protocol risk is tracked once per unique protocol, not per block
  // This is handled at the end of simulation

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
  // Protocol risk is tracked once per unique protocol, not per block

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
  edges: StrategyEdge[],
  blocks: StrategyBlock[]
): BlockState {
  const data = block.data as BorrowBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  let collateralValue = 0;
  let inputApy = 0;
  let inputLeverage = 1;
  let inputAsset: string | null = null;
  let inputAmount = 0;
  let inputLiquidationThreshold = 0;

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

      // Get liquidation threshold from the lend block
      const lendBlock = blocks.find(b => b.id === inputId);
      if (lendBlock?.type === "lend") {
        const lendData = lendBlock.data as LendBlockData;
        inputLiquidationThreshold = lendData.liquidationThreshold ?? 82.5;
      }
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

  // Get liquidation threshold from the upstream lend block if available
  // Default to 82.5% which is typical for LSTs on Aave
  const liqThreshold = inputLiquidationThreshold > 0 ? inputLiquidationThreshold / 100 : 0.825;
  const healthFactor = borrowValue > 0 ? (collateralValue * liqThreshold) / borrowValue : Infinity;
  const liquidationPrice = ctx.ethPrice * (borrowValue / (collateralValue * liqThreshold));

  const newLeverage = ctx.initialValue > 0
    ? inputLeverage + (borrowValue / ctx.initialValue)
    : inputLeverage;
  ctx.leverage = Math.max(ctx.leverage, newLeverage);

  ctx.healthFactor = ctx.healthFactor === null
    ? healthFactor
    : Math.min(ctx.healthFactor, healthFactor);
  ctx.liquidationPrice = liquidationPrice;

  ctx.totalGasCost += gasCost;

  // Track max LTV for risk calculation at the end (not accumulated per block)
  // Risk score will be calculated based on overall strategy characteristics

  // Calculate borrowed amount in the borrowed asset
  const borrowedAmount = data.asset === "ETH" ? borrowValue / ctx.ethPrice : borrowValue;

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
  const outputAmount = data.toAsset === "ETH" ? outputValue / ctx.ethPrice : outputValue;

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
  edges: StrategyEdge[],
  ethPrice: number = DEFAULT_ETH_PRICE
): SimulationResult {
  // Validate strategy
  if (blocks.length === 0) {
    return createErrorResult("Strategy has no blocks");
  }

  const hasInput = blocks.some((b) => b.type === "input");
  if (!hasInput) {
    return createErrorResult("Strategy needs an Input block");
  }

  // Check for cycles - if found, handle as a leverage loop
  const loopInfo = detectLoop(blocks, edges);

  // If there's a cycle, we'll process it as a leverage loop
  // Remove the loop-back edge for topological processing
  const processedEdges = loopInfo.hasCycle && loopInfo.loopBackEdge
    ? edges.filter(e => e.id !== loopInfo.loopBackEdge!.id)
    : edges;

  // Process blocks in topological order (using edges without loop-back for sorting)
  try {
    const sortedBlocks = topologicalSort(blocks, processedEdges);

    const ctx: SimulationContext = {
      initialValue: 0,
      ethPrice,
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
          state = processBorrowBlock(block, ctx, edges, blocks);
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

    // If this is a leverage loop, calculate the effective leverage multiplier
    // Leverage loop formula: with LTV = r, effective leverage = 1 / (1 - r)
    // This multiplies all yields (both positive and negative)
    let loopLeverage = 1;
    if (loopInfo.hasCycle && loopInfo.ltv > 0) {
      loopLeverage = 1 / (1 - loopInfo.ltv);

      // Apply leverage multiplier to yield sources
      // Stake/supply yields are multiplied by leverage
      // Borrow costs are also multiplied (they increase with more iterations)
      ctx.yieldSources = ctx.yieldSources.map(source => ({
        ...source,
        weight: source.weight * loopLeverage,
      }));

      // Update the context leverage
      ctx.leverage = Math.max(ctx.leverage, loopLeverage);

      // Recalculate health factor for the leveraged position
      // With leverage L and LTV r: HF = liquidation_threshold / (r * L / L) = LT / r
      // More simply: as you loop, HF approaches LT / r
      const liquidationThreshold = 0.825; // Typical for LSTs on Aave
      const effectiveHF = liquidationThreshold / loopInfo.ltv;
      ctx.healthFactor = effectiveHF;

      // Liquidation price: current_price * (1 - margin_of_safety)
      // Where margin_of_safety = (HF - 1) / HF
      const marginOfSafety = (effectiveHF - 1) / effectiveHF;
      ctx.liquidationPrice = ctx.ethPrice * (1 - marginOfSafety);

      // Add risk for leverage loops
      ctx.riskScore += Math.min(40, loopLeverage * 10);
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

    // Calculate risk score based on overall strategy characteristics
    // 1. Health factor risk (most important)
    let riskScore = 0;
    if (ctx.healthFactor !== null) {
      if (ctx.healthFactor < 1.1) riskScore += 50;
      else if (ctx.healthFactor < 1.25) riskScore += 35;
      else if (ctx.healthFactor < 1.5) riskScore += 20;
      else if (ctx.healthFactor < 2.0) riskScore += 10;
    }

    // 2. Leverage risk
    if (ctx.leverage >= 5) riskScore += 30;
    else if (ctx.leverage >= 3) riskScore += 20;
    else if (ctx.leverage >= 2) riskScore += 10;

    // 3. Unique protocols (more protocols = more smart contract risk)
    const uniqueProtocols = new Set(ctx.yieldSources.map(s => s.protocol)).size;
    if (uniqueProtocols >= 4) riskScore += 15;
    else if (uniqueProtocols >= 2) riskScore += 5;

    ctx.riskScore = Math.min(100, riskScore);

    // Risk level based on health factor primarily
    let riskLevel: RiskLevel = "low";
    if (ctx.healthFactor !== null && ctx.healthFactor < 1.15) riskLevel = "extreme";
    else if (ctx.healthFactor !== null && ctx.healthFactor < 1.3) riskLevel = "high";
    else if (ctx.leverage >= 4 || riskScore >= 60) riskLevel = "extreme";
    else if (ctx.leverage >= 2.5 || riskScore >= 40) riskLevel = "high";
    else if (ctx.leverage >= 1.5 || riskScore >= 20) riskLevel = "medium";

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
