"use client";

/**
 * NeonHealthGauge - Premium Radial Health Factor Gauge
 *
 * Features animated arcs, particle effects, neon glows,
 * and dynamic color transitions based on health status.
 */

import { useEffect, useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Shield, Zap } from "lucide-react";

interface NeonHealthGaugeProps {
  value: number;
  max?: number;
  liquidationPrice?: number | null;
  className?: string;
  size?: "default" | "large";
  showParticles?: boolean;
}

function NeonHealthGaugeComponent({
  value,
  max = 3,
  liquidationPrice,
  className,
  size = "default",
  showParticles = true,
}: NeonHealthGaugeProps) {
  // Ensure value is a valid number
  const safeValue = typeof value === "number" && !isNaN(value) && isFinite(value) ? value : 0;
  const safeMax = typeof max === "number" && !isNaN(max) && isFinite(max) && max > 0 ? max : 3;

  const [animatedValue, setAnimatedValue] = useState(0);

  // Animate value on mount/change
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(safeValue), 100);
    return () => clearTimeout(timer);
  }, [safeValue]);

  // Calculate status and colors
  const status = useMemo(() => {
    if (safeValue < 1.1) return "critical";
    if (safeValue < 1.25) return "danger";
    if (safeValue < 1.5) return "warning";
    return "healthy";
  }, [safeValue]);

  const colors = useMemo(() => {
    switch (status) {
      case "critical":
        return {
          primary: "#EF4444",
          secondary: "#991B1B",
          glow: "rgba(239, 68, 68, 0.6)",
          bg: "rgba(239, 68, 68, 0.1)",
        };
      case "danger":
        return {
          primary: "#F97316",
          secondary: "#C2410C",
          glow: "rgba(249, 115, 22, 0.6)",
          bg: "rgba(249, 115, 22, 0.1)",
        };
      case "warning":
        return {
          primary: "#F59E0B",
          secondary: "#B45309",
          glow: "rgba(245, 158, 11, 0.6)",
          bg: "rgba(245, 158, 11, 0.1)",
        };
      default:
        return {
          primary: "#22C55E",
          secondary: "#15803D",
          glow: "rgba(34, 197, 94, 0.6)",
          bg: "rgba(34, 197, 94, 0.1)",
        };
    }
  }, [status]);

  // SVG dimensions
  const svgSize = size === "large" ? 280 : 220;
  const center = svgSize / 2;
  const radius = size === "large" ? 100 : 80;
  const strokeWidth = size === "large" ? 12 : 10;

  // Arc calculations
  const percentage = Math.min((animatedValue / safeMax) * 100, 100);
  const circumference = 2 * Math.PI * radius;
  const arcLength = (percentage / 100) * (circumference * 0.75); // 270 degree arc

  // Generate arc path for 270 degrees (from 135 to 405 degrees)
  const startAngle = 135;
  const endAngle = 405;
  const sweepAngle = (percentage / 100) * 270;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(startAngle + sweepAngle);
  const largeArc = sweepAngle > 180 ? 1 : 0;

  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${polarToCartesian(endAngle).x} ${polarToCartesian(endAngle).y}`;
  const valuePath =
    sweepAngle > 0
      ? `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
      : "";

  // Tick marks
  const ticks = useMemo(() => {
    const tickCount = 9; // 0, 0.5, 1, 1.5, 2, 2.5, 3
    const tickAngles: { angle: number; label: string; major: boolean }[] = [];

    for (let i = 0; i <= tickCount; i++) {
      const val = (i / tickCount) * safeMax;
      const angle = startAngle + (i / tickCount) * 270;
      tickAngles.push({
        angle,
        label: val.toFixed(1),
        major: i % 3 === 0,
      });
    }

    return tickAngles;
  }, [safeMax]);

  // Particles around the gauge
  const particles = useMemo(() => {
    if (!showParticles) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: startAngle + (i / 12) * 270,
      delay: i * 0.1,
    }));
  }, [showParticles]);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: colors.glow }}
      />

      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="overflow-visible"
      >
        <defs>
          {/* Main gradient */}
          <linearGradient id="health-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} />
            <stop offset="100%" stopColor={colors.secondary} />
          </linearGradient>

          {/* Glow filter */}
          <filter id="health-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur1" />
            <feGaussianBlur stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Inner shadow */}
          <filter id="inner-shadow">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="out" />
          </filter>
        </defs>

        {/* Background circle pattern */}
        <circle
          cx={center}
          cy={center}
          r={radius + 25}
          fill="none"
          stroke="rgba(255, 255, 255, 0.02)"
          strokeWidth={50}
          strokeDasharray="2 6"
        />

        {/* Outer decorative ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius + 20}
          fill="none"
          stroke={colors.primary}
          strokeWidth={1}
          strokeOpacity={0.2}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        />

        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {ticks.map((tick, i) => {
          const innerR = radius - (tick.major ? 20 : 14);
          const outerR = radius - 8;
          const inner = polarToCartesian(tick.angle);
          const outer = {
            x: center + innerR * Math.cos((tick.angle * Math.PI) / 180),
            y: center + innerR * Math.sin((tick.angle * Math.PI) / 180),
          };

          return (
            <g key={i}>
              <line
                x1={outer.x}
                y1={outer.y}
                x2={center + outerR * Math.cos((tick.angle * Math.PI) / 180)}
                y2={center + outerR * Math.sin((tick.angle * Math.PI) / 180)}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth={tick.major ? 2 : 1}
              />
              {tick.major && (
                <text
                  x={center + (radius - 35) * Math.cos((tick.angle * Math.PI) / 180)}
                  y={center + (radius - 35) * Math.sin((tick.angle * Math.PI) / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white/30 text-[10px]"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {tick.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Value arc glow (behind) */}
        <motion.path
          d={valuePath}
          fill="none"
          stroke={colors.primary}
          strokeWidth={strokeWidth + 8}
          strokeLinecap="round"
          strokeOpacity={0.3}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          filter="url(#health-glow)"
        />

        {/* Value arc main */}
        <motion.path
          d={valuePath}
          fill="none"
          stroke="url(#health-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Animated pulse at end of arc */}
        {sweepAngle > 0 && isFinite(end.x) && isFinite(end.y) && (
          <motion.circle
            cx={end.x}
            cy={end.y}
            r={8}
            fill={colors.primary}
            filter="url(#health-glow)"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [1, 0.6, 1],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ transformOrigin: `${end.x}px ${end.y}px` }}
          />
        )}

        {/* Floating particles */}
        {particles.map((particle) => {
          const particleR = radius + 15;
          const px = center + particleR * Math.cos((particle.angle * Math.PI) / 180);
          const py = center + particleR * Math.sin((particle.angle * Math.PI) / 180);

          // Skip particles with invalid coordinates
          if (!isFinite(px) || !isFinite(py)) return null;

          return (
            <motion.circle
              key={particle.id}
              cx={px}
              cy={py}
              r={2}
              fill={colors.primary}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 0.6, 0],
                scale: [0, 1, 0],
                y: [0, -10, 0],
              }}
              transition={{
                duration: 2,
                delay: particle.delay,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
          );
        })}

        {/* Center decorative elements */}
        <circle
          cx={center}
          cy={center}
          r={45}
          fill="rgba(10, 10, 15, 0.9)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={1}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={35}
          fill="none"
          stroke={colors.primary}
          strokeWidth={1}
          strokeOpacity={0.3}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />
      </svg>

      {/* Center content */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="flex flex-col items-center"
        >
          <div
            className={cn(
              "text-4xl font-bold tabular-nums",
              size === "large" && "text-5xl"
            )}
            style={{
              fontFamily: "var(--font-mono), monospace",
              color: colors.primary,
              textShadow: `0 0 20px ${colors.glow}`,
            }}
          >
            {animatedValue.toFixed(2)}
          </div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mt-1">
            Health Factor
          </div>
        </motion.div>
      </div>

      {/* Status badge */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className={cn(
          "mt-4 flex items-center gap-2 px-4 py-2 rounded-full",
          "border backdrop-blur-sm"
        )}
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.primary + "40",
        }}
      >
        {status === "healthy" && <Shield className="w-4 h-4" style={{ color: colors.primary }} />}
        {status === "warning" && <AlertTriangle className="w-4 h-4" style={{ color: colors.primary }} />}
        {(status === "danger" || status === "critical") && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: colors.primary }} />
          </motion.div>
        )}
        <span
          className="text-sm font-semibold capitalize"
          style={{ color: colors.primary }}
        >
          {status === "critical" ? "Critical Risk" : status === "healthy" ? "Healthy" : `${status.charAt(0).toUpperCase() + status.slice(1)} Risk`}
        </span>
      </motion.div>

      {/* Liquidation price */}
      {liquidationPrice && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-3 text-xs text-white/40"
        >
          Liquidates at{" "}
          <span className="text-red-400 font-mono">
            ${liquidationPrice.toLocaleString()}
          </span>
        </motion.div>
      )}
    </div>
  );
}

export const NeonHealthGauge = memo(NeonHealthGaugeComponent);

// ============================================================================
// No Borrowing State
// ============================================================================

export function NoBorrowingState({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex flex-col items-center justify-center py-12",
        className
      )}
    >
      <motion.div
        className="relative"
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-400" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-green-500/30"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      <div className="mt-6 text-center">
        <div className="text-lg font-semibold text-white">No Borrowing</div>
        <div className="text-sm text-white/50 mt-1">
          Zero liquidation risk
        </div>
      </div>
    </motion.div>
  );
}
