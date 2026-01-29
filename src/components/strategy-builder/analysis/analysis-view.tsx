"use client";

/**
 * Strategy Analysis View - Premium Cyberpunk Edition
 *
 * Advanced data visualization for DeFi strategy analysis.
 * Features holographic cards, animated Sankey flows, neon gauges,
 * and premium particle effects.
 */

import { useMemo, memo, useState, Component, ErrorInfo, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Sparkles,
  Layers,
  PiggyBank,
  HandCoins,
  ArrowUpRight,
  DollarSign,
  Gauge,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStrategyStore } from "@/lib/strategy/store";
import { Orbitron, Exo_2, Fira_Code } from "next/font/google";

// Import premium components
import { HoloMetricCard, MetricGrid } from "./holo-metric-card";
import { NeonHealthGauge, NoBorrowingState } from "./neon-health-gauge";
import { StrategyFlow } from "./cyber-sankey";
import { ParticleField } from "./particle-field";

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center p-8 text-white/50">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
            <div className="text-sm">Something went wrong</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Fonts
// ============================================================================

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// ============================================================================
// Animation Variants
// ============================================================================

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

// ============================================================================
// Section Header
// ============================================================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function SectionHeader({ title, subtitle, icon, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-600/10 border border-purple-500/20">
            {icon}
          </div>
        )}
        <div>
          <h2
            className={cn(
              "text-lg font-bold tracking-wide text-white",
              orbitron.className
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ============================================================================
// Premium Card Wrapper
// ============================================================================

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

function PremiumCard({ children, className, glow = false }: PremiumCardProps) {
  return (
    <motion.div
      variants={fadeIn}
      className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-[#12121a]/95 to-[#0a0a10]/98",
        "border border-purple-500/10",
        glow && "shadow-[0_0_40px_rgba(168,85,247,0.1)]",
        className
      )}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-purple-500/20 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-cyan-500/20 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-cyan-500/20 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-purple-500/20 rounded-br-xl" />

      {/* Top accent line */}
      <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

      {children}
    </motion.div>
  );
}

// ============================================================================
// APY Breakdown Bars
// ============================================================================

interface APYBreakdownProps {
  items: Array<{
    label: string;
    type: string;
    value: number;
    protocol?: string;
  }>;
  netApy: number;
}

function APYBreakdown({ items, netApy }: APYBreakdownProps) {
  // Safeguard: ensure items is an array
  const safeItems = Array.isArray(items) ? items : [];
  const safeNetApy = typeof netApy === "number" && isFinite(netApy) ? netApy : 0;

  // If no items, show placeholder
  if (safeItems.length === 0) {
    return (
      <div className="text-center py-8 text-white/40">
        <div className="text-sm">No yield sources configured</div>
      </div>
    );
  }

  const maxAbs = Math.max(...safeItems.map((i) => Math.abs(i.value || 0)), 0.01);

  const typeColors: Record<string, { bg: string; text: string; bar: string }> = {
    stake: { bg: "bg-purple-500/20", text: "text-purple-400", bar: "#A855F7" },
    supply: { bg: "bg-green-500/20", text: "text-green-400", bar: "#22C55E" },
    lend: { bg: "bg-green-500/20", text: "text-green-400", bar: "#22C55E" },
    borrow: { bg: "bg-amber-500/20", text: "text-amber-400", bar: "#F59E0B" },
    rewards: { bg: "bg-cyan-500/20", text: "text-cyan-400", bar: "#06B6D4" },
  };

  return (
    <div className="space-y-4">
      {safeItems.map((item, i) => {
        const itemValue = typeof item.value === "number" && isFinite(item.value) ? item.value : 0;
        const isPositive = itemValue >= 0;
        const barWidth = Math.min(100, (Math.abs(itemValue) / maxAbs) * 100);
        const colorScheme = typeColors[item.type] || typeColors.rewards;

        return (
          <motion.div
            key={`${item.label || "item"}-${item.type || "unknown"}-${i}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-white">{item.label || "Unknown"}</span>
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                    colorScheme.bg,
                    colorScheme.text
                  )}
                >
                  {item.type || "yield"}
                </span>
              </div>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  firaCode.className,
                  isPositive ? "text-green-400" : "text-red-400"
                )}
              >
                {isPositive ? "+" : ""}
                {itemValue.toFixed(2)}%
              </span>
            </div>

            {/* Animated bar */}
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: isPositive
                    ? `linear-gradient(90deg, ${colorScheme.bar}, ${colorScheme.bar}80)`
                    : "linear-gradient(90deg, #EF4444, #EF444480)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        );
      })}

      {/* Net APY Total */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="pt-4 mt-4 border-t border-white/10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className={cn("text-sm font-bold text-white", orbitron.className)}>
              Net APY
            </span>
          </div>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              firaCode.className,
              netApy >= 0 ? "text-green-400" : "text-red-400"
            )}
            style={{
              textShadow:
                netApy >= 0
                  ? "0 0 20px rgba(34, 197, 94, 0.5)"
                  : "0 0 20px rgba(239, 68, 68, 0.5)",
            }}
          >
            {netApy >= 0 ? "+" : ""}
            {netApy.toFixed(2)}%
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Projection Flow
// ============================================================================

interface ProjectionFlowProps {
  initialValue: number;
  projectedValue: number;
  gasCost: number;
  fees: number;
}

function ProjectionFlow({ initialValue, projectedValue, gasCost, fees }: ProjectionFlowProps) {
  const grossYield = projectedValue - initialValue + gasCost + fees;
  const netGain = projectedValue - initialValue;

  const steps = [
    {
      label: "Initial Capital",
      value: `$${initialValue.toLocaleString()}`,
      color: "cyan",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      label: "Strategy Yields",
      value: `+$${Math.round(grossYield).toLocaleString()}`,
      color: "green",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      label: "Gas & Protocol Fees",
      value: `-$${Math.round(gasCost + fees).toLocaleString()}`,
      color: "red",
      icon: <TrendingDown className="w-4 h-4" />,
    },
    {
      label: "Projected Value (1Y)",
      value: `$${Math.round(projectedValue).toLocaleString()}`,
      color: "purple",
      icon: <Sparkles className="w-4 h-4" />,
      highlight: true,
    },
  ];

  const colorSchemes: Record<string, { bg: string; border: string; text: string }> = {
    cyan: { bg: "from-cyan-500/10 to-cyan-600/5", border: "border-cyan-500/30", text: "text-cyan-400" },
    green: { bg: "from-green-500/10 to-green-600/5", border: "border-green-500/30", text: "text-green-400" },
    red: { bg: "from-red-500/10 to-red-600/5", border: "border-red-500/30", text: "text-red-400" },
    purple: { bg: "from-purple-500/10 to-purple-600/5", border: "border-purple-500/30", text: "text-purple-400" },
  };

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const scheme = colorSchemes[step.color];

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "relative flex items-center justify-between p-4 rounded-xl",
              "bg-gradient-to-r border backdrop-blur-sm",
              scheme.bg,
              scheme.border,
              step.highlight && "ring-1 ring-purple-500/30"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  `bg-gradient-to-br ${scheme.bg}`
                )}
              >
                <span className={scheme.text}>{step.icon}</span>
              </div>
              <span
                className={cn(
                  "text-sm",
                  step.highlight ? "font-semibold text-white" : "text-white/70"
                )}
              >
                {step.label}
              </span>
            </div>
            <span
              className={cn(
                "font-bold tabular-nums",
                firaCode.className,
                step.highlight ? "text-lg" : "text-base",
                scheme.text
              )}
              style={step.highlight ? { textShadow: "0 0 20px rgba(168, 85, 247, 0.5)" } : {}}
            >
              {step.value}
            </span>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="absolute left-7 -bottom-3 w-px h-3 bg-gradient-to-b from-white/20 to-transparent" />
            )}
          </motion.div>
        );
      })}

      {/* Net gain highlight */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/70">Net Annual Gain</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              firaCode.className,
              netGain >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {netGain >= 0 ? "+" : ""}${Math.round(netGain).toLocaleString()}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Risk Badge
// ============================================================================

function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    low: {
      bg: "from-green-500/20 to-emerald-500/10",
      border: "border-green-500/40",
      text: "text-green-400",
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]",
    },
    medium: {
      bg: "from-amber-500/20 to-orange-500/10",
      border: "border-amber-500/40",
      text: "text-amber-400",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    },
    high: {
      bg: "from-red-500/20 to-rose-500/10",
      border: "border-red-500/40",
      text: "text-red-400",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
    },
    extreme: {
      bg: "from-red-600/20 to-rose-600/10",
      border: "border-red-600/40",
      text: "text-red-500",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    },
  };

  const c = config[level] || config.medium;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider",
        "bg-gradient-to-r border backdrop-blur-sm",
        c.bg,
        c.border,
        c.text,
        c.glow
      )}
    >
      <motion.span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: "currentColor" }}
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      {level === "low" ? "Low Risk" : level === "medium" ? "Medium Risk" : level === "high" ? "High Risk" : "Extreme Risk"}
    </span>
  );
}

// ============================================================================
// Main Analysis View
// ============================================================================

interface AnalysisViewProps {
  onBack: () => void;
}

function AnalysisViewComponent({ onBack }: AnalysisViewProps) {
  const simulationResult = useStrategyStore((state) => state.simulationResult);
  const result = simulationResult;
  const [activeTab, setActiveTab] = useState<"overview" | "flow">("overview");

  // Prepare yield data
  const yieldItems = useMemo(() => {
    if (!result?.yieldSources) return [];

    const map = new Map<string, { label: string; type: string; value: number; protocol: string }>();

    result.yieldSources.forEach((source) => {
      const key = `${source.protocol}-${source.type}`;
      const contribution = (source.apy * source.weight) / 100;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.value += contribution;
      } else {
        map.set(key, {
          label: source.protocol.charAt(0).toUpperCase() + source.protocol.slice(1),
          type: source.type,
          value: contribution,
          protocol: source.protocol,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [result?.yieldSources]);

  // Prepare flow data
  const flowData = useMemo(() => {
    if (!result?.yieldSources) return { sources: [], borrowCosts: [] };

    const sources = result.yieldSources
      .filter((s) => s.type !== "borrow")
      .map((s) => ({
        name: s.protocol.charAt(0).toUpperCase() + s.protocol.slice(1),
        sublabel: s.type,
        apy: (s.apy * s.weight) / 100,
        color: s.type === "stake" ? "#A855F7" : "#22C55E",
      }));

    const borrowCosts = result.yieldSources
      .filter((s) => s.type === "borrow")
      .map((s) => ({
        name: s.protocol.charAt(0).toUpperCase() + s.protocol.slice(1),
        sublabel: "Borrow Cost",
        apy: Math.abs((s.apy * s.weight) / 100),
        color: "#EF4444",
      }));

    return { sources, borrowCosts };
  }, [result?.yieldSources]);

  if (!result || !result.isValid) {
    return (
      <div
        className={cn(
          "flex-1 flex items-center justify-center relative overflow-hidden",
          "bg-gradient-to-b from-[#050508] via-[#0a0a0f] to-[#050508]",
          orbitron.variable,
          exo2.variable,
          firaCode.variable
        )}
      >
        {/* <ParticleField intensity="low" /> */}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center max-w-md px-8"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/10 border border-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-purple-400" />
          </div>
          <h2 className={cn("text-2xl font-bold text-white mb-3", orbitron.className)}>
            <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
              No Strategy to Analyze
            </span>
          </h2>
          <p className="text-white/50 mb-8">
            Build a strategy on the canvas to see detailed analysis and projections.
          </p>
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white font-semibold shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Canvas
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const netGain = result.projectedValue1Y - result.initialValue;

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className={cn(
        "flex-1 overflow-hidden relative",
        "bg-gradient-to-b from-[#050508] via-[#0a0a0f] to-[#050508]",
        orbitron.variable,
        exo2.variable,
        firaCode.variable
      )}
    >
      {/* Particle background - disabled for debugging */}
      {/* <ParticleField intensity="low" /> */}

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#050508]/95 backdrop-blur-xl border-b border-purple-500/10">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <h1
                className={cn(
                  "text-xl font-bold tracking-wider uppercase",
                  "bg-gradient-to-r from-white via-purple-300 to-cyan-400 bg-clip-text text-transparent",
                  orbitron.className
                )}
              >
                Strategy Analysis
              </h1>
              <p className={cn("text-xs text-white/40 flex items-center gap-1.5", exo2.className)}>
                <Activity className="w-3 h-3 text-purple-400" />
                Real-time performance projections
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <RiskBadge level={result.riskLevel} />

            <div className="text-right">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Net APY</div>
              <div
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  firaCode.className,
                  result.netApy >= 0 ? "text-green-400" : "text-red-400"
                )}
                style={{
                  textShadow:
                    result.netApy >= 0
                      ? "0 0 30px rgba(34, 197, 94, 0.5)"
                      : "0 0 30px rgba(239, 68, 68, 0.5)",
                }}
              >
                {result.netApy >= 0 ? "+" : ""}
                {result.netApy.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex px-8 gap-1">
          {[
            { id: "overview", label: "Overview", icon: <Gauge className="w-4 h-4" /> },
            { id: "flow", label: "Flow Analysis", icon: <Activity className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "overview" | "flow")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all",
                activeTab === tab.id
                  ? "bg-purple-500/20 text-purple-300 border-b-2 border-purple-500"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100%-140px)] px-8 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "overview" ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-7xl mx-auto space-y-6"
            >
              {/* Key Metrics */}
              <motion.div variants={stagger}>
                <MetricGrid columns={4}>
                  <HoloMetricCard
                    label="Initial Value"
                    value={`$${result.initialValue.toLocaleString()}`}
                    icon={<DollarSign className="w-4 h-4 text-cyan-400" />}
                    color="cyan"
                  />
                  <HoloMetricCard
                    label="Projected (1Y)"
                    value={`$${Math.round(result.projectedValue1Y).toLocaleString()}`}
                    subValue={`${netGain >= 0 ? "+" : ""}$${Math.round(netGain).toLocaleString()}`}
                    trend={netGain >= 0 ? "up" : "down"}
                    icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                    color="green"
                  />
                  <HoloMetricCard
                    label="Leverage"
                    value={`${result.leverage.toFixed(2)}x`}
                    trend={result.leverage > 2 ? "up" : "neutral"}
                    icon={<Layers className="w-4 h-4 text-purple-400" />}
                    color="purple"
                  />
                  <HoloMetricCard
                    label="Est. Gas Cost"
                    value={`$${result.gasCostUsd}`}
                    icon={<Zap className="w-4 h-4 text-amber-400" />}
                    color="amber"
                  />
                </MetricGrid>
              </motion.div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* APY Breakdown */}
                <PremiumCard className="lg:col-span-2 p-6" glow>
                  <SectionHeader
                    title="APY Breakdown"
                    subtitle="Yield sources and costs"
                    icon={<PiggyBank className="w-4 h-4 text-green-400" />}
                    action={
                      result.leverage > 1.1 && (
                        <span
                          className={cn(
                            "text-xs px-3 py-1 rounded-lg font-bold",
                            "bg-amber-500/20 text-amber-400 border border-amber-500/20"
                          )}
                        >
                          {result.leverage.toFixed(1)}x Leveraged
                        </span>
                      )
                    }
                  />
                  <ErrorBoundary>
                    <APYBreakdown items={yieldItems} netApy={result.netApy} />
                  </ErrorBoundary>
                </PremiumCard>

                {/* Health Factor */}
                <PremiumCard className="p-6" glow>
                  <SectionHeader
                    title="Health Factor"
                    subtitle="Liquidation risk assessment"
                    icon={<Gauge className="w-4 h-4 text-cyan-400" />}
                  />

                  <ErrorBoundary fallback={<NoBorrowingState />}>
                    {result.healthFactor !== null ? (
                      <NeonHealthGauge
                        value={result.healthFactor}
                        max={3}
                        liquidationPrice={result.liquidationPrice}
                      />
                    ) : (
                      <NoBorrowingState />
                    )}
                  </ErrorBoundary>
                </PremiumCard>
              </div>

              {/* Projection */}
              <PremiumCard className="p-6" glow>
                <SectionHeader
                  title="1 Year Projection"
                  subtitle="Expected returns breakdown"
                  icon={<ArrowUpRight className="w-4 h-4 text-green-400" />}
                  action={
                    <span
                      className={cn(
                        "text-sm font-bold",
                        firaCode.className,
                        netGain >= 0 ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {netGain >= 0 ? "+" : ""}${Math.round(netGain).toLocaleString()}
                    </span>
                  }
                />
                <ErrorBoundary>
                  <ProjectionFlow
                    initialValue={result.initialValue}
                    projectedValue={result.projectedValue1Y}
                    gasCost={result.gasCostUsd}
                    fees={result.protocolFees}
                  />
                </ErrorBoundary>
              </PremiumCard>

              {/* Warnings */}
              {result.healthFactor !== null && result.healthFactor < 1.5 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-start gap-4 p-5 rounded-2xl",
                    "bg-gradient-to-r border",
                    result.healthFactor < 1.25
                      ? "from-red-500/10 to-rose-500/5 border-red-500/30"
                      : "from-amber-500/10 to-orange-500/5 border-amber-500/30"
                  )}
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      result.healthFactor < 1.25 ? "bg-red-500/20" : "bg-amber-500/20"
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        "w-6 h-6",
                        result.healthFactor < 1.25 ? "text-red-400" : "text-amber-400"
                      )}
                    />
                  </motion.div>
                  <div>
                    <div className="font-bold text-white">
                      {result.healthFactor < 1.25 ? "Critical Health Factor" : "Low Health Factor"}
                    </div>
                    <div className="text-sm text-white/60 mt-1">
                      Health Factor: {result.healthFactor.toFixed(2)} — Consider reducing leverage to avoid
                      liquidation.
                      {result.liquidationPrice &&
                        ` Liquidation triggers at $${result.liquidationPrice.toFixed(0)} ETH price.`}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-7xl mx-auto"
            >
              <PremiumCard className="p-8" glow>
                <SectionHeader
                  title="Strategy Flow"
                  subtitle="Visualize how value flows through your strategy"
                  icon={<Activity className="w-4 h-4 text-purple-400" />}
                />

                <div className="flex justify-center overflow-x-auto py-8">
                  <div className="text-white/60 text-center">
                    <div className="text-lg mb-2">Flow Visualization</div>
                    <div className="text-sm">
                      Net APY: {result.netApy?.toFixed(2) ?? "N/A"}% |
                      Sources: {flowData.sources?.length ?? 0} |
                      Costs: {flowData.borrowCosts?.length ?? 0}
                    </div>
                    {flowData.sources && flowData.sources.length > 0 && (
                      <ErrorBoundary
                        fallback={
                          <div className="mt-4 text-amber-400">Unable to render flow diagram</div>
                        }
                      >
                        <StrategyFlow
                          sources={flowData.sources}
                          borrowCosts={flowData.borrowCosts}
                          netApy={result.netApy}
                          initialValue={result.initialValue}
                          projectedValue={result.projectedValue1Y}
                          width={850}
                          height={400}
                        />
                      </ErrorBoundary>
                    )}
                  </div>
                </div>
              </PremiumCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export const AnalysisView = memo(AnalysisViewComponent);
