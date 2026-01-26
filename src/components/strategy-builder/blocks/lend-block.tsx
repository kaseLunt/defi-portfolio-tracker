"use client";

/**
 * Lend Block Component
 *
 * Represents supplying assets to a lending protocol.
 * Shows protocol selection, supply APY, and LTV settings.
 */

import { memo, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { PiggyBank } from "lucide-react";
import { BaseBlock } from "./base-block";
import { useStrategyStore } from "@/lib/strategy/store";
import type { LendBlockData, LendProtocol, StrategyBlock, StakeBlockData } from "@/lib/strategy/types";

// ============================================================================
// Protocol Options
// ============================================================================

// Format APY with appropriate precision, no trailing zeros
function formatApy(apy: number): string {
  if (apy === 0) return "0%";

  let decimals = 2;
  if (apy < 1) decimals = 3;
  if (apy < 0.01) decimals = 4;
  if (apy < 0.0001) decimals = 5;

  // Remove trailing zeros after decimal
  return `${parseFloat(apy.toFixed(decimals))}%`;
}

const LEND_PROTOCOLS: {
  value: LendProtocol;
  label: string;
  logo: string;
  maxLtv: number;
  liquidationThreshold: number;
}[] = [
  { value: "aave-v3", label: "Aave V3", logo: "👻", maxLtv: 80, liquidationThreshold: 82.5 },
  { value: "compound-v3", label: "Compound V3", logo: "🧪", maxLtv: 83, liquidationThreshold: 85 },
  { value: "morpho", label: "Morpho", logo: "🦋", maxLtv: 86, liquidationThreshold: 91.5 },
  { value: "spark", label: "Spark", logo: "✨", maxLtv: 80, liquidationThreshold: 82.5 },
];

// ============================================================================
// Component
// ============================================================================

function LendBlockComponent({ id, data, selected }: NodeProps<StrategyBlock>) {
  const blockData = data as unknown as LendBlockData;

  const updateBlock = useStrategyStore((state) => state.updateBlock);
  const selectedBlockId = useStrategyStore((state) => state.selectedBlockId);
  const getLendingApy = useStrategyStore((state) => state.getLendingApy);
  const yieldsLoading = useStrategyStore((state) => state.yieldsLoading);
  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);

  const isSelected = selected || selectedBlockId === id;

  // Detect incoming asset from connected block
  const incomingAsset = useMemo(() => {
    // Find edge pointing to this block
    const incomingEdge = edges.find((e) => e.target === id);
    if (!incomingEdge) return "ETH"; // Default if not connected

    // Find source block
    const sourceBlock = blocks.find((b) => b.id === incomingEdge.source);
    if (!sourceBlock) return "ETH";

    // Get output asset based on source block type
    if (sourceBlock.type === "stake") {
      const stakeData = sourceBlock.data as unknown as StakeBlockData;
      return stakeData.outputAsset; // e.g., "eETH", "stETH", etc.
    }
    if (sourceBlock.type === "input") {
      return "ETH";
    }
    return "ETH";
  }, [id, edges, blocks]);

  // Always use live APY from DeFi Llama with correct asset
  const liveSupplyApy = getLendingApy(blockData.protocol, "supply", incomingAsset);

  // Get current protocol info
  const currentProtocol = LEND_PROTOCOLS.find(
    (p) => p.value === blockData.protocol
  );

  // Handle protocol change
  const handleProtocolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const protocol = e.target.value as LendProtocol;
    const protocolInfo = LEND_PROTOCOLS.find((p) => p.value === protocol);
    updateBlock(id, {
      protocol,
      maxLtv: protocolInfo?.maxLtv ?? 80,
      liquidationThreshold: protocolInfo?.liquidationThreshold ?? 82.5,
      isConfigured: true,
      isValid: true,
    });
  };

  return (
    <BaseBlock
      blockType="lend"
      label="Lend"
      icon={<PiggyBank className="w-4 h-4" />}
      selected={isSelected}
      hasInput={true}
      hasOutput={true}
      isValid={blockData.isValid}
      blockId={id}
    >
      <div className="space-y-3">
        {/* Protocol Selector */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Protocol</label>
          <select
            value={blockData.protocol}
            onChange={handleProtocolChange}
            className="w-full px-2 py-1.5 rounded-lg bg-[#1a1a24] border border-white/10
                       text-sm text-white focus:border-green-500 focus:outline-none
                       transition-colors"
          >
            {LEND_PROTOCOLS.map((protocol) => (
              <option key={protocol.value} value={protocol.value}>
                {protocol.logo} {protocol.label}
              </option>
            ))}
          </select>
        </div>

        {/* Asset & APY Display */}
        <div className="flex justify-between items-center py-2 px-2 rounded-lg bg-green-500/10">
          <div className="flex flex-col">
            <span className="text-xs text-white/60">Supply APY</span>
            <span className="text-[10px] text-white/40">{incomingAsset}</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-green-400">
              {yieldsLoading ? "..." : formatApy(liveSupplyApy)}
            </span>
            {/* LSTs earn staking yield on top */}
            {incomingAsset !== "ETH" && liveSupplyApy < 1 && (
              <div className="text-[9px] text-white/40">+ staking yield</div>
            )}
          </div>
        </div>

        {/* LTV Info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="py-1.5 px-2 rounded bg-white/5">
            <div className="text-white/40">Max LTV</div>
            <div className="font-medium text-white">
              {currentProtocol?.maxLtv ?? blockData.maxLtv}%
            </div>
          </div>
          <div className="py-1.5 px-2 rounded bg-white/5">
            <div className="text-white/40">Liq. Threshold</div>
            <div className="font-medium text-white">
              {currentProtocol?.liquidationThreshold ?? blockData.liquidationThreshold}%
            </div>
          </div>
        </div>

        {/* Output Info */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Collateral Position</span>
            <span className="text-green-400">→ Borrow</span>
          </div>
        </div>
      </div>
    </BaseBlock>
  );
}

export const LendBlock = memo(LendBlockComponent);
