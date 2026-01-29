"use client";

/**
 * Flow Edge Component
 *
 * Custom edge that displays flow amount/percentage on hover.
 * Supports click-to-edit for partial allocations with slider and ETH input.
 * Features animated particles flowing along the connection path.
 */

import { memo, useState, useCallback, useMemo, useId } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { useStrategyStore } from "@/lib/strategy/store";
import { useLivePrices } from "@/hooks/use-live-prices";
import type {
  StrategyEdgeData,
  InputBlockData,
  StakeBlockData,
  LendBlockData,
  BorrowBlockData,
  SwapBlockData,
  AssetType,
} from "@/lib/strategy/types";

// ============================================================================
// Animated Flow Particles
// ============================================================================

interface FlowParticlesProps {
  path: string;
  color: string;
  particleCount: number;
  speed: number; // 0-1, affects animation duration
  isActive: boolean;
}

function FlowParticles({ path, color, particleCount, speed, isActive }: FlowParticlesProps) {
  const id = useId();

  if (!isActive) return null;

  // Create staggered particles
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const delay = (i / particleCount) * (3 - speed * 2); // Stagger start times
    const duration = 3 - speed * 2; // Faster flow = shorter duration

    return (
      <circle
        key={i}
        r={3}
        fill={color}
        filter={`url(#glow-${id})`}
      >
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
          path={path}
        />
        {/* Pulsing size */}
        <animate
          attributeName="r"
          values="2;4;2"
          dur="1s"
          repeatCount="indefinite"
        />
        {/* Fading opacity */}
        <animate
          attributeName="opacity"
          values="0.3;1;0.3"
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
        />
      </circle>
    );
  });

  return (
    <g>
      {/* Glow filter for particles */}
      <defs>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {particles}
    </g>
  );
}

// ============================================================================
// Flow Edge Component
// ============================================================================

function FlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLabelHovered, setIsLabelHovered] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [inputMode, setInputMode] = useState<"percent" | "eth">("percent");

  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const updateEdgeFlowPercent = useStrategyStore((state) => state.updateEdgeFlowPercent);
  const { prices } = useLivePrices();

  // Get real ETH price, fallback to 3000 if not available
  const ethPrice = prices["ethereum"]?.usd ?? 3000;

  // Get edge data with defaults
  const edgeData = (data as StrategyEdgeData) ?? { flowPercent: 100 };
  const flowPercent = edgeData.flowPercent ?? 100;

  // Find source block to calculate flow amount
  const sourceEdge = edges.find((e) => e.id === id);
  const sourceBlock = sourceEdge
    ? blocks.find((b) => b.id === sourceEdge.source)
    : null;

  // Calculate what actually flows OUT of the source block (accounting for transformations)
  const sourceValue = useMemo(() => {
    if (!sourceBlock) return 0;

    // If source is input block, return its amount directly
    if (sourceBlock.data.type === "input") {
      return (sourceBlock.data as InputBlockData).amount;
    }

    // Calculate what flows into a block, then apply its transformation
    const calculateBlockOutput = (blockId: string, visited: Set<string> = new Set()): number => {
      // Prevent infinite loops
      if (visited.has(blockId)) return 0;
      visited.add(blockId);

      const block = blocks.find((b) => b.id === blockId);
      if (!block) return 0;

      // Base case: input block
      if (block.data.type === "input") {
        return (block.data as InputBlockData).amount;
      }

      // Find all edges pointing to this block
      const incomingEdges = edges.filter((e) => e.target === blockId);
      if (incomingEdges.length === 0) return 0;

      // Sum up all incoming flows
      let totalInflow = 0;
      for (const edge of incomingEdges) {
        const edgeData = edge.data as StrategyEdgeData | undefined;
        const edgePercent = edgeData?.flowPercent ?? 100;

        // Recursively get the OUTPUT of the source block
        const sourceOutput = calculateBlockOutput(edge.source, visited);
        totalInflow += (sourceOutput * edgePercent) / 100;
      }

      // Apply block-specific transformations
      if (block.data.type === "borrow") {
        // Borrow block outputs LTV% of input as borrowed amount
        const borrowData = block.data as BorrowBlockData;
        return totalInflow * (borrowData.ltvPercent / 100);
      }

      if (block.data.type === "swap") {
        // Swap converts between assets - need to apply price conversion
        const swapData = block.data as SwapBlockData;

        // Get asset prices (stablecoins = $1, ETH-based assets = live ETH price)
        const getAssetPrice = (asset: AssetType): number => {
          const stablecoins = ["USDC", "USDT", "DAI"];
          if (stablecoins.includes(asset)) return 1;
          // ETH and LSTs use real ETH price
          return ethPrice;
        };

        const fromPrice = getAssetPrice(swapData.fromAsset);
        const toPrice = getAssetPrice(swapData.toAsset);

        // Convert: inputAmount * fromPrice / toPrice
        // e.g., 2.33 eETH * 3300 / 1 = 7689 USDC
        return (totalInflow * fromPrice) / toPrice;
      }

      // Other blocks pass through (stake, lend - approximately same value)
      return totalInflow;
    };

    return calculateBlockOutput(sourceBlock.id);
  }, [sourceBlock, blocks, edges, ethPrice]);

  // Calculate flow amount based on source block
  const flowAmount = useMemo(() => {
    return (sourceValue * flowPercent) / 100;
  }, [sourceValue, flowPercent]);

  // Get the bezier path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Handle edge click for editing
  const handleEdgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPopover(!showPopover);
  }, [showPopover]);

  // Handle flow percent change - auto-balances sibling edges
  const handleFlowChange = useCallback((newPercent: number) => {
    updateEdgeFlowPercent(id, Math.max(0, Math.min(100, newPercent)));
  }, [id, updateEdgeFlowPercent]);

  // Handle ETH amount change - converts to percent
  const handleEthChange = useCallback((ethAmount: number) => {
    if (sourceValue <= 0) return;
    const newPercent = (ethAmount / sourceValue) * 100;
    handleFlowChange(newPercent);
  }, [sourceValue, handleFlowChange]);

  // Determine if this is a partial flow
  const isPartialFlow = flowPercent < 100;

  // Get output asset symbol from source block (traces through graph for pass-through blocks)
  const assetSymbol = useMemo((): AssetType => {
    if (!sourceBlock) return "ETH";

    // Helper to trace backwards to find the asset flowing into a block
    const traceInputAsset = (blockId: string, visited: Set<string> = new Set()): AssetType => {
      if (visited.has(blockId)) return "ETH";
      visited.add(blockId);

      const block = blocks.find((b) => b.id === blockId);
      if (!block) return "ETH";

      // Base case: input block provides its asset
      if (block.data.type === "input") {
        return (block.data as InputBlockData).asset || "ETH";
      }

      // Stake outputs its outputAsset
      if (block.data.type === "stake") {
        return (block.data as StakeBlockData).outputAsset || "ETH";
      }

      // Swap outputs its toAsset
      if (block.data.type === "swap") {
        return (block.data as SwapBlockData).toAsset || "ETH";
      }

      // Borrow outputs its borrowed asset
      if (block.data.type === "borrow") {
        return (block.data as BorrowBlockData).asset || "ETH";
      }

      // Lend passes through the input asset - trace backwards
      if (block.data.type === "lend") {
        const incomingEdge = edges.find((e) => e.target === blockId);
        if (incomingEdge) {
          return traceInputAsset(incomingEdge.source, visited);
        }
        return "ETH";
      }

      // Default: trace backwards
      const incomingEdge = edges.find((e) => e.target === blockId);
      if (incomingEdge) {
        return traceInputAsset(incomingEdge.source, visited);
      }

      return "ETH";
    };

    return traceInputAsset(sourceBlock.id);
  }, [sourceBlock, blocks, edges]);

  // Format display value
  const formatFlowDisplay = () => {
    if (flowAmount >= 1000) return `${(flowAmount / 1000).toFixed(1)}K`;
    if (flowAmount >= 1) return flowAmount.toFixed(2);
    if (flowAmount >= 0.01) return flowAmount.toFixed(3);
    return flowAmount.toFixed(4);
  };

  // Calculate particle speed based on flow amount (more flow = faster)
  const particleSpeed = useMemo(() => {
    return Math.min(1, Math.max(0.3, flowAmount / 10));
  }, [flowAmount]);

  // Particle count based on flow percentage
  const particleCount = useMemo(() => {
    if (flowPercent >= 100) return 5;
    if (flowPercent >= 50) return 4;
    return 3;
  }, [flowPercent]);

  // Edge colors based on flow state - Cyberpunk neon
  const edgeColor = isPartialFlow
    ? "#F59E0B" // Amber for partial flow
    : "#00FFD0"; // Cyan for normal flow (cyberpunk)

  const glowColor = isPartialFlow
    ? "rgba(245, 158, 11, 0.5)"
    : "rgba(0, 255, 208, 0.4)";

  const secondaryGlow = isPartialFlow
    ? "rgba(245, 158, 11, 0.2)"
    : "rgba(168, 85, 247, 0.3)";

  const uniqueId = useId();

  return (
    <>
      {/* Outer neon glow */}
      <path
        d={edgePath}
        fill="none"
        stroke={secondaryGlow}
        strokeWidth={isHovered ? 20 : 14}
        strokeLinecap="round"
        style={{
          filter: "blur(8px)",
          transition: "all 0.3s ease",
        }}
      />

      {/* Inner glow/trail effect */}
      <path
        d={edgePath}
        fill="none"
        stroke={glowColor}
        strokeWidth={isHovered ? 10 : 6}
        strokeLinecap="round"
        style={{
          filter: "blur(3px)",
          transition: "all 0.3s ease",
        }}
      />

      {/* Main Edge Path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeWidth: selected || isHovered ? 3 : 2,
          strokeDasharray: isPartialFlow ? "8,4" : "none",
          filter: isHovered ? `drop-shadow(0 0 8px ${glowColor})` : "none",
          transition: "all 0.2s ease",
        }}
      />

      {/* Animated flow particles */}
      <FlowParticles
        path={edgePath}
        color={edgeColor}
        particleCount={particleCount}
        speed={particleSpeed}
        isActive={flowAmount > 0}
      />

      {/* Animated gradient overlay for "energy" feel */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#flow-gradient-${uniqueId})`}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ opacity: 0.6 }}
      />
      <defs>
        <linearGradient id={`flow-gradient-${uniqueId}`} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={edgeColor} stopOpacity="0">
            <animate attributeName="offset" values="-1;1" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor={edgeColor} stopOpacity="1">
            <animate attributeName="offset" values="-0.5;1.5" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor={edgeColor} stopOpacity="0">
            <animate attributeName="offset" values="0;2" dur="2s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>

      {/* Invisible wider path for easier hover/click */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={24}
        stroke="transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleEdgeClick}
        style={{ cursor: 'pointer' }}
      />

      {/* Flow Label - always visible with different states */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsLabelHovered(true)}
          onMouseLeave={() => setIsLabelHovered(false)}
        >
          <div
            onClick={handleEdgeClick}
            className={`
              relative px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer overflow-hidden
              transition-all duration-300
              ${isPartialFlow
                ? "bg-gradient-to-r from-[#1a1a24] to-[#201810] text-amber-400 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "bg-gradient-to-r from-[#1a1a24] to-[#101520] text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,255,208,0.15)]"
              }
              ${(isHovered || isLabelHovered || showPopover) ? "scale-110 shadow-[0_0_25px_rgba(168,85,247,0.3)]" : ""}
              ${!isHovered && !isLabelHovered && !showPopover && !isPartialFlow && !selected ? "opacity-80" : "opacity-100"}
            `}
          >
            {/* Holographic shimmer on hover */}
            <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full ${(isHovered || isLabelHovered) ? "translate-x-full transition-transform duration-700" : ""}`} />
            <span className="relative flex items-center gap-2">
              <span className="font-semibold">{formatFlowDisplay()} {assetSymbol}</span>
              <span className={`text-[10px] ${isPartialFlow ? "text-amber-500/70" : "text-cyan-500/60"}`}>
                {Math.round(flowPercent)}%
              </span>
            </span>
          </div>
        </div>

        {/* Popover for editing flow */}
        {showPopover && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 30}px)`,
              pointerEvents: "all",
              zIndex: 100,
            }}
            className="nodrag nopan"
          >
            <div className="bg-[#12121a] border border-white/20 rounded-xl p-4 shadow-2xl min-w-[260px]">
              {/* Header with mode toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-white font-medium">Allocate Flow</div>
                <div className="flex bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setInputMode("percent")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      inputMode === "percent"
                        ? "bg-purple-500 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setInputMode("eth")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      inputMode === "eth"
                        ? "bg-purple-500 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {assetSymbol}
                  </button>
                </div>
              </div>

              {/* Slider */}
              <div className="mb-4 nodrag">
                <input
                  type="range"
                  value={flowPercent}
                  onChange={(e) => handleFlowChange(Number(e.target.value))}
                  min={0}
                  max={100}
                  step={1}
                  className="nodrag w-full h-2 rounded-full appearance-none cursor-pointer
                           bg-gradient-to-r from-white/10 via-purple-500/50 to-purple-500
                           [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:w-4
                           [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-white
                           [&::-webkit-slider-thumb]:shadow-lg
                           [&::-webkit-slider-thumb]:shadow-purple-500/30
                           [&::-webkit-slider-thumb]:border-2
                           [&::-webkit-slider-thumb]:border-purple-500
                           [&::-webkit-slider-thumb]:cursor-grab
                           [&::-webkit-slider-thumb]:active:cursor-grabbing"
                  style={{
                    background: `linear-gradient(to right, #735CFF ${flowPercent}%, rgba(255,255,255,0.1) ${flowPercent}%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-white/30 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Input field - switches between % and ETH */}
              <div className="flex items-center gap-3 mb-4 nodrag">
                {inputMode === "percent" ? (
                  <div className="flex-1 flex items-center gap-2 bg-[#0a0a0f] rounded-lg border border-white/10 px-3 py-2">
                    <input
                      type="number"
                      value={Math.round(flowPercent * 10) / 10}
                      onChange={(e) => handleFlowChange(Number(e.target.value))}
                      className="nodrag flex-1 bg-transparent text-white text-lg font-semibold
                               focus:outline-none [appearance:textfield]
                               [&::-webkit-outer-spin-button]:appearance-none
                               [&::-webkit-inner-spin-button]:appearance-none"
                      min={0}
                      max={100}
                      step={0.1}
                    />
                    <span className="text-white/40 text-sm">%</span>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2 bg-[#0a0a0f] rounded-lg border border-white/10 px-3 py-2">
                    <input
                      type="number"
                      value={Math.round(flowAmount * 10000) / 10000}
                      onChange={(e) => handleEthChange(Number(e.target.value))}
                      className="nodrag flex-1 bg-transparent text-white text-lg font-semibold
                               focus:outline-none [appearance:textfield]
                               [&::-webkit-outer-spin-button]:appearance-none
                               [&::-webkit-inner-spin-button]:appearance-none"
                      min={0}
                      max={sourceValue}
                      step={0.0001}
                    />
                    <span className="text-white/40 text-sm">{assetSymbol}</span>
                  </div>
                )}
              </div>

              {/* Quick percentage buttons */}
              <div className="flex gap-1.5 mb-4">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleFlowChange(pct)}
                    className={`
                      flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                      ${Math.round(flowPercent) === pct
                        ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                        : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      }
                    `}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Summary showing both values */}
              <div className="bg-white/5 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Amount</span>
                  <span className="text-sm font-semibold text-white">
                    {flowAmount.toFixed(4)} {assetSymbol}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-white/50">Percentage</span>
                  <span className="text-sm font-semibold text-purple-400">
                    {(Math.round(flowPercent * 10) / 10)}%
                  </span>
                </div>
                {sourceValue > 0 && (
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-white/5">
                    <span className="text-xs text-white/40">of {sourceValue} {assetSymbol} total</span>
                  </div>
                )}
              </div>

              {/* Done button */}
              <button
                onClick={() => setShowPopover(false)}
                className="w-full py-2 rounded-lg bg-purple-500 text-white text-sm font-medium
                         hover:bg-purple-400 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const FlowEdge = memo(FlowEdgeComponent);
