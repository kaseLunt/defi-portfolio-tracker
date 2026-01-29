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
  Pause,
  RotateCcw,
  Save,
  Share2,
  Info,
  TrendingUp,
  AlertTriangle,
  Zap,
  Sparkles,
} from "lucide-react";
import { StrategyCanvas } from "@/components/strategy-builder/canvas";
import { StrategySidebar } from "@/components/strategy-builder/sidebar";
import { useStrategyStore } from "@/lib/strategy/store";
import { simulateStrategy } from "@/lib/strategy/simulation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

// ============================================================================
// Custom Fonts
// ============================================================================

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
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
                 px-5 py-3 rounded-2xl bg-[#0a0a0f]/90 backdrop-blur-xl
                 border border-purple-500/20 shadow-xl shadow-purple-500/10"
    >
      {/* Key Metrics */}
      <div className="flex items-center gap-6">
        {/* Net APY */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Net APY</div>
            <div className={cn("text-xl font-bold text-purple-400", jetbrainsMono.className)}>
              {result.netApy.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="w-px h-10 bg-white/10" />

        {/* 1Y Projection */}
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">1Y Projection</div>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-lg font-bold text-green-400", jetbrainsMono.className)}>
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
              <div className={cn("text-sm font-bold text-amber-400", jetbrainsMono.className)}>
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

      {/* View Details Button */}
      <motion.button
        onClick={onViewDetails}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium
                   bg-gradient-to-r from-purple-500 to-pink-500 text-white
                   shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow"
      >
        <TrendingUp className="w-4 h-4" />
        <span>View Analysis</span>
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
// Full Analysis View
// ============================================================================

function AnalysisView({ onBack }: { onBack: () => void }) {
  const simulationResult = useStrategyStore((state) => state.simulationResult);
  const result = simulationResult;

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low": return "text-green-400";
      case "medium": return "text-yellow-400";
      case "high": return "text-orange-400";
      case "extreme": return "text-red-400";
      default: return "text-white/60";
    }
  };

  const getRiskGlow = (level: string) => {
    switch (level) {
      case "low": return "shadow-green-500/20";
      case "medium": return "shadow-yellow-500/20";
      case "high": return "shadow-orange-500/20";
      case "extreme": return "shadow-red-500/20";
      default: return "";
    }
  };

  if (!result || !result.isValid) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-white/40">
          <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No valid strategy to analyze</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            ← Back to Canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 overflow-y-auto bg-[#0a0a0f]"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              ←
            </motion.button>
            <div>
              <h1 className={cn("text-2xl font-bold text-white", spaceGrotesk.className)}>
                Strategy Analysis
              </h1>
              <p className="text-sm text-white/50">Detailed breakdown of your DeFi strategy</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30",
              "text-2xl font-bold text-purple-400",
              jetbrainsMono.className
            )}>
              {result.netApy.toFixed(2)}% APY
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-6">
        {/* Hero Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 shadow-lg shadow-purple-500/10"
          >
            <div className="text-xs text-white/50 mb-2">Net APY</div>
            <div className={cn("text-4xl font-bold text-purple-400", jetbrainsMono.className)}>
              {result.netApy.toFixed(2)}%
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30"
          >
            <div className="text-xs text-white/50 mb-2">Initial Value</div>
            <div className={cn("text-3xl font-bold text-blue-400", jetbrainsMono.className)}>
              ${result.initialValue.toLocaleString()}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 shadow-lg shadow-green-500/10"
          >
            <div className="text-xs text-white/50 mb-2">1Y Projected</div>
            <div className={cn("text-3xl font-bold text-green-400", jetbrainsMono.className)}>
              ${result.projectedValue1Y.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-green-400/60 mt-1">
              +${(result.projectedValue1Y - result.initialValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={cn("p-5 rounded-2xl bg-[#12121a] border border-white/10 shadow-lg", getRiskGlow(result.riskLevel))}
          >
            <div className="text-xs text-white/50 mb-2">Risk Level</div>
            <div className={cn("text-2xl font-bold capitalize", getRiskColor(result.riskLevel), spaceGrotesk.className)}>
              {result.riskLevel}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-5 rounded-2xl bg-[#12121a] border border-white/10"
          >
            <div className="text-xs text-white/50 mb-2">Est. Gas Cost</div>
            <div className={cn("text-2xl font-bold text-white", jetbrainsMono.className)}>
              ${result.gasCostUsd}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="p-5 rounded-2xl bg-[#12121a] border border-white/10"
          >
            <div className="text-xs text-white/50 mb-2">Leverage</div>
            <div className={cn("text-2xl font-bold text-white", jetbrainsMono.className)}>
              {result.leverage.toFixed(2)}x
            </div>
          </motion.div>
        </div>

        {/* Yield Breakdown + Projection - Side by Side */}
        {result.yieldSources.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* APY Waterfall */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-[#12121a] to-[#0d0d14] border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className={cn("text-lg font-semibold text-white", spaceGrotesk.className)}>
                    APY Breakdown
                  </h2>
                  {result.leverage > 1.1 && (
                    <div className="text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/20">
                      {result.leverage.toFixed(1)}x leveraged
                    </div>
                  )}
                </div>
                <div className={cn("text-sm px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-semibold", jetbrainsMono.className)}>
                  {result.netApy >= 0 ? "+" : ""}{result.netApy.toFixed(2)}% Net
                </div>
              </div>

              {(() => {
                const aggregated = result.yieldSources.reduce((acc, source) => {
                  const key = `${source.protocol}-${source.type}`;
                  if (!acc[key]) {
                    acc[key] = { ...source, count: 1, totalWeight: source.weight };
                  } else {
                    const existing = acc[key];
                    const newTotalWeight = existing.totalWeight + source.weight;
                    existing.apy = (existing.apy * existing.totalWeight + source.apy * source.weight) / newTotalWeight;
                    existing.totalWeight = newTotalWeight;
                    existing.weight = newTotalWeight;
                    existing.count += 1;
                  }
                  return acc;
                }, {} as Record<string, typeof result.yieldSources[0] & { count: number; totalWeight: number }>);

                const sources = Object.values(aggregated).sort((a, b) => {
                  if (a.apy >= 0 && b.apy < 0) return -1;
                  if (a.apy < 0 && b.apy >= 0) return 1;
                  return Math.abs(b.apy * b.weight) - Math.abs(a.apy * a.weight);
                });

                const maxContribution = Math.max(...sources.map(s => Math.abs(s.apy * s.weight / 100)));

                return (
                  <div className="space-y-4">
                    {sources.map((source, i) => {
                      const contribution = (source.apy * source.weight) / 100;
                      const barWidth = maxContribution > 0 ? (Math.abs(contribution) / maxContribution) * 100 : 0;
                      const isPositive = contribution >= 0;

                      return (
                        <motion.div
                          key={`${source.protocol}-${source.type}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-[#12121a]",
                                source.type === "stake" && "bg-purple-400 ring-purple-400/30",
                                source.type === "supply" && "bg-emerald-400 ring-emerald-400/30",
                                source.type === "borrow" && "bg-amber-400 ring-amber-400/30",
                              )} />
                              <span className="text-sm font-medium text-white">{source.protocol}</span>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium",
                                source.type === "stake" && "bg-purple-500/20 text-purple-300",
                                source.type === "supply" && "bg-emerald-500/20 text-emerald-300",
                                source.type === "borrow" && "bg-amber-500/20 text-amber-300",
                              )}>
                                {source.type}
                              </span>
                              {source.count > 1 && (
                                <span className="text-xs text-white/40">×{source.count}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-white/50">
                                {source.apy.toFixed(2)}% × {source.weight.toFixed(0)}%
                              </span>
                              <span className={cn(
                                "text-sm font-bold tabular-nums min-w-[70px] text-right",
                                jetbrainsMono.className,
                                isPositive ? "text-emerald-400" : "text-red-400"
                              )}>
                                {isPositive ? "+" : ""}{contribution.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.6, delay: 0.4 + i * 0.05, ease: "easeOut" }}
                              className={cn(
                                "absolute top-0 h-full rounded-full",
                                isPositive
                                  ? "left-0 bg-gradient-to-r from-emerald-500 to-emerald-400"
                                  : "right-0 bg-gradient-to-l from-red-500 to-red-400"
                              )}
                            />
                          </div>
                        </motion.div>
                      );
                    })}

                    <div className="border-t border-white/10 my-4" />

                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                        <span className="text-sm font-semibold text-white">Total Net APY</span>
                      </div>
                      <span className={cn(
                        "text-xl font-bold",
                        jetbrainsMono.className,
                        result.netApy >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {result.netApy >= 0 ? "+" : ""}{result.netApy.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </motion.div>

            {/* 1 Year Projection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-[#12121a] to-[#0d0d14] border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn("text-lg font-semibold text-white", spaceGrotesk.className)}>
                  1 Year Projection
                </h2>
                <div className={cn("text-sm px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 font-semibold", jetbrainsMono.className)}>
                  +${(result.projectedValue1Y - result.initialValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>

              <div className="relative space-y-6">
                {/* Start */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Start</div>
                    <div className={cn("text-2xl font-bold text-blue-400", jetbrainsMono.className)}>
                      ${(result.initialValue / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-500/30 to-blue-500/10 border border-blue-500/30 flex items-center px-4">
                    <span className="text-sm text-blue-300">Initial Capital</span>
                  </div>
                </div>

                {/* Yield */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Yield</div>
                    <div className={cn("text-2xl font-bold text-emerald-400", jetbrainsMono.className)}>
                      +${((result.projectedValue1Y - result.initialValue + result.gasCostUsd + result.protocolFees) / 1000).toFixed(1)}K
                    </div>
                  </div>
                  <div className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-500/30 to-emerald-500/10 border border-emerald-500/30 flex items-center px-4 relative overflow-hidden">
                    <span className="text-sm text-emerald-300">Staking + Lending Rewards</span>
                    <motion.div
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400"
                      animate={{ x: [-200, 0], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>

                {/* Costs */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Costs</div>
                    <div className={cn("text-2xl font-bold text-red-400", jetbrainsMono.className)}>
                      -${(result.gasCostUsd + result.protocolFees).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-500/30 to-red-500/10 border border-red-500/30 flex items-center px-4">
                    <span className="text-sm text-red-300">Gas + Borrow Interest</span>
                  </div>
                </div>

                {/* Connecting line */}
                <div className="absolute left-28 top-12 bottom-12 w-0.5 bg-gradient-to-b from-blue-500/50 via-emerald-500/50 to-green-500/50" />

                {/* End */}
                <div className="flex items-center gap-4">
                  <div className="w-24 text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">End</div>
                    <div className={cn("text-2xl font-bold text-green-400", jetbrainsMono.className)}>
                      ${(result.projectedValue1Y / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div className="flex-1 h-14 rounded-xl bg-gradient-to-r from-green-500/40 to-green-500/20 border-2 border-green-500/40 flex items-center justify-between px-4 shadow-lg shadow-green-500/20">
                    <span className="text-sm font-medium text-green-300">Projected Value</span>
                    <span className={cn("text-lg font-bold text-green-400", jetbrainsMono.className)}>
                      {result.netApy.toFixed(2)}% APY
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Health Factor Warning */}
        {result.healthFactor !== null && result.healthFactor < 1.5 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-4"
          >
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="text-lg font-semibold text-red-400">Low Health Factor Warning</div>
              <div className="text-sm text-white/60 mt-1">
                Health Factor: <span className="font-bold text-red-400">{result.healthFactor.toFixed(2)}</span> —
                Consider reducing LTV to avoid liquidation.
                {result.liquidationPrice && (
                  <span> Liquidation triggers at <span className="font-bold text-red-400">${result.liquidationPrice.toFixed(0)}</span> ETH price.</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Simulation Runner (background effect)
// ============================================================================

function SimulationRunner() {
  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const setSimulationResult = useStrategyStore((state) => state.setSimulationResult);

  useEffect(() => {
    if (blocks.length > 0) {
      const result = simulateStrategy(blocks, edges);
      setSimulationResult(result);
    } else {
      setSimulationResult(null);
    }
  }, [blocks, edges, setSimulationResult]);

  return null;
}

// ============================================================================
// Toolbar Component
// ============================================================================

function Toolbar() {
  const blocks = useStrategyStore((state) => state.blocks);
  const clearStrategy = useStrategyStore((state) => state.clearStrategy);
  const simulationResult = useStrategyStore((state) => state.simulationResult);

  const hasValidStrategy = blocks.length > 0 && simulationResult?.isValid;

  return (
    <motion.div
      variants={itemVariants}
      className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl"
    >
      {/* Left - Title with gradient */}
      <div className="flex items-center gap-4">
        <motion.div
          className="relative p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border border-purple-500/30"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Zap className="w-6 h-6 text-purple-400" />
          <motion.div
            className="absolute inset-0 rounded-xl bg-purple-500/20"
            animate={{ opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
        <div>
          <h1 className={cn(
            "text-xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent",
            spaceGrotesk.className
          )}>
            Strategy Builder
          </h1>
          <p className="text-xs text-white/50 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            Build and simulate DeFi yield strategies
          </p>
        </div>
      </div>

      {/* Right - Actions with enhanced styling */}
      <div className="flex items-center gap-3">
        {/* Execute Button - Coming Soon */}
        <div className="relative group">
          <motion.button
            disabled
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all
                       bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400/50
                       border border-green-500/20 cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            <span>Execute</span>
          </motion.button>
          {/* Tooltip */}
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg
                          bg-[#1a1a24] border border-white/10 text-xs text-white/70 whitespace-nowrap
                          opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                          shadow-xl z-50">
            Coming soon — Execute strategy on-chain
          </div>
        </div>

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

  // Hydration pattern for React Flow (client-only component)
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          {/* Animated loading spinner */}
          <div className="relative">
            <motion.div
              className="w-16 h-16 rounded-full border-2 border-purple-500/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-0 w-16 h-16 rounded-full border-t-2 border-purple-500"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <Zap className="absolute inset-0 m-auto w-6 h-6 text-purple-400" />
          </div>
          <div className={cn("text-white/70 font-medium", spaceGrotesk.className)}>
            Loading Strategy Builder
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-purple-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
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
        "h-screen flex flex-col bg-[#0a0a0f]",
        spaceGrotesk.variable,
        jetbrainsMono.variable
      )}
    >
      {/* Background simulation runner */}
      <SimulationRunner />

      {/* Prefetch yields in background */}
      <YieldsPrefetcher />

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content - Switch between Canvas and Analysis */}
      <AnimatePresence mode="wait">
        {currentView === "canvas" ? (
          <motion.div
            key="canvas"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex overflow-hidden relative"
          >
            {/* Sidebar */}
            <StrategySidebar />

            {/* Canvas */}
            <motion.div variants={itemVariants} className="flex-1 relative">
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
            className="flex-1 flex overflow-hidden"
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
