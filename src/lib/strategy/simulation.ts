/**
 * DeFi Strategy Builder - Simulation Engine
 *
 * Calculates yields, risks, and projections for a strategy.
 * Uses topological sort to process blocks in correct order.
 */

import type {
  StrategyBlock,
  StrategyEdge,
  SimulationResult,
  RiskLevel,
  YieldSource,
  InputBlockData,
  StakeBlockData,
  LendBlockData,
  BorrowBlockData,
  SwapBlockData,
  AssetType,
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
  value: number; // USD value at this block
  asset: string;
  apy: number; // Cumulative APY at this point
  leverage: number;
  isCollateral: boolean;
  healthFactor: number | null;
  liquidationPrice: number | null;
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
 * Topological sort of blocks (Kahn's algorithm)
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

  // Check for cycles
  if (sorted.length !== blocks.length) {
    throw new Error("Strategy contains cycles - invalid configuration");
  }

  return sorted;
}

// ============================================================================
// Block Processors
// ============================================================================

/**
 * Process Input block
 */
function processInputBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _edges: StrategyEdge[]
): BlockState {
  const data = block.data as InputBlockData;

  // Assume ETH = $3300 for demo (would fetch from API)
  const ETH_PRICE = 3300;
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
  };
}

/**
 * Process Stake block
 */
function processStakeBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as StakeBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  // Get input state
  let inputValue = 0;
  let inputLeverage = 1;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState) {
      inputValue += inputState.value;
      inputLeverage = Math.max(inputLeverage, inputState.leverage);
    }
  }

  // Get staking APY
  const protocol = getStakingProtocol(data.protocol);
  const apy = data.apy ?? getDefaultApy(data.protocol);

  // Add yield source
  ctx.yieldSources.push({
    protocol: protocol?.name ?? data.protocol,
    type: "stake",
    apy,
    weight: (inputValue / ctx.initialValue) * 100,
  });

  // Add gas cost
  ctx.totalGasCost += GAS_COSTS.stake;

  // Add protocol risk
  ctx.riskScore += (protocol?.riskScore ?? 30) * 0.3;

  return {
    value: inputValue, // Value stays same, just converted to LST
    asset: data.outputAsset,
    apy,
    leverage: inputLeverage,
    isCollateral: false,
    healthFactor: null,
    liquidationPrice: null,
  };
}

/**
 * Process Lend block
 */
function processLendBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as LendBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  // Get input state
  let inputValue = 0;
  let inputAsset = "ETH";
  let inputLeverage = 1;
  let inputApy = 0;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState) {
      inputValue += inputState.value;
      inputAsset = inputState.asset;
      inputLeverage = Math.max(inputLeverage, inputState.leverage);
      inputApy = Math.max(inputApy, inputState.apy);
    }
  }

  // Get lending APY
  const protocol = getLendingProtocol(data.protocol);
  const market = getLendingMarket(data.protocol, inputAsset as AssetType, data.chain);
  const supplyApy = data.supplyApy ?? market?.supplyApy ?? getDefaultApy(`${data.protocol}:${inputAsset.toLowerCase()}`);

  // Add yield source
  ctx.yieldSources.push({
    protocol: protocol?.name ?? data.protocol,
    type: "supply",
    apy: supplyApy,
    weight: (inputValue / ctx.initialValue) * 100,
  });

  // Add gas cost
  ctx.totalGasCost += GAS_COSTS.lend;

  // Add protocol risk
  ctx.riskScore += (protocol?.riskScore ?? 20) * 0.25;

  return {
    value: inputValue,
    asset: inputAsset,
    apy: inputApy + supplyApy,
    leverage: inputLeverage,
    isCollateral: true,
    healthFactor: 999, // Will be calculated when borrow is added
    liquidationPrice: null,
  };
}

/**
 * Process Borrow block
 */
function processBorrowBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as BorrowBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  // Get input state (should be from Lend block)
  let collateralValue = 0;
  let inputApy = 0;
  let inputLeverage = 1;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState && inputState.isCollateral) {
      collateralValue += inputState.value;
      inputApy = inputState.apy;
      inputLeverage = inputState.leverage;
    }
  }

  // Calculate borrow amount
  const borrowValue = collateralValue * (data.ltvPercent / 100);

  // Get borrow APY (negative yield)
  const borrowApy = data.borrowApy ?? getDefaultApy(`aave-v3:${data.asset.toLowerCase()}:borrow`);

  // Add yield source (negative)
  ctx.yieldSources.push({
    protocol: "Borrow",
    type: "borrow",
    apy: -borrowApy,
    weight: (borrowValue / ctx.initialValue) * 100,
  });

  // Calculate health factor
  // Health = (Collateral * Liq Threshold) / Debt
  const liqThreshold = 0.825; // Default for most protocols
  const healthFactor = (collateralValue * liqThreshold) / borrowValue;

  // Calculate liquidation price
  // Price where health factor = 1
  const ETH_PRICE = 3300;
  const liquidationPrice = ETH_PRICE * (borrowValue / (collateralValue * liqThreshold));

  // Update leverage
  const newLeverage = inputLeverage + (borrowValue / ctx.initialValue);
  ctx.leverage = Math.max(ctx.leverage, newLeverage);

  // Update health factor
  ctx.healthFactor = ctx.healthFactor === null
    ? healthFactor
    : Math.min(ctx.healthFactor, healthFactor);
  ctx.liquidationPrice = liquidationPrice;

  // Add gas cost
  ctx.totalGasCost += GAS_COSTS.borrow;

  // Add risk based on LTV
  if (data.ltvPercent >= 80) ctx.riskScore += 30;
  else if (data.ltvPercent >= 70) ctx.riskScore += 20;
  else if (data.ltvPercent >= 60) ctx.riskScore += 10;

  return {
    value: borrowValue,
    asset: data.asset,
    apy: inputApy - borrowApy,
    leverage: newLeverage,
    isCollateral: false,
    healthFactor,
    liquidationPrice,
  };
}

