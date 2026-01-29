"use client";

/**
 * Strategy Insights Components
 *
 * Professional-grade visualizations for DeFi strategy analysis.
 * Designed for clarity, actionability, and visual impact.
 */

import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  DollarSign,
  Percent,
  Activity,
  Target,
  Flame,
  Lightbulb,
} from "lucide-react";

// ============================================================================
// Waterfall Chart - Financial Standard for APY Breakdown
// ============================================================================

interface WaterfallItem {
  label: string;
  value: number;
  type: "start" | "positive" | "negative" | "total";
  protocol?: string;
  sublabel?: string;
}

interface WaterfallChartProps {
  items: WaterfallItem[];
  height?: number;
  className?: string;
}

function WaterfallChartComponent({ items, height = 320, className }: WaterfallChartProps) {
  // Calculate cumulative values and scale
  const chartData = useMemo(() => {
    let runningTotal = 0;
    const processedItems = items.map((item, index) => {
      const start = item.type === "start" || item.type === "total" ? 0 : runningTotal;
      const end = item.type === "total" ? runningTotal : start + item.value;

      if (item.type !== "total") {
        runningTotal = end;
      }

      return {
        ...item,
        start,
        end,
        index,
      };
    });

    const allValues = processedItems.flatMap(p => [p.start, p.end]);
    const minVal = Math.min(...allValues, 0);
    const maxVal = Math.max(...allValues);
    const range = maxVal - minVal || 1;

    return { processedItems, minVal, maxVal, range };
  }, [items]);

  const barWidth = 64;
  const barGap = 24;
  const chartPadding = 60;
  const chartWidth = items.length * (barWidth + barGap) + chartPadding * 2;
  const chartHeight = height;
  const plotHeight = chartHeight - 80;

  const yScale = (value: number) => {
    return chartHeight - 40 - ((value - chartData.minVal) / chartData.range) * plotHeight;
  };

  const getBarColor = (type: string, value: number) => {
    if (type === "start") return { fill: "#06B6D4", stroke: "#22D3EE", glow: "rgba(6, 182, 212, 0.4)" };
    if (type === "total") return { fill: "#A855F7", stroke: "#C084FC", glow: "rgba(168, 85, 247, 0.4)" };
    if (value >= 0) return { fill: "#22C55E", stroke: "#4ADE80", glow: "rgba(34, 197, 94, 0.4)" };
    return { fill: "#EF4444", stroke: "#F87171", glow: "rgba(239, 68, 68, 0.4)" };
  };

  return (
    <div className={cn("relative", className)}>
      <svg
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-visible"
      >
        <defs>
          <filter id="bar-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="connector-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>

        {/* Zero line */}
        <line
          x1={chartPadding - 10}
          y1={yScale(0)}
          x2={chartWidth - chartPadding + 10}
          y2={yScale(0)}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Connector lines between bars */}
        {chartData.processedItems.slice(0, -1).map((item, i) => {
          const nextItem = chartData.processedItems[i + 1];
          if (!nextItem || nextItem.type === "total") return null;

          const x1 = chartPadding + i * (barWidth + barGap) + barWidth;
          const x2 = chartPadding + (i + 1) * (barWidth + barGap);
          const y = yScale(item.end);

          return (
            <motion.line
              key={`connector-${i}`}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              stroke="url(#connector-gradient)"
              strokeWidth={2}
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
            />
          );
        })}

        {/* Bars */}
        {chartData.processedItems.map((item, i) => {
          const colors = getBarColor(item.type, item.value);
          const x = chartPadding + i * (barWidth + barGap);
          const y1 = yScale(item.start);
          const y2 = yScale(item.end);
          const barHeight = Math.abs(y1 - y2);
          const barY = Math.min(y1, y2);

          return (
            <g key={item.label}>
              {/* Bar shadow/glow */}
              <motion.rect
                x={x - 2}
                y={barY - 2}
                width={barWidth + 4}
                height={barHeight + 4}
                rx={6}
                fill={colors.glow}
                filter="url(#bar-glow)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 0.1 + i * 0.08 }}
              />

              {/* Main bar */}
              <motion.rect
                x={x}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={1.5}
                initial={{ scaleY: 0, originY: item.value >= 0 ? 1 : 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: "backOut" }}
                style={{ transformOrigin: `${x + barWidth / 2}px ${item.value >= 0 ? y1 : y2}px` }}
              />

              {/* Value label */}
              <motion.text
                x={x + barWidth / 2}
                y={barY - 8}
                textAnchor="middle"
                className="text-xs font-bold"
                style={{ fontFamily: "var(--font-mono), monospace", fill: colors.stroke }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                {item.type === "start" ? `$${(item.value / 1000).toFixed(0)}K` :
                 item.type === "total" ? `${item.value >= 0 ? "+" : ""}${item.value.toFixed(2)}%` :
                 `${item.value >= 0 ? "+" : ""}${item.value.toFixed(2)}%`}
              </motion.text>

              {/* Label */}
              <motion.text
                x={x + barWidth / 2}
                y={chartHeight - 20}
                textAnchor="middle"
                className="text-[10px] fill-white/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.08 }}
              >
                {item.label.length > 10 ? item.label.slice(0, 9) + "…" : item.label}
              </motion.text>

              {/* Sublabel (protocol) */}
              {item.sublabel && (
                <motion.text
                  x={x + barWidth / 2}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  className="text-[8px] fill-white/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                >
                  {item.sublabel}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const WaterfallChart = memo(WaterfallChartComponent);

// ============================================================================
// Strategy Pipeline - Visual representation of strategy flow
// ============================================================================

interface PipelineStep {
  id: string;
  type: "input" | "stake" | "lend" | "borrow" | "loop" | "output";
  label: string;
  protocol?: string;
  value?: string;
  apy?: number;
  isWarning?: boolean;
}

interface StrategyPipelineProps {
  steps: PipelineStep[];
  className?: string;
}

const stepIcons: Record<string, React.ReactNode> = {
  input: <DollarSign className="w-5 h-5" />,
  stake: <Zap className="w-5 h-5" />,
  lend: <TrendingUp className="w-5 h-5" />,
  borrow: <TrendingDown className="w-5 h-5" />,
  loop: <Activity className="w-5 h-5" />,
  output: <Target className="w-5 h-5" />,
};

const stepColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  input: { bg: "from-cyan-500/20 to-cyan-600/10", border: "border-cyan-500/40", text: "text-cyan-400", glow: "shadow-cyan-500/20" },
  stake: { bg: "from-purple-500/20 to-purple-600/10", border: "border-purple-500/40", text: "text-purple-400", glow: "shadow-purple-500/20" },
  lend: { bg: "from-green-500/20 to-green-600/10", border: "border-green-500/40", text: "text-green-400", glow: "shadow-green-500/20" },
  borrow: { bg: "from-amber-500/20 to-amber-600/10", border: "border-amber-500/40", text: "text-amber-400", glow: "shadow-amber-500/20" },
  loop: { bg: "from-pink-500/20 to-pink-600/10", border: "border-pink-500/40", text: "text-pink-400", glow: "shadow-pink-500/20" },
  output: { bg: "from-emerald-500/20 to-emerald-600/10", border: "border-emerald-500/40", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
};

function StrategyPipelineComponent({ steps, className }: StrategyPipelineProps) {
  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto py-4 px-2", className)}>
      {steps.map((step, index) => {
        const colors = stepColors[step.type] || stepColors.input;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative flex flex-col items-center gap-2 px-4 py-3 rounded-xl",
                "bg-gradient-to-br border backdrop-blur-sm min-w-[100px]",
                colors.bg,
                colors.border,
                step.isWarning && "ring-2 ring-red-500/50"
              )}
            >
              {/* Icon */}
              <div className={cn("p-2 rounded-lg bg-black/20", colors.text)}>
                {stepIcons[step.type]}
              </div>

              {/* Label */}
              <div className="text-center">
                <div className="text-xs font-medium text-white">{step.label}</div>
                {step.protocol && (
                  <div className="text-[10px] text-white/50">{step.protocol}</div>
                )}
              </div>

              {/* Value/APY */}
              {(step.value || step.apy !== undefined) && (
                <div className={cn("text-sm font-bold font-mono", colors.text)}>
                  {step.value || `${step.apy! >= 0 ? "+" : ""}${step.apy!.toFixed(1)}%`}
                </div>
              )}

              {/* Warning indicator */}
              {step.isWarning && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -top-1 -right-1"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </motion.div>
              )}
            </motion.div>

            {/* Arrow connector */}
            {!isLast && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.05 }}
                className="mx-2"
              >
                <ArrowRight className="w-5 h-5 text-white/30" />
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const StrategyPipeline = memo(StrategyPipelineComponent);

// ============================================================================
// Key Insights - AI-style analysis cards
// ============================================================================

interface Insight {
  type: "success" | "warning" | "danger" | "info";
  title: string;
  description: string;
  metric?: string;
  action?: string;
}

interface KeyInsightsProps {
  insights: Insight[];
  className?: string;
}

const insightConfig: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    bg: "from-green-500/10 to-emerald-500/5",
    border: "border-green-500/30",
    text: "text-green-400"
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    bg: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-500/30",
    text: "text-amber-400"
  },
  danger: {
    icon: <Flame className="w-5 h-5" />,
    bg: "from-red-500/10 to-rose-500/5",
    border: "border-red-500/30",
    text: "text-red-400"
  },
  info: {
    icon: <Lightbulb className="w-5 h-5" />,
    bg: "from-blue-500/10 to-indigo-500/5",
    border: "border-blue-500/30",
    text: "text-blue-400"
  },
};

function KeyInsightsComponent({ insights, className }: KeyInsightsProps) {
  return (
    <div className={cn("grid gap-3", className)}>
      {insights.map((insight, index) => {
        const config = insightConfig[insight.type];

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-start gap-4 p-4 rounded-xl",
              "bg-gradient-to-r border backdrop-blur-sm",
              config.bg,
              config.border
            )}
          >
            <div className={cn("p-2 rounded-lg bg-black/20 shrink-0", config.text)}>
              {config.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{insight.title}</span>
                {insight.metric && (
                  <span className={cn("text-sm font-mono font-bold", config.text)}>
                    {insight.metric}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/60 mt-1">{insight.description}</p>
              {insight.action && (
                <p className={cn("text-xs mt-2 font-medium", config.text)}>
                  {insight.action}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export const KeyInsights = memo(KeyInsightsComponent);

// ============================================================================
// Yield Composition Ring - Donut chart for yield breakdown
// ============================================================================

interface YieldSegment {
  label: string;
  value: number;
  color: string;
  protocol?: string;
}

interface YieldCompositionRingProps {
  segments: YieldSegment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  className?: string;
}

function YieldCompositionRingComponent({
  segments,
  centerValue,
  centerLabel,
  size = 200,
  className,
}: YieldCompositionRingProps) {
  const total = segments.reduce((sum, seg) => sum + Math.abs(seg.value), 0);
  const radius = size / 2 - 20;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;

  // Calculate segment positions
  const segmentData = useMemo(() => {
    let currentOffset = 0;
    return segments.map((segment) => {
      const percentage = Math.abs(segment.value) / total;
      const length = percentage * circumference * 0.75; // 270 degrees
      const offset = currentOffset;
      currentOffset += length;
      return { ...segment, length, offset, percentage };
    });
  }, [segments, total, circumference]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-[135deg]">
        <defs>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
        />

        {/* Segments */}
        {segmentData.map((segment, i) => (
          <motion.circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth - 4}
            strokeLinecap="round"
            strokeDasharray={`${segment.length} ${circumference}`}
            strokeDashoffset={-segment.offset}
            filter="url(#ring-glow)"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${segment.length} ${circumference}` }}
            transition={{ delay: 0.2 + i * 0.1, duration: 0.8, ease: "easeOut" }}
          />
        ))}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <div className="text-3xl font-bold font-mono text-white">{centerValue}</div>
          <div className="text-xs text-white/50 uppercase tracking-wider">{centerLabel}</div>
        </motion.div>
      </div>

      {/* Legend */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3">
        {segmentData.map((segment, i) => (
          <motion.div
            key={segment.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.05 }}
            className="flex items-center gap-1.5"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-[10px] text-white/60">{segment.label}</span>
            <span className="text-[10px] font-mono font-bold" style={{ color: segment.color }}>
              {segment.value >= 0 ? "+" : ""}{segment.value.toFixed(1)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const YieldCompositionRing = memo(YieldCompositionRingComponent);

// ============================================================================
// Risk Meter - Visual risk assessment
// ============================================================================

interface RiskMeterProps {
  score: number; // 0-100
  level: "low" | "medium" | "high" | "extreme";
  healthFactor?: number | null;
  liquidationPrice?: number | null;
  className?: string;
}

function RiskMeterComponent({ score, level, healthFactor, liquidationPrice, className }: RiskMeterProps) {
  const segments = [
    { label: "Low", color: "#22C55E", range: [0, 25] },
    { label: "Medium", color: "#F59E0B", range: [25, 50] },
    { label: "High", color: "#F97316", range: [50, 75] },
    { label: "Extreme", color: "#EF4444", range: [75, 100] },
  ];

  const currentSegment = segments.find(s => score >= s.range[0] && score < s.range[1]) || segments[3];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Meter bar */}
      <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, #22C55E 0%, #F59E0B 33%, #F97316 66%, #EF4444 100%)"
          }}
        />

        {/* Indicator */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-lg"
          style={{ borderColor: currentSegment.color }}
          initial={{ left: "0%" }}
          animate={{ left: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-white/40">
        {segments.map(seg => (
          <span key={seg.label} style={{ color: seg.color }}>{seg.label}</span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        {healthFactor !== null && healthFactor !== undefined && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Health Factor</div>
            <div className={cn(
              "text-lg font-mono font-bold",
              healthFactor < 1.25 ? "text-red-400" : healthFactor < 1.5 ? "text-amber-400" : "text-green-400"
            )}>
              {healthFactor.toFixed(2)}
            </div>
          </div>
        )}
        {liquidationPrice !== null && liquidationPrice !== undefined && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Liquidation Price</div>
            <div className="text-lg font-mono font-bold text-red-400">
              ${liquidationPrice.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const RiskMeter = memo(RiskMeterComponent);
