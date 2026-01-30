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
  SavedSystem,
} from "./types";
import { loadTemplate as loadTemplateFromLib } from "./templates";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import { getDefaultApy } from "./protocols";
import type { StrategyApyData } from "@/server/services/yields";
import {
  analyzeRouteCompatibility,
  optimizeRoute,
  validateRoute,
  type TokenIncompatibility,
  type RouteValidationResult,
} from "./route-optimizer";

// ============================================================================
// Smart Connection Helpers
// ============================================================================

/**
 * Get the output asset of a block based on its type and configuration
 */
function getBlockOutputAsset(block: StrategyBlock): AssetType | null {
  switch (block.type) {
    case "input":
      return (block.data as InputBlockData).asset;
    case "stake":
      return (block.data as StakeBlockData).outputAsset;
    case "lend":
      // Lend outputs the same asset it receives (it's collateralized)
      return null; // Will be determined by upstream
    case "borrow":
      return (block.data as BorrowBlockData).asset;
    case "swap":
      return (block.data as SwapBlockData).toAsset;
    default:
      return null;
  }
}

/**
 * Auto-configure a block based on incoming asset from connected source
 */
function autoConfigureBlockData(
  targetBlock: StrategyBlock,
  incomingAsset: AssetType
): Partial<BlockData> | null {
  switch (targetBlock.type) {
    case "stake": {
      // Stake blocks accept ETH and output LSTs
      if (incomingAsset === "ETH") {
        return {
          inputAsset: "ETH",
          outputAsset: "eETH" as AssetType,
          protocol: "etherfi",
          apy: getDefaultApy("etherfi"),
          isConfigured: true,
          isValid: true,
        };
      }
      return null;
    }
    case "lend": {
      // Lend blocks accept various assets
      const validLendAssets: AssetType[] = ["ETH", "eETH", "weETH", "stETH", "wstETH", "USDC", "DAI"];
      if (validLendAssets.includes(incomingAsset)) {
        return {
          isConfigured: true,
          isValid: true,
        };
      }
      return null;
    }
    case "borrow": {
      // Borrow doesn't need auto-config based on input
      // It borrows from the collateral provided
      return {
        isConfigured: true,
        isValid: true,
      };
    }
    case "swap": {
      // Set the fromAsset to match incoming
      return {
        fromAsset: incomingAsset,
        isConfigured: true,
        isValid: true,
      };
    }
    default:
      return null;
  }
}

// ============================================================================
// History Types
// ============================================================================

interface HistoryEntry {
  blocks: StrategyBlock[];
  edges: StrategyEdge[];
}

const MAX_HISTORY_SIZE = 30;

// ============================================================================
// Store State
// ============================================================================

interface StrategyState {
  // Canvas state
  blocks: StrategyBlock[];
  edges: StrategyEdge[];

  // History (for undo/redo)
  history: HistoryEntry[];
  historyIndex: number; // -1 means no history, points to current state in history

  // Selection
  selectedBlockId: string | null;

  // Simulation
  simulationResult: SimulationResult | null;
  isSimulating: boolean;

  // Yields (cached from DeFi Llama)
  yields: StrategyApyData | null;
  yieldsLoading: boolean;

  // Prices (live from CoinGecko)
  ethPrice: number;

  // UI state
  isSidebarOpen: boolean;
  isResultsPanelOpen: boolean;

  // Saved Systems (user-created reusable loops)
  savedSystems: SavedSystem[];

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

  // Actions - Prices
  setEthPrice: (price: number) => void;

  // Actions - UI
  toggleSidebar: () => void;
  toggleResultsPanel: () => void;

  // Actions - Strategy
  clearStrategy: () => void;
  loadStrategy: (blocks: StrategyBlock[], edges: StrategyEdge[]) => void;
  loadTemplate: (templateId: string) => boolean;

