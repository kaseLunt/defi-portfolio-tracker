"use client";

/**
 * HoloMetricCard - Premium 3D Holographic Metric Card
 *
 * Features 3D tilt effects, glassmorphism, animated borders,
 * and holographic shimmer effects.
 */

import { useState, useRef, useCallback, memo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface HoloMetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "default" | "green" | "red" | "purple" | "cyan" | "amber";
  size?: "default" | "large" | "compact";
  icon?: React.ReactNode;
  className?: string;
  glowIntensity?: "low" | "medium" | "high";
}

const colorSchemes = {
  default: {
    border: "rgba(168, 85, 247, 0.3)",
    glow: "rgba(168, 85, 247, 0.2)",
    accent: "#A855F7",
    gradient: "from-purple-500/20 to-violet-600/5",
  },
  green: {
    border: "rgba(34, 197, 94, 0.3)",
    glow: "rgba(34, 197, 94, 0.2)",
    accent: "#22C55E",
    gradient: "from-green-500/20 to-emerald-600/5",
  },
  red: {
    border: "rgba(239, 68, 68, 0.3)",
    glow: "rgba(239, 68, 68, 0.2)",
    accent: "#EF4444",
    gradient: "from-red-500/20 to-rose-600/5",
  },
  purple: {
    border: "rgba(168, 85, 247, 0.3)",
    glow: "rgba(168, 85, 247, 0.2)",
    accent: "#A855F7",
    gradient: "from-purple-500/20 to-violet-600/5",
  },
  cyan: {
    border: "rgba(6, 182, 212, 0.3)",
    glow: "rgba(6, 182, 212, 0.2)",
    accent: "#06B6D4",
    gradient: "from-cyan-500/20 to-teal-600/5",
  },
  amber: {
    border: "rgba(245, 158, 11, 0.3)",
    glow: "rgba(245, 158, 11, 0.2)",
    accent: "#F59E0B",
    gradient: "from-amber-500/20 to-orange-600/5",
  },
};

function HoloMetricCardComponent({
  label,
  value,
  subValue,
  trend,
  trendValue,
  color = "default",
  size = "default",
  icon,
  className,
  glowIntensity = "medium",
}: HoloMetricCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Motion values for 3D effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring physics for smooth movement
  const springConfig = { damping: 25, stiffness: 200 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);

  // Shimmer position
  const shimmerX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-100, 200]), springConfig);
  const shimmerY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-100, 200]), springConfig);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      mouseX.set(x);
      mouseY.set(y);
    },
    [mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  }, [mouseX, mouseY]);

  const scheme = colorSchemes[color];
  const glowOpacity = { low: 0.1, medium: 0.2, high: 0.35 }[glowIntensity];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-white/40";

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl cursor-default",
        size === "compact" && "p-4",
        size === "default" && "p-5",
        size === "large" && "p-6",
        className
      )}
    >
      {/* Background layers */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, rgba(18, 18, 26, 0.95), rgba(10, 10, 15, 0.98))`,
        }}
      />

      {/* Holographic gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          scheme.gradient
        )}
      />

      {/* Animated border */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          border: `1px solid ${scheme.border}`,
          boxShadow: isHovered
            ? `0 0 30px ${scheme.glow}, inset 0 0 20px ${scheme.glow}`
            : `0 0 0 ${scheme.glow}`,
        }}
        animate={{
          boxShadow: isHovered
            ? [
                `0 0 30px ${scheme.glow}, inset 0 0 20px ${scheme.glow}`,
                `0 0 50px ${scheme.glow}, inset 0 0 30px ${scheme.glow}`,
                `0 0 30px ${scheme.glow}, inset 0 0 20px ${scheme.glow}`,
              ]
            : `0 0 15px rgba(168, 85, 247, ${glowOpacity})`,
        }}
        transition={{ duration: 2, repeat: isHovered ? Infinity : 0 }}
      />

      {/* Corner accents */}
      <div
        className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 rounded-tl-lg"
        style={{ borderColor: scheme.accent, opacity: 0.4 }}
      />
      <div
        className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 rounded-tr-lg"
        style={{ borderColor: scheme.accent, opacity: 0.4 }}
      />
      <div
        className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 rounded-bl-lg"
        style={{ borderColor: scheme.accent, opacity: 0.4 }}
      />
      <div
        className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 rounded-br-lg"
        style={{ borderColor: scheme.accent, opacity: 0.4 }}
      />

      {/* Holographic shimmer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${shimmerX}% ${shimmerY}%, rgba(255, 255, 255, 0.08) 0%, transparent 50%)`,
        }}
      />

      {/* Top accent line */}
      <motion.div
        className="absolute top-0 left-8 right-8 h-px"
        style={{ backgroundColor: scheme.accent }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Content */}
      <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon && (
              <div
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${scheme.accent}20` }}
              >
                {icon}
              </div>
            )}
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
              {label}
            </span>
          </div>

          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                trend === "up" && "bg-green-500/20",
                trend === "down" && "bg-red-500/20",
                trend === "neutral" && "bg-white/10"
              )}
            >
              <TrendIcon className={cn("w-3 h-3", trendColor)} />
              {trendValue && (
                <span className={trendColor}>{trendValue}</span>
              )}
            </div>
          )}
        </div>

        {/* Value */}
        <div
          className={cn(
            "font-bold text-white tabular-nums",
            size === "compact" && "text-2xl",
            size === "default" && "text-3xl",
            size === "large" && "text-4xl"
          )}
          style={{
            fontFamily: "var(--font-mono), monospace",
            textShadow: isHovered ? `0 0 20px ${scheme.accent}60` : "none",
          }}
        >
          {value}
        </div>

        {/* Sub value */}
        {subValue && (
          <div
            className={cn(
              "mt-1 text-sm font-medium",
              trend === "up" && "text-green-400/80",
              trend === "down" && "text-red-400/80",
              !trend && "text-white/50"
            )}
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            {subValue}
          </div>
        )}
      </div>

      {/* Scan line effect */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        initial={{ top: "0%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}

export const HoloMetricCard = memo(HoloMetricCardComponent);

// ============================================================================
// Metric Grid - Pre-styled grid layout
// ============================================================================

interface MetricGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ children, columns = 4, className }: MetricGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-2 md:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
