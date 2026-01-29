"use client";

/**
 * Modern Strategy Analysis Components
 *
 * Clean, minimal design inspired by Linear, Stripe, Mercury.
 * No glows, no heavy gradients - just clear data presentation.
 */

import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle,
  Info,
  ChevronRight,
} from "lucide-react";

// ============================================================================
// Minimal Card
// ============================================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      "bg-[#0f0f11] rounded-xl border border-white/[0.06] p-5",
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn("mb-4", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-sm font-medium text-white/90", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-white/40 mt-0.5">{children}</p>
  );
}

// ============================================================================
// Strategy Flow - Clean horizontal pipeline
// ============================================================================

interface FlowStep {
  label: string;
  sublabel?: string;
  value?: string;
  valueColor?: "default" | "positive" | "negative";
  status?: "default" | "warning" | "active";
}

interface StrategyFlowProps {
  steps: FlowStep[];
  className?: string;
}

function StrategyFlowComponent({ steps, className }: StrategyFlowProps) {
  const valueColors = {
    default: "text-white/70",
    positive: "text-emerald-400",
    negative: "text-rose-400",
  };

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto py-2", className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex flex-col items-center px-5 py-3 rounded-lg min-w-[90px]",
              "bg-white/[0.02] border",
              step.status === "warning"
                ? "border-amber-500/30 bg-amber-500/[0.03]"
                : step.status === "active"
                ? "border-white/10 bg-white/[0.04]"
                : "border-transparent"
            )}
          >
            <span className="text-[11px] font-medium text-white/50 uppercase tracking-wide">
              {step.label}
            </span>
            {step.sublabel && (
              <span className="text-[10px] text-white/30 mt-0.5">{step.sublabel}</span>
            )}
            {step.value && (
              <span className={cn(
                "text-sm font-semibold mt-1.5 font-mono",
                valueColors[step.valueColor || "default"]
              )}>
                {step.value}
              </span>
            )}
          </motion.div>

          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-white/20 mx-1 shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export const StrategyFlow = memo(StrategyFlowComponent);

// ============================================================================
// APY Breakdown - Clean bar visualization
// ============================================================================

interface APYItem {
  label: string;
  protocol?: string;
  value: number;
  type: "yield" | "cost";
}

interface APYBreakdownProps {
  items: APYItem[];
  netApy: number;
  className?: string;
}

