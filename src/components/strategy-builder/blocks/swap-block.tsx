"use client";

/**
 * Swap Block Component
 *
 * Represents a token swap via DEX aggregator.
 * Configurable slippage and asset pair.
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowLeftRight } from "lucide-react";
import { BaseBlock } from "./base-block";
import { useStrategyStore } from "@/lib/strategy/store";
import type { SwapBlockData, AssetType, StrategyBlock } from "@/lib/strategy/types";

// ============================================================================
// Swappable Assets
// ============================================================================

const SWAP_ASSETS: { value: AssetType; label: string; icon: string }[] = [
  { value: "ETH", label: "ETH", icon: "Ξ" },
  { value: "stETH", label: "stETH", icon: "🔵" },
  { value: "eETH", label: "eETH", icon: "🔷" },
  { value: "weETH", label: "weETH", icon: "🔷" },
  { value: "wstETH", label: "wstETH", icon: "🔵" },
  { value: "rETH", label: "rETH", icon: "🚀" },
  { value: "USDC", label: "USDC", icon: "$" },
  { value: "USDT", label: "USDT", icon: "$" },
  { value: "DAI", label: "DAI", icon: "◈" },
];

// ============================================================================
// Component
// ============================================================================

function SwapBlockComponent({ id, data, selected }: NodeProps<StrategyBlock>) {
  const blockData = data as unknown as SwapBlockData;

  const updateBlock = useStrategyStore((state) => state.updateBlock);
  const selectedBlockId = useStrategyStore((state) => state.selectedBlockId);

  const isSelected = selected || selectedBlockId === id;

  // Handle from asset change
  const handleFromAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateBlock(id, {
      fromAsset: e.target.value as AssetType,
      isConfigured: true,
      isValid: true,
    });
  };

  // Handle to asset change
  const handleToAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateBlock(id, {
      toAsset: e.target.value as AssetType,
      isConfigured: true,
      isValid: true,
    });
  };

  // Handle slippage change
  const handleSlippageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateBlock(id, { slippage: parseFloat(e.target.value) });
  };

  return (
    <BaseBlock
      blockType="swap"
      label="Swap"
      icon={<ArrowLeftRight className="w-4 h-4" />}
      selected={isSelected}
      hasInput={true}
      hasOutput={true}
      isValid={blockData.isValid}
      blockId={id}
    >
      <div className="space-y-3">
        {/* From Asset */}
        <div className="nodrag">
          <label className="block text-xs text-white/50 mb-1">From</label>
          <select
            value={blockData.fromAsset}
            onChange={handleFromAssetChange}
            className="nodrag w-full px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-white/10
                       text-sm text-white focus:border-cyan-500 focus:outline-none
                       transition-colors cursor-pointer"
          >
            {SWAP_ASSETS.map((asset) => (
              <option key={asset.value} value={asset.value}>
                {asset.icon} {asset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Arrow */}
        <div className="flex justify-center">
          <div className="p-1.5 rounded-full bg-cyan-500/20 text-cyan-400">
            <ArrowLeftRight className="w-3 h-3" />
          </div>
        </div>

        {/* To Asset */}
        <div className="nodrag">
          <label className="block text-xs text-white/50 mb-1">To</label>
          <select
            value={blockData.toAsset}
            onChange={handleToAssetChange}
            className="nodrag w-full px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-white/10
                       text-sm text-white focus:border-cyan-500 focus:outline-none
                       transition-colors cursor-pointer"
          >
            {SWAP_ASSETS.map((asset) => (
              <option key={asset.value} value={asset.value}>
                {asset.icon} {asset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Slippage */}
        <div className="pt-2 border-t border-white/5 nodrag">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">Max Slippage</span>
            <select
              value={blockData.slippage}
              onChange={handleSlippageChange}
              className="nodrag px-2 py-0.5 rounded bg-[#1a1a24] border border-white/10
                         text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              <option value={0.1}>0.1%</option>
              <option value={0.5}>0.5%</option>
              <option value={1}>1.0%</option>
              <option value={2}>2.0%</option>
            </select>
          </div>
        </div>

        {/* Fee Info */}
        <div className="flex justify-between items-center py-2 px-2 rounded-lg bg-cyan-500/10">
          <span className="text-xs text-white/60">Swap Fee</span>
          <span className="text-xs font-medium text-cyan-400">~0.3%</span>
        </div>
      </div>
    </BaseBlock>
  );
}

export const SwapBlock = memo(SwapBlockComponent);
