"use client";

/**
 * Stake Block Component
 *
 * Represents staking ETH into a liquid staking protocol.
 * Shows protocol selection, APY, and output asset.
 */

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Layers } from "lucide-react";
import { BaseBlock } from "./base-block";
import { useStrategyStore } from "@/lib/strategy/store";
import type { StakeBlockData, StakeProtocol, AssetType, StrategyBlock } from "@/lib/strategy/types";

// ============================================================================
// Protocol Options
// ============================================================================

const STAKE_PROTOCOLS: {
  value: StakeProtocol;
  label: string;
  outputAsset: AssetType;
  logo: string;
}[] = [
  { value: "etherfi", label: "EtherFi", outputAsset: "eETH", logo: "🔷" },
  { value: "lido", label: "Lido", outputAsset: "stETH", logo: "🔵" },
  { value: "rocketpool", label: "Rocket Pool", outputAsset: "rETH", logo: "🚀" },
  { value: "frax", label: "Frax", outputAsset: "sfrxETH", logo: "⚡" },
  { value: "coinbase", label: "Coinbase", outputAsset: "cbETH", logo: "🔹" },
];

// ============================================================================
// Component
// ============================================================================

function StakeBlockComponent({ id, data, selected }: NodeProps<StrategyBlock>) {
  const blockData = data as unknown as StakeBlockData;

  const updateBlock = useStrategyStore((state) => state.updateBlock);
  const selectedBlockId = useStrategyStore((state) => state.selectedBlockId);
  const getStakingApy = useStrategyStore((state) => state.getStakingApy);
  const yieldsLoading = useStrategyStore((state) => state.yieldsLoading);

  const isSelected = selected || selectedBlockId === id;

  // Always use live APY from DeFi Llama (not cached block data)
  const liveApy = getStakingApy(blockData.protocol);

  // Get current protocol info
  const currentProtocol = STAKE_PROTOCOLS.find(
    (p) => p.value === blockData.protocol
  );

  // Handle protocol change
  const handleProtocolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const protocol = e.target.value as StakeProtocol;
    const protocolInfo = STAKE_PROTOCOLS.find((p) => p.value === protocol);
    updateBlock(id, {
      protocol,
      outputAsset: protocolInfo?.outputAsset ?? "eETH",
      apy: getStakingApy(protocol),
      isConfigured: true,
      isValid: true,
    });
  };

  return (
    <BaseBlock
      blockType="stake"
      label="Stake"
      icon={<Layers className="w-4 h-4" />}
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
                       text-sm text-white focus:border-purple-500 focus:outline-none
                       transition-colors"
          >
            {STAKE_PROTOCOLS.map((protocol) => (
              <option key={protocol.value} value={protocol.value}>
                {protocol.logo} {protocol.label}
              </option>
            ))}
          </select>
        </div>

        {/* APY Display */}
        <div className="flex justify-between items-center py-2 px-2 rounded-lg bg-purple-500/10">
          <span className="text-xs text-white/60">APY</span>
          <span className="text-sm font-semibold text-purple-400">
            {yieldsLoading ? "..." : `${liveApy.toFixed(2)}%`}
          </span>
        </div>

        {/* Asset Flow */}
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <span className="text-white/50">In:</span>
              <span className="text-white">ETH</span>
            </div>
            <span className="text-white/30">→</span>
            <div className="flex items-center gap-1">
              <span className="text-white/50">Out:</span>
              <span className="text-purple-400 font-medium">
                {currentProtocol?.outputAsset ?? "eETH"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </BaseBlock>
  );
}

export const StakeBlock = memo(StakeBlockComponent);
