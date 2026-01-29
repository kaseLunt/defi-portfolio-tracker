"use client";

/**
 * RadialHealthGauge Component
 *
 * A cockpit-style circular gauge inspired by spacecraft instrumentation
 * and premium automotive dashboards. Features animated arcs, glowing
 * indicators, and dynamic risk zone coloring.
 */

import { useEffect, useState, useMemo, memo } from "react";
import { motion, animate } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, Shield, Zap } from "lucide-react";

interface RadialHealthGaugeProps {
  value: number; // 0-100 or custom range
  maxValue?: number;
  minValue?: number;
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "health" | "risk" | "performance";
  showTicks?: boolean;
  showGlow?: boolean;
  animate?: boolean;
  className?: string;
  thresholds?: {
    danger: number;
    warning: number;
    safe: number;
  };
}

const sizeConfig = {
  sm: { size: 120, strokeWidth: 8, fontSize: "text-lg", iconSize: 16 },
  md: { size: 180, strokeWidth: 10, fontSize: "text-2xl", iconSize: 20 },
  lg: { size: 240, strokeWidth: 12, fontSize: "text-4xl", iconSize: 28 },
  xl: { size: 320, strokeWidth: 16, fontSize: "text-5xl", iconSize: 36 },
};

const defaultThresholds = {
  danger: 25,
  warning: 50,
  safe: 75,
};

