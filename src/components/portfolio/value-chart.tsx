"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/utils";
import { TrendingUp, TrendingDown, BarChart3, Clock, Database, Sparkles } from "lucide-react";

type Timeframe = "7d" | "30d" | "90d" | "1y";

interface LoadingProgress {
  status:
    | "idle"
    | "pending"
    | "fetching_balances"
    | "fetching_prices"
    | "processing"
    | "complete"
    | "error";
  stage: string;
  percent: number;
  processedChains: number;
  totalChains: number;
  processedTimestamps: number;
  totalTimestamps: number;
}

interface ValueChartProps {
  data?: { timestamp: Date; totalUsd: number }[];
  currentValue: number;
  isLoading?: boolean;
  progress?: LoadingProgress;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  selectedTimeframe?: Timeframe;
}

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "1M" },
  { value: "90d", label: "3M" },
  { value: "1y", label: "1Y" },
];

function formatXAxis(timestamp: Date, timeframe: Timeframe): string {
  switch (timeframe) {
    case "7d":
      return format(timestamp, "EEE");
    case "30d":
      return format(timestamp, "MMM d");
    case "90d":
      return format(timestamp, "MMM d");
    case "1y":
      return format(timestamp, "MMM ''yy");
    default:
      return format(timestamp, "MMM d");
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { formattedDate?: string } }>;
  label?: Date | string | number;
  isPositive: boolean;
}

