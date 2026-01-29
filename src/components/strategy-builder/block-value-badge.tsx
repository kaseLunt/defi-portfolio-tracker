"use client";

/**
 * Block Value Badge
 *
 * Displays input/output values on strategy blocks.
 * Shows asset amount and USD value with animations.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { ComputedBlockValue, AssetType } from "@/lib/strategy/types";

interface BlockValueBadgeProps {
  type: "input" | "output";
  value: ComputedBlockValue | null;
  isVisible: boolean;
}

function formatAmount(amount: number, asset: AssetType | null): string {
  if (!asset) return "—";
  if (amount === 0) return `0 ${asset}`;

  // Format based on magnitude
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K ${asset}`;
  } else if (amount >= 1) {
    return `${amount.toFixed(2)} ${asset}`;
  } else {
    return `${amount.toFixed(4)} ${asset}`;
  }
}

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
}

export function BlockValueBadge({ type, value, isVisible }: BlockValueBadgeProps) {
  if (!value || !isVisible) return null;

  const isInput = type === "input";
  const asset = isInput ? value.inputAsset : value.outputAsset;
  const amount = isInput ? value.inputAmount : value.outputAmount;
  const usdValue = isInput ? value.inputValueUsd : value.outputValueUsd;

  // Don't show input badge for blocks with no input (like Input block)
  if (isInput && !value.inputAsset) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: isInput ? -8 : 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`
          absolute left-1/2 -translate-x-1/2 z-10
          ${isInput ? "-top-7" : "-bottom-7"}
        `}
      >
        <div
          className={`
            flex items-center gap-1.5 px-2 py-0.5 rounded-full
            text-[10px] font-medium whitespace-nowrap
            backdrop-blur-sm border
            ${isInput
              ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
              : "bg-green-500/10 border-green-500/20 text-green-300"
            }
          `}
        >
          <span className={`${isInput ? "text-blue-400" : "text-green-400"}`}>
            {isInput ? "↓" : "↓"}
          </span>
          <motion.span
            key={`${asset}-${amount}`}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="tabular-nums"
          >
            {formatAmount(amount, asset)}
          </motion.span>
          <span className="text-white/40">·</span>
          <motion.span
            key={`usd-${usdValue}`}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="text-white/60 tabular-nums"
          >
            {formatUsd(usdValue)}
          </motion.span>
          {value.gasCostUsd > 0 && !isInput && (
            <>
              <span className="text-white/40">·</span>
              <span className="text-amber-400/80">-{formatUsd(value.gasCostUsd)}</span>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
