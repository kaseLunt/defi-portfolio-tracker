"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ETHERFI_TIERS, type EtherFiTier } from "@/lib/etherfi-constants";

interface TierBadgeProps {
  tier: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    container: "w-10 h-10",
    icon: "w-4 h-4",
    text: "text-[9px]",
    glow: "shadow-[0_0_12px_var(--tier-glow)]",
  },
  md: {
    container: "w-14 h-14",
    icon: "w-5 h-5",
    text: "text-[10px]",
    glow: "shadow-[0_0_20px_var(--tier-glow)]",
  },
  lg: {
    container: "w-20 h-20",
    icon: "w-7 h-7",
    text: "text-xs",
    glow: "shadow-[0_0_30px_var(--tier-glow)]",
  },
  xl: {
    container: "w-28 h-28",
    icon: "w-10 h-10",
    text: "text-sm",
    glow: "shadow-[0_0_40px_var(--tier-glow)]",
  },
} as const;

/**
 * Animated tier badge with gaming-inspired glow effects
 */
export function TierBadge({
  tier,
  size = "md",
  showLabel = true,
  animated = true,
  className,
}: TierBadgeProps) {
  const tierInfo = ETHERFI_TIERS[tier as EtherFiTier] ?? ETHERFI_TIERS[0];
  const config = SIZE_CONFIG[size];
  const isPlatinum = tier === 3;

  const badgeStyle = useMemo(
    () => ({
      "--tier-color": tierInfo.color,
      "--tier-glow": tierInfo.glowColor,
      background: tierInfo.bgGradient,
    }),
    [tierInfo]
  ) as React.CSSProperties;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1.5",
        className
      )}
    >
      {/* Main badge */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-xl",
          config.container,
          config.glow,
          animated && "animate-tier-pulse",
          isPlatinum && "animate-shimmer"
        )}
        style={badgeStyle}
      >
        {/* Inner ring effect */}
        <div
          className={cn(
            "absolute inset-1 rounded-lg border border-white/20",
            "bg-gradient-to-b from-white/15 to-transparent"
          )}
        />

        {/* Diamond icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={cn(config.icon, "relative z-10")}
        >
          <path
            d="M12 2L2 9L12 22L22 9L12 2Z"
            fill="currentColor"
            className="text-white/90"
          />
          <path
            d="M12 2L2 9L12 12L22 9L12 2Z"
            fill="currentColor"
            className="text-white/40"
          />
        </svg>

        {/* Platinum shimmer overlay */}
        {isPlatinum && (
          <div
            className={cn(
              "absolute inset-0 rounded-xl overflow-hidden",
              "bg-gradient-to-r from-transparent via-white/30 to-transparent",
              "animate-shimmer-slide"
            )}
          />
        )}
      </div>

      {/* Tier label */}
      {showLabel && (
        <span
          className={cn(
            "font-bold uppercase tracking-wider",
            config.text
          )}
          style={{ color: tierInfo.color }}
        >
          {tierInfo.name}
        </span>
      )}
    </div>
  );
}

/**
 * Compact tier indicator for inline use
 */
export function TierDot({
  tier,
  className,
}: {
  tier: number;
  className?: string;
}) {
  const tierInfo = ETHERFI_TIERS[tier as EtherFiTier] ?? ETHERFI_TIERS[0];

  return (
    <div
      className={cn(
        "w-2.5 h-2.5 rounded-full ring-2 ring-background",
        "shadow-[0_0_8px_var(--tier-glow)]",
        className
      )}
      style={{
        background: tierInfo.bgGradient,
        "--tier-glow": tierInfo.glowColor,
      } as React.CSSProperties}
      title={`${tierInfo.name} Tier`}
    />
  );
}

/**
 * Progress bar to next tier with animated fill
 */
interface TierProgressProps {
  progress: number;
  tierColor: string;
  tierGlow: string;
  pointsToNext?: number | null;
  nextTier?: string | null;
  animated?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TierProgress({
  progress,
  tierColor,
  tierGlow,
  pointsToNext,
  nextTier,
  animated = true,
  size = "md",
  className,
}: TierProgressProps) {
  const barHeight = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className={cn("space-y-1", className)}>
      {/* Progress bar */}
      <div
        className={cn(
          "w-full rounded-full overflow-hidden",
          barHeight,
          "bg-secondary/80"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            animated && "animate-progress-fill"
          )}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: `linear-gradient(90deg, ${tierColor}cc, ${tierColor})`,
            boxShadow: `0 0 10px ${tierGlow}`,
          }}
        />
      </div>

      {/* Next tier info */}
      {pointsToNext != null && nextTier && (
        <p className="text-[10px] text-muted-foreground tabular-nums">
          <span className="font-medium" style={{ color: tierColor }}>
            {pointsToNext.toLocaleString()}
          </span>{" "}
          points to {nextTier}
        </p>
      )}
    </div>
  );
}