function CustomTooltip({ active, payload, isPositive }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const formattedLabel = payload[0]?.payload?.formattedDate ?? "";

  return (
    <div className="glass-heavy border border-border rounded-xl shadow-2xl p-4 min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        {formattedLabel}
      </p>
      <p
        className={`text-xl font-bold tabular-nums font-display ${
          isPositive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {formatUSD(payload[0].value)}
      </p>
    </div>
  );
}

export function ValueChart({
  data,
  currentValue,
  isLoading,
  progress,
  onTimeframeChange,
  selectedTimeframe = "7d",
}: ValueChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(selectedTimeframe);

  // Sync internal state with prop (e.g., when wallet changes and resets to 7d)
  useEffect(() => {
    setTimeframe(selectedTimeframe);
  }, [selectedTimeframe]);

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    onTimeframeChange?.(newTimeframe);
  };

  const hasRealData = data && data.length > 0;

  const chartData = useMemo(() => {
    if (!hasRealData) return [];
    return data.map((d) => ({
      ...d,
      timestamp: new Date(d.timestamp),
      formattedDate: format(new Date(d.timestamp), "MMM d, yyyy \u2022 h:mm a"),
    }));
  }, [data, hasRealData]);

  const { yMin, yMax, avgValue } = useMemo(() => {
    if (chartData.length === 0) {
      return { yMin: 0, yMax: 100, avgValue: 50 };
    }

    const values = chartData.map((d) => d.totalUsd);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const range = dataMax - dataMin;

    const padding = range * 0.15 || dataMax * 0.1;
    let min = dataMin - padding;
    let max = dataMax + padding;

    // Round to nice values
    const magnitude = Math.pow(10, Math.floor(Math.log10(max - min)));
    const step = magnitude / 4;

    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;

    return { yMin: Math.max(0, min), yMax: max, avgValue: avg };
  }, [chartData]);

  const firstValue = chartData[0]?.totalUsd ?? currentValue;
  const lastValue = chartData[chartData.length - 1]?.totalUsd ?? currentValue;
  const change = hasRealData ? lastValue - firstValue : 0;
  const changePercent =
    hasRealData && firstValue > 0 ? (change / firstValue) * 100 : 0;
  const isPositive = change >= 0;

  // Generate gradient colors based on performance
  const gradientId = `chartGradient-${isPositive ? "up" : "down"}`;
  const strokeColor = isPositive ? "#34d399" : "#f87171";
  const glowColor = isPositive ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.3)";

  return (
    <Card className="overflow-hidden card-glow border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Portfolio Performance
              </p>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-bold tracking-tight tabular-nums font-display">
                {formatUSD(currentValue)}
              </span>
              {hasRealData && (
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg ${
                    isPositive
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-red-400 bg-red-500/10"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  <span className="tabular-nums">
                    {isPositive ? "+" : ""}
                    {changePercent.toFixed(2)}%
                  </span>
                </span>
              )}
            </div>
            {hasRealData && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {isPositive ? "+" : ""}
                {formatUSD(change)} past{" "}
                {timeframe === "7d"
                  ? "7 days"
                  : timeframe === "30d"
                    ? "30 days"
                    : timeframe === "90d"
                      ? "90 days"
                      : "year"}
              </p>
            )}
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
            {TIMEFRAME_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={timeframe === option.value ? "default" : "ghost"}
                size="sm"
                className={`h-8 px-4 text-xs font-semibold rounded-lg transition-all ${
                  timeframe === option.value
                    ? "shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => handleTimeframeChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 pb-4 px-2 sm:px-6">
        {isLoading ? (
          <div className="h-[200px] sm:h-[260px] flex flex-col items-center justify-center gap-6">
            {progress &&
            progress.status !== "idle" &&
            progress.status !== "complete" ? (
              <>
                {/* Stage Icon */}
                <div className="relative">
                  <div className="h-14 w-14 rounded-xl border-2 border-primary/20 border-t-primary animate-spin flex items-center justify-center">
                    {progress.status === "fetching_balances" ? (
                      <Database className="h-6 w-6 text-primary" />
                    ) : progress.status === "fetching_prices" ? (
                      <TrendingUp className="h-6 w-6 text-primary" />
                    ) : progress.status === "processing" ? (
                      <Sparkles className="h-6 w-6 text-primary" />
                    ) : (
                      <Clock className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full max-w-xs">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Building chart</span>
                    <span className="tabular-nums">{progress.percent}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary via-primary to-primary/60 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.max(progress.percent, 5)}%`,
                        boxShadow: "0 0 20px hsl(var(--primary) / 0.5)",
                      }}
                    />
                  </div>
                </div>

                {/* Stage Description */}
                <div className="text-center max-w-xs">
                  <p className="text-sm font-medium mb-1">
                    {progress.stage || "Processing..."}
                  </p>
                  {progress.status === "fetching_balances" && progress.totalChains > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {progress.processedChains} / {progress.totalChains} chains scanned
                    </p>
                  )}
                  {progress.status === "fetching_prices" && progress.totalTimestamps > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {progress.processedTimestamps} / {progress.totalTimestamps} data points
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl border-2 border-primary/20 border-t-primary animate-spin" />
                  <BarChart3 className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Building your chart</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fetching historical portfolio data...
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] sm:h-[260px] flex flex-col items-center justify-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Historical data not yet available</p>
            <p className="text-xs mt-1 opacity-70">
              Portfolio tracking begins when you connect your wallet
            </p>
          </div>
        ) : (
          <div className="h-[200px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                    <stop offset="50%" stopColor={strokeColor} stopOpacity={0.1} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Reference line at average */}
                <ReferenceLine
                  y={avgValue}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeOpacity={0.3}
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => formatXAxis(new Date(v), timeframe)}
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                    fontWeight: 500,
                  }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={60}
                  interval="preserveStartEnd"
                  dy={8}
                />
                <YAxis
                  tickFormatter={(v) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`
                  }
                  tick={{
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                    fontWeight: 500,
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  domain={[yMin, yMax]}
                  tickCount={5}
                />
                <Tooltip
                  content={<CustomTooltip isPositive={isPositive} />}
                  cursor={{
                    stroke: "hsl(var(--muted-foreground))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                    strokeOpacity: 0.5,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalUsd"
                  stroke={strokeColor}
                  strokeWidth={2.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  filter="url(#glow)"
                  activeDot={{
                    r: 6,
                    stroke: strokeColor,
                    strokeWidth: 2,
                    fill: "hsl(var(--card))",
                    style: { boxShadow: `0 0 12px ${glowColor}` },
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
