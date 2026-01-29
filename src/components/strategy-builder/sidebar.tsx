"use client";

/**
 * Strategy Builder Sidebar
 *
 * Block palette for dragging onto the canvas.
 * Also shows templates, saved loops, and help.
 * Features premium styling and drag animations.
 */

import { type DragEvent, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Layers,
  PiggyBank,
  HandCoins,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
  Zap,
  GripVertical,
  Package,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStrategyStore } from "@/lib/strategy/store";
import type { BlockType, SavedSystem } from "@/lib/strategy/types";
import { STRATEGY_TEMPLATES, loadTemplate } from "@/lib/strategy/templates";

// ============================================================================
// Block Definitions
// ============================================================================

interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
}

const BLOCKS: BlockDefinition[] = [
  {
    type: "input",
    label: "Input",
    description: "Starting capital",
    icon: <Wallet className="w-5 h-5" />,
    color: "bg-gradient-to-br from-blue-500/25 to-blue-600/10 text-blue-400",
    borderColor: "border-blue-500/30 hover:border-blue-400/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)]",
  },
  {
    type: "stake",
    label: "Stake",
    description: "LST staking",
    icon: <Layers className="w-5 h-5" />,
    color: "bg-gradient-to-br from-purple-500/25 to-violet-600/10 text-purple-400",
    borderColor: "border-purple-500/30 hover:border-purple-400/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]",
  },
  {
    type: "lend",
    label: "Lend",
    description: "Supply to protocol",
    icon: <PiggyBank className="w-5 h-5" />,
    color: "bg-gradient-to-br from-emerald-500/25 to-green-600/10 text-emerald-400",
    borderColor: "border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]",
  },
  {
    type: "borrow",
    label: "Borrow",
    description: "Against collateral",
    icon: <HandCoins className="w-5 h-5" />,
    color: "bg-gradient-to-br from-amber-500/25 to-orange-600/10 text-amber-400",
    borderColor: "border-amber-500/30 hover:border-amber-400/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]",
  },
  {
    type: "swap",
    label: "Swap",
    description: "DEX exchange",
    icon: <ArrowLeftRight className="w-5 h-5" />,
    color: "bg-gradient-to-br from-cyan-500/25 to-teal-600/10 text-cyan-400",
    borderColor: "border-cyan-500/30 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]",
  },
];

// ============================================================================
// Draggable Block Item
// ============================================================================

