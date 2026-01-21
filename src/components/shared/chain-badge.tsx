"use client";

import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ChainBadgeProps {
  chainId: SupportedChainId;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ChainBadge({
  chainId,
  showName = true,
  size = "md",
  className,
}: ChainBadgeProps) {
  const chain = CHAIN_INFO[chainId];

  if (!chain) {
    return null;
  }

  const sizeClasses = {
    sm: "w-4 h-4 text-[10px]",
    md: "w-5 h-5 text-xs",
    lg: "w-6 h-6 text-sm",
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-semibold text-white",
          sizeClasses[size]
        )}
        style={{ backgroundColor: chain.color }}
        title={chain.name}
      >
        {chain.shortName[0]}
      </div>
      {showName && (
        <span className="text-sm text-muted-foreground">{chain.shortName}</span>
      )}
    </div>
  );
}

interface ChainDotProps {
  chainId: SupportedChainId;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ChainDot({ chainId, size = "md", className }: ChainDotProps) {
  const chain = CHAIN_INFO[chainId];

  if (!chain) {
    return null;
  }

  const sizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <div
      className={cn(sizeClasses[size], "rounded-full border border-background", className)}
      style={{ backgroundColor: chain.color }}
      title={chain.name}
    />
  );
}
