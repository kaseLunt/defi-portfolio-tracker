"use client";

/**
 * Loop Badge Component
 *
 * Displays on detected leverage loops with iteration control.
 * Shows effective leverage and allows adjusting iterations.
 */

import { memo, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ChevronUp, ChevronDown, AlertTriangle, Zap } from "lucide-react";
import type { DetectedLoop, StrategyBlock, BorrowBlockData, LendBlockData, InputBlockData } from "@/lib/strategy/types";
import { calculateLoopIterations, calculateHealthFactors } from "@/lib/strategy/loop-detection";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface LoopBadgeProps {
  loop: DetectedLoop;
  blocks: StrategyBlock[];
  position: { x: number; y: number };
  onIterationsChange: (loopId: string, iterations: number) => void;
}

// ============================================================================
// Component
// ============================================================================

function LoopBadgeComponent({
  loop,
  blocks,
  position,
  onIterationsChange,
}: LoopBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get relevant data from blocks
  const loopData = useMemo(() => {
    const loopBlocks = loop.blockIds.map((id) =>
      blocks.find((b) => b.id === id)
    );

    // Find input value
    const inputBlock = blocks.find((b) => b.data.type === "input");
    const initialValue = inputBlock
      ? (inputBlock.data as InputBlockData).amount
      : 1000;

    // Find LTV from borrow block
    const borrowBlock = loopBlocks.find((b) => b?.data.type === "borrow");
    const ltvPercent = borrowBlock
      ? (borrowBlock.data as BorrowBlockData).ltvPercent
      : 70;

    // Find liquidation threshold from lend block
    const lendBlock = loopBlocks.find((b) => b?.data.type === "lend");
    const liquidationThreshold = lendBlock
      ? (lendBlock.data as LendBlockData).liquidationThreshold
      : 82.5;

    return { initialValue, ltvPercent, liquidationThreshold };
  }, [loop.blockIds, blocks]);

  // Calculate leverage stats
  const leverageStats = useMemo(() => {
    return calculateLoopIterations(
      loopData.initialValue,
      loopData.ltvPercent,
      loop.iterations
    );
  }, [loopData, loop.iterations]);

  // Calculate health factors
  const healthFactors = useMemo(() => {
    return calculateHealthFactors(
      loopData.initialValue,
      loopData.ltvPercent,
      loopData.liquidationThreshold,
      Math.max(loop.iterations, 5) // Show up to 5 for preview
    );
  }, [loopData, loop.iterations]);

  // Get risk level color
  const getRiskColor = (hf: number) => {
    if (hf > 1.5) return "text-green-400";
    if (hf > 1.2) return "text-yellow-400";
    if (hf > 1.1) return "text-orange-400";
    return "text-red-400";
  };

  const getRiskBg = (hf: number) => {
    if (hf > 1.5) return "bg-green-500/10";
    if (hf > 1.2) return "bg-yellow-500/10";
    if (hf > 1.1) return "bg-orange-500/10";
    return "bg-red-500/10";
  };

  const currentHealthFactor =
    healthFactors[loop.iterations - 1]?.healthFactor ?? Infinity;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Main Badge */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-gradient-to-r from-purple-500/20 to-pink-500/20",
          "border border-purple-500/30",
          "text-white text-sm font-medium",
          "shadow-lg shadow-purple-500/20",
          "cursor-pointer transition-all",
          isExpanded && "ring-2 ring-purple-500/50"
        )}
      >
        <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin-slow" />
        <span className="text-purple-300">×{loop.iterations}</span>
        <span className="text-white/60">→</span>
        <span className="text-green-400 font-semibold">
          {leverageStats.effectiveLeverage.toFixed(1)}x
        </span>
        {currentHealthFactor < 1.2 && (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        )}
      </motion.button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2
                       bg-[#12121a] border border-white/10 rounded-xl
                       shadow-2xl shadow-black/50 min-w-[280px] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="font-semibold text-white">Leverage Loop</span>
              </div>
            </div>

            {/* Iteration Control */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-xs text-white/50 mb-2">Iterations</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => onIterationsChange(loop.id, n)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                      loop.iterations === n
                        ? "bg-purple-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() =>
                    onIterationsChange(loop.id, Math.min(10, loop.iterations + 1))
                  }
                  className="px-2 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Iteration Breakdown */}
            <div className="px-4 py-3 max-h-[200px] overflow-y-auto">
              <div className="text-xs text-white/50 mb-2">Per-Iteration Breakdown</div>
              <div className="space-y-1">
                {healthFactors.slice(0, loop.iterations).map((hf, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between py-1.5 px-2 rounded",
                      i < loop.iterations ? getRiskBg(hf.healthFactor) : "opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-4">{i + 1}</span>
                      <span className="text-xs text-white">
                        +{leverageStats.iterationValues[i]?.toFixed(0) ?? 0} ETH
                      </span>
                    </div>
                    <div className={cn("text-xs font-medium", getRiskColor(hf.healthFactor))}>
                      HF: {hf.healthFactor === Infinity ? "∞" : hf.healthFactor.toFixed(2)}
                      {hf.healthFactor < 1.1 && " ⚠️"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="px-4 py-3 border-t border-white/5 bg-white/5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-white/40">Total Position</div>
                  <div className="text-sm font-semibold text-white">
                    {leverageStats.totalValue.toFixed(0)} ETH
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40">Eff. Leverage</div>
                  <div className="text-sm font-semibold text-green-400">
                    {leverageStats.effectiveLeverage.toFixed(2)}x
                  </div>
                </div>
              </div>

              {/* Warning */}
              {currentHealthFactor < 1.2 && (
                <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200">
                      High liquidation risk at {loop.iterations} iterations.
                      Consider reducing to {Math.max(1, loop.iterations - 1)}.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const LoopBadge = memo(LoopBadgeComponent);

// ============================================================================
// Custom Animation
// ============================================================================

// Add to tailwind.config.ts:
// animation: { 'spin-slow': 'spin 3s linear infinite' }
