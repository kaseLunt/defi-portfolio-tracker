"use client";

import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  isConnected: boolean;
  className?: string;
}

export function LiveIndicator({ isConnected, className }: LiveIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        isConnected ? "text-green-500" : "text-muted-foreground",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            isConnected ? "bg-green-500" : "bg-muted-foreground"
          )}
        />
      </span>
      <span>{isConnected ? "Live" : "Offline"}</span>
    </div>
  );
}
