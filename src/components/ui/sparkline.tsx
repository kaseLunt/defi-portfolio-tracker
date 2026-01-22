"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  showDot?: boolean;
  positive?: boolean; // Force positive/negative coloring
}

export function Sparkline({
  data,
  width = 60,
  height = 24,
  strokeWidth = 1.5,
  className,
  showDot = true,
  positive,
}: SparklineProps) {
  const { path, areaPath, color, glowColor, endPoint, isFlat } = useMemo(() => {
    if (!data.length || data.every((v) => v === data[0])) {
      return {
        path: `M 0 ${height / 2} L ${width} ${height / 2}`,
        areaPath: "",
        color: "hsl(var(--muted-foreground))",
        glowColor: "transparent",
        endPoint: { x: width, y: height / 2 },
        isFlat: true,
      };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const padding = 3;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return { x, y };
    });

    // Create smooth curve using quadratic bezier
    let pathData = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      pathData += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${cpX.toFixed(2)} ${((prev.y + curr.y) / 2).toFixed(2)}`;
    }
    // Connect to last point
    const last = points[points.length - 1];
    pathData += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;

    // Create area path for gradient fill
    const areaPath = `${pathData} L ${last.x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

    const firstValue = data[0];
    const lastValue = data[data.length - 1];
    const isPositive = positive ?? lastValue >= firstValue;

    return {
      path: pathData,
      areaPath,
      color: isPositive ? "#34d399" : "#f87171",
      glowColor: isPositive ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.3)",
      endPoint: last,
      isFlat: false,
    };
  }, [data, width, height, positive]);

  if (data.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ width, height }}
      >
        <span className="text-[10px] text-muted-foreground/50">--</span>
      </div>
    );
  }

  const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
    >
      {!isFlat && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {/* Area fill */}
      {!isFlat && areaPath && (
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
        />
      )}
      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          filter: !isFlat ? `drop-shadow(0 0 2px ${glowColor})` : undefined,
        }}
      />
      {/* End dot */}
      {showDot && endPoint && !isFlat && (
        <>
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r={3}
            fill={color}
            style={{
              filter: `drop-shadow(0 0 4px ${glowColor})`,
            }}
          />
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r={1.5}
            fill="white"
            fillOpacity={0.9}
          />
        </>
      )}
    </svg>
  );
}

// Generate mock sparkline data for demo purposes
export function generateMockSparklineData(
  seed: number,
  trend: "up" | "down" | "neutral" = "neutral"
): number[] {
  const points = 12;
  const data: number[] = [];
  let value = 100 + (seed % 50);

  for (let i = 0; i < points; i++) {
    const noise =
      Math.sin(seed * i * 0.5) * 5 + Math.cos(seed * i * 0.3) * 3;
    const trendBias = trend === "up" ? 0.5 : trend === "down" ? -0.5 : 0;
    value = value + noise + trendBias * i;
    data.push(value);
  }

  return data;
}