function DraggableBlock({ block, index }: { block: BlockDefinition; index: number }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = (event: DragEvent, nodeType: BlockType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.03, x: 6 }}
      whileTap={{ scale: 0.97 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as DragEvent, block.type)}
      onDragEnd={onDragEnd}
      className={cn(
        "relative flex items-center gap-3 p-3 rounded-xl border cursor-grab group overflow-hidden",
        "bg-gradient-to-br from-[#12121a]/90 to-[#0a0a10]/95 glass-depth-1",
        "transition-all duration-300 active:cursor-grabbing",
        block.borderColor,
        isDragging && "opacity-50 scale-95"
      )}
    >
      {/* Holographic shimmer on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
      />

      <div className={cn(
        "relative p-2.5 rounded-xl transition-all duration-300",
        block.color,
        "group-hover:scale-110 group-hover:shadow-lg"
      )}>
        {block.icon}
      </div>
      <div className="flex-1 min-w-0 relative">
        <div className="text-sm font-medium text-white group-hover:text-white/95">{block.label}</div>
        <div className="text-xs text-white/40 truncate group-hover:text-white/50">{block.description}</div>
      </div>
      <GripVertical className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors" />
    </motion.div>
  );
}

// ============================================================================
// Risk Level Badge
// ============================================================================

function RiskBadge({ level }: { level: string }) {
  const colors = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    extreme: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-[10px] rounded border capitalize",
        colors[level as keyof typeof colors] || colors.low
      )}
    >
      {level}
    </span>
  );
}

// ============================================================================
// My Saved Loops Section
// ============================================================================

function MySavedLoops() {
  const [isExpanded, setIsExpanded] = useState(true);
  const savedSystems = useStrategyStore((state) => state.savedSystems);
  const deleteSystem = useStrategyStore((state) => state.deleteSystem);
  const loadSavedSystems = useStrategyStore((state) => state.loadSavedSystems);

  // Load saved systems from localStorage on mount
  useEffect(() => {
    loadSavedSystems();
  }, [loadSavedSystems]);

  const handleDragStart = (e: DragEvent, system: SavedSystem) => {
    e.dataTransfer.setData("application/saved-system", system.id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="border-b border-white/10">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Package className="w-4 h-4 text-purple-400" />
          My Loops
          {savedSystems.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-300">
              {savedSystems.length}
            </span>
          )}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {savedSystems.length === 0 ? (
                <div className="p-3 rounded-lg bg-white/5 border border-dashed border-white/10 text-center">
                  <Package className="w-6 h-6 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">
                    Select multiple blocks to save as a reusable loop
                  </p>
                </div>
              ) : (
                savedSystems.map((system, index) => (
                  <motion.div
                    key={system.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    draggable
                    onDragStart={(e) => handleDragStart(e as unknown as DragEvent, system)}
                    className={cn(
                      "group relative p-3 rounded-xl border cursor-grab",
                      "bg-[#12121a]/80 backdrop-blur-sm transition-all duration-200",
                      "hover:bg-[#1a1a24] hover:shadow-lg active:cursor-grabbing",
                      "border-purple-500/30 hover:border-purple-500/60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {system.name}
                        </div>
                        <div className="text-xs text-white/50 truncate">
                          {system.blockCount} blocks
                          {system.description && ` · ${system.description}`}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSystem(system.id);
                        }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                        title="Delete loop"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Sidebar Component
// ============================================================================

export function StrategySidebar() {
  const [activeTab, setActiveTab] = useState<"blocks" | "templates">("blocks");
  const isSidebarOpen = useStrategyStore((state) => state.isSidebarOpen);
  const toggleSidebar = useStrategyStore((state) => state.toggleSidebar);
  const clearStrategy = useStrategyStore((state) => state.clearStrategy);
  const loadStrategy = useStrategyStore((state) => state.loadStrategy);

  const handleLoadTemplate = (templateId: string) => {
    const strategy = loadTemplate(templateId);
    if (strategy) {
      loadStrategy(strategy.blocks, strategy.edges);
    }
  };

  return (
    <div
      className={cn(
        "relative h-full flex flex-col cyber-sidebar transition-all duration-300",
        isSidebarOpen ? "w-72" : "w-12"
      )}
    >
      {/* Vertical accent line */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-purple-500/30 to-transparent" />
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 z-10 p-1 rounded-full bg-[#12121a] border border-white/10
                   text-white/60 hover:text-white hover:bg-[#1a1a24] transition-colors"
      >
        {isSidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {isSidebarOpen ? (
        <>
          {/* Tab Switcher */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab("blocks")}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === "blocks"
                  ? "text-white border-b-2 border-purple-500"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Blocks
              </span>
            </button>
            <button
              onClick={() => setActiveTab("templates")}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === "templates"
                  ? "text-white border-b-2 border-purple-500"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              <span className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "blocks" ? (
              <div>
                {/* My Saved Loops Section */}
                <MySavedLoops />

                {/* Block Palette */}
                <div className="p-4 space-y-2">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-white/50 mb-3 flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    Drag blocks onto the canvas
                  </motion.p>
                  {BLOCKS.map((block, index) => (
                    <DraggableBlock key={block.type} block={block} index={index} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-white/50 mb-3 flex items-center gap-2"
                >
                  <FileText className="w-3 h-3 text-purple-400" />
                  Load a pre-built strategy
                </motion.p>
                {STRATEGY_TEMPLATES.map((template, index) => (
                  <motion.button
                    key={template.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLoadTemplate(template.id)}
                    className="relative w-full p-4 rounded-xl overflow-hidden
                               bg-gradient-to-br from-[#12121a]/90 to-[#0a0a10]/95
                               border border-white/5 hover:border-purple-500/40
                               hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]
                               transition-all duration-300 text-left group"
                  >
                    {/* Holographic shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                    <div className="relative flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/25 to-violet-600/10"
                            whileHover={{ rotate: 15, scale: 1.1 }}
                          >
                            <Zap className="w-3.5 h-3.5 text-purple-400" />
                          </motion.div>
                          <span className="text-sm font-semibold text-white truncate group-hover:text-purple-200 transition-colors">
                            {template.name}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 mt-1.5 line-clamp-2 group-hover:text-white/50">
                          {template.description}
                        </p>
                      </div>
                      <RiskBadge level={template.riskLevel} />
                    </div>
                    <div className="relative flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-white/30">Est. APY</span>
                      <span className="text-sm font-bold text-emerald-400 neon-green">
                        {template.estimatedApy}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 space-y-2">
            <button
              onClick={clearStrategy}
              className="w-full px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30
                         text-sm text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Clear Canvas
            </button>
          </div>
        </>
      ) : (
        /* Collapsed State - Icon Only */
        <div className="flex-1 py-4 flex flex-col items-center gap-2">
          {BLOCKS.map((block) => (
            <div
              key={block.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", block.type);
                e.dataTransfer.effectAllowed = "move";
              }}
              className={cn(
                "p-2 rounded-lg cursor-grab transition-all",
                block.color,
                "hover:scale-110 active:cursor-grabbing"
              )}
              title={block.label}
            >
              {block.icon}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
