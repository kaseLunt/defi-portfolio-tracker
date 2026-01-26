"use client";

/**
 * Strategy Builder Canvas
 *
 * React Flow canvas wrapper with custom styling and handlers.
 * Supports drag-and-drop from sidebar and block connections.
 */

import { useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useStrategyStore } from "@/lib/strategy/store";
import type { BlockType, DetectedLoop } from "@/lib/strategy/types";
import { InputBlock } from "./blocks/input-block";
import { StakeBlock } from "./blocks/stake-block";
import { LendBlock } from "./blocks/lend-block";
import { BorrowBlock } from "./blocks/borrow-block";
import { SwapBlock } from "./blocks/swap-block";
import { FlowEdge } from "./edges/flow-edge";
import { LoopBadge } from "./loop-badge";

// ============================================================================
// Node Types Registration
// ============================================================================

const nodeTypes: NodeTypes = {
  input: InputBlock,
  stake: StakeBlock,
  lend: LendBlock,
  borrow: BorrowBlock,
  swap: SwapBlock,
};

const edgeTypes: EdgeTypes = {
  flow: FlowEdge,
};

// ============================================================================
// Canvas Styles
// ============================================================================

const canvasStyles = {
  background: "#0a0a0f",
};

// ============================================================================
// Inner Canvas Component
// ============================================================================

function CanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();

  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const onNodesChange = useStrategyStore((state) => state.onNodesChange);
  const onEdgesChange = useStrategyStore((state) => state.onEdgesChange);
  const addEdge = useStrategyStore((state) => state.addEdge);
  const addBlock = useStrategyStore((state) => state.addBlock);
  const selectBlock = useStrategyStore((state) => state.selectBlock);
  const detectedLoops = useStrategyStore((state) => state.detectedLoops);
  const updateLoopIterations = useStrategyStore((state) => state.updateLoopIterations);

  // Calculate the screen position for each detected loop badge
  const loopPositions = useMemo(() => {
    return detectedLoops.map((loop) => {
      const loopBlocks = loop.blockIds
        .map((id) => blocks.find((b) => b.id === id))
        .filter(Boolean);

      if (loopBlocks.length === 0) {
        return { loop, position: { x: 0, y: 0 } };
      }

      // Calculate centroid of loop blocks in flow coordinates
      const avgX =
        loopBlocks.reduce((sum, b) => sum + (b?.position.x ?? 0), 0) /
        loopBlocks.length;
      const avgY =
        loopBlocks.reduce((sum, b) => sum + (b?.position.y ?? 0), 0) /
        loopBlocks.length;

      // Convert flow coordinates to screen coordinates
      const screenX = avgX * viewport.zoom + viewport.x + 100; // Offset to not overlap
      const screenY = avgY * viewport.zoom + viewport.y - 30;

      return {
        loop,
        position: { x: screenX, y: screenY },
      };
    });
  }, [detectedLoops, blocks, viewport]);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection) => {
      addEdge(connection);
    },
    [addEdge]
  );

  // Handle drag over (for dropping blocks from sidebar)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop (create block at drop position)
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as BlockType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addBlock(type, position);
    },
    [screenToFlowPosition, addBlock]
  );

  // Handle node click (select block)
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectBlock(node.id);
    },
    [selectBlock]
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    selectBlock(null);
  }, [selectBlock]);

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={blocks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        style={canvasStyles}
        defaultEdgeOptions={{
          type: "flow",
          animated: true,
          data: { flowPercent: 100 },
        }}
        connectionLineStyle={{ stroke: "#735CFF", strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#1a1a24"
          gap={24}
          size={1}
          style={{ backgroundColor: "#0a0a0f" }}
        />
        <Controls
          className="!bg-[#12121a] !border-[#2a2a3a] !rounded-lg"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-[#12121a] !border-[#2a2a3a] !rounded-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case "input":
                return "#3B82F6";
              case "stake":
                return "#735CFF";
              case "lend":
                return "#22C55E";
              case "borrow":
                return "#F59E0B";
              case "swap":
                return "#06B6D4";
              default:
                return "#6B7280";
            }
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
        />

      </ReactFlow>

      {/* Loop Badges - positioned above the canvas with screen coordinates */}
      {loopPositions.map(({ loop, position }) => (
        <LoopBadge
          key={loop.id}
          loop={loop}
          blocks={blocks}
          position={position}
          onIterationsChange={updateLoopIterations}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Exported Canvas Component (with Provider)
// ============================================================================

export function StrategyCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
