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
  { border: string; bg: string; glow: string; glowRgb: string; icon: string }
> = {
  input: {
    border: "border-blue-500/50",
    bg: "bg-blue-500/10",
    glow: "shadow-blue-500/20",
    glowRgb: "59, 130, 246", // blue-500
    icon: "text-blue-400",
  },
  stake: {
    border: "border-purple-500/50",
    bg: "bg-purple-500/10",
    glow: "shadow-purple-500/20",
    glowRgb: "168, 85, 247", // purple-500
    icon: "text-purple-400",
  },
  lend: {
    border: "border-green-500/50",
    bg: "bg-green-500/10",
    glow: "shadow-green-500/20",
    glowRgb: "34, 197, 94", // green-500
    icon: "text-green-400",
  },
  borrow: {
    border: "border-amber-500/50",
    bg: "bg-amber-500/10",
    glow: "shadow-amber-500/20",
    glowRgb: "245, 158, 11", // amber-500
    icon: "text-amber-400",
  },
  swap: {
    border: "border-cyan-500/50",
    bg: "bg-cyan-500/10",
    glow: "shadow-cyan-500/20",
    glowRgb: "6, 182, 212", // cyan-500
    icon: "text-cyan-400",
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.2,
        ease: [0.23, 1, 0.32, 1],
      }}
      whileHover={hasAnimated ? { scale: 1.01, transition: { duration: 0.15 } } : undefined}
      className={cn(
        // Base styles - explicit width helps React Flow with selection hit testing
        "relative w-[220px] rounded-xl border backdrop-blur-sm",
        "bg-[#12121a]/90 transition-all duration-200",
        // Border color based on type
        colors.border,
        // Glow effect on hover
        "hover:shadow-lg",
        blockType === "input" && "hover:shadow-blue-500/20",
        blockType === "stake" && "hover:shadow-purple-500/20",
        blockType === "lend" && "hover:shadow-green-500/20",
        blockType === "borrow" && "hover:shadow-amber-500/20",
        blockType === "swap" && "hover:shadow-cyan-500/20",
        // Selected state
        selected && [
          "ring-2 ring-offset-2 ring-offset-[#0a0a0f]",
          "shadow-xl",
          blockType === "input" && "ring-blue-500 shadow-blue-500/30",
          blockType === "stake" && "ring-purple-500 shadow-purple-500/30",
          blockType === "lend" && "ring-green-500 shadow-green-500/30",
          blockType === "borrow" && "ring-amber-500 shadow-amber-500/30",
          blockType === "swap" && "ring-cyan-500 shadow-cyan-500/30",
        ],
        // Invalid state
        !isValid && "border-red-500/50 ring-red-500/30"
      )}
    >
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
