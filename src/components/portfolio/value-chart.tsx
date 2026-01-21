"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/utils";

type Timeframe = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

interface LoadingProgress {
  status: "idle" | "pending" | "fetching_balances" | "fetching_prices" | "processing" | "complete" | "error";
  stage: string;
  percent: number;
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
  showSimulated?: boolean; // If true, show simulated data when no real data
}

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

// Generate simulated historical data when no data is available
function generateSimulatedData(
  currentValue: number,
  timeframe: Timeframe
): { timestamp: Date; totalUsd: number }[] {
  const now = new Date();
  const data: { timestamp: Date; totalUsd: number }[] = [];

  let points: number;
  let intervalMs: number;

  switch (timeframe) {
    case "24h":
      points = 24;
      intervalMs = 60 * 60 * 1000; // 1 hour
      break;
    case "7d":
      points = 28;
      intervalMs = 6 * 60 * 60 * 1000; // 6 hours
      break;
    case "30d":
      points = 30;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      break;
    case "90d":
      points = 30;
      intervalMs = 3 * 24 * 60 * 60 * 1000; // 3 days
      break;
    case "1y":
      points = 52;
      intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
    case "all":
      points = 24;
      intervalMs = 30 * 24 * 60 * 60 * 1000; // 1 month
      break;
  }

  // Generate slightly varying historical values
  // Starting from a lower value to show growth
  const volatility = 0.02; // 2% variation
  const growthFactor = timeframe === "all" ? 0.5 : timeframe === "1y" ? 0.8 : 0.95;

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMs);
    const progress = (points - 1 - i) / (points - 1); // 0 to 1
    const baseValue = currentValue * (growthFactor + (1 - growthFactor) * progress);
    const noise = (Math.random() - 0.5) * 2 * volatility * baseValue;
    const value = i === 0 ? currentValue : baseValue + noise;

    data.push({
      timestamp,
      totalUsd: Math.max(0, value),
    });
  }

  return data;
}

function formatXAxis(timestamp: Date, timeframe: Timeframe): string {
  switch (timeframe) {
    case "24h":
      return format(timestamp, "HH:mm");
    case "7d":
      return format(timestamp, "EEE");
    case "30d":
    case "90d":
      return format(timestamp, "MMM d");
    case "1y":
    case "all":
      return format(timestamp, "MMM yyyy");
    default:
      return format(timestamp, "MMM d");
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { formattedDate?: string } }>;
  label?: Date | string | number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  // Use formattedDate from payload if available, otherwise format the label
  const formattedLabel =
    payload[0]?.payload?.formattedDate ??
    (label instanceof Date ? format(label, "MMM d, yyyy HH:mm") : String(label ?? ""));

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{formattedLabel}</p>
      <p className="text-sm font-semibold">{formatUSD(payload[0].value)}</p>
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
  showSimulated = false,
}: ValueChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(selectedTimeframe);

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    onTimeframeChange?.(newTimeframe);
  };

  const hasRealData = data && data.length > 0;

  // Use provided data or generate simulated data (only if showSimulated is true)
  const chartData = useMemo(() => {
    if (hasRealData) {
      return data.map((d) => ({
        ...d,
        timestamp: new Date(d.timestamp),
        formattedDate: format(new Date(d.timestamp), "MMM d, yyyy HH:mm"),
      }));
    }
    if (showSimulated) {
      return generateSimulatedData(currentValue, timeframe).map((d) => ({
        ...d,
        formattedDate: format(d.timestamp, "MMM d, yyyy HH:mm"),
      }));
    }
    return [];
  }, [data, hasRealData, currentValue, timeframe, showSimulated]);

  // Calculate change
  const firstValue = chartData[0]?.totalUsd ?? currentValue;
  const lastValue = chartData[chartData.length - 1]?.totalUsd ?? currentValue;
  const change = hasRealData ? lastValue - firstValue : 0;
  const changePercent = hasRealData && firstValue > 0 ? (change / firstValue) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold">{formatUSD(currentValue)}</span>
              <span
                className={`text-sm font-medium ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {isPositive ? "+" : ""}
                {formatUSD(change)} ({isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            {TIMEFRAME_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={timeframe === option.value ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleTimeframeChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-4">
            {progress && progress.status !== "idle" && progress.status !== "complete" ? (
              <>
                {/* Progress bar */}
                <div className="w-full max-w-xs">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(progress.percent, 5)}%` }}
                    />
                  </div>
                </div>
                {/* Stage message */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">{progress.stage}</p>
                  {progress.totalTimestamps > 0 && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {progress.processedTimestamps} of {progress.totalTimestamps} data points
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="animate-pulse text-muted-foreground">Loading chart...</div>
            )}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
            <p>Historical data not yet available</p>
            <p className="text-sm mt-1">Portfolio tracking begins when you connect your wallet</p>
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPositive ? "#22c55e" : "#ef4444"}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={isPositive ? "#22c55e" : "#ef4444"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(v) => formatXAxis(new Date(v), timeframe)}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  domain={[0, "dataMax * 1.1"]}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="totalUsd"
                  stroke={isPositive ? "#22c55e" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#colorValue)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: isPositive ? "#22c55e" : "#ef4444",
                    strokeWidth: 2,
                    fill: "hsl(var(--background))",
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
