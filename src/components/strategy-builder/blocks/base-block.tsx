"use client";

/**
 * Base Block Component
 *
 * Provides the common visual styling for all strategy blocks.
 * Individual block types compose this with their specific content.
 * Features entrance animations and premium visual effects.
 */

import { type ReactNode, useMemo, useState, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStrategyStore } from "@/lib/strategy/store";
import type { StrategyEdgeData } from "@/lib/strategy/types";
import { BlockValueBadge } from "../block-value-badge";

// ============================================================================
// Types
// ============================================================================

export interface BaseBlockProps {
  children: ReactNode;
  selected?: boolean;
  blockType: "input" | "stake" | "lend" | "borrow" | "swap";
  label: string;
  icon: ReactNode;
  hasInput?: boolean;
  hasOutput?: boolean;
  isValid?: boolean;
  errorMessage?: string;
  blockId?: string; // For calculating output allocation
}

// ============================================================================
// Color Mapping
// ============================================================================

const blockColors: Record<
  BaseBlockProps["blockType"],
  { border: string; bg: string; glow: string; glowRgb: string; icon: string; gradient: string }
> = {
  input: {
    border: "border-blue-500/40",
    bg: "bg-gradient-to-br from-blue-500/15 to-blue-600/5",
    glow: "shadow-blue-500/30",
    glowRgb: "59, 130, 246",
    icon: "text-blue-400",
    gradient: "from-blue-500/20 via-transparent to-cyan-500/10",
  },
  stake: {
    border: "border-purple-500/40",
    bg: "bg-gradient-to-br from-purple-500/15 to-violet-600/5",
    glow: "shadow-purple-500/30",
    glowRgb: "168, 85, 247",
    icon: "text-purple-400",
    gradient: "from-purple-500/20 via-transparent to-pink-500/10",
  },
  lend: {
    border: "border-emerald-500/40",
    bg: "bg-gradient-to-br from-emerald-500/15 to-green-600/5",
    glow: "shadow-emerald-500/30",
    glowRgb: "16, 185, 129",
    icon: "text-emerald-400",
    gradient: "from-emerald-500/20 via-transparent to-cyan-500/10",
  },
  borrow: {
    border: "border-amber-500/40",
    bg: "bg-gradient-to-br from-amber-500/15 to-orange-600/5",
    glow: "shadow-amber-500/30",
    glowRgb: "245, 158, 11",
    icon: "text-amber-400",
    gradient: "from-amber-500/20 via-transparent to-rose-500/10",
  },
  swap: {
    border: "border-cyan-500/40",
    bg: "bg-gradient-to-br from-cyan-500/15 to-teal-600/5",
    glow: "shadow-cyan-500/30",
    glowRgb: "6, 182, 212",
    icon: "text-cyan-400",
    gradient: "from-cyan-500/20 via-transparent to-blue-500/10",
  },
};

// ============================================================================
// Component
// ============================================================================