  // Actions - History (Undo/Redo)
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - Saved Systems
  saveSystem: (name: string, description: string, blockIds: string[]) => void;
  deleteSystem: (id: string) => void;
  placeSystem: (systemId: string, position: { x: number; y: number }) => void;
  loadSavedSystems: () => void;

  // Actions - Route Optimization
  optimizeStrategy: () => { success: boolean; insertedCount: number };
  getRouteIncompatibilities: () => TokenIncompatibility[];
  validateStrategy: () => RouteValidationResult;
  removeAutoInsertedBlocks: () => void;
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

// Helper to deep clone state for history
function cloneState(blocks: StrategyBlock[], edges: StrategyEdge[]): HistoryEntry {
  return {
    blocks: JSON.parse(JSON.stringify(blocks)),
    edges: JSON.parse(JSON.stringify(edges)),
  };
}

export const useStrategyStore = create<StrategyState>()(
  devtools(
    (set, get) => ({
      // Initial state
      blocks: [],
      edges: [],
      history: [],
      historyIndex: -1,
      selectedBlockId: null,
      simulationResult: null,
      isSimulating: false,
      yields: null,
      yieldsLoading: false,
      ethPrice: 2700, // Default, will be updated from API
      isSidebarOpen: true,
      isResultsPanelOpen: true,
      savedSystems: [],

      // Actions - Canvas
      addBlock: (type, position) => {
        const { blocks, edges, history } = get();

        // Push current state to history before change
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, get().historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        const id = generateBlockId();
        const newBlock: StrategyBlock = {
          id,
          type,
          position,
          selectable: true,
          data: createDefaultBlockData(type),
        };

        set({
          blocks: [...blocks, newBlock],
          selectedBlockId: id,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      updateBlock: (id, data) => {
        const { blocks, edges, history, historyIndex } = get();

        // Push current state to history before change
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        set({
          blocks: blocks.map((block) =>
            block.id === id
              ? { ...block, data: { ...block.data, ...data } as BlockData }
              : block
          ),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      removeBlock: (id) => {
        const { blocks, edges, history, historyIndex, selectedBlockId } = get();

        // Push current state to history before change
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        set({
          blocks: blocks.filter((block) => block.id !== id),
          edges: edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          ),
          selectedBlockId: selectedBlockId === id ? null : selectedBlockId,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
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

        const { blocks, edges, history, historyIndex } = get();

        // Check if edge already exists
        if (edges.some((e) => e.source === source && e.target === target)) {
          return;
        }

        // Push current state to history before change
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        const id = `edge_${source}_${target}`;

        // Find existing edges from same source
        const existingFromSource = edges.filter((e) => e.source === source);
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
        const updatedEdges = edges.map((edge) => {
          if (edge.source === source) {
            return {
              ...edge,
              data: { ...edge.data, flowPercent: equalPercent },
            };
          }
          return edge;
        });

        // Smart connection: auto-configure target block based on source output
        const sourceBlock = blocks.find((b) => b.id === source);
        const targetBlock = blocks.find((b) => b.id === target);
        let updatedBlocks = blocks;

        if (sourceBlock && targetBlock) {
          const outputAsset = getBlockOutputAsset(sourceBlock);
          if (outputAsset) {
            const autoConfig = autoConfigureBlockData(targetBlock, outputAsset);
            if (autoConfig) {
              updatedBlocks = blocks.map((block) =>
                block.id === target
                  ? { ...block, data: { ...block.data, ...autoConfig } as BlockData }
                  : block
              );
            }
          }
        }

        set({
          blocks: updatedBlocks,
          edges: [...updatedEdges, newEdge],
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      removeEdge: (id) => {
        const { blocks, edges, history, historyIndex } = get();

        // Push current state to history before change
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        set({
          edges: edges.filter((edge) => edge.id !== id),
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      onEdgesChange: (changes) => {
        set((state) => {
          const newEdges = applyEdgeChanges(changes, state.edges);
          return { edges: newEdges };
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
        const { blocks, edges, history, historyIndex } = get();

        // Only push history if there's something to clear
        if (blocks.length > 0 || edges.length > 0) {
          const historyEntry = cloneState(blocks, edges);
          const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

          set({
            blocks: [],
            edges: [],
            selectedBlockId: null,
            simulationResult: null,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        } else {
          set({
            blocks: [],
            edges: [],
            selectedBlockId: null,
            simulationResult: null,
          });
        }
      },

      loadStrategy: (blocks, edges) => {
        const state = get();

        // Push current state to history if there's content
        if (state.blocks.length > 0 || state.edges.length > 0) {
          const historyEntry = cloneState(state.blocks, state.edges);
          const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

          set({
            blocks,
            edges,
            selectedBlockId: null,
            simulationResult: null,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        } else {
          set({
            blocks,
            edges,
            selectedBlockId: null,
            simulationResult: null,
          });
        }
      },

      loadTemplate: (templateId) => {
        const template = loadTemplateFromLib(templateId);
        if (!template) return false;

        const state = get();

        // Push current state to history if there's content
        if (state.blocks.length > 0 || state.edges.length > 0) {
          const historyEntry = cloneState(state.blocks, state.edges);
          const newHistory = [...state.history.slice(0, state.historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

          set({
            blocks: template.blocks,
            edges: template.edges,
            selectedBlockId: null,
            simulationResult: null,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        } else {
          set({
            blocks: template.blocks,
            edges: template.edges,
            selectedBlockId: null,
            simulationResult: null,
          });
        }
        return true;
      },

      // Actions - History (Undo/Redo)
      undo: () => {
        const { history, historyIndex, blocks, edges } = get();
        if (historyIndex < 0) return;

        // If we're at the end, save current state first so we can redo to it
        if (historyIndex === history.length - 1) {
          const currentState = cloneState(blocks, edges);
          set({
            history: [...history, currentState],
          });
        }

        const prevState = history[historyIndex];
        set({
          blocks: JSON.parse(JSON.stringify(prevState.blocks)),
          edges: JSON.parse(JSON.stringify(prevState.edges)),
          historyIndex: historyIndex - 1,
          simulationResult: null,
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;

        const nextIndex = historyIndex + 1;
        const nextState = history[nextIndex];

        // If redoing to the last state (current), move index past it
        const newIndex = nextIndex === history.length - 1 ? nextIndex : nextIndex;

        set({
          blocks: JSON.parse(JSON.stringify(nextState.blocks)),
          edges: JSON.parse(JSON.stringify(nextState.edges)),
          historyIndex: newIndex,
          simulationResult: null,
        });
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex >= 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // Actions - Saved Systems
      saveSystem: (name, description, blockIds) => {
        const { blocks, edges, savedSystems } = get();

        // Get selected blocks
        const selectedBlocks = blocks.filter((b) => blockIds.includes(b.id));
        if (selectedBlocks.length === 0) return;

        // Get edges that connect selected blocks
        const selectedEdges = edges.filter(
          (e) => blockIds.includes(e.source) && blockIds.includes(e.target)
        );

        // Calculate relative positions (relative to first block)
        const firstBlock = selectedBlocks[0];
        const relativeBlocks = selectedBlocks.map((block) => ({
          ...block,
          position: {
            x: block.position.x - firstBlock.position.x,
            y: block.position.y - firstBlock.position.y,
          },
        }));

        const newSystem: SavedSystem = {
          id: `system_${Date.now()}`,
          name,
          description: description || undefined,
          blocks: relativeBlocks,
          edges: selectedEdges,
          blockCount: selectedBlocks.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const updatedSystems = [...savedSystems, newSystem];

        // Persist to localStorage
        try {
          localStorage.setItem(
            "strategy-builder-saved-systems",
            JSON.stringify(updatedSystems)
          );
        } catch (e) {
          console.error("Failed to save systems to localStorage:", e);
        }

        set({ savedSystems: updatedSystems });
      },

      deleteSystem: (id) => {
        const { savedSystems } = get();
        const updatedSystems = savedSystems.filter((s) => s.id !== id);

        // Persist to localStorage
        try {
          localStorage.setItem(
            "strategy-builder-saved-systems",
            JSON.stringify(updatedSystems)
          );
        } catch (e) {
          console.error("Failed to save systems to localStorage:", e);
        }

        set({ savedSystems: updatedSystems });
      },

      placeSystem: (systemId, position) => {
        const { blocks, edges, savedSystems, history, historyIndex } = get();

        const system = savedSystems.find((s) => s.id === systemId);
        if (!system) return;

        // Push current state to history
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        // Generate new IDs for blocks and edges
        const idMap = new Map<string, string>();
        const timestamp = Date.now();

        system.blocks.forEach((block, index) => {
          idMap.set(block.id, `placed_${timestamp}_${index}`);
        });

        // Create new blocks with new IDs and offset positions
        const newBlocks: StrategyBlock[] = system.blocks.map((block, index) => ({
          ...block,
          id: idMap.get(block.id)!,
          position: {
            x: position.x + block.position.x,
            y: position.y + block.position.y,
          },
          selected: true, // Select placed blocks
        }));

        // Create new edges with updated IDs
        const newEdges: StrategyEdge[] = system.edges.map((edge, index) => ({
          ...edge,
          id: `placed_edge_${timestamp}_${index}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        }));

        // Deselect existing blocks
        const updatedBlocks = blocks.map((b) => ({ ...b, selected: false }));

        set({
          blocks: [...updatedBlocks, ...newBlocks],
          edges: [...edges, ...newEdges],
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      loadSavedSystems: () => {
        try {
          const stored = localStorage.getItem("strategy-builder-saved-systems");
          if (stored) {
            const systems = JSON.parse(stored) as SavedSystem[];
            set({ savedSystems: systems });
          }
        } catch (e) {
          console.error("Failed to load saved systems:", e);
        }
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

      // Actions - Prices
      setEthPrice: (price) => {
        set({ ethPrice: price });
      },

      // Actions - Route Optimization
      optimizeStrategy: () => {
        const { blocks, edges, history, historyIndex } = get();

        // Run route optimization
        const optimized = optimizeRoute(blocks, edges);

        if (optimized.autoInsertedBlockIds.length === 0) {
          return { success: true, insertedCount: 0 };
        }

        // Push current state to history before optimization
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        set({
          blocks: optimized.blocks,
          edges: optimized.edges,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          simulationResult: null,
        });

        return { success: true, insertedCount: optimized.autoInsertedBlockIds.length };
      },

      getRouteIncompatibilities: () => {
        const { blocks, edges } = get();
        return analyzeRouteCompatibility(blocks, edges);
      },

      validateStrategy: () => {
        const { blocks, edges } = get();
        return validateRoute(blocks, edges);
      },

      removeAutoInsertedBlocks: () => {
        const { blocks, edges, history, historyIndex } = get();

        // Find all auto-inserted blocks
        const autoBlockIds = new Set(
          blocks
            .filter((b) => (b.data as Record<string, unknown>).isAutoInserted === true)
            .map((b) => b.id)
        );

        if (autoBlockIds.size === 0) return;

        // Push current state to history
        const historyEntry = cloneState(blocks, edges);
        const newHistory = [...history.slice(0, historyIndex + 1), historyEntry].slice(-MAX_HISTORY_SIZE);

        // Remove auto-inserted blocks and their edges
        const filteredBlocks = blocks.filter((b) => !autoBlockIds.has(b.id));
        const filteredEdges = edges.filter(
          (e) => !autoBlockIds.has(e.source) && !autoBlockIds.has(e.target)
        );

        set({
          blocks: filteredBlocks,
          edges: filteredEdges,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          simulationResult: null,
        });
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
