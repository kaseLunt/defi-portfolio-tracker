"use client";

/**
 * Borrow Block Component
 *
 * Represents borrowing assets against collateral.
 * Context-aware: Shows collateral source, calculated borrow amount,
 * and health factor preview.
 */

import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { HandCoins, AlertTriangle, Shield } from "lucide-react";
import { BaseBlock } from "./base-block";
import { useStrategyStore } from "@/lib/strategy/store";
import type {
  BorrowBlockData,
  AssetType,
  StrategyBlock,
  LendBlockData,
  InputBlockData,
  StakeBlockData,
  StrategyEdgeData,
} from "@/lib/strategy/types";

// ============================================================================
// Constants
// ============================================================================

const ETH_PRICE = 3300; // Demo price - would fetch from API

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
  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);

  const isSelected = selected || selectedBlockId === id;

  // Always use live APY from DeFi Llama (defaults to aave-v3 borrow rate)
  const liveBorrowApy = getLendingApy("aave-v3", "borrow");

  // Trace back to find collateral context
  const collateralContext = useMemo(() => {
    // Find edge pointing to this block
    const incomingEdge = edges.find((e) => e.target === id);
    if (!incomingEdge) {
      return { connected: false, collateralValue: 0, collateralAsset: "ETH", lendProtocol: null, liquidationThreshold: 82.5 };
    }

    // Find source block (should be Lend block)
    const sourceBlock = blocks.find((b) => b.id === incomingEdge.source);
    if (!sourceBlock) {
      return { connected: false, collateralValue: 0, collateralAsset: "ETH", lendProtocol: null, liquidationThreshold: 82.5 };
    }

    // Get edge flow percent
    const edgeData = incomingEdge.data as StrategyEdgeData | undefined;
    const flowPercent = edgeData?.flowPercent ?? 100;

    // Check if source is a Lend block
    if (sourceBlock.type === "lend") {
      const lendData = sourceBlock.data as unknown as LendBlockData;

      // Now trace back from Lend to get the actual collateral value
      const lendIncomingEdge = edges.find((e) => e.target === sourceBlock.id);
      let collateralValue = 0;
      let collateralAsset = "ETH";

      if (lendIncomingEdge) {
        const lendSource = blocks.find((b) => b.id === lendIncomingEdge.source);
        const lendEdgeData = lendIncomingEdge.data as StrategyEdgeData | undefined;
        const lendFlowPercent = lendEdgeData?.flowPercent ?? 100;

        if (lendSource?.type === "stake") {
          const stakeData = lendSource.data as unknown as StakeBlockData;
          collateralAsset = stakeData.outputAsset;

          // Trace back further to input
          const stakeIncomingEdge = edges.find((e) => e.target === lendSource.id);
          if (stakeIncomingEdge) {
            const inputBlock = blocks.find((b) => b.id === stakeIncomingEdge.source);
            if (inputBlock?.type === "input") {
              const inputData = inputBlock.data as unknown as InputBlockData;
              const stakeEdgeData = stakeIncomingEdge.data as StrategyEdgeData | undefined;
              const stakeFlowPercent = stakeEdgeData?.flowPercent ?? 100;
              const inputValue = inputData.asset === "ETH" ? inputData.amount * ETH_PRICE : inputData.amount;
              collateralValue = (inputValue * stakeFlowPercent / 100) * (lendFlowPercent / 100) * (flowPercent / 100);
            }
          }
        } else if (lendSource?.type === "input") {
          const inputData = lendSource.data as unknown as InputBlockData;
          collateralAsset = inputData.asset;
          const inputValue = inputData.asset === "ETH" ? inputData.amount * ETH_PRICE : inputData.amount;
          collateralValue = (inputValue * lendFlowPercent / 100) * (flowPercent / 100);
        }
      }

      return {
        connected: true,
        collateralValue,
        collateralAsset,
        lendProtocol: lendData.protocol,
        liquidationThreshold: lendData.liquidationThreshold,
      };
    }

    return { connected: false, collateralValue: 0, collateralAsset: "ETH", lendProtocol: null, liquidationThreshold: 82.5 };
  }, [id, blocks, edges]);

  // Calculate borrow amount and health factor
  const calculations = useMemo(() => {
    const { collateralValue, liquidationThreshold } = collateralContext;
    const borrowValue = collateralValue * (blockData.ltvPercent / 100);

    // Health Factor = (Collateral × Liq Threshold) / Debt
    const healthFactor = borrowValue > 0
      ? (collateralValue * (liquidationThreshold / 100)) / borrowValue
      : Infinity;

    // Liquidation price (ETH)
    const liquidationPrice = borrowValue > 0
      ? ETH_PRICE * (borrowValue / (collateralValue * (liquidationThreshold / 100)))
      : 0;

    // Borrow amount in asset terms (assume 1:1 for stablecoins, convert for ETH)
    const borrowAmount = blockData.asset === "ETH"
      ? borrowValue / ETH_PRICE
      : borrowValue;

    return { borrowValue, borrowAmount, healthFactor, liquidationPrice };
  }, [collateralContext, blockData.ltvPercent, blockData.asset]);

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

  // Risk level based on health factor
  const getHealthStatus = (hf: number) => {
    if (hf === Infinity) return { label: "Safe", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
    if (hf >= 2) return { label: "Healthy", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30" };
    if (hf >= 1.5) return { label: "Moderate", color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30" };
    if (hf >= 1.2) return { label: "Elevated", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" };
    return { label: "Danger", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" };
  };

  const healthStatus = getHealthStatus(calculations.healthFactor);

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
        {/* Collateral Context */}
        {collateralContext.connected ? (
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Collateral</span>
              <span className="text-xs font-medium text-white">
                ${collateralContext.collateralValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="text-[10px] text-white/30 mt-0.5">
              {collateralContext.collateralAsset} via {collateralContext.lendProtocol || "Lend"}
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] text-amber-400">Connect from a Lend block</span>
          </div>
        )}

        {/* Asset Selector */}
        <div className="nodrag">
          <label className="block text-xs text-white/50 mb-1">Borrow Asset</label>
          <select
            value={blockData.asset}
            onChange={handleAssetChange}
            className="nodrag w-full px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-white/10
                       text-sm text-white focus:border-amber-500 focus:outline-none
                       transition-colors cursor-pointer"
          >
            {BORROW_ASSETS.map((asset) => (
              <option key={asset.value} value={asset.value}>
                {asset.icon} {asset.label}
              </option>
            ))}
          </select>
        </div>

        {/* LTV Slider */}
        <div className="nodrag">
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
            className="nodrag w-full h-1.5 rounded-full bg-[#1a1a24] appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-amber-500
                       [&::-webkit-slider-thumb]:cursor-grab
                       [&::-webkit-slider-thumb]:active:cursor-grabbing"
          />
          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
            <span>Safe (10%)</span>
            <span>Max (90%)</span>
          </div>
        </div>

        {/* Calculated Borrow Amount */}
        {collateralContext.connected && calculations.borrowValue > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Borrow Amount</span>
              <span className="text-sm font-bold text-amber-400 tabular-nums">
                {blockData.asset === "ETH"
                  ? `${calculations.borrowAmount.toFixed(2)} ETH`
                  : `$${calculations.borrowValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                }
              </span>
            </div>
          </div>
        )}

        {/* Borrow APY */}
        <div className="flex justify-between items-center py-2 px-2 rounded-lg bg-[#1a1a24]">
          <span className="text-xs text-white/60">Borrow APY</span>
          <span className="text-sm font-semibold text-red-400">
            {yieldsLoading ? "..." : `-${liveBorrowApy.toFixed(2)}%`}
          </span>
        </div>

        {/* Health Factor */}
        {collateralContext.connected && calculations.borrowValue > 0 && (
          <div className={`p-2.5 rounded-lg ${healthStatus.bg} border ${healthStatus.border}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Shield className={`w-3.5 h-3.5 ${healthStatus.color}`} />
                <span className="text-xs text-white/60">Health Factor</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${healthStatus.bg} ${healthStatus.color}`}>
                {healthStatus.label}
              </span>
            </div>
            <div className={`text-lg font-bold ${healthStatus.color} tabular-nums`}>
              {calculations.healthFactor === Infinity ? "∞" : calculations.healthFactor.toFixed(2)}
            </div>
          </div>
        )}

        {/* Liquidation Warning */}
        {calculations.healthFactor !== Infinity && calculations.healthFactor < 1.5 && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-[10px] text-red-400">
              Liquidation at ${calculations.liquidationPrice.toFixed(0)} ETH price
            </div>
          </div>
        )}
      </div>
    </BaseBlock>
  );
}

export const BorrowBlock = memo(BorrowBlockComponent);