function RadialHealthGaugeComponent({
  value,
  maxValue = 100,
  minValue = 0,
  label = "Health Factor",
  sublabel,
  size = "lg",
  variant = "health",
  showTicks = true,
  showGlow = true,
  animate: shouldAnimate = true,
  className,
  thresholds = defaultThresholds,
}: RadialHealthGaugeProps) {
  // Ensure inputs are valid numbers
  const safeValue = typeof value === "number" && isFinite(value) ? value : 0;
  const safeMaxValue = typeof maxValue === "number" && isFinite(maxValue) && maxValue > minValue ? maxValue : 100;
  const safeMinValue = typeof minValue === "number" && isFinite(minValue) ? minValue : 0;

  const [displayValue, setDisplayValue] = useState(0);
  const config = sizeConfig[size];

  // Normalize value to 0-100 percentage
  const normalizedValue = useMemo(() => {
    const range = safeMaxValue - safeMinValue;
    if (range <= 0) return 0;
    return Math.max(0, Math.min(100, ((safeValue - safeMinValue) / range) * 100));
  }, [safeValue, safeMinValue, safeMaxValue]);

  // Animate value on change
  useEffect(() => {
    if (shouldAnimate) {
      const controls = animate(displayValue, normalizedValue, {
        duration: 1.5,
        ease: [0.34, 1.56, 0.64, 1], // Bouncy spring-like
        onUpdate: setDisplayValue,
      });
      return () => controls.stop();
    } else {
      setDisplayValue(normalizedValue);
    }
  }, [normalizedValue, shouldAnimate]);

  // Determine color based on value and thresholds
  const getColor = useMemo(() => {
    if (normalizedValue <= thresholds.danger) {
      return {
        primary: "#ef4444", // red-500
        glow: "rgba(239, 68, 68, 0.5)",
        bg: "rgba(239, 68, 68, 0.1)",
        status: "critical",
      };
    } else if (normalizedValue <= thresholds.warning) {
      return {
        primary: "#f59e0b", // amber-500
        glow: "rgba(245, 158, 11, 0.5)",
        bg: "rgba(245, 158, 11, 0.1)",
        status: "warning",
      };
    } else if (normalizedValue <= thresholds.safe) {
      return {
        primary: "#00ffd0", // cyan
        glow: "rgba(0, 255, 208, 0.5)",
        bg: "rgba(0, 255, 208, 0.1)",
        status: "good",
      };
    } else {
      return {
        primary: "#22c55e", // green-500
        glow: "rgba(34, 197, 94, 0.5)",
        bg: "rgba(34, 197, 94, 0.1)",
        status: "excellent",
      };
    }
  }, [normalizedValue, thresholds]);

  // SVG calculations
  const center = config.size / 2;
  const radius = (config.size - config.strokeWidth) / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const strokeDashoffset = arcLength - (arcLength * displayValue) / 100;

  // Generate tick marks
  const ticks = useMemo(() => {
    if (!showTicks) return [];
    const tickCount = 27; // Every 10 degrees for 270 degree arc
    return Array.from({ length: tickCount }, (_, i) => {
      const angle = -225 + (i * 270) / (tickCount - 1);
      const isMajor = i % 3 === 0;
      const tickLength = isMajor ? 12 : 6;
      const innerRadius = radius - tickLength;
      const outerRadius = radius + 4;

      const rad = (angle * Math.PI) / 180;
      return {
        x1: center + innerRadius * Math.cos(rad),
        y1: center + innerRadius * Math.sin(rad),
        x2: center + outerRadius * Math.cos(rad),
        y2: center + outerRadius * Math.sin(rad),
        isMajor,
        angle,
      };
    });
  }, [radius, center, showTicks]);

  // Indicator position
  const indicatorAngle = -225 + (displayValue / 100) * 270;
  const indicatorRad = (indicatorAngle * Math.PI) / 180;
  const indicatorX = center + (radius - 20) * Math.cos(indicatorRad);
  const indicatorY = center + (radius - 20) * Math.sin(indicatorRad);

  const StatusIcon = useMemo(() => {
    switch (getColor.status) {
      case "critical":
        return AlertTriangle;
      case "warning":
        return AlertTriangle;
      case "excellent":
        return Zap;
      default:
        return Shield;
    }
  }, [getColor.status]);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg
        width={config.size}
        height={config.size}
        viewBox={`0 0 ${config.size} ${config.size}`}
        className="transform -rotate-90"
      >
        {/* Definitions */}
        <defs>
          {/* Glow filter */}
          <filter id={`glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient for arc */}
          <linearGradient id={`gauge-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="33%" stopColor="#f59e0b" />
            <stop offset="66%" stopColor="#00ffd0" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          {/* Outer glow gradient */}
          <radialGradient id={`outer-glow-${size}`}>
            <stop offset="70%" stopColor="transparent" />
            <stop offset="100%" stopColor={getColor.glow} stopOpacity="0.3" />
          </radialGradient>
        </defs>

        {/* Ambient glow ring */}
        {showGlow && (
          <circle
            cx={center}
            cy={center}
            r={radius + 15}
            fill={`url(#outer-glow-${size})`}
          />
        )}

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(135 ${center} ${center})`}
        />

        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.isMajor ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}
            strokeWidth={tick.isMajor ? 2 : 1}
            transform={`rotate(90 ${center} ${center})`}
          />
        ))}

        {/* Colored arc segments for risk zones */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth={config.strokeWidth - 4}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeOpacity={0.15}
          transform={`rotate(135 ${center} ${center})`}
        />

        {/* Value arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor.primary}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(135 ${center} ${center})`}
          filter={showGlow ? `url(#glow-${size})` : undefined}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
        />

        {/* Needle indicator */}
        {isFinite(indicatorX) && isFinite(indicatorY) && (
          <motion.circle
            cx={indicatorX}
            cy={indicatorY}
            r={6}
            fill={getColor.primary}
            filter={showGlow ? `url(#glow-${size})` : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ transform: "rotate(90deg)", transformOrigin: `${center}px ${center}px` }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Status icon */}
        <motion.div
          className="mb-2"
          animate={{
            scale: getColor.status === "critical" ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 0.5,
            repeat: getColor.status === "critical" ? Infinity : 0,
          }}
        >
          <StatusIcon
            size={config.iconSize}
            style={{ color: getColor.primary }}
            className={showGlow ? "drop-shadow-lg" : ""}
          />
        </motion.div>

        {/* Value */}
        <motion.div
          className={cn(
            "font-mono font-bold tabular-nums",
            config.fontSize
          )}
          style={{
            color: getColor.primary,
            textShadow: showGlow ? `0 0 20px ${getColor.glow}` : undefined,
          }}
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {safeValue.toFixed(2)}
        </motion.div>

        {/* Label */}
        <div className="text-white/50 text-sm font-medium mt-1">{label}</div>
        {sublabel && (
          <div className="text-white/30 text-xs mt-0.5">{sublabel}</div>
        )}

        {/* Status badge */}
        <motion.div
          className={cn(
            "mt-3 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
            "border backdrop-blur-sm"
          )}
          style={{
            backgroundColor: getColor.bg,
            borderColor: `${getColor.primary}40`,
            color: getColor.primary,
          }}
          animate={{
            boxShadow: showGlow
              ? [
                  `0 0 0px ${getColor.glow}`,
                  `0 0 15px ${getColor.glow}`,
                  `0 0 0px ${getColor.glow}`,
                ]
              : undefined,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {getColor.status}
        </motion.div>
      </div>
    </div>
  );
}

export const RadialHealthGauge = memo(RadialHealthGaugeComponent);

/**
 * MiniGauge - Compact inline gauge for dashboards
 */
interface MiniGaugeProps {
  value: number;
  maxValue?: number;
  size?: number;
  color?: string;
  className?: string;
}

function MiniGaugeComponent({
  value,
  maxValue = 100,
  size = 48,
  color = "#00ffd0",
  className,
}: MiniGaugeProps) {
  const percentage = Math.min(100, (value / maxValue) * 100);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={3}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      <span
        className="absolute font-mono text-xs font-bold"
        style={{ color }}
      >
        {Math.round(percentage)}
      </span>
    </div>
  );
}

export const MiniGauge = memo(MiniGaugeComponent);
