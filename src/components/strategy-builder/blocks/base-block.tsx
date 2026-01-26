"use client";

/**
 * Base Block Component
 *
 * Provides the common visual styling for all strategy blocks.
 * Individual block types compose this with their specific content.
 */

import { type ReactNode, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useStrategyStore } from "@/lib/strategy/store";
import type { StrategyEdgeData } from "@/lib/strategy/types";

// ============================================================================
// Types
// ============================================================================

export interface BaseBlockProps {
  children: ReactNode;
  selected?: boolean;
  blockType: "input" | "stake" | "lend" | "borrow" | "swap" | "loop";
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
  { border: string; bg: string; glow: string; icon: string }
> = {
  input: {
    border: "border-blue-500/50",
    bg: "bg-blue-500/10",
    glow: "shadow-blue-500/20",
    icon: "text-blue-400",
  },
  stake: {
    border: "border-purple-500/50",
    bg: "bg-purple-500/10",
    glow: "shadow-purple-500/20",
    icon: "text-purple-400",
  },
  lend: {
    border: "border-green-500/50",
    bg: "bg-green-500/10",
    glow: "shadow-green-500/20",
    icon: "text-green-400",
  },
  borrow: {
    border: "border-amber-500/50",
    bg: "bg-amber-500/10",
    glow: "shadow-amber-500/20",
    icon: "text-amber-400",
  },
  swap: {
    border: "border-cyan-500/50",
    bg: "bg-cyan-500/10",
    glow: "shadow-cyan-500/20",
    icon: "text-cyan-400",
  },
  loop: {
    border: "border-rose-500/50",
    bg: "bg-rose-500/10",
    glow: "shadow-rose-500/20",
    icon: "text-rose-400",
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
    <div
      className={cn(
        // Base styles
        "relative min-w-[200px] rounded-xl border backdrop-blur-sm",
        "bg-[#12121a]/90 transition-all duration-200",
        // Border color based on type
        colors.border,
        // Selected state
        selected && [
          "ring-2 ring-offset-2 ring-offset-[#0a0a0f]",
          blockType === "input" && "ring-blue-500",
          blockType === "stake" && "ring-purple-500",
          blockType === "lend" && "ring-green-500",
          blockType === "borrow" && "ring-amber-500",
          blockType === "swap" && "ring-cyan-500",
          blockType === "loop" && "ring-rose-500",
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

      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 rounded-br-xl" />
    </div>
  );
}
