"use client";

import { useLivePrices } from "@/hooks/use-live-prices";
import { cn } from "@/lib/utils";

export function PriceTicker() {
  const { prices, isConnected, recentlyUpdated } = useLivePrices();

  const ethPrice = prices["ethereum"];
  const btcPrice = prices["bitcoin"];

  const formatPrice = (price: number) => {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatChange = (change: number | null) => {
    if (change === null) return null;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-secondary/30 border border-border/50 text-xs font-mono">
      {/* Connection indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
          )}
        />
        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
          {isConnected ? "Live" : "..."}
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* ETH Price */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">ETH</span>
        <span
          key={ethPrice?.updatedAt ?? 0}
          className="font-semibold value-up"
        >
          {ethPrice ? formatPrice(ethPrice.usd) : "—"}
        </span>
        {ethPrice?.change24h !== null && ethPrice?.change24h !== undefined && (
          <span
            className={cn(
              "text-[10px]",
              ethPrice.change24h >= 0 ? "text-emerald-500" : "text-red-500"
            )}
          >
            {formatChange(ethPrice.change24h)}
          </span>
        )}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* BTC Price */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">BTC</span>
        <span
          key={btcPrice?.updatedAt ?? 0}
          className="font-semibold value-up"
        >
          {btcPrice ? formatPrice(btcPrice.usd) : "—"}
        </span>
        {btcPrice?.change24h !== null && btcPrice?.change24h !== undefined && (
          <span
            className={cn(
              "text-[10px]",
              btcPrice.change24h >= 0 ? "text-emerald-500" : "text-red-500"
            )}
          >
            {formatChange(btcPrice.change24h)}
          </span>
        )}
      </div>
    </div>
  );
}
