"use client";

/**
 * Canvas Empty State Component
 *
 * Premium onboarding experience when the strategy canvas is empty.
 * Features animated holographic elements and guided action prompts.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Layers,
  PiggyBank,
  Wallet,
  ArrowRight,
  Zap,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStrategyStore } from "@/lib/strategy/store";
import { loadTemplate } from "@/lib/strategy/templates";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

interface QuickStartCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
  delay?: number;
}

function QuickStartCard({
  icon,
  title,
  description,
  color,
  onClick,
  delay = 0,
}: QuickStartCardProps) {
  return (
    <motion.button
      variants={itemVariants}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative p-5 rounded-2xl text-left transition-all duration-300",
        "bg-gradient-to-br from-[#12121a]/80 to-[#0a0a10]/90",
        "border border-white/5 hover:border-white/20",
        "holographic-border backdrop-blur-xl",
        "pointer-events-auto cursor-pointer"
      )}
    >
      {/* Glow effect on hover */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          color === "purple" && "bg-purple-500/10",
          color === "cyan" && "bg-cyan-500/10",
          color === "pink" && "bg-pink-500/10"
        )}
      />

      {/* Icon with glow */}
      <div
        className={cn(
          "relative w-12 h-12 rounded-xl flex items-center justify-center mb-4",
          "bg-gradient-to-br transition-all duration-300",
          color === "purple" && "from-purple-500/20 to-purple-600/10 text-purple-400 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]",
          color === "cyan" && "from-cyan-500/20 to-cyan-600/10 text-cyan-400 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]",
          color === "pink" && "from-pink-500/20 to-pink-600/10 text-pink-400 group-hover:shadow-[0_0_30px_rgba(236,72,153,0.3)]"
        )}
      >
        {icon}
      </div>

      <h3 className="text-white font-semibold mb-1 group-hover:text-white/90">
        {title}
      </h3>
      <p className="text-sm text-white/50 group-hover:text-white/60">
        {description}
      </p>

      {/* Arrow indicator */}
      <ArrowRight
        className={cn(
          "absolute bottom-5 right-5 w-5 h-5 opacity-0 group-hover:opacity-100",
          "transform translate-x-2 group-hover:translate-x-0 transition-all duration-300",
          color === "purple" && "text-purple-400",
          color === "cyan" && "text-cyan-400",
          color === "pink" && "text-pink-400"
        )}
      />
    </motion.button>
  );
}

function CanvasEmptyStateComponent() {
  const loadStrategy = useStrategyStore((state) => state.loadStrategy);

  const handleLoadTemplate = (templateId: string) => {
    const strategy = loadTemplate(templateId);
    if (strategy) {
      loadStrategy(strategy.blocks, strategy.edges);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
    >
      {/* Content wrapper - pointer-events-none so drags pass through to canvas */}
      <div className="max-w-2xl px-8 pointer-events-none">
        {/* Header with animated icon */}
        <motion.div variants={itemVariants} className="text-center mb-10">
          {/* Holographic orb */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, rgba(168,85,247,0.3), rgba(6,182,212,0.3), rgba(236,72,153,0.3), rgba(168,85,247,0.3))",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
            {/* Inner core */}
            <div className="absolute inset-2 rounded-full bg-[#0a0a0f] flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="w-10 h-10 text-purple-400" />
              </motion.div>
            </div>
            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: ["#a855f7", "#06b6d4", "#ec4899"][i % 3],
                  left: "50%",
                  top: "50%",
                }}
                animate={{
                  x: [0, Math.cos((i * Math.PI) / 3) * 50],
                  y: [0, Math.sin((i * Math.PI) / 3) * 50],
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>

          <h2 className="text-3xl font-bold text-white mb-3">
            <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
              Build Your Strategy
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-md mx-auto">
            Drag blocks from the sidebar to compose your DeFi yield strategy, or start with a template.
          </p>
        </motion.div>

        {/* Quick start cards - pointer-events-auto for button interaction */}
        <div className="grid grid-cols-3 gap-4 mb-8 pointer-events-auto">
          <QuickStartCard
            icon={<Layers className="w-6 h-6" />}
            title="Leveraged LST"
            description="Stake, lend & borrow loop"
            color="purple"
            onClick={() => handleLoadTemplate("leveraged-lst-2x")}
          />
          <QuickStartCard
            icon={<PiggyBank className="w-6 h-6" />}
            title="LST + Lending"
            description="Stake ETH, supply for yield"
            color="cyan"
            onClick={() => handleLoadTemplate("lst-lending")}
          />
          <QuickStartCard
            icon={<Sparkles className="w-6 h-6" />}
            title="Conservative LST"
            description="Simple EtherFi staking"
            color="pink"
            onClick={() => handleLoadTemplate("conservative-lst")}
          />
        </div>

        {/* Hint */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-3 text-sm text-white/30"
        >
          <MousePointerClick className="w-4 h-4" />
          <span>Drag blocks from sidebar • Click templates above • Connect blocks to build flows</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export const CanvasEmptyState = memo(CanvasEmptyStateComponent);
