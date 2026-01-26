"use client";

/**
 * Flow Edge Component
 *
 * Custom edge that displays flow amount/percentage on hover.
 * Supports click-to-edit for partial allocations with slider and ETH input.
 */

import { memo, useState, useCallback, useMemo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { useStrategyStore } from "@/lib/strategy/store";
import type { StrategyEdgeData, InputBlockData } from "@/lib/strategy/types";

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

  // Get edge data with defaults
  const edgeData = (data as StrategyEdgeData) ?? { flowPercent: 100 };
  const flowPercent = edgeData.flowPercent ?? 100;

  // Find source block to calculate flow amount
  const sourceEdge = edges.find((e) => e.id === id);
  const sourceBlock = sourceEdge
    ? blocks.find((b) => b.id === sourceEdge.source)
    : null;

  // Calculate what actually flows INTO the source block (tracing through the graph)
  const sourceValue = useMemo(() => {
    if (!sourceBlock) return 0;

    // If source is input block, return its amount directly
    if (sourceBlock.data.type === "input") {
      return (sourceBlock.data as InputBlockData).amount;
    }

    // Otherwise, trace backwards to find what flows into this block
    // by summing all incoming edges' flow amounts
    const calculateInflow = (blockId: string, visited: Set<string> = new Set()): number => {
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

        // Recursively get the inflow to the source of this edge
        const sourceInflow = calculateInflow(edge.source, visited);
        totalInflow += (sourceInflow * edgePercent) / 100;
      }

      return totalInflow;
    };

    return calculateInflow(sourceBlock.id);
  }, [sourceBlock, blocks, edges]);

  // Calculate flow amount based on source block
  const flowAmount = useMemo(() => {
    return (sourceValue * flowPercent) / 100;
  }, [sourceValue, flowPercent]);

  // Get bezier path
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

  // Get asset symbol from source block
  const assetSymbol = useMemo(() => {
    if (sourceBlock?.data.type === "input") {
      return (sourceBlock.data as InputBlockData).asset || "ETH";
    }
    return "ETH";
  }, [sourceBlock]);

  // Format display value
  const formatFlowDisplay = () => {
    if (flowAmount >= 1000) return `${(flowAmount / 1000).toFixed(1)}K`;
    if (flowAmount >= 1) return flowAmount.toFixed(2);
    if (flowAmount >= 0.01) return flowAmount.toFixed(3);
    return flowAmount.toFixed(4);
  };

  return (
    <>
      {/* Edge Path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isPartialFlow ? "#F59E0B" : "#735CFF",
          strokeWidth: selected || isHovered ? 3 : 2,
          strokeDasharray: isPartialFlow ? "5,5" : "none",
          filter: isHovered ? "drop-shadow(0 0 6px rgba(115, 92, 255, 0.5))" : "none",
          transition: "all 0.2s ease",
        }}
      />

      {/* Invisible wider path for easier hover/click */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={24}
        stroke="transparent"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleEdgeClick}
        style={{ cursor: "pointer" }}
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
              px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer
              transition-all duration-200 shadow-lg
              ${isPartialFlow
                ? "bg-[#1a1a24] text-amber-400 border border-amber-500/50"
                : "bg-[#1a1a24] text-purple-300 border border-purple-500/40"
              }
              ${(isHovered || isLabelHovered || showPopover) ? "scale-105 ring-2 ring-purple-500/30" : ""}
              ${!isHovered && !isLabelHovered && !showPopover && !isPartialFlow && !selected ? "opacity-70" : "opacity-100"}
            `}
          >
            <span className="flex items-center gap-2">
              <span className="font-semibold">{formatFlowDisplay()} {assetSymbol}</span>
              <span className={`text-[10px] ${isPartialFlow ? "text-amber-500/70" : "text-white/40"}`}>
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
              <div className="mb-4">
                <input
                  type="range"
                  value={flowPercent}
                  onChange={(e) => handleFlowChange(Number(e.target.value))}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer
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
              <div className="flex items-center gap-3 mb-4">
                {inputMode === "percent" ? (
                  <div className="flex-1 flex items-center gap-2 bg-[#0a0a0f] rounded-lg border border-white/10 px-3 py-2">
                    <input
                      type="number"
                      value={Math.round(flowPercent * 10) / 10}
                      onChange={(e) => handleFlowChange(Number(e.target.value))}
                      className="flex-1 bg-transparent text-white text-lg font-semibold
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
                      className="flex-1 bg-transparent text-white text-lg font-semibold
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
