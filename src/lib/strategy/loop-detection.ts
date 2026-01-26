/**
 * Loop Detection Algorithm
 *
 * Detects cycles in the strategy graph and identifies leverage loops.
 * Uses DFS-based cycle detection optimized for small graphs.
 */

import type { StrategyBlock, StrategyEdge, DetectedLoop } from "./types";

// ============================================================================
// Types
// ============================================================================

interface GraphNode {
  id: string;
  blockType: string;
  outgoing: string[]; // Target block IDs
  incoming: string[]; // Source block IDs
}

// ============================================================================
// Graph Building
// ============================================================================

function buildGraph(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  // Initialize nodes
  for (const block of blocks) {
    graph.set(block.id, {
      id: block.id,
      blockType: block.type,
      outgoing: [],
      incoming: [],
    });
  }

  // Add edges
  for (const edge of edges) {
    const sourceNode = graph.get(edge.source);
    const targetNode = graph.get(edge.target);

    if (sourceNode && targetNode) {
      sourceNode.outgoing.push(edge.target);
      targetNode.incoming.push(edge.source);
    }
  }

  return graph;
}

// ============================================================================
// Cycle Detection (DFS-based)
// ============================================================================

interface CycleInfo {
  blockIds: string[];
  edgeIds: string[];
}

function findCycles(
  graph: Map<string, GraphNode>,
  edges: StrategyEdge[]
): CycleInfo[] {
  const cycles: CycleInfo[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = graph.get(nodeId);
    if (!node) return;

    for (const neighborId of node.outgoing) {
      if (!visited.has(neighborId)) {
        dfs(neighborId);
      } else if (recursionStack.has(neighborId)) {
        // Found a cycle! Extract it from the path
        const cycleStart = path.indexOf(neighborId);
        if (cycleStart !== -1) {
          const cycleBlockIds = path.slice(cycleStart);

          // Find edges that form this cycle
          const cycleEdgeIds: string[] = [];
          for (let i = 0; i < cycleBlockIds.length; i++) {
            const from = cycleBlockIds[i];
            const to = cycleBlockIds[(i + 1) % cycleBlockIds.length];
            const edge = edges.find((e) => e.source === from && e.target === to);
            if (edge) cycleEdgeIds.push(edge.id);
          }

          // Also add the edge that closes the loop
          const lastBlock = cycleBlockIds[cycleBlockIds.length - 1];
          const closingEdge = edges.find(
            (e) => e.source === lastBlock && e.target === neighborId
          );
          if (closingEdge && !cycleEdgeIds.includes(closingEdge.id)) {
            cycleEdgeIds.push(closingEdge.id);
          }

          cycles.push({
            blockIds: cycleBlockIds,
            edgeIds: cycleEdgeIds,
          });
        }
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
  }

  // Start DFS from each unvisited node
  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}

// ============================================================================
// Loop Classification
// ============================================================================

/**
 * Determines if a cycle is a leverage loop
 * (contains Stake → Lend → Borrow pattern)
 */
function isLeverageLoop(
  cycle: CycleInfo,
  blocks: StrategyBlock[]
): boolean {
  const blockTypes = cycle.blockIds.map((id) => {
    const block = blocks.find((b) => b.id === id);
    return block?.type;
  });

  // Check for typical leverage pattern
  const hasStake = blockTypes.includes("stake");
  const hasLend = blockTypes.includes("lend");
  const hasBorrow = blockTypes.includes("borrow");

  return hasStake && hasLend && hasBorrow;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect all loops in the strategy graph
 */
export function detectLoops(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): DetectedLoop[] {
  if (blocks.length === 0 || edges.length === 0) {
    return [];
  }

  const graph = buildGraph(blocks, edges);
  const cycles = findCycles(graph, edges);

  // Convert cycles to DetectedLoop objects
  const detectedLoops: DetectedLoop[] = cycles.map((cycle, index) => {
    // Find entry and exit blocks
    const entryBlockId = cycle.blockIds[0];
    const exitBlockId = cycle.blockIds[cycle.blockIds.length - 1];

    return {
      id: `loop_${index}_${Date.now()}`,
      blockIds: cycle.blockIds,
      edgeIds: cycle.edgeIds,
      iterations: 1, // Default
      entryBlockId,
      exitBlockId,
    };
  });

  return detectedLoops;
}

/**
 * Calculate effective values for a leverage loop
 */
export function calculateLoopIterations(
  initialValue: number,
  ltvPercent: number,
  iterations: number
): {
  iterationValues: number[];
  totalValue: number;
  effectiveLeverage: number;
} {
  const iterationValues: number[] = [];
  let currentValue = initialValue;

  for (let i = 0; i < iterations; i++) {
    iterationValues.push(currentValue);
    // Each iteration, we can borrow LTV% of current value
    currentValue = currentValue * (ltvPercent / 100);
  }

  const totalValue = iterationValues.reduce((sum, v) => sum + v, 0);
  const effectiveLeverage = totalValue / initialValue;

  return {
    iterationValues,
    totalValue,
    effectiveLeverage,
  };
}

/**
 * Calculate health factor at each iteration
 */
export function calculateHealthFactors(
  initialValue: number,
  ltvPercent: number,
  liquidationThreshold: number,
  iterations: number
): {
  iteration: number;
  collateral: number;
  debt: number;
  healthFactor: number;
}[] {
  const results: {
    iteration: number;
    collateral: number;
    debt: number;
    healthFactor: number;
  }[] = [];

  let totalCollateral = initialValue;
  let totalDebt = 0;

  for (let i = 1; i <= iterations; i++) {
    // Borrow against current collateral
    const borrowed = totalCollateral * (ltvPercent / 100);
    totalDebt += borrowed;

    // New collateral = borrowed amount (re-staked)
    totalCollateral += borrowed;

    // Health Factor = (Collateral × Liquidation Threshold) / Debt
    const healthFactor =
      totalDebt > 0
        ? (totalCollateral * (liquidationThreshold / 100)) / totalDebt
        : Infinity;

    results.push({
      iteration: i,
      collateral: totalCollateral,
      debt: totalDebt,
      healthFactor,
    });
  }

  return results;
}
