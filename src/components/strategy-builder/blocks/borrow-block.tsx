"use client";

/**
 * Borrow Block Component
 *
 * Represents borrowing assets against collateral.
 * Requires connection from a Lend block.
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { HandCoins } from "lucide-react";
import { BaseBlock } from "./base-block";
import { useStrategyStore } from "@/lib/strategy/store";
import type { BorrowBlockData, AssetType, StrategyBlock } from "@/lib/strategy/types";

// ============================================================================
// Borrowable Assets
// ============================================================================

const BORROW_ASSETS: { value: AssetType; label: string; icon: string }[] = [
  { value: "ETH", label: "ETH", icon: "Ξ" },
  { value: "USDC", label: "USDC", icon: "$" },
  { value: "USDT", label: "USDT", icon: "$" },
  { value: "DAI", label: "DAI", icon: "◈" },
];

// ============================================================================
// Component
// ============================================================================

function BorrowBlockComponent({ id, data, selected }: NodeProps<StrategyBlock>) {
  const blockData = data as unknown as BorrowBlockData;

  const updateBlock = useStrategyStore((state) => state.updateBlock);
  const selectedBlockId = useStrategyStore((state) => state.selectedBlockId);
  const getLendingApy = useStrategyStore((state) => state.getLendingApy);
  const yieldsLoading = useStrategyStore((state) => state.yieldsLoading);

  const isSelected = selected || selectedBlockId === id;

  // Always use live APY from DeFi Llama (defaults to aave-v3 borrow rate)
  const liveBorrowApy = getLendingApy("aave-v3", "borrow");

  // Handle asset change
  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateBlock(id, {
      asset: e.target.value as AssetType,
      isConfigured: true,
      isValid: true,
    });
  };

  // Handle LTV change
  const handleLtvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 95);
    updateBlock(id, { ltvPercent: value });
  };

  // Risk level based on LTV
  const getRiskLevel = (ltv: number) => {
    if (ltv < 50) return { label: "Safe", color: "text-green-400", bg: "bg-green-500/10" };
    if (ltv < 70) return { label: "Moderate", color: "text-yellow-400", bg: "bg-yellow-500/10" };
    if (ltv < 80) return { label: "Elevated", color: "text-orange-400", bg: "bg-orange-500/10" };
    return { label: "High Risk", color: "text-red-400", bg: "bg-red-500/10" };
  };

  const riskLevel = getRiskLevel(blockData.ltvPercent);

  return (
    <BaseBlock
      blockType="borrow"
      label="Borrow"
      icon={<HandCoins className="w-4 h-4" />}
      selected={isSelected}
      hasInput={true}
      hasOutput={true}
      isValid={blockData.isValid}
      blockId={id}
    >
      <div className="space-y-3">
        {/* Asset Selector */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Borrow Asset</label>
          <select
            value={blockData.asset}
            onChange={handleAssetChange}
            className="w-full px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-white/10
                       text-sm text-white focus:border-amber-500 focus:outline-none
                       transition-colors"
          >
            {BORROW_ASSETS.map((asset) => (
              <option key={asset.value} value={asset.value}>
                {asset.icon} {asset.label}
              </option>
            ))}
          </select>
        </div>

        {/* LTV Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-white/50">LTV Ratio</label>
            <span className="text-xs font-medium text-amber-400">
              {blockData.ltvPercent}%
            </span>
          </div>
          <input
            type="range"
            value={blockData.ltvPercent}
            onChange={handleLtvChange}
            min={10}
            max={90}
            step={5}
            className="w-full h-1.5 rounded-full bg-[#1a1a24] appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-amber-500"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
            <span>Safe (10%)</span>
            <span>Max (90%)</span>
          </div>
        </div>

        {/* Borrow APY */}
        <div className="flex justify-between items-center py-2 px-2 rounded-lg bg-amber-500/10">
          <span className="text-xs text-white/60">Borrow APY</span>
          <span className="text-sm font-semibold text-amber-400">
            {yieldsLoading ? "..." : `-${liveBorrowApy.toFixed(2)}%`}
          </span>
        </div>

        {/* Risk Level */}
        <div className={`flex justify-between items-center py-2 px-2 rounded-lg ${riskLevel.bg}`}>
          <span className="text-xs text-white/60">Risk Level</span>
          <span className={`text-xs font-semibold ${riskLevel.color}`}>
            {riskLevel.label}
          </span>
        </div>
      </div>
    </BaseBlock>
  );
}

export const BorrowBlock = memo(BorrowBlockComponent);
