"use client";

import { trpc } from "@/lib/trpc";
import { STALE_TIMES } from "@/lib/constants";
import { useMemo } from "react";

/**
 * Fast portfolio hook using progressive loading
 *
 * 1. Token balances load first (~600ms)
 * 2. DeFi positions load separately using smart adapter selection
 * 3. Both use stale-while-revalidate for instant cached responses
 */
export function useFastPortfolio(
  walletAddress: string | undefined,
  options?: {
    chains?: number[];
    enabled?: boolean;
  }
) {
  // Step 1: Fetch token balances (FAST - ~600ms)
  const {
    data: tokenData,
    isLoading: tokensLoading,
    isFetching: tokensFetching,
    error: tokensError,
    refetch: refetchTokens,
  } = trpc.portfolio.getTokenBalances.useQuery(
    {
      walletAddress: walletAddress!,
      chains: options?.chains,
    },
    {
      enabled: !!walletAddress && options?.enabled !== false,
      staleTime: STALE_TIMES.POSITIONS,
      refetchOnWindowFocus: false,
    }
  );

  // Extract token symbols for smart adapter selection
  const tokenSymbols = useMemo(() => {
    return tokenData?.balances.map(b => b.tokenSymbol) ?? [];
  }, [tokenData?.balances]);

  // Step 2: Fetch DeFi positions (uses smart adapter selection)
  const {
    data: defiData,
    isLoading: defiLoading,
    isFetching: defiFetching,
    error: defiError,
    refetch: refetchDefi,
  } = trpc.portfolio.getDefiPositions.useQuery(
    {
      walletAddress: walletAddress!,
      chains: options?.chains,
      tokenSymbols,
    },
    {
      enabled: !!walletAddress && !!tokenData && options?.enabled !== false,
      staleTime: STALE_TIMES.POSITIONS,
      refetchOnWindowFocus: false,
    }
  );

  // Combined refetch
  const refetch = async () => {
    await Promise.all([refetchTokens(), refetchDefi()]);
  };

  // Calculate totals
  const tokenTotalUsd = tokenData?.totalValueUsd ?? 0;
  const defiTotalUsd = defiData?.totalValueUsd ?? 0;

  // Total value: use token balances as primary (they include DeFi tokens like aTokens)
  // but if DeFi shows significantly more, use that (edge case for unlisted tokens)
  const totalValue = Math.max(tokenTotalUsd, defiTotalUsd);

  return {
    // Token data (loads first)
    tokenBalances: tokenData?.balances ?? [],
    tokenTotalUsd,
    tokensLoading,
    tokensFetching,
    tokensStale: tokenData?.stale ?? false,
    tokensRefreshing: tokenData?.refreshing ?? false,
    tokensError,

    // DeFi data (loads second)
    positions: defiData?.positions ?? [],
    defiTotalUsd,
    defiLoading,
    defiFetching,
    defiStale: defiData?.stale ?? false,
    defiRefreshing: defiData?.refreshing ?? false,
    defiError,
    protocolsQueried: defiData?.protocolsQueried ?? [],
    byProtocol: defiData?.byProtocol ?? [],

    // Combined
    totalValue,
    byChain: tokenData?.byChain ?? [],
    avgApy: defiData?.avgApy ?? 0,
    yield24h: defiData?.totalYield24h ?? 0,

    // Loading states
    isLoading: tokensLoading, // Consider loaded when tokens are ready
    isFullyLoaded: !tokensLoading && !defiLoading,
    isFetching: tokensFetching || defiFetching,
    error: tokensError || defiError,
    refetch,
  };
}
