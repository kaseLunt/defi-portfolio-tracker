"use client";

import { trpc } from "@/lib/trpc";
import { STALE_TIMES } from "@/lib/constants";

/**
 * Hook to fetch live portfolio data for any wallet address
 */
export function useLivePortfolio(
  walletAddress: string | undefined,
  options?: {
    chains?: number[];
    protocols?: string[];
    enabled?: boolean;
  }
) {
  const { data, isLoading, error, refetch, isFetching } =
    trpc.portfolio.getLivePortfolio.useQuery(
      {
        walletAddress: walletAddress!,
        chains: options?.chains,
        protocols: options?.protocols,
      },
      {
        enabled: !!walletAddress && options?.enabled !== false,
        staleTime: STALE_TIMES.POSITIONS,
        refetchOnWindowFocus: false,
      }
    );

  return {
    portfolio: data,
    isLoading,
    isFetching,
    error,
    refetch,
    // Derived data
    totalValue: data?.totalValueUsd ?? 0,
    positions: data?.positions ?? [],
    byProtocol: data?.byProtocol ?? [],
    byChain: data?.byChain ?? [],
    avgApy: data?.avgApy ?? 0,
    yield24h: data?.totalYield24h ?? 0,
  };
}

/**
 * Hook to fetch supported protocols
 */
export function useProtocols(options?: { chainId?: number; category?: string }) {
  return trpc.portfolio.getProtocols.useQuery(
    {
      chainId: options?.chainId,
      category: options?.category,
    },
    {
      staleTime: STALE_TIMES.PROTOCOLS,
    }
  );
}

/**
 * Hook to fetch prices for specific tokens
 */
export function usePrices(coingeckoIds: string[]) {
  return trpc.price.getPrices.useQuery(
    { coingeckoIds },
    {
      enabled: coingeckoIds.length > 0,
      staleTime: STALE_TIMES.PRICES,
      refetchInterval: STALE_TIMES.PRICES,
    }
  );
}

/**
 * Hook to fetch price for a single token by symbol
 */
export function useTokenPrice(symbol: string) {
  return trpc.price.getPriceBySymbol.useQuery(
    { symbol },
    {
      enabled: !!symbol,
      staleTime: STALE_TIMES.PRICES,
    }
  );
}