export function BaseBlock({
  children,
  selected,
  blockType,
  label,
  icon,
  hasInput = true,
  hasOutput = true,
  isValid = true,
  errorMessage,
  blockId,
}: BaseBlockProps) {
  const colors = blockColors[blockType];
  const edges = useStrategyStore((state) => state.edges);
  const simulationResult = useStrategyStore((state) => state.simulationResult);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Get computed values for this block from simulation
  const blockValue = useMemo(() => {
    if (!blockId || !simulationResult?.blockValues) return null;
    return simulationResult.blockValues[blockId] ?? null;
  }, [blockId, simulationResult]);

  // Mark as animated after mount
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Calculate total output allocation for this block
  const outputAllocation = useMemo(() => {
    if (!blockId || !hasOutput) return { total: 100, count: 0, isOver: false };

    const outgoingEdges = edges.filter((e) => e.source === blockId);
    if (outgoingEdges.length === 0) return { total: 0, count: 0, isOver: false };

    const total = outgoingEdges.reduce((sum, edge) => {
      const data = edge.data as StrategyEdgeData | undefined;
      return sum + (data?.flowPercent ?? 100);
    }, 0);

    return {
      total,
      count: outgoingEdges.length,
      isOver: total > 100,
    };
  }, [blockId, edges, hasOutput]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={hasAnimated ? { scale: 1.02, y: -2, transition: { duration: 0.2 } } : undefined}
      className={cn(
        // Base styles - explicit width helps React Flow with selection hit testing
        "relative w-[220px] rounded-xl border",
        "glass-depth-2 transition-all duration-300",
        // Holographic gradient overlay
        "bg-gradient-to-br from-[#12121a]/95 via-[#0d0d14]/90 to-[#12121a]/95",
        // Border color based on type
        colors.border,
        // Premium hover glow effect
        "hover:shadow-xl",
        blockType === "input" && "hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:border-blue-500/60",
        blockType === "stake" && "hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:border-purple-500/60",
        blockType === "lend" && "hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:border-emerald-500/60",
        blockType === "borrow" && "hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:border-amber-500/60",
        blockType === "swap" && "hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] hover:border-cyan-500/60",
        // Selected state with neon glow
        selected && [
          "ring-2 ring-offset-2 ring-offset-[#0a0a0f]",
          "shadow-xl",
          blockType === "input" && "ring-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.35)]",
          blockType === "stake" && "ring-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.35)]",
          blockType === "lend" && "ring-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.35)]",
          blockType === "borrow" && "ring-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.35)]",
          blockType === "swap" && "ring-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.35)]",
        ],
        // Invalid state
        !isValid && "border-red-500/50 ring-red-500/30"
      )}
    >
      {/* Holographic gradient overlay on hover */}
      <div
        className={cn(
          "absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none",
          `bg-gradient-to-br ${colors.gradient}`
        )}
      />
      {/* Input Handle */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(
            "!w-3 !h-3 !border-2 !border-[#0a0a0f] !bg-[#2a2a3a]",
            "hover:!bg-[#735CFF] transition-colors"
          )}
        />
      )}

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-xl border-b border-white/5",
          colors.bg
        )}
      >
        <span className={cn("text-lg", colors.icon)}>{icon}</span>
        <span className="text-sm font-medium text-white/90">{label}</span>
      </div>

      {/* Content */}
      <div className="p-3">{children}</div>

      {/* Error Message */}
      {!isValid && errorMessage && (
        <div className="px-3 pb-2 text-xs text-red-400">{errorMessage}</div>
      )}

      {/* Output Handle */}
      {hasOutput && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            className={cn(
              "!w-3 !h-3 !border-2 !border-[#0a0a0f] !bg-[#2a2a3a]",
              "hover:!bg-[#735CFF] transition-colors"
            )}
          />

          {/* Output Allocation Badge - shows when multiple outputs or over-allocated */}
          {outputAllocation.count > 1 && (
            <div
              className={cn(
                "absolute -right-1 -bottom-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                "flex items-center gap-1 border shadow-lg",
                outputAllocation.isOver
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : outputAllocation.total === 100
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
              )}
            >
              <span>{outputAllocation.total}%</span>
              {outputAllocation.isOver && <span>⚠</span>}
            </div>
          )}
        </>
      )}

      {/* Corner Accents - animated on selected */}
      <motion.div
        className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 rounded-tl-xl"
        animate={selected ? { borderColor: "rgba(255,255,255,0.5)" } : {}}
      />
      <motion.div
        className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 rounded-tr-xl"
        animate={selected ? { borderColor: "rgba(255,255,255,0.5)" } : {}}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 rounded-bl-xl"
        animate={selected ? { borderColor: "rgba(255,255,255,0.5)" } : {}}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 rounded-br-xl"
        animate={selected ? { borderColor: "rgba(255,255,255,0.5)" } : {}}
      />

      {/* Subtle inner glow when selected */}
      {selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, rgba(${colors.glowRgb}, 0.15), transparent 70%)`,
          }}
        />
      )}

      {/* Value propagation badges */}
      <BlockValueBadge
        type="input"
        value={blockValue}
        isVisible={!!blockValue && hasInput}
      />
      <BlockValueBadge
        type="output"
        value={blockValue}
        isVisible={!!blockValue && hasOutput}
      />

    </motion.div>
  );
}
