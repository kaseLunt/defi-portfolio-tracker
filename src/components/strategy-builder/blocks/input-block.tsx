"use client";

/**
 * Input Block Component
 *
 * The starting point for any strategy - defines the initial capital.
 * Allows selecting asset type and amount.
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Wallet } from "lucide-react";
import { BaseBlock } from "./base-block";
import { useStrategyStore } from "@/lib/strategy/store";
import type { InputBlockData, AssetType, StrategyBlock } from "@/lib/strategy/types";

// ============================================================================
// Asset Options
// ============================================================================

const ASSETS: { value: AssetType; label: string; icon: string }[] = [
  { value: "ETH", label: "ETH", icon: "Ξ" },
  { value: "USDC", label: "USDC", icon: "$" },
  { value: "USDT", label: "USDT", icon: "$" },
  { value: "DAI", label: "DAI", icon: "◈" },
];

// ============================================================================
// Component
// ============================================================================

function InputBlockComponent({ id, data, selected }: NodeProps<StrategyBlock>) {
  const blockData = data as unknown as InputBlockData;

  const updateBlock = useStrategyStore((state) => state.updateBlock);
  const selectedBlockId = useStrategyStore((state) => state.selectedBlockId);

  const isSelected = selected || selectedBlockId === id;

  // Handle asset change
  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateBlock(id, { asset: e.target.value as AssetType });
  };

  // Handle amount change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    updateBlock(id, { amount: value });
  };

  return (
    <BaseBlock
      blockType="input"
      label="Input Capital"
      icon={<Wallet className="w-4 h-4" />}
      selected={isSelected}
      hasInput={false}
      hasOutput={true}
      isValid={blockData.isValid}
      blockId={id}
    >
      <div className="space-y-3">
        {/* Asset Selector */}
        <div className="nodrag">
          <label className="block text-xs text-white/50 mb-1">Asset</label>
          <select
            value={blockData.asset}
            onChange={handleAssetChange}
            className="nodrag w-full px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-white/10
                       text-sm text-white focus:border-blue-500 focus:outline-none
                       transition-colors cursor-pointer"
          >
            {ASSETS.map((asset) => (
              <option key={asset.value} value={asset.value}>
                {asset.icon} {asset.label}
              </option>
            ))}
          </select>
        </div>

        {/* Amount Input */}
        <div className="nodrag">
          <label className="block text-xs text-white/50 mb-1">Amount</label>
          <div className="relative">
            <input
              type="number"
              value={blockData.amount}
              onChange={handleAmountChange}
              min={0}
              step={0.1}
              className="nodrag w-full px-2 py-1.5 pr-12 rounded-lg bg-[#1a1a24] border border-white/10
                         text-sm text-white focus:border-blue-500 focus:outline-none
                         transition-colors [appearance:textfield]
                         [&::-webkit-outer-spin-button]:appearance-none
                         [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/40">
              {blockData.asset}
            </span>
          </div>
        </div>

        {/* Value Display */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">Value</span>
            <span className="text-sm font-medium text-white">
              {blockData.amount.toLocaleString()} {blockData.asset}
            </span>
          </div>
        </div>
      </div>
    </BaseBlock>
  );
}

export const InputBlock = memo(InputBlockComponent);
