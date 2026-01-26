"use client";

/**
 * DeFi Strategy Builder Page
 *
 * Visual drag-and-drop tool for building, simulating,
 * and analyzing DeFi yield strategies.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  Share2,
  Info,
  TrendingUp,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { StrategyCanvas } from "@/components/strategy-builder/canvas";
import { StrategySidebar } from "@/components/strategy-builder/sidebar";
import { useStrategyStore } from "@/lib/strategy/store";
import { simulateStrategy } from "@/lib/strategy/simulation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// ============================================================================
// Results Panel Component
// ============================================================================

function ResultsPanel() {
  const simulationResult = useStrategyStore((state) => state.simulationResult);
  const isSimulating = useStrategyStore((state) => state.isSimulating);
  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const setSimulationResult = useStrategyStore((state) => state.setSimulationResult);
  const isResultsPanelOpen = useStrategyStore(
    (state) => state.isResultsPanelOpen
  );
  const toggleResultsPanel = useStrategyStore(
    (state) => state.toggleResultsPanel
  );

  // Run simulation whenever blocks or edges change
  useEffect(() => {
    if (blocks.length > 0) {
      const result = simulateStrategy(blocks, edges);
      setSimulationResult(result);
    } else {
      setSimulationResult(null);
    }
  }, [blocks, edges, setSimulationResult]);

  const result = simulationResult;

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "text-green-400";
      case "medium":
        return "text-yellow-400";
      case "high":
        return "text-orange-400";
      case "extreme":
        return "text-red-400";
      default:
        return "text-white/60";
    }
  };

  if (!isResultsPanelOpen) {
    return (
      <button
        onClick={toggleResultsPanel}
        className="absolute bottom-4 right-4 px-4 py-2 rounded-lg bg-[#12121a] border border-white/10
                   text-sm text-white/60 hover:text-white hover:bg-[#1a1a24] transition-colors
                   flex items-center gap-2"
      >
        <TrendingUp className="w-4 h-4" />
        Show Results
      </button>
    );
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 bg-[#0a0a0f]/95 backdrop-blur-xl
                 border-t border-white/10"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isSimulating ? "bg-yellow-400 animate-pulse" : "bg-green-400"
            )}
          />
          <span className="text-sm font-medium text-white">
            {isSimulating ? "Simulating..." : "Strategy Simulation"}
          </span>
        </div>
        <button
          onClick={toggleResultsPanel}
          className="text-white/40 hover:text-white transition-colors text-sm"
        >
          Hide
        </button>
      </div>

      {/* Results Grid */}
      <div className="px-6 py-4">
        {!result || blocks.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Add blocks to the canvas to see simulation results</p>
          </div>
        ) : !result.isValid ? (
          <div className="text-center py-8 text-amber-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p>{result.errorMessage || "Invalid strategy configuration"}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Net APY */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20">
                <div className="text-xs text-white/50 mb-1">Net APY</div>
                <div className="text-2xl font-bold text-purple-400">
                  {result.netApy.toFixed(2)}%
                </div>
              </div>

              {/* Initial Value */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20">
                <div className="text-xs text-white/50 mb-1">Initial Value</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${result.initialValue.toLocaleString()}
                </div>
              </div>

              {/* Projected Value */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20">
                <div className="text-xs text-white/50 mb-1">1Y Value</div>
                <div className="text-2xl font-bold text-green-400">
                  ${result.projectedValue1Y.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Risk Level */}
              <div className="p-4 rounded-xl bg-[#12121a] border border-white/10">
                <div className="text-xs text-white/50 mb-1">Risk Level</div>
                <div
                  className={cn(
                    "text-xl font-bold capitalize",
                    getRiskColor(result.riskLevel)
                  )}
                >
                  {result.riskLevel}
                </div>
              </div>

              {/* Gas Cost */}
              <div className="p-4 rounded-xl bg-[#12121a] border border-white/10">
                <div className="text-xs text-white/50 mb-1">Est. Gas</div>
                <div className="text-xl font-bold text-white">
                  ${result.gasCostUsd}
                </div>
              </div>

              {/* Leverage */}
              <div className="p-4 rounded-xl bg-[#12121a] border border-white/10">
                <div className="text-xs text-white/50 mb-1">Leverage</div>
                <div className="text-xl font-bold text-white">
                  {result.leverage.toFixed(2)}x
                </div>
              </div>
            </div>

            {/* Yield Sources */}
            {result.yieldSources.length > 0 && (
              <div className="p-4 rounded-xl bg-[#12121a] border border-white/10">
                <div className="text-xs text-white/50 mb-3">Yield Breakdown</div>
                <div className="space-y-2">
                  {result.yieldSources.map((source, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          source.type === "stake" && "bg-purple-400",
                          source.type === "supply" && "bg-green-400",
                          source.type === "borrow" && "bg-amber-400",
                        )} />
                        <span className="text-sm text-white/80">{source.protocol}</span>
                        <span className="text-xs text-white/40 capitalize">({source.type})</span>
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        source.apy >= 0 ? "text-green-400" : "text-red-400"
                      )}>
                        {source.apy >= 0 ? "+" : ""}{source.apy.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health Factor Warning */}
            {result.healthFactor !== null && result.healthFactor < 1.5 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-red-400">Low Health Factor</div>
                  <div className="text-xs text-white/60 mt-1">
                    Health Factor: {result.healthFactor.toFixed(2)} — Consider reducing LTV to avoid liquidation.
                    {result.liquidationPrice && (
                      <span> Liquidation at ${result.liquidationPrice.toFixed(0)}.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Toolbar Component
// ============================================================================

function Toolbar() {
  const blocks = useStrategyStore((state) => state.blocks);
  const clearStrategy = useStrategyStore((state) => state.clearStrategy);
  const isSimulating = useStrategyStore((state) => state.isSimulating);
  const setIsSimulating = useStrategyStore((state) => state.setIsSimulating);

  const handleSimulate = () => {
    if (blocks.length === 0) return;
    setIsSimulating(true);
    // Simulate for 1 second then stop
    setTimeout(() => setIsSimulating(false), 1000);
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0a0a0f]">
      {/* Left - Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/20">
          <Zap className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Strategy Builder</h1>
          <p className="text-xs text-white/50">
            Build and simulate DeFi yield strategies
          </p>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSimulate}
          disabled={blocks.length === 0 || isSimulating}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
            blocks.length > 0 && !isSimulating
              ? "bg-purple-500 hover:bg-purple-600 text-white"
              : "bg-white/5 text-white/30 cursor-not-allowed"
          )}
        >
          {isSimulating ? (
            <>
              <Pause className="w-4 h-4" />
              Simulating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Simulate
            </>
          )}
        </button>

        <button
          onClick={clearStrategy}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Save"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Yields Prefetcher
// ============================================================================

function YieldsPrefetcher() {
  const setYields = useStrategyStore((state) => state.setYields);
  const setYieldsLoading = useStrategyStore((state) => state.setYieldsLoading);

  // Fetch yields from DeFi Llama (cached 24hr on server)
  const { data: yields } = trpc.yields.getStrategyApys.useQuery(undefined, {
    staleTime: 1000 * 60 * 60, // 1 hour client-side cache
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (yields) {
      setYields(yields);
    }
  }, [yields, setYields]);

  useEffect(() => {
    setYieldsLoading(!yields);
  }, [yields, setYieldsLoading]);

  return null;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function StrategiesPage() {
  const [mounted, setMounted] = useState(false);

// Hydration pattern for React Flow (client-only component)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/50">Loading Strategy Builder...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Prefetch yields in background */}
      <YieldsPrefetcher />

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <StrategySidebar />

        {/* Canvas */}
        <div className="flex-1 relative">
          <StrategyCanvas />

          {/* Results Panel */}
          <ResultsPanel />
        </div>
      </div>

      {/* Global Styles for React Flow */}
      <style jsx global>{`
        .react-flow__node {
          cursor: grab;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .react-flow__node.selected {
          background: transparent !important;
        }
        .react-flow__node-input,
        .react-flow__node-stake,
        .react-flow__node-lend,
        .react-flow__node-borrow,
        .react-flow__node-swap,
        .react-flow__node-loop,
        .react-flow__node-default {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .react-flow__node:active {
          cursor: grabbing;
        }
        .react-flow__edge-path {
          stroke-width: 2;
        }
        .react-flow__handle {
          opacity: 0;
          transition: opacity 0.2s;
        }
        .react-flow__node:hover .react-flow__handle {
          opacity: 1;
        }
        .react-flow__controls {
          box-shadow: none !important;
        }
        .react-flow__controls-button {
          background: #12121a !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: rgba(255, 255, 255, 0.6) !important;
        }
        .react-flow__controls-button:hover {
          background: #1a1a24 !important;
          color: white !important;
        }
        .react-flow__minimap {
          background: #12121a !important;
        }
      `}</style>
    </div>
  );
}