/**
 * Process Swap block
 */
function processSwapBlock(
  block: StrategyBlock,
  ctx: SimulationContext,
  edges: StrategyEdge[]
): BlockState {
  const data = block.data as SwapBlockData;
  const reverseAdj = buildReverseAdjacency(edges);
  const inputIds = reverseAdj.get(block.id) ?? [];

  // Get input state
  let inputValue = 0;
  let inputApy = 0;
  let inputLeverage = 1;
  for (const inputId of inputIds) {
    const inputState = ctx.blockStates.get(inputId);
    if (inputState) {
      inputValue += inputState.value;
      inputApy = inputState.apy;
      inputLeverage = inputState.leverage;
    }
  }

  // Apply slippage
  const outputValue = inputValue * (1 - data.slippage / 100);
  ctx.protocolFees += inputValue * 0.003; // 0.3% swap fee

  // Add gas cost
  ctx.totalGasCost += GAS_COSTS.swap;

  return {
    value: outputValue,
    asset: data.toAsset,
    apy: inputApy,
    leverage: inputLeverage,
    isCollateral: false,
    healthFactor: null,
    liquidationPrice: null,
  };
}

// ============================================================================
// Main Simulation Function
// ============================================================================

/**
 * Run simulation on a strategy
 */
export function simulateStrategy(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): SimulationResult {
  // Validate strategy
  if (blocks.length === 0) {
    return {
      isValid: false,
      errorMessage: "Strategy has no blocks",
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
    };
  }

  // Check for input block
  const hasInput = blocks.some((b) => b.type === "input");
  if (!hasInput) {
    return {
      isValid: false,
      errorMessage: "Strategy needs an Input block",
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
    };
  }

  try {
    // Sort blocks topologically
    const sortedBlocks = topologicalSort(blocks, edges);

    // Initialize simulation context
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

    // Process each block in order
    for (const block of sortedBlocks) {
      let state: BlockState;

      switch (block.type) {
        case "input":
          state = processInputBlock(block, ctx, edges);
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
          };
      }

      ctx.blockStates.set(block.id, state);
    }

    // Calculate total APY
    const grossApy = ctx.yieldSources.reduce((sum, s) => sum + s.apy * (s.weight / 100), 0);

    // Calculate net APY (after gas amortized over 1 year)
    const gasCostAsPercent = ctx.initialValue > 0
      ? (ctx.totalGasCost / ctx.initialValue) * 100
      : 0;
    const feesAsPercent = ctx.initialValue > 0
      ? (ctx.protocolFees / ctx.initialValue) * 100
      : 0;
    const netApy = grossApy - gasCostAsPercent - feesAsPercent;

    // Calculate projections
    const projectedValue1Y = ctx.initialValue * (1 + netApy / 100);
    const projectedYield1Y = projectedValue1Y - ctx.initialValue;

    // Determine risk level
    let riskLevel: RiskLevel = "low";
    if (ctx.riskScore >= 70 || ctx.leverage >= 4) riskLevel = "extreme";
    else if (ctx.riskScore >= 50 || ctx.leverage >= 3) riskLevel = "high";
    else if (ctx.riskScore >= 30 || ctx.leverage >= 2) riskLevel = "medium";

    // Calculate max drawdown (simplified)
    const maxDrawdown = ctx.leverage > 1
      ? Math.min(100, 20 * ctx.leverage)
      : 10;

    return {
      isValid: true,
      grossApy,
      netApy,
      initialValue: ctx.initialValue,
      projectedValue1Y,
      projectedYield1Y: projectedYield1Y / ctx.initialValue,
      gasCostUsd: ctx.totalGasCost,
      protocolFees: ctx.protocolFees,
      riskLevel,
      riskScore: Math.min(100, ctx.riskScore),
      liquidationPrice: ctx.liquidationPrice,
      healthFactor: ctx.healthFactor,
      maxDrawdown,
      leverage: ctx.leverage,
      yieldSources: ctx.yieldSources,
    };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: error instanceof Error ? error.message : "Simulation failed",
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
    };
  }
}