function APYBreakdownComponent({ items, netApy, className }: APYBreakdownProps) {
  const maxValue = Math.max(...items.map(i => Math.abs(i.value)), 1);

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80">{item.label}</span>
              {item.protocol && (
                <span className="text-[10px] text-white/30 uppercase">{item.protocol}</span>
              )}
            </div>
            <span className={cn(
              "text-sm font-mono font-medium",
              item.type === "yield" ? "text-emerald-400" : "text-rose-400"
            )}>
              {item.type === "yield" ? "+" : "-"}{Math.abs(item.value).toFixed(2)}%
            </span>
          </div>

          <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                item.type === "yield" ? "bg-emerald-500/60" : "bg-rose-500/60"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${(Math.abs(item.value) / maxValue) * 100}%` }}
              transition={{ delay: i * 0.03, duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      ))}

      {/* Net APY */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: items.length * 0.03 }}
        className="pt-3 mt-3 border-t border-white/[0.06]"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/60">Net APY</span>
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
      </motion.div>
    </div>
  );
}

export const APYBreakdown = memo(APYBreakdownComponent);

// ============================================================================
// Metric Row - Simple key-value display
// ============================================================================

interface MetricRowProps {
  label: string;
  value: string;
  subValue?: string;
  status?: "default" | "success" | "warning" | "danger";
}

export function MetricRow({ label, value, subValue, status = "default" }: MetricRowProps) {
  const statusColors = {
    default: "text-white/90",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <div className="text-right">
        <span className={cn("text-sm font-medium font-mono", statusColors[status])}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-white/30 ml-2">{subValue}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Risk Indicator - Minimal risk display
// ============================================================================

interface RiskIndicatorProps {
  level: "low" | "medium" | "high" | "extreme";
  score: number;
  className?: string;
}

function RiskIndicatorComponent({ level, score, className }: RiskIndicatorProps) {
  const config = {
    low: { color: "bg-emerald-500", text: "text-emerald-400", label: "Low Risk" },
    medium: { color: "bg-amber-500", text: "text-amber-400", label: "Medium Risk" },
    high: { color: "bg-orange-500", text: "text-orange-400", label: "High Risk" },
    extreme: { color: "bg-rose-500", text: "text-rose-400", label: "Extreme Risk" },
  };

  const c = config[level];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-medium", c.text)}>{c.label}</span>
        <span className="text-xs text-white/40">{score}/100</span>
      </div>

      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
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

export const RiskIndicator = memo(RiskIndicatorComponent);

// ============================================================================
// Insight Alert - Clean notification style
// ============================================================================

interface InsightProps {
  type: "info" | "success" | "warning" | "danger";
  title: string;
  description: string;
  metric?: string;
}

export function Insight({ type, title, description, metric }: InsightProps) {
  const config = {
    info: { icon: Info, bg: "bg-blue-500/5", border: "border-blue-500/10", text: "text-blue-400" },
    success: { icon: CheckCircle, bg: "bg-emerald-500/5", border: "border-emerald-500/10", text: "text-emerald-400" },
    warning: { icon: AlertCircle, bg: "bg-amber-500/5", border: "border-amber-500/10", text: "text-amber-400" },
    danger: { icon: AlertCircle, bg: "bg-rose-500/5", border: "border-rose-500/10", text: "text-rose-400" },
  };

  const c = config[type];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        c.bg, c.border
      )}
    >
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", c.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">{title}</span>
          {metric && (
            <span className={cn("text-xs font-mono font-medium", c.text)}>{metric}</span>
          )}
        </div>
        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Projection Summary - Key numbers at a glance
// ============================================================================

interface ProjectionProps {
  initialValue: number;
  projectedValue: number;
  netApy: number;
  timeframe?: string;
  className?: string;
}

function ProjectionSummaryComponent({
  initialValue,
  projectedValue,
  netApy,
  timeframe = "1 Year",
  className
}: ProjectionProps) {
  const gain = projectedValue - initialValue;
  const gainPercent = ((gain / initialValue) * 100);

  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      <div>
        <div className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Initial</div>
        <div className="text-lg font-semibold text-white/90 font-mono">
          ${initialValue.toLocaleString()}
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03]">
          <ArrowRight className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[11px] text-white/40">{timeframe}</span>
          <ArrowRight className="w-3.5 h-3.5 text-white/30" />
        </div>
      </div>

      <div className="text-right">
        <div className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Projected</div>
        <div className="text-lg font-semibold text-white/90 font-mono">
          ${Math.round(projectedValue).toLocaleString()}
        </div>
        <div className={cn(
          "text-xs font-mono mt-0.5",
          gain >= 0 ? "text-emerald-400" : "text-rose-400"
        )}>
          {gain >= 0 ? "+" : ""}{Math.round(gain).toLocaleString()} ({gainPercent >= 0 ? "+" : ""}{gainPercent.toFixed(1)}%)
        </div>
      </div>
    </div>
  );
}

export const ProjectionSummary = memo(ProjectionSummaryComponent);

// ============================================================================
// Stat Grid - For key metrics
// ============================================================================

interface Stat {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

interface StatGridProps {
  stats: Stat[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatGrid({ stats, columns = 4, className }: StatGridProps) {
  return (
    <div className={cn(
      "grid gap-4",
      columns === 2 && "grid-cols-2",
      columns === 3 && "grid-cols-3",
      columns === 4 && "grid-cols-4",
      className
    )}>
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]"
        >
          <div className="text-[11px] text-white/40 uppercase tracking-wide">{stat.label}</div>
          <div className="text-xl font-semibold text-white/90 font-mono mt-1">{stat.value}</div>
          {stat.change && (
            <div className={cn(
              "text-xs font-mono mt-1",
              stat.changeType === "positive" && "text-emerald-400",
              stat.changeType === "negative" && "text-rose-400",
              stat.changeType === "neutral" && "text-white/40"
            )}>
              {stat.change}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Section Header - Minimal
// ============================================================================

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-medium text-white/90">{title}</h3>
        {description && (
          <p className="text-xs text-white/40 mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
