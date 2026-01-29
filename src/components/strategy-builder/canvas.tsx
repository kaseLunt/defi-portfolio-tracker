"use client";

/**
 * Strategy Builder Canvas
 *
 * React Flow canvas wrapper with custom styling and handlers.
 * Supports drag-and-drop from sidebar and block connections.
 * Features ambient background effects and connection celebrations.
 */

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type Node,
  useOnSelectionChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";

import { useStrategyStore } from "@/lib/strategy/store";
import type { BlockType, StrategyBlock, StrategyEdge } from "@/lib/strategy/types";
import { InputBlock } from "./blocks/input-block";
import { StakeBlock } from "./blocks/stake-block";
import { LendBlock } from "./blocks/lend-block";
import { BorrowBlock } from "./blocks/borrow-block";
import { SwapBlock } from "./blocks/swap-block";
import { FlowEdge } from "./edges/flow-edge";
import { SelectionActionBar } from "./selection-action-bar";
import { AuroraBackground } from "./aurora-background";
import { CanvasEmptyState } from "./canvas-empty-state";

// ============================================================================
// Connection Celebration Effect
// ============================================================================

interface CelebrationParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
}

function ConnectionCelebration({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  const [particles, setParticles] = useState<CelebrationParticle[]>([]);

  useEffect(() => {
    // Generate particles in a burst pattern - Cyberpunk neon colors
    const colors = ["#00FFD0", "#A855F7", "#FF0080", "#00D4FF", "#FFD000"];
    const newParticles: CelebrationParticle[] = [];

    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        angle: (i / 12) * Math.PI * 2,
        speed: 2 + Math.random() * 3,
        size: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setParticles(newParticles);

    // Clean up after animation
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: Math.cos(particle.angle) * particle.speed * 30,
            y: Math.sin(particle.angle) * particle.speed * 30,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
          }}
        />
      ))}
      {/* Central flash */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute rounded-full"
        style={{
          width: 20,
          height: 20,
          background: "radial-gradient(circle, rgba(115, 92, 255, 0.8) 0%, transparent 70%)",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

// ============================================================================
// Cyber Grid Background
// ============================================================================

function CyberGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated grid lines */}
      <div className="absolute inset-0 cyber-grid-animated opacity-30" />

      {/* Vertical scan line */}
      <motion.div
        className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-500/50 to-transparent"
        initial={{ left: "-5%" }}
        animate={{ left: "105%" }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Horizontal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"
        initial={{ top: "-5%" }}
        animate={{ top: "105%" }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-purple-500/20 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-cyan-500/20 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-pink-500/20 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-purple-500/20 rounded-br-lg" />
    </div>
  );
}

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

interface CelebrationState {
  id: number;
  x: number;
  y: number;
}

// Clipboard state for copy/paste (module-level to persist across renders)
let clipboard: { nodes: StrategyBlock[]; edges: StrategyEdge[] } | null = null;

function CanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();

  // Celebration state for connection effects
  const [celebrations, setCelebrations] = useState<CelebrationState[]>([]);
  const celebrationIdRef = useRef(0);

  // Track selected nodes for copy/paste
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const onNodesChange = useStrategyStore((state) => state.onNodesChange);
  const onEdgesChange = useStrategyStore((state) => state.onEdgesChange);
  const addEdge = useStrategyStore((state) => state.addEdge);
  const addBlock = useStrategyStore((state) => state.addBlock);
  const selectBlock = useStrategyStore((state) => state.selectBlock);
  const loadStrategy = useStrategyStore((state) => state.loadStrategy);
  const undo = useStrategyStore((state) => state.undo);
  const redo = useStrategyStore((state) => state.redo);
  const canUndo = useStrategyStore((state) => state.canUndo);
  const canRedo = useStrategyStore((state) => state.canRedo);
  const placeSystem = useStrategyStore((state) => state.placeSystem);
  const { setNodes, getNodes } = useReactFlow();

  // Track selection changes with workaround for last-node selection bug
  useOnSelectionChange({
    onChange: ({ nodes: selectedByReactFlow }) => {
      // Workaround: If 2+ nodes are selected, check if there's a connected unselected node
      // that should also be included (fixes React Flow box selection bug with last node)
      if (selectedByReactFlow.length >= 2) {
        const selectedIds = new Set(selectedByReactFlow.map(n => n.id));
        const allNodes = getNodes();

        // Find the bounding box of selected nodes
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (const node of selectedByReactFlow) {
          if (node.position.x > maxX) maxX = node.position.x;
          if (node.position.y < minY) minY = node.position.y;
          if (node.position.y > maxY) maxY = node.position.y;
        }

        // Check if there's an unselected node just to the right that should be included
        const nodesToAdd: Node[] = [];
        for (const node of allNodes) {
          if (!selectedIds.has(node.id) &&
              node.position.x > maxX &&
              node.position.x < maxX + 400 &&
              node.position.y >= minY - 100 &&
              node.position.y <= maxY + 100) {
            // Check if this node is connected to any selected node
            const isConnected = edges.some(e =>
              (selectedIds.has(e.source) && e.target === node.id) ||
              (selectedIds.has(e.target) && e.source === node.id)
            );
            if (isConnected) {
              nodesToAdd.push(node);
            }
          }
        }

        if (nodesToAdd.length > 0) {
          const finalSelection = [...selectedByReactFlow, ...nodesToAdd];
          setSelectedNodes(finalSelection);
          // Also update React Flow's internal selection
          const finalIds = new Set(finalSelection.map(n => n.id));
          setNodes(allNodes.map(n => ({
            ...n,
            selected: finalIds.has(n.id)
          })));
          return;
        }
      }

      setSelectedNodes(selectedByReactFlow);
    },
  });

  // Calculate action bar position based on selected nodes
  const actionBarPosition = useMemo(() => {
    if (selectedNodes.length < 2) return null;

    // Find bounding box of selected nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selectedNodes) {
      const x = node.position.x;
      const y = node.position.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 200); // Approximate node width
      maxY = Math.max(maxY, y + 100); // Approximate node height
    }

    // Convert to screen position
    if (reactFlowWrapper.current) {
      const centerX = (minX + maxX) / 2;
      const bottomY = maxY;

      // Apply viewport transform
      const screenX = centerX * viewport.zoom + viewport.x;
      const screenY = bottomY * viewport.zoom + viewport.y;

      return { x: screenX, y: screenY };
    }

    return null;
  }, [selectedNodes, viewport]);

  // Delete selected nodes
  const handleDeleteSelected = useCallback(() => {
    const selectedIds = selectedNodes.map((n) => n.id);
    const changes = selectedIds.map((id) => ({
      type: "remove" as const,
      id,
    }));
    onNodesChange(changes);
  }, [selectedNodes, onNodesChange]);

  // Handle new connections with celebration effect
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      addEdge(connection);

      // Find target block position for celebration
      if (connection.target) {
        const targetBlock = blocks.find((b) => b.id === connection.target);
        if (targetBlock && reactFlowWrapper.current) {
          // Convert flow position to screen position
          const rect = reactFlowWrapper.current.getBoundingClientRect();
          const screenX = targetBlock.position.x * viewport.zoom + viewport.x + rect.left + 100;
          const screenY = targetBlock.position.y * viewport.zoom + viewport.y + rect.top + 50;

          const newCelebration: CelebrationState = {
            id: ++celebrationIdRef.current,
            x: screenX - rect.left,
            y: screenY - rect.top,
          };

          setCelebrations((prev) => [...prev, newCelebration]);
        }
      }
    },
    [addEdge, blocks, viewport]
  );

  // Remove celebration after animation
  const handleCelebrationComplete = useCallback((id: number) => {
    setCelebrations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Handle drag over (for dropping blocks from sidebar)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop (create block at drop position or place saved system)
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if dropping a saved system
      const systemId = event.dataTransfer.getData("application/saved-system");
      if (systemId) {
        placeSystem(systemId, position);
        return;
      }

      // Otherwise, dropping a new block
      const type = event.dataTransfer.getData(
        "application/reactflow"
      ) as BlockType;
      if (!type) return;

      addBlock(type, position);
    },
    [screenToFlowPosition, addBlock, placeSystem]
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

  // Generate unique ID for pasted blocks
  const generatePasteId = useCallback(() => {
    return `paste_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Copy selected nodes and edges
  const handleCopy = useCallback(() => {
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    // Copy nodes
    const nodesToCopy = blocks.filter((b) => selectedNodeIds.has(b.id));

    // Copy edges that connect selected nodes
    const edgesToCopy = edges.filter(
      (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    );

    clipboard = {
      nodes: JSON.parse(JSON.stringify(nodesToCopy)),
      edges: JSON.parse(JSON.stringify(edgesToCopy)),
    };

    console.log(`Copied ${nodesToCopy.length} blocks and ${edgesToCopy.length} edges`);
  }, [selectedNodes, blocks, edges]);

  // Paste copied nodes and edges
  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;

    // Create ID mapping for pasted nodes
    const idMap = new Map<string, string>();
    clipboard.nodes.forEach((node) => {
      idMap.set(node.id, generatePasteId());
    });

    // Calculate offset (paste 100px right and down from original)
    const offsetX = 100;
    const offsetY = 100;

    // Create new nodes with new IDs and offset positions
    const newNodes: StrategyBlock[] = clipboard.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
      selected: true, // Select pasted nodes
    }));

    // Create new edges with updated source/target IDs
    const newEdges: StrategyEdge[] = clipboard.edges.map((edge) => ({
      ...edge,
      id: generatePasteId(),
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
    }));

    // Deselect existing nodes, add new ones
    const updatedBlocks = blocks.map((b) => ({ ...b, selected: false }));
    const updatedEdges = [...edges];

    // Load updated strategy
    loadStrategy([...updatedBlocks, ...newNodes], [...updatedEdges, ...newEdges]);

    console.log(`Pasted ${newNodes.length} blocks and ${newEdges.length} edges`);
  }, [blocks, edges, generatePasteId, loadStrategy]);

  // Keyboard event handler for copy/paste/undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
        return;
      }

      // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
        return;
      }

      // Ctrl+C or Cmd+C for copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        handleCopy();
      }

      // Ctrl+V or Cmd+V for paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        handlePaste();
      }

      // Ctrl+D or Cmd+D for duplicate (copy + paste in one)
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleCopy();
        setTimeout(handlePaste, 0);
      }

      // Ctrl+A or Cmd+A for select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const allNodes = getNodes();
        setNodes(allNodes.map(node => ({ ...node, selected: true })));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy, handlePaste, undo, redo, canUndo, canRedo]);

  const hasBlocks = blocks.length > 0;

  return (
    <div ref={reactFlowWrapper} className="h-full w-full relative">
      {/* Aurora background effect */}
      <AuroraBackground intensity={hasBlocks ? "low" : "medium"} />

      {/* Cyber grid overlay */}
      <CyberGrid />

      {/* Connection celebration effects */}
      <AnimatePresence>
        {celebrations.map((celebration) => (
          <ConnectionCelebration
            key={celebration.id}
            x={celebration.x}
            y={celebration.y}
            onComplete={() => handleCelebrationComplete(celebration.id)}
          />
        ))}
      </AnimatePresence>

      {/* Empty state when no blocks */}
      {!hasBlocks && <CanvasEmptyState />}

      {/* Selection Action Bar */}
      <SelectionActionBar
        selectedCount={selectedNodes.length}
        selectedNodeIds={selectedNodes.map((n) => n.id)}
        onDuplicate={() => {
          handleCopy();
          setTimeout(handlePaste, 0);
        }}
        onDelete={handleDeleteSelected}
        position={actionBarPosition}
      />

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
        minZoom={0.2}
        maxZoom={2}
        style={canvasStyles}
        // Box selection: hold Shift and drag to select multiple blocks
        selectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        // Also allow Shift+click to add to selection
        multiSelectionKeyCode="Shift"
        // Delete selected with Backspace/Delete
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{
          type: "flow",
          animated: true,
          data: { flowPercent: 100 },
        }}
        connectionLineStyle={{ stroke: "#735CFF", strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="rgba(120, 0, 255, 0.15)"
          gap={32}
          size={1.5}
          style={{ backgroundColor: "transparent" }}
        />
        <Controls
          className="!bg-[#12121a] !border-[#2a2a3a] !rounded-lg"
          style={{ bottom: 100 }}
          showInteractive={false}
        />
        <MiniMap
          className="!bg-[#12121a] !border-[#2a2a3a] !rounded-lg"
          style={{ bottom: 100 }}
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
