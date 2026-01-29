"use client";

/**
 * AnimatedCounter Component
 *
 * A dramatic number counter that animates values with spring physics.
 * Features: digit morphing, glow effects, and optional unit suffixes.
 * Inspired by high-end trading terminals and space mission control.
 */

import { useEffect, useRef, useState, memo } from "react";
import { motion, useSpring, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  color?: "cyan" | "purple" | "pink" | "gold" | "white";
  showGlow?: boolean;
  showPulse?: boolean;
  formatOptions?: Intl.NumberFormatOptions;
}

const sizeClasses = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-5xl",
  xl: "text-7xl",
};

const colorClasses = {
  cyan: {
    text: "text-cyan-400",
    glow: "drop-shadow-[0_0_20px_rgba(0,255,208,0.5)]",
    pulse: "rgba(0, 255, 208, 0.3)",
  },
  purple: {
    text: "text-purple-400",
    glow: "drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]",
    pulse: "rgba(168, 85, 247, 0.3)",
  },
  pink: {
    text: "text-pink-400",
    glow: "drop-shadow-[0_0_20px_rgba(236,72,153,0.5)]",
    pulse: "rgba(236, 72, 153, 0.3)",
  },
  gold: {
    text: "text-amber-400",
    glow: "drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]",
    pulse: "rgba(251, 191, 36, 0.3)",
  },
  white: {
    text: "text-white",
    glow: "drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]",
    pulse: "rgba(255, 255, 255, 0.2)",
  },
};

function AnimatedCounterComponent({
  value,
  duration = 2,
  decimals = 2,
  prefix = "",
  suffix = "",
  className,
  size = "lg",
  color = "cyan",
  showGlow = true,
  showPulse = true,
  formatOptions,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValue = useRef(value);
  const nodeRef = useRef<HTMLSpanElement>(null);

  // Spring for smooth value transitions
  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 15,
  });

  useEffect(() => {
    setIsAnimating(true);
    const controls = animate(prevValue.current, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for dramatic feel
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
      onComplete: () => {
        setIsAnimating(false);
        prevValue.current = value;
      },
    });

    return () => controls.stop();
  }, [value, duration]);

  // Format the number
  const formattedValue = formatOptions
    ? new Intl.NumberFormat("en-US", formatOptions).format(displayValue)
    : displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  const colorConfig = colorClasses[color];

  return (
    <div className={cn("relative inline-flex items-baseline", className)}>
      {/* Pulse ring effect */}
      {showPulse && isAnimating && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: [1, 1.5, 2],
            opacity: [0.5, 0.2, 0],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatDelay: 0.2,
          }}
          style={{
            background: `radial-gradient(circle, ${colorConfig.pulse}, transparent 70%)`,
          }}
        />
      )}

      {/* Prefix */}
      {prefix && (
        <span
          className={cn(
            "font-mono opacity-60 mr-1",
            sizeClasses[size],
            colorConfig.text
          )}
        >
          {prefix}
        </span>
      )}

      {/* Main value with digit morphing */}
      <motion.span
        ref={nodeRef}
        className={cn(
          "font-mono font-bold tabular-nums tracking-tight",
          sizeClasses[size],
          colorConfig.text,
          showGlow && colorConfig.glow
        )}
        animate={{
          scale: isAnimating ? [1, 1.02, 1] : 1,
        }}
        transition={{
          duration: 0.3,
          repeat: isAnimating ? Infinity : 0,
          repeatDelay: 0.5,
        }}
      >
        {formattedValue}
      </motion.span>

      {/* Suffix */}
      {suffix && (
        <span
          className={cn(
            "font-mono opacity-60 ml-1",
            size === "xl" ? "text-3xl" : size === "lg" ? "text-xl" : "text-base",
            colorConfig.text
          )}
        >
          {suffix}
        </span>
      )}

      {/* Scanline effect during animation */}
      {isAnimating && (
        <motion.div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute left-0 right-0 h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${colorConfig.pulse}, transparent)`,
            }}
            animate={{
              top: ["0%", "100%"],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

export const AnimatedCounter = memo(AnimatedCounterComponent);

/**
 * CompactCounter - For smaller inline values
 */
interface CompactCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  color?: "cyan" | "purple" | "pink" | "gold" | "white";
  trend?: "up" | "down" | "neutral";
}

function CompactCounterComponent({
  value,
  decimals = 2,
  prefix = "",
  suffix = "",
  className,
  color = "cyan",
  trend = "neutral",
}: CompactCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: setDisplayValue,
    });
    return () => controls.stop();
  }, [value]);

  const colorConfig = colorClasses[color];
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: colorConfig.text,
  };

  return (
    <span
      className={cn(
        "font-mono font-semibold tabular-nums",
        trendColors[trend],
        className
      )}
    >
      {prefix}
      {displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export const CompactCounter = memo(CompactCounterComponent);

/**
 * PercentageCounter - Specialized for percentages with progress indication
 */
interface PercentageCounterProps {
  value: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  showBar?: boolean;
  color?: "cyan" | "purple" | "pink" | "gold";
}

function PercentageCounterComponent({
  value,
  className,
  size = "md",
  showBar = true,
  color = "cyan",
}: PercentageCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 2,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: setDisplayValue,
    });
    return () => controls.stop();
  }, [value]);

  const colorConfig = colorClasses[color];
  const barColors = {
    cyan: "from-cyan-500 to-cyan-400",
    purple: "from-purple-500 to-purple-400",
    pink: "from-pink-500 to-pink-400",
    gold: "from-amber-500 to-amber-400",
  };

  const sizeStyles = {
    sm: { text: "text-lg", bar: "h-1" },
    md: { text: "text-2xl", bar: "h-1.5" },
    lg: { text: "text-4xl", bar: "h-2" },
  };

  return (
    <div className={cn("space-y-2", className)}>
      <motion.span
        className={cn(
          "font-mono font-bold tabular-nums",
          sizeStyles[size].text,
          colorConfig.text,
          colorConfig.glow
        )}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 0.5 }}
      >
        {displayValue.toFixed(2)}%
      </motion.span>

      {showBar && (
        <div
          className={cn(
            "w-full rounded-full bg-white/5 overflow-hidden",
            sizeStyles[size].bar
          )}
        >
          <motion.div
            className={cn(
              "h-full rounded-full bg-gradient-to-r",
              barColors[color]
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(displayValue, 100)}%` }}
            transition={{ duration: 2, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>
      )}
    </div>
  );
}

export const PercentageCounter = memo(PercentageCounterComponent);
