"use client";

/**
 * Auto-Wrap Block Component
 *
 * A visually distinct block that is automatically inserted by the route optimizer
 * to handle token wrapping/unwrapping between incompatible protocols.
 *
 * Key visual differences from regular blocks:
 * - Smaller, more compact design
 * - Dashed border to indicate auto-inserted
 * - Muted color palette
 * - "Auto" badge indicator
 * - Non-editable (system-managed)
 */

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AssetType } from "@/lib/strategy/types";
import type { WrapStep } from "@/lib/strategy/route-optimizer";

// ============================================================================
// Types
// ============================================================================

export interface AutoWrapBlockData extends Record<string, unknown> {
  type: "auto-wrap";
  label: string;
  isConfigured: true;
  isValid: true;
  isAutoInserted: true;
  fromAsset: AssetType;
  toAsset: AssetType;
  wrapStep: WrapStep;
  wrapperContract: string;
  icon?: string;
  slippage?: number;
  estimatedOutput?: number | null;
}

type AutoWrapNode = Node<AutoWrapBlockData>;

// ============================================================================
// Token Icons
// ============================================================================

const TOKEN_ICONS: Record<string, string> = {
  ETH: "⟠",
  stETH: "🔵",
  wstETH: "🔷",
  eETH: "💎",
  weETH: "🔹",
  rETH: "🚀",
  cbETH: "🔸",
  sfrxETH: "⚡",
  USDC: "💵",
  DAI: "🌕",
};

function getTokenIcon(token: AssetType): string {
  return TOKEN_ICONS[token] ?? "🪙";
}

// ============================================================================
// Component
// ============================================================================

function AutoWrapBlockComponent({ data, selected }: NodeProps<AutoWrapNode>) {
  const { fromAsset, toAsset, wrapStep } = data;
  const isWrap = wrapStep?.isWrap ?? true;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.25,
        ease: [0.23, 1, 0.32, 1],
      }}
      className={cn(
        // Compact size - smaller than regular blocks
        "relative w-[140px] rounded-lg",
        // Dashed border to indicate auto-inserted
        "border-2 border-dashed",
        // Muted background
        "bg-gradient-to-br from-[#1a1a24]/90 via-[#12121a]/85 to-[#1a1a24]/90",
        // Default state - subtle appearance
        "border-slate-500/30",
        // Hover state
        "hover:border-slate-400/50 hover:shadow-lg hover:shadow-slate-500/10",
        // Selected state
        selected && [
          "ring-1 ring-slate-400/50",
          "border-slate-400/60",
          "shadow-lg shadow-slate-500/20",
        ]
      )}
    >
      {/* Auto Badge */}
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10">
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wider",
            "bg-slate-700/80 text-slate-300 border border-slate-500/30",
            "backdrop-blur-sm"
          )}
        >
          Auto
        </span>
      </div>

      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!w-2.5 !h-2.5 !border-2 !border-[#0a0a0f] !bg-slate-500",
          "hover:!bg-slate-400 transition-colors"
        )}
      />

      {/* Content */}
      <div className="px-3 py-3">
        {/* Token Flow Visualization */}
        <div className="flex items-center justify-center gap-1.5">
          {/* From Token */}
          <div className="flex flex-col items-center">
            <span className="text-lg">{getTokenIcon(fromAsset)}</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
              {fromAsset}
            </span>
          </div>

          {/* Arrow */}
          <motion.div
            className="flex items-center text-slate-500"
            animate={{
              x: [0, 3, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <svg
              width="20"
              height="12"
              viewBox="0 0 20 12"
              fill="none"
              className="text-slate-400"
            >
              <path
                d="M1 6H17M17 6L12 1M17 6L12 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          {/* To Token */}
          <div className="flex flex-col items-center">
            <span className="text-lg">{getTokenIcon(toAsset)}</span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
              {toAsset}
            </span>
          </div>
        </div>

        {/* Action Label */}
        <div className="text-center mt-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">
            {isWrap ? "Wrap" : "Unwrap"}
          </span>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!w-2.5 !h-2.5 !border-2 !border-[#0a0a0f] !bg-slate-500",
          "hover:!bg-slate-400 transition-colors"
        )}
      />

      {/* Subtle inner glow when selected */}
      {selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(148, 163, 184, 0.1), transparent 70%)",
          }}
        />
      )}

      {/* Tooltip on hover - shows contract address */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 -bottom-10 z-20",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "px-2 py-1 rounded text-[9px] text-slate-400 whitespace-nowrap",
            "bg-slate-800/90 border border-slate-700/50"
          )}
        >
          Auto-inserted for protocol compatibility
        </div>
      </div>
    </motion.div>
  );
}

export const AutoWrapBlock = memo(AutoWrapBlockComponent);
