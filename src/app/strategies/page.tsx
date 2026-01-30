"use client";

/**
 * DeFi Strategy Builder Page
 *
 * Visual drag-and-drop tool for building, simulating,
 * and analyzing DeFi yield strategies.
 *
 * Features premium visual design with custom typography,
 * staggered animations, and ambient effects.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  RotateCcw,
  Save,
  Share2,
  TrendingUp,
  AlertTriangle,
  Zap,
  Sparkles,
  Loader2,
} from "lucide-react";
import { StrategyCanvas } from "@/components/strategy-builder/canvas";
import { StrategySidebar } from "@/components/strategy-builder/sidebar";
import { AnalysisView } from "@/components/strategy-builder/analysis/analysis-view";
import { ExecutionModal } from "@/components/strategy-builder/execution";
import { useStrategyStore } from "@/lib/strategy/store";
import { simulateStrategy } from "@/lib/strategy/simulation";
import { useTransactionExecution } from "@/hooks/use-transaction-execution";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Orbitron, Exo_2, Fira_Code } from "next/font/google";

// ============================================================================
// Custom Fonts - Cyberpunk Aesthetic
// ============================================================================

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// ============================================================================
// Animation Variants
// ============================================================================

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

// ============================================================================
// Compact Results Bar (shown on Canvas view)
// ============================================================================

function CompactResultsBar({ onViewDetails }: { onViewDetails: () => void }) {
  const simulationResult = useStrategyStore((state) => state.simulationResult);
  const blocks = useStrategyStore((state) => state.blocks);

  const result = simulationResult;

  if (!result || !result.isValid || blocks.length === 0) {
    return null;
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "text-green-400";
      case "medium": return "text-yellow-400";
      case "high": return "text-orange-400";
      case "extreme": return "text-red-400";
      default: return "text-white/60";
    }
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-4 left-4 right-4 flex items-center justify-between
                 px-6 py-4 rounded-2xl glass-depth-3
                 border border-purple-500/20
                 shadow-[0_0_40px_rgba(120,0,255,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      {/* Holographic top border accent */}
      <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      {/* Key Metrics */}
      <div className="flex items-center gap-6">
        {/* Net APY */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Net APY</div>
            <div className={cn("text-xl font-bold text-purple-400", firaCode.className)}>
              {result.netApy.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="w-px h-10 bg-white/10" />

        {/* 1Y Projection */}
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">1Y Projection</div>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-lg font-bold text-green-400", firaCode.className)}>
              ${result.projectedValue1Y.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-green-400/60">
              +${(result.projectedValue1Y - result.initialValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        <div className="w-px h-10 bg-white/10" />

        {/* Risk & Leverage */}
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Risk</div>
            <div className={cn("text-sm font-bold capitalize", getRiskColor(result.riskLevel))}>
              {result.riskLevel}
            </div>
          </div>
          {result.leverage > 1.1 && (
            <div className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/20">
              <div className={cn("text-sm font-bold text-amber-400", firaCode.className)}>
                {result.leverage.toFixed(1)}x
              </div>
            </div>
          )}
        </div>

        {/* Health Factor Warning */}
        {result.healthFactor !== null && result.healthFactor < 1.5 && (
          <>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">HF: {result.healthFactor.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* View Details Button - Cyberpunk Style */}
      <motion.button
        onClick={onViewDetails}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium overflow-hidden
                   bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500 text-white
                   shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]
                   transition-all duration-300 group"
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.5 }}
        />
        <TrendingUp className="w-4 h-4 relative z-10 group-hover:rotate-12 transition-transform" />
        <span className={cn("relative z-10 tracking-wide", orbitron.className)}>View Analysis</span>
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
// Simulation Runner (background effect)
// ============================================================================

function SimulationRunner() {
  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const ethPrice = useStrategyStore((state) => state.ethPrice);
  const setSimulationResult = useStrategyStore((state) => state.setSimulationResult);

  useEffect(() => {
    if (blocks.length > 0) {
      const result = simulateStrategy(blocks, edges, ethPrice);
      setSimulationResult(result);
    } else {
      setSimulationResult(null);
    }
  }, [blocks, edges, ethPrice, setSimulationResult]);

  return null;
}

// ============================================================================
// Toolbar Component
// ============================================================================

interface ToolbarProps {
  onExecute: () => void;
  canExecute: boolean;
  isBuilding: boolean;
}

function Toolbar({ onExecute, canExecute, isBuilding }: ToolbarProps) {
  const blocks = useStrategyStore((state) => state.blocks);
  const clearStrategy = useStrategyStore((state) => state.clearStrategy);
  const simulationResult = useStrategyStore((state) => state.simulationResult);

  const hasValidStrategy = blocks.length > 0 && simulationResult?.isValid;

  return (
    <motion.div
      variants={itemVariants}
      className="relative flex items-center justify-between px-6 py-4 border-b border-purple-500/10 glass-depth-2"
    >
      {/* Holographic accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      {/* Left - Title with cyberpunk styling */}
      <div className="flex items-center gap-4">
        <motion.div
          className="relative p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-600/10 border border-purple-500/30 overflow-hidden"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Zap className="w-6 h-6 text-purple-400 relative z-10" />
          {/* Animated pulse */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              background: "radial-gradient(circle at center, rgba(168,85,247,0.3), transparent 70%)"
            }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
        <div>
          <h1 className={cn(
            "text-xl font-bold tracking-wider uppercase",
            "bg-gradient-to-r from-white via-purple-300 to-cyan-400 bg-clip-text text-transparent",
            orbitron.className
          )}>
            Strategy Builder
          </h1>
          <p className={cn("text-xs text-white/40 flex items-center gap-1.5", exo2.className)}>
            <Sparkles className="w-3 h-3 text-purple-400" />
            DeFi yield strategy composition engine
          </p>
        </div>
      </div>

      {/* Right - Actions with enhanced styling */}
      <div className="flex items-center gap-3">
        {/* Execute Button */}
        <motion.button
          onClick={onExecute}
          disabled={!canExecute || isBuilding}
          whileHover={canExecute ? { scale: 1.02 } : undefined}
          whileTap={canExecute ? { scale: 0.98 } : undefined}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
            canExecute
              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
              : "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400/50 border border-green-500/20 cursor-not-allowed"
          )}
        >
          {isBuilding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span>{isBuilding ? "Building..." : "Execute"}</span>
        </motion.button>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          <motion.button
            onClick={clearStrategy}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Save"
          >
            <Save className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Price Prefetcher
// ============================================================================

function PricePrefetcher() {
  const setEthPrice = useStrategyStore((state) => state.setEthPrice);

  // Fetch ETH price from CoinGecko
  const { data: ethPriceData } = trpc.price.getPriceBySymbol.useQuery(
    { symbol: "ETH" },
    {
      staleTime: 1000 * 60, // 1 minute cache
      refetchInterval: 1000 * 60, // Refetch every minute
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    if (ethPriceData?.priceUsd) {
      setEthPrice(ethPriceData.priceUsd);
    }
  }, [ethPriceData, setEthPrice]);

  return null;
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
  const [currentView, setCurrentView] = useState<"canvas" | "analysis">("canvas");
  const [executionModalOpen, setExecutionModalOpen] = useState(false);

  // Transaction execution hook
  const execution = useTransactionExecution();

  // Handle execute button click
  const handleExecute = async () => {
    setExecutionModalOpen(true);
    await execution.buildPlan();
  };

  // Hydration pattern for React Flow (client-only component)
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-b from-[#050508] via-[#0a0a0f] to-[#050508]">
        {/* Aurora background */}
        <div className="absolute inset-0 aurora-bg opacity-30" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative flex flex-col items-center gap-6"
        >
          {/* Holographic loading orb */}
          <div className="relative w-24 h-24">
            {/* Outer rotating ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, rgba(168,85,247,0.5), rgba(6,182,212,0.5), rgba(236,72,153,0.5), rgba(168,85,247,0.5))",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            {/* Inner core */}
            <div className="absolute inset-2 rounded-full bg-[#0a0a0f] flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Zap className="w-8 h-8 text-purple-400" />
              </motion.div>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full blur-xl bg-purple-500/20" />
          </div>

          <div className={cn("text-white/80 font-medium tracking-widest uppercase", orbitron.className)}>
            Initializing
          </div>

          {/* Loading bar */}
          <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: "100%" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-[#050508] via-[#0a0a0f] to-[#050508]",
        orbitron.variable,
        exo2.variable,
        firaCode.variable
      )}
    >
      {/* Background simulation runner */}
      <SimulationRunner />

      {/* Prefetch prices in background */}
      <PricePrefetcher />

      {/* Prefetch yields in background */}
      <YieldsPrefetcher />

      {/* Toolbar */}
      <Toolbar
        onExecute={handleExecute}
        canExecute={execution.canExecute ?? false}
        isBuilding={execution.isBuilding}
      />

      {/* Execution Modal */}
      <ExecutionModal
        open={executionModalOpen}
        onOpenChange={setExecutionModalOpen}
        execution={execution}
      />

      {/* Main Content - Switch between Canvas and Analysis */}
      <AnimatePresence mode="wait">
        {currentView === "canvas" ? (
          <motion.div
            key="canvas"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex min-h-0 overflow-hidden relative"
          >
            {/* Sidebar */}
            <StrategySidebar />

            {/* Canvas */}
            <motion.div variants={itemVariants} className="flex-1 min-h-0 relative overflow-hidden">
              <StrategyCanvas />

              {/* Compact Results Bar */}
              <CompactResultsBar onViewDetails={() => setCurrentView("analysis")} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <AnalysisView onBack={() => setCurrentView("canvas")} />
          </motion.div>
        )}
      </AnimatePresence>

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
    </motion.div>
  );
}
