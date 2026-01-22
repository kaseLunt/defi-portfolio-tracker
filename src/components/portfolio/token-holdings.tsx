"use client";

import { useState } from "react";
import { type SupportedChainId } from "@/lib/constants";
import { formatUSD } from "@/lib/utils";
import { ChainDot } from "@/components/shared/chain-badge";
import { SkeletonRow } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/ui/sparkline";
import { Coins, TrendingUp, TrendingDown } from "lucide-react";

interface TokenBalance {
  chainId: SupportedChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  balance: number;
  balanceRaw: string;
  quoteUsd: number;
  logoUrl?: string;
}

interface TokenHoldingsProps {
  tokens: TokenBalance[];
  isLoading?: boolean;
  tokenPriceHistory?: Record<string, number[]>;
}

function formatBalance(balance: number): string {
  if (balance >= 1_000_000) {
    return `${(balance / 1_000_000).toFixed(2)}M`;
  }
  if (balance >= 1_000) {
    return `${(balance / 1_000).toFixed(2)}K`;
  }
  if (balance >= 1) {
    return balance.toFixed(4);
  }
  if (balance >= 0.0001) {
    return balance.toFixed(6);
  }
  return balance.toExponential(2);
}

function TokenLogo({
  logoUrl,
  symbol,
  size = "md",
}: {
  logoUrl?: string;
  symbol: string;
  size?: "sm" | "md" | "lg";
}) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-14 h-14 text-base",
  };

  if (!logoUrl || imageError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary/80 ring-1 ring-primary/10`}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative group-hover:scale-105 transition-transform">
      <img
        src={logoUrl}
        alt={symbol}
        className={`${sizeClasses[size]} rounded-full bg-secondary object-cover ring-1 ring-white/10`}
        onError={() => setImageError(true)}
      />
    </div>
  );
}

function TokenRow({
  token,
  sparklineData,
  index,
}: {
  token: TokenBalance;
  sparklineData: number[];
  index: number;
}) {
  // Calculate price trend from sparkline
  const hasTrend = sparklineData.length >= 2;
  const firstPrice = sparklineData[0] ?? 0;
  const lastPrice = sparklineData[sparklineData.length - 1] ?? 0;
  const priceChange = hasTrend && firstPrice > 0
    ? ((lastPrice - firstPrice) / firstPrice) * 100
    : 0;
  const isPositive = priceChange >= 0;

  return (
    <div
      className="group flex items-center gap-4 p-4 rounded-xl transition-all duration-200 bg-card/30 hover:bg-card border border-transparent hover:border-border/50 cursor-default"
      style={{ animationDelay: `${index * 25}ms` }}
    >
      {/* Token Logo */}
      <div className="relative flex-shrink-0">
        <TokenLogo logoUrl={token.logoUrl} symbol={token.tokenSymbol} />
        <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
          <ChainDot chainId={token.chainId} size="sm" />
        </div>
      </div>

      {/* Token Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{token.tokenSymbol}</span>
          {hasTrend && Math.abs(priceChange) > 0.01 && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                isPositive
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-red-400 bg-red-500/10"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              <span className="tabular-nums">
                {Math.abs(priceChange).toFixed(1)}%
              </span>
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {token.tokenName}
        </div>
      </div>

      {/* Sparkline */}
      <div className="hidden sm:flex items-center justify-center w-20 flex-shrink-0">
        <Sparkline
          data={sparklineData}
          width={72}
          height={28}
          positive={isPositive}
        />
      </div>

      {/* Balance & Value */}
      <div className="text-right flex-shrink-0 min-w-[110px] space-y-0.5">
        <div className="font-semibold tabular-nums text-lg">
          {formatUSD(token.quoteUsd)}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatBalance(token.balance)} {token.tokenSymbol}
        </div>
      </div>
    </div>
  );
}

export function TokenHoldings({
  tokens,
  isLoading,
  tokenPriceHistory = {},
}: TokenHoldingsProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary mb-4">
          <Coins className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">No tokens found</p>
        <p className="text-muted-foreground/70 text-sm mt-1.5">
          Connect a wallet with token balances to see holdings
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tokens.map((token, index) => {
        const priceKey = `${token.chainId}:${token.tokenAddress.toLowerCase()}`;
        const sparklineData = tokenPriceHistory[priceKey] ?? [];

        return (
          <div
            key={`${token.chainId}-${token.tokenAddress}-${index}`}
            className="animate-in"
            style={{ animationDelay: `${index * 25}ms` }}
          >
            <TokenRow
              token={token}
              sparklineData={sparklineData}
              index={index}
            />
          </div>
        );
      })}
    </div>
  );
}

export { TokenLogo };
