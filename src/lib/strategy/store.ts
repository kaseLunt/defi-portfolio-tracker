/**
 * DeFi Strategy Builder - Zustand Store
 *
 * State management for the strategy builder canvas, including
 * blocks, edges, selection, and simulation state.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  StrategyBlock,
  StrategyEdge,
  BlockType,
  BlockData,
  SimulationResult,
  AssetType,
  InputBlockData,
  StakeBlockData,
  LendBlockData,
  BorrowBlockData,
  SwapBlockData,
  LoopBlockData,
  DetectedLoop,
} from "./types";
import { detectLoops } from "./loop-detection";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { getDefaultApy } from "./protocols";
import type { StrategyApyData } from "@/server/services/yields";

// ============================================================================
// Store State
// ============================================================================

interface StrategyState {
  // Canvas state
  blocks: StrategyBlock[];
  edges: StrategyEdge[];

  // Selection
  selectedBlockId: string | null;

  // Simulation
  simulationResult: SimulationResult | null;
  isSimulating: boolean;

  // Yields (cached from DeFi Llama)
  yields: StrategyApyData | null;
  yieldsLoading: boolean;

  // UI state
  isSidebarOpen: boolean;
  isResultsPanelOpen: boolean;

  // Loops
  detectedLoops: DetectedLoop[];

  // Actions - Canvas
  addBlock: (type: BlockType, position: { x: number; y: number }) => void;
  updateBlock: (id: string, data: Partial<BlockData>) => void;
  removeBlock: (id: string) => void;
  onNodesChange: (changes: NodeChange<StrategyBlock>[]) => void;

  // Actions - Edges
  addEdge: (connection: Connection) => void;
  removeEdge: (id: string) => void;
  onEdgesChange: (changes: EdgeChange<StrategyEdge>[]) => void;
  updateEdgeFlowPercent: (edgeId: string, newPercent: number) => void;

  // Actions - Selection
  selectBlock: (id: string | null) => void;

  // Actions - Simulation
  setSimulationResult: (result: SimulationResult | null) => void;
  setIsSimulating: (isSimulating: boolean) => void;

  // Actions - Yields
  setYields: (yields: StrategyApyData) => void;
  setYieldsLoading: (loading: boolean) => void;
  getStakingApy: (protocol: string) => number;
  getLendingApy: (protocol: string, type: "supply" | "borrow", asset?: string) => number;

  // Actions - UI
  toggleSidebar: () => void;
  toggleResultsPanel: () => void;

  // Actions - Strategy
  clearStrategy: () => void;
  loadStrategy: (blocks: StrategyBlock[], edges: StrategyEdge[]) => void;

  // Actions - Loops
  updateLoopIterations: (loopId: string, iterations: number) => void;
}

// ============================================================================
// Block Factory
// ============================================================================

let blockIdCounter = 0;

function generateBlockId(): string {
  return `block_${Date.now()}_${++blockIdCounter}`;
}

function createDefaultBlockData(type: BlockType): BlockData {
  switch (type) {
    case "input":
      return {
        type: "input",
        asset: "ETH" as AssetType,
        amount: 1,
        label: "Input",
        isConfigured: true,
        isValid: true,
      } satisfies InputBlockData;
    case "stake":
      return {
        type: "stake",
        protocol: "etherfi",
        inputAsset: "ETH" as AssetType,
        outputAsset: "eETH" as AssetType,
        apy: getDefaultApy("etherfi"),
        label: "Stake",
        isConfigured: true,
        isValid: true,
      } satisfies StakeBlockData;
    case "lend":
      return {
        type: "lend",
        protocol: "aave-v3",
        chain: 1,
        supplyApy: getDefaultApy("aave-v3:eth"),
        maxLtv: 80,
        liquidationThreshold: 82.5,
        label: "Lend",
        isConfigured: true,
        isValid: true,
      } satisfies LendBlockData;
    case "borrow":
      return {
        type: "borrow",
        asset: "ETH" as AssetType,
        ltvPercent: 70,
        borrowApy: getDefaultApy("aave-v3:eth:borrow"),
        label: "Borrow",
        isConfigured: true,
        isValid: true,
      } satisfies BorrowBlockData;
    case "swap":
      return {
        type: "swap",
        fromAsset: "ETH" as AssetType,
        toAsset: "USDC" as AssetType,
        slippage: 0.5,
        estimatedOutput: null,
        label: "Swap",
        isConfigured: false,
        isValid: false,
      } satisfies SwapBlockData;
    case "loop":
      return {
        type: "loop",
        iterations: 2,
        targetLtv: 70,
        label: "Loop",
        isConfigured: false,
        isValid: false,
      } satisfies LoopBlockData;
    case "lp":
      // LP block uses same structure as loop for now
      return {
        type: "loop",
        iterations: 1,
        targetLtv: 0,
        label: "LP",
        isConfigured: false,
        isValid: false,
      } satisfies LoopBlockData;
    default:
      throw new Error(`Unknown block type: ${type}`);
  }
}

// ============================================================================
// Store
// ============================================================================

export const useStrategyStore = create<StrategyState>()(
  devtools(
    (set, get) => ({
      // Initial state
      blocks: [],
      edges: [],
      selectedBlockId: null,
      simulationResult: null,
      isSimulating: false,
      yields: null,
      yieldsLoading: false,
      isSidebarOpen: true,
      isResultsPanelOpen: true,
      detectedLoops: [],

      // Actions - Canvas
      addBlock: (type, position) => {
        const id = generateBlockId();
        const newBlock: StrategyBlock = {
          id,
          type,
          position,
          data: createDefaultBlockData(type),
        };

        set((state) => ({
          blocks: [...state.blocks, newBlock],
          selectedBlockId: id,
        }));
      },

      updateBlock: (id, data) => {
        set((state) => ({
          blocks: state.blocks.map((block) =>
            block.id === id
              ? { ...block, data: { ...block.data, ...data } as BlockData }
              : block
          ),
        }));
      },

      removeBlock: (id) => {
        set((state) => ({
          blocks: state.blocks.filter((block) => block.id !== id),
          edges: state.edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          ),
          selectedBlockId:
            state.selectedBlockId === id ? null : state.selectedBlockId,
        }));
      },

      onNodesChange: (changes) => {
        set((state) => ({
          blocks: applyNodeChanges(changes, state.blocks),
        }));
      },

      // Actions - Edges
      addEdge: (connection) => {
        const { source, target, sourceHandle, targetHandle } = connection;
        if (!source || !target) return;

        const id = `edge_${source}_${target}`;

        set((state) => {
          // Check if edge already exists
          if (state.edges.some((e) => e.source === source && e.target === target)) {
            return state;
          }

          // Find existing edges from same source
          const existingFromSource = state.edges.filter((e) => e.source === source);
          const totalEdgesFromSource = existingFromSource.length + 1;

          // Calculate equal distribution
          const equalPercent = Math.round((100 / totalEdgesFromSource) * 10) / 10;

          // Create new edge with equal share
          const newEdge: StrategyEdge = {
            id,
            source,
            target,
            sourceHandle: sourceHandle ?? undefined,
            targetHandle: targetHandle ?? undefined,
            type: "flow",
            animated: true,
            data: { flowPercent: equalPercent },
          };

          // Update existing edges to redistribute
          const updatedEdges = state.edges.map((edge) => {
            if (edge.source === source) {
              return {
                ...edge,
                data: { ...edge.data, flowPercent: equalPercent },
              };
            }
            return edge;
          });

          const newEdges = [...updatedEdges, newEdge];
          // Detect loops after adding edge
          const loops = detectLoops(state.blocks, newEdges);
          return { edges: newEdges, detectedLoops: loops };
        });
      },

      removeEdge: (id) => {
        set((state) => {
          const newEdges = state.edges.filter((edge) => edge.id !== id);
          // Re-detect loops after removing edge
          const loops = detectLoops(state.blocks, newEdges);
          return { edges: newEdges, detectedLoops: loops };
        });
      },

      onEdgesChange: (changes) => {
        set((state) => {
          const newEdges = applyEdgeChanges(changes, state.edges);
          // Re-detect loops on any edge change
          const loops = detectLoops(state.blocks, newEdges);
          return { edges: newEdges, detectedLoops: loops };
        });
      },

      updateEdgeFlowPercent: (edgeId, newPercent) => {
        set((state) => {
          // Find the edge being updated
          const targetEdge = state.edges.find((e) => e.id === edgeId);
          if (!targetEdge) return state;

          const sourceBlockId = targetEdge.source;

          // Find all sibling edges (other edges from the same source)
          const siblingEdges = state.edges.filter(
            (e) => e.source === sourceBlockId && e.id !== edgeId
          );

          // Clamp new percent to valid range
          const clampedPercent = Math.max(0, Math.min(100, newPercent));

          // Calculate remaining allocation for siblings
          const remaining = 100 - clampedPercent;

          // Update all edges
          const updatedEdges = state.edges.map((edge) => {
            if (edge.id === edgeId) {
              // Update the target edge
              return {
                ...edge,
                data: { ...edge.data, flowPercent: clampedPercent },
              };
            } else if (siblingEdges.some((s) => s.id === edge.id)) {
              // Distribute remaining equally among siblings
              const siblingPercent = siblingEdges.length > 0
                ? remaining / siblingEdges.length
                : 0;
              return {
                ...edge,
                data: { ...edge.data, flowPercent: Math.round(siblingPercent * 10) / 10 },
              };
            }
            return edge;
          });

          return { edges: updatedEdges };
        });
      },

      // Actions - Selection
      selectBlock: (id) => {
        set({ selectedBlockId: id });
      },

      // Actions - Simulation
      setSimulationResult: (result) => {
        set({ simulationResult: result });
      },

      setIsSimulating: (isSimulating) => {
        set({ isSimulating });
      },

      // Actions - UI
      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
      },

      toggleResultsPanel: () => {
        set((state) => ({ isResultsPanelOpen: !state.isResultsPanelOpen }));
      },

      // Actions - Strategy
      clearStrategy: () => {
        set({
          blocks: [],
          edges: [],
          selectedBlockId: null,
          simulationResult: null,
          detectedLoops: [],
        });
      },

      loadStrategy: (blocks, edges) => {
        const loops = detectLoops(blocks, edges);
        set({
          blocks,
          edges,
          selectedBlockId: null,
          simulationResult: null,
          detectedLoops: loops,
        });
      },

      // Actions - Loops
      updateLoopIterations: (loopId, iterations) => {
        set((state) => ({
          detectedLoops: state.detectedLoops.map((loop) =>
            loop.id === loopId ? { ...loop, iterations } : loop
          ),
        }));
      },

      // Actions - Yields
      setYields: (yields) => {
        set({ yields, yieldsLoading: false });
      },

      setYieldsLoading: (loading) => {
        set({ yieldsLoading: loading });
      },

      getStakingApy: (protocol) => {
        const { yields } = get();
        if (yields?.staking) {
          const apy = yields.staking[protocol as keyof typeof yields.staking];
          if (apy !== undefined) return apy;
        }
        // Fallback to hardcoded defaults
        return getDefaultApy(protocol);
      },

      getLendingApy: (protocol, type, asset = "ETH") => {
        const { yields } = get();
        if (yields?.lending) {
          const protocolData = yields.lending[protocol as keyof typeof yields.lending];
          if (protocolData) {
            // Handle old format { supply, borrow } for backwards compatibility
            if ("supply" in protocolData && typeof protocolData.supply === "number") {
              return type === "supply"
                ? (protocolData as unknown as { supply: number; borrow: number }).supply
                : (protocolData as unknown as { supply: number; borrow: number }).borrow;
            }

            // New format: { ETH: { supply, borrow }, weETH: { supply, borrow }, ... }
            // Map staking output assets to their lending equivalents
            const assetKey = asset === "eETH" ? "weETH" : asset;
            const assetRates = protocolData[assetKey as keyof typeof protocolData];
            if (assetRates && typeof assetRates === "object" && "supply" in assetRates) {
              return type === "supply" ? assetRates.supply : assetRates.borrow;
            }
            // Fallback to ETH rates if asset not found
            const ethRates = protocolData["ETH" as keyof typeof protocolData];
            if (ethRates && typeof ethRates === "object" && "supply" in ethRates) {
              return type === "supply" ? ethRates.supply : ethRates.borrow;
            }
          }
        }
        // Fallback to hardcoded defaults
        const key = type === "borrow" ? `${protocol}:eth:borrow` : `${protocol}:eth`;
        return getDefaultApy(key);
      },
    }),
    { name: "strategy-store" }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectBlocks = (state: StrategyState) => state.blocks;
export const selectEdges = (state: StrategyState) => state.edges;
export const selectSelectedBlock = (state: StrategyState) => {
  if (!state.selectedBlockId) return null;
  return state.blocks.find((b) => b.id === state.selectedBlockId) ?? null;
};
export const selectSimulationResult = (state: StrategyState) =>
  state.simulationResult;
export const selectIsSimulating = (state: StrategyState) => state.isSimulating;
