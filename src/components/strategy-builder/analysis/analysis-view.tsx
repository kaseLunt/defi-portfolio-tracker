"use client";

/**
 * Strategy Analysis View - Modern Edition
 *
 * Clean, minimal design inspired by Linear, Stripe, Mercury.
 * No glows, no heavy gradients - just clear data presentation.
 */

import { useMemo, memo, useState, Component, ErrorInfo, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Gauge,
  Activity,
  ChevronRight,
  Info,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStrategyStore } from "@/lib/strategy/store";

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
        <div className="flex items-center justify-center p-8 text-zinc-500">
          <div className="text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-amber-500" />
            <div className="text-sm">Something went wrong</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Clean Card Components
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      "bg-zinc-900/50 rounded-xl border border-zinc-800/80 p-5",
      className
    )}>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
      {description && (
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      )}
    </div>
  );
}

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

function StatCard({ label, value, subValue, trend, icon }: StatCardProps) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <div className="text-xl font-semibold text-zinc-100 font-mono">{value}</div>
      {subValue && (
        <div className={cn(
          "text-xs font-mono mt-1",
          trend === "up" && "text-emerald-400",
          trend === "down" && "text-rose-400",
          trend === "neutral" && "text-zinc-500"
        )}>
          {subValue}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// APY Breakdown - Clean bars
// ============================================================================

interface APYItem {
  label: string;
  type: string;
  value: number;
  protocol?: string;
}

function APYBreakdown({ items, netApy }: { items: APYItem[]; netApy: number }) {
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = Math.max(...safeItems.map(i => Math.abs(i.value || 0)), 0.01);

  if (safeItems.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        No yield sources configured
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {safeItems.map((item, i) => {
        const value = typeof item.value === "number" && isFinite(item.value) ? item.value : 0;
        const isPositive = value >= 0;
        const barWidth = (Math.abs(value) / maxValue) * 100;

        return (
          <motion.div
            key={`${item.label}-${item.type}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-300">{item.label}</span>
                <span className="text-[10px] text-zinc-600 uppercase">{item.type}</span>
              </div>
              <span className={cn(
                "text-sm font-mono font-medium",
                isPositive ? "text-emerald-400" : "text-rose-400"
              )}>
                {isPositive ? "+" : ""}{value.toFixed(2)}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  isPositive ? "bg-emerald-500/70" : "bg-rose-500/70"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
              />
            </div>
          </motion.div>
        );
      })}

      <div className="pt-4 mt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-400">Net APY</span>
          <div className="flex items-center gap-1.5">
            {netApy >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            )}
            <span className={cn(
              "text-lg font-semibold font-mono",
              netApy >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {netApy >= 0 ? "+" : ""}{netApy.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Health Gauge - Clean radial
// ============================================================================

function HealthGauge({ value, liquidationPrice }: { value: number; liquidationPrice?: number | null }) {
  const safeValue = typeof value === "number" && isFinite(value) ? value : 0;
  const percentage = Math.min(100, (safeValue / 3) * 100);

  const getColor = () => {
    if (safeValue < 1.25) return { stroke: "#ef4444", text: "text-rose-400", label: "Critical" };
    if (safeValue < 1.5) return { stroke: "#f59e0b", text: "text-amber-400", label: "Low" };
    if (safeValue < 2) return { stroke: "#22c55e", text: "text-emerald-400", label: "Safe" };
    return { stroke: "#22c55e", text: "text-emerald-400", label: "Very Safe" };
  };

  const config = getColor();
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
          />
          <motion.circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke={config.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-semibold font-mono", config.text)}>
            {safeValue.toFixed(2)}
          </span>
          <span className="text-xs text-zinc-500">{config.label}</span>
        </div>
      </div>

      {liquidationPrice && (
        <div className="mt-4 text-center">
          <div className="text-xs text-zinc-500">Liquidation at</div>
          <div className="text-sm font-mono text-zinc-300">${liquidationPrice.toFixed(0)} ETH</div>
        </div>
      )}
    </div>
  );
}

function NoBorrowingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
        <CheckCircle className="w-6 h-6 text-emerald-400" />
      </div>
      <div className="text-sm text-zinc-300">No Borrowing</div>
      <div className="text-xs text-zinc-500 mt-1">No liquidation risk</div>
    </div>
  );
}

// ============================================================================
// Projection Flow - Clean steps
// ============================================================================

function ProjectionFlow({
  initialValue,
  projectedValue,
  gasCost,
  fees
}: {
  initialValue: number;
  projectedValue: number;
  gasCost: number;
  fees: number;
}) {
  const grossYield = projectedValue - initialValue + gasCost + fees;
  const netGain = projectedValue - initialValue;

  const steps = [
    { label: "Initial Capital", value: initialValue, type: "neutral" as const },
    { label: "Strategy Yields", value: grossYield, type: "positive" as const },
    { label: "Gas & Fees", value: -(gasCost + fees), type: "negative" as const },
    { label: "Projected (1Y)", value: projectedValue, type: "highlight" as const },
  ];

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg",
            step.type === "highlight"
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-zinc-800/30"
          )}
        >
          <span className={cn(
            "text-sm",
            step.type === "highlight" ? "font-medium text-zinc-100" : "text-zinc-400"
          )}>
            {step.label}
          </span>
          <span className={cn(
            "font-mono font-medium",
            step.type === "positive" && "text-emerald-400",
            step.type === "negative" && "text-rose-400",
            step.type === "neutral" && "text-zinc-300",
            step.type === "highlight" && "text-emerald-400 text-lg"
          )}>
            {step.type === "positive" && "+"}
            ${Math.abs(Math.round(step.value)).toLocaleString()}
          </span>
        </motion.div>
      ))}

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Net Annual Gain</span>
          <span className={cn(
            "text-lg font-semibold font-mono",
            netGain >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {netGain >= 0 ? "+" : ""}${Math.round(netGain).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Strategy Pipeline - Clean flow
// ============================================================================

interface PipelineStep {
  id: string;
  label: string;
  value?: string;
  apy?: number;
  isWarning?: boolean;
}

function StrategyPipeline({ steps }: { steps: PipelineStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex flex-col items-center px-4 py-3 rounded-lg min-w-[80px]",
              "bg-zinc-800/50 border",
              step.isWarning
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-zinc-700/50"
            )}
          >
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
              {step.label}
            </span>
            {step.value && (
              <span className="text-sm font-semibold text-zinc-200 mt-1 font-mono">
                {step.value}
              </span>
            )}
            {step.apy !== undefined && (
              <span className={cn(
                "text-sm font-semibold mt-1 font-mono",
                step.apy >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {step.apy >= 0 ? "+" : ""}{step.apy.toFixed(1)}%
              </span>
            )}
          </motion.div>

          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-zinc-600 mx-1 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Risk Indicator
// ============================================================================

function RiskIndicator({ level, score }: { level: string; score: number }) {
  const config: Record<string, { color: string; text: string; label: string }> = {
    low: { color: "bg-emerald-500", text: "text-emerald-400", label: "Low Risk" },
    medium: { color: "bg-amber-500", text: "text-amber-400", label: "Medium Risk" },
    high: { color: "bg-orange-500", text: "text-orange-400", label: "High Risk" },
    extreme: { color: "bg-rose-500", text: "text-rose-400", label: "Extreme Risk" },
  };

  const c = config[level] || config.medium;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-medium", c.text)}>{c.label}</span>
        <span className="text-xs text-zinc-500">{score}/100</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", c.color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Insight Alert
// ============================================================================

interface InsightData {
  type: "info" | "success" | "warning" | "danger";
  title: string;
  description: string;
  metric?: string;
}

function Insight({ type, title, description, metric }: InsightData) {
  const config = {
    info: { icon: Info, bg: "bg-blue-500/5", border: "border-blue-500/20", text: "text-blue-400" },
    success: { icon: CheckCircle, bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400" },
    warning: { icon: AlertCircle, bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400" },
    danger: { icon: AlertCircle, bg: "bg-rose-500/5", border: "border-rose-500/20", text: "text-rose-400" },
  };

  const c = config[type];
  const Icon = c.icon;

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", c.bg, c.border)}>
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", c.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{title}</span>
          {metric && (
            <span className={cn("text-xs font-mono font-medium", c.text)}>{metric}</span>
          )}
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Risk Badge
// ============================================================================

function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    low: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-400" },
    high: { bg: "bg-orange-500/10", text: "text-orange-400" },
    extreme: { bg: "bg-rose-500/10", text: "text-rose-400" },
  };

  const c = config[level] || config.medium;
  const labels: Record<string, string> = {
    low: "Low Risk",
    medium: "Medium Risk",
    high: "High Risk",
    extreme: "Extreme Risk",
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
      c.bg, c.text
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {labels[level] || "Unknown"}
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

    const map = new Map<string, APYItem>();

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

  // Strategy pipeline steps
  const pipelineSteps = useMemo(() => {
    if (!result) return [];

    const steps: PipelineStep[] = [];

    steps.push({
      id: "input",
      label: "Capital",
      value: `$${result.initialValue.toLocaleString()}`,
    });

    const hasStaking = result.yieldSources.some(s => s.type === "stake");
    const hasLending = result.yieldSources.some(s => s.type === "supply");
    const hasBorrowing = result.yieldSources.some(s => s.type === "borrow");

    if (hasStaking) {
      const apy = result.yieldSources
        .filter(s => s.type === "stake")
        .reduce((sum, s) => sum + (s.apy * s.weight) / 100, 0);
      steps.push({ id: "stake", label: "Stake", apy });
    }

    if (hasLending) {
      const apy = result.yieldSources
        .filter(s => s.type === "supply")
        .reduce((sum, s) => sum + (s.apy * s.weight) / 100, 0);
      steps.push({ id: "lend", label: "Supply", apy });
    }

    if (hasBorrowing) {
      const apy = result.yieldSources
        .filter(s => s.type === "borrow")
        .reduce((sum, s) => sum + (s.apy * s.weight) / 100, 0);
      steps.push({
        id: "borrow",
        label: "Borrow",
        apy,
        isWarning: result.healthFactor !== null && result.healthFactor < 1.5,
      });
    }

    if (result.leverage > 1.5) {
      steps.push({
        id: "loop",
        label: "Loop",
        value: `${result.leverage.toFixed(1)}x`,
        isWarning: result.leverage > 3,
      });
    }

    steps.push({ id: "output", label: "Result", apy: result.netApy });

    return steps;
  }, [result]);

  // Generate insights
  const insights = useMemo(() => {
    if (!result) return [];

    const list: InsightData[] = [];

    if (result.netApy > 5) {
      list.push({
        type: "success",
        title: "Strong Yield",
        description: "Above-average returns compared to typical DeFi yields.",
        metric: `${result.netApy.toFixed(2)}% APY`,
      });
    } else if (result.netApy > 0) {
      list.push({
        type: "info",
        title: "Positive Returns",
        description: "Strategy is profitable after all costs.",
        metric: `${result.netApy.toFixed(2)}% APY`,
      });
    }

    if (result.healthFactor !== null) {
      if (result.healthFactor < 1.25) {
        list.push({
          type: "danger",
          title: "Critical Liquidation Risk",
          description: "Position is extremely close to liquidation.",
          metric: `HF: ${result.healthFactor.toFixed(2)}`,
        });
      } else if (result.healthFactor < 1.5) {
        list.push({
          type: "warning",
          title: "Elevated Risk",
          description: "Health factor below recommended 1.5 threshold.",
          metric: `HF: ${result.healthFactor.toFixed(2)}`,
        });
      }
    }

    if (result.leverage > 3) {
      list.push({
        type: "warning",
        title: "High Leverage",
        description: "Leverage above 3x amplifies both gains and losses.",
        metric: `${result.leverage.toFixed(1)}x`,
      });
    }

    return list;
  }, [result]);

  // Empty state
  if (!result || !result.isValid) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm px-8"
        >
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
            <Activity className="w-8 h-8 text-zinc-500" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">
            No Strategy to Analyze
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            Build a strategy on the canvas to see detailed analysis.
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Canvas
          </button>
        </motion.div>
      </div>
    );
  }

  const netGain = result.projectedValue1Y - result.initialValue;

  return (
    <div className="flex-1 overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-zinc-100">
                Strategy Analysis
              </h1>
              <p className="text-xs text-zinc-500">Performance projections</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <RiskBadge level={result.riskLevel} />

            <div className="text-right">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Net APY</div>
              <div className={cn(
                "text-2xl font-semibold font-mono",
                result.netApy >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {result.netApy >= 0 ? "+" : ""}{result.netApy.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-1 border-t border-zinc-800/30">
          {[
            { id: "overview", label: "Overview" },
            { id: "flow", label: "Flow Analysis" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "overview" | "flow")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100%-120px)] px-6 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "overview" ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  label="Initial"
                  value={`$${result.initialValue.toLocaleString()}`}
                  icon={<DollarSign className="w-4 h-4" />}
                />
                <StatCard
                  label="Projected (1Y)"
                  value={`$${Math.round(result.projectedValue1Y).toLocaleString()}`}
                  subValue={`${netGain >= 0 ? "+" : ""}$${Math.round(netGain).toLocaleString()}`}
                  trend={netGain >= 0 ? "up" : "down"}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                <StatCard
                  label="Leverage"
                  value={`${result.leverage.toFixed(2)}x`}
                  icon={<Layers className="w-4 h-4" />}
                />
                <StatCard
                  label="Gas Cost"
                  value={`$${result.gasCostUsd}`}
                  icon={<Zap className="w-4 h-4" />}
                />
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* APY Breakdown */}
                <Card className="lg:col-span-2">
                  <SectionHeader
                    title="APY Breakdown"
                    description="Yield sources and costs"
                  />
                  <ErrorBoundary>
                    <APYBreakdown items={yieldItems} netApy={result.netApy} />
                  </ErrorBoundary>
                </Card>

                {/* Health Factor */}
                <Card>
                  <SectionHeader
                    title="Health Factor"
                    description="Liquidation risk"
                  />
                  <ErrorBoundary fallback={<NoBorrowingState />}>
                    {result.healthFactor !== null ? (
                      <HealthGauge
                        value={result.healthFactor}
                        liquidationPrice={result.liquidationPrice}
                      />
                    ) : (
                      <NoBorrowingState />
                    )}
                  </ErrorBoundary>
                </Card>
              </div>

              {/* Projection */}
              <Card>
                <SectionHeader
                  title="1 Year Projection"
                  description="Expected returns breakdown"
                />
                <ErrorBoundary>
                  <ProjectionFlow
                    initialValue={result.initialValue}
                    projectedValue={result.projectedValue1Y}
                    gasCost={result.gasCostUsd}
                    fees={result.protocolFees}
                  />
                </ErrorBoundary>
              </Card>

              {/* Warning */}
              {result.healthFactor !== null && result.healthFactor < 1.5 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border",
                    result.healthFactor < 1.25
                      ? "bg-rose-500/5 border-rose-500/20"
                      : "bg-amber-500/5 border-amber-500/20"
                  )}
                >
                  <AlertTriangle className={cn(
                    "w-5 h-5 shrink-0",
                    result.healthFactor < 1.25 ? "text-rose-400" : "text-amber-400"
                  )} />
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {result.healthFactor < 1.25 ? "Critical Health Factor" : "Low Health Factor"}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Health Factor: {result.healthFactor.toFixed(2)} — Consider reducing leverage.
                      {result.liquidationPrice && ` Liquidation at $${result.liquidationPrice.toFixed(0)} ETH.`}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              {/* Pipeline */}
              <Card>
                <SectionHeader
                  title="Strategy Pipeline"
                  description="How capital flows through the strategy"
                />
                <ErrorBoundary>
                  <StrategyPipeline steps={pipelineSteps} />
                </ErrorBoundary>
              </Card>

              {/* Two column */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk */}
                <Card>
                  <SectionHeader
                    title="Risk Assessment"
                    description="Overall strategy risk"
                  />
                  <ErrorBoundary>
                    <div className="space-y-4">
                      <RiskIndicator level={result.riskLevel} score={result.riskScore} />

                      {result.healthFactor !== null && (
                        <div className="pt-4 border-t border-zinc-800">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Health Factor</span>
                            <span className="font-mono text-zinc-300">{result.healthFactor.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {result.liquidationPrice && (
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Liquidation Price</span>
                          <span className="font-mono text-zinc-300">${result.liquidationPrice.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                  </ErrorBoundary>
                </Card>

                {/* Insights */}
                <Card>
                  <SectionHeader
                    title="Key Insights"
                    description="Strategy analysis"
                  />
                  <ErrorBoundary>
                    {insights.length > 0 ? (
                      <div className="space-y-3">
                        {insights.map((insight, i) => (
                          <Insight key={i} {...insight} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 text-sm">
                        No significant insights
                      </div>
                    )}
                  </ErrorBoundary>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const AnalysisView = memo(AnalysisViewComponent);
