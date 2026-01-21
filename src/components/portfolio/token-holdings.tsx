"use client";

import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { formatUSD } from "@/lib/utils";
import { ChainDot } from "@/components/shared/chain-badge";

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
}

function formatBalance(balance: number): string {
  if (balance >= 1_000_000) {
    return `${(balance / 1_000_000).toFixed(2)}M`;
  }
  if (balance >= 1_000) {
    return `${(balance / 1_000).toFixed(2)}K`;
  }
  if (balance >= 1) {
    return balance.toFixed(2);
  }
  if (balance >= 0.0001) {
    return balance.toFixed(4);
  }
  return balance.toExponential(2);
}

export function TokenHoldings({ tokens, isLoading }: TokenHoldingsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded mt-1" />
            </div>
            <div className="text-right">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-3 w-14 bg-muted rounded mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tokens found in this wallet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tokens.map((token, index) => {
        const chainInfo = CHAIN_INFO[token.chainId];

        return (
          <div
            key={`${token.chainId}-${token.tokenAddress}-${index}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {/* Token Logo */}
            <div className="relative">
              {token.logoUrl ? (
                <img
                  src={token.logoUrl}
                  alt={token.tokenSymbol}
                  className="w-10 h-10 rounded-full bg-muted"
                  onError={(e) => {
                    // Fallback to initial if image fails
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold ${token.logoUrl ? 'hidden' : ''}`}
              >
                {token.tokenSymbol.slice(0, 2).toUpperCase()}
              </div>
              {/* Chain indicator */}
              <div className="absolute -bottom-0.5 -right-0.5">
                <ChainDot chainId={token.chainId} size="sm" />
              </div>
            </div>

            {/* Token Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{token.tokenSymbol}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {token.tokenName}
              </div>
            </div>

            {/* Balance & Value */}
            <div className="text-right">
              <div className="font-medium">{formatUSD(token.quoteUsd)}</div>
              <div className="text-xs text-muted-foreground">
                {formatBalance(token.balance)} {token.tokenSymbol}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
