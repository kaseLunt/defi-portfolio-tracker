"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { STALE_TIMES } from "@/lib/constants";

/**
 * Hook for EtherFi user data (membership, validators, etc.)
 * Fetches all user data in a single query for efficiency
 */
export function useEtherFiUser(walletAddress: string | undefined) {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.etherfi.getUserData.useQuery(
    { walletAddress: walletAddress! },
    {
      enabled: !!walletAddress,
      staleTime: STALE_TIMES.POSITIONS,
      refetchOnWindowFocus: false,
    }
  );

  // Parse staked amount from account data (in wei)
  const stakedAmountWei = data?.account?.stakedAmount
    ? BigInt(data.account.stakedAmount)
    : 0n;
  // Handle negative values (some accounts show negative in subgraph)
  const normalizedStakedAmount = stakedAmountWei < 0n ? 0n : stakedAmountWei;
  const hasStakedAmount = normalizedStakedAmount > 0n;

  return {
    // Membership / Tier data
    membership: data?.membership ?? null,
    hasMembership: !!data?.membership,
    tier: data?.membership?.tier ?? 0,
    tierName: data?.membership?.tierName ?? "Bronze",
    tierColor: data?.membership?.tierColor ?? "#CD7F32",
    loyaltyPoints: data?.membership?.loyaltyPoints ?? 0,
    tierPoints: data?.membership?.tierPoints ?? 0,
    totalPoints: data?.membership?.totalPoints ?? 0,
    progress: data?.membership?.progress ?? 0,
    nextTier: data?.membership?.nextTier ?? null,
    pointsToNextTier: data?.membership?.pointsToNextTier ?? null,

    // Early adopter
    earlyAdopter: data?.earlyAdopter ?? null,
    isEarlyAdopter: !!data?.earlyAdopter,

    // Validators
    validators: data?.validators ?? { total: 0, byPhase: {}, restakedCount: 0 },
    hasValidators: (data?.validators?.total ?? 0) > 0,

    // T-NFTs
    tnfts: data?.tnfts ?? [],
    hasTnfts: (data?.tnfts?.length ?? 0) > 0,

    // Withdrawals
    withdrawals: data?.withdrawals ?? [],
    hasPendingWithdrawals: (data?.withdrawals?.length ?? 0) > 0,

    // Referrals
    referrals: data?.referrals ?? null,
    hasReferrals: !!data?.referrals,

    // Account (staked amount)
    account: data?.account ?? null,
    stakedAmountWei: normalizedStakedAmount,
    hasStakedAmount,

    // Status
    isLoading,
    isFetching,
    error,
    refetch,

    // Computed: has any EtherFi activity (now includes staked amount)
    hasEtherFiActivity:
      !!data?.membership ||
      !!data?.earlyAdopter ||
      (data?.validators?.total ?? 0) > 0 ||
      (data?.tnfts?.length ?? 0) > 0 ||
      hasStakedAmount,
  };
}

/**
 * Hook for EtherFi protocol statistics
 */
export function useEtherFiProtocol() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = trpc.etherfi.getProtocolStats.useQuery(undefined, {
    staleTime: 60 * 1000, // 1 minute - protocol stats change slowly
    refetchOnWindowFocus: false,
  });

  return {
    totalValidators: data?.totalValidators ?? 0,
    activeValidators: data?.activeValidators ?? 0,
    pendingValidators: data?.pendingValidators ?? 0,
    totalStakers: data?.totalStakers ?? 0,
    totalStakedEth: data?.totalStakedEth ?? 0,
    tvlUsd: data?.tvlUsd ?? "—",
    currentApy: data?.currentApy ?? 0,

    isLoading,
    isFetching,
    error,
    refetch,
  };
}

/**
 * Hook for current EtherFi APY
 */
export function useEtherFiApy() {
  const { data, isLoading } = trpc.etherfi.getCurrentApy.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    apy: data?.apy ?? 0,
    isLoading,
  };
}

/**
 * Combined hook for EtherFi dashboard card
 * Returns just what's needed for the compact card view
 */
export function useEtherFiCard(walletAddress: string | undefined) {
  const user = useEtherFiUser(walletAddress);
  const { apy, isLoading: apyLoading } = useEtherFiApy();

  return {
    // Tier display
    hasMembership: user.hasMembership,
    tierName: user.tierName,
    tierColor: user.tierColor,
    totalPoints: user.totalPoints,
    progress: user.progress,
    nextTier: user.nextTier,
    pointsToNextTier: user.pointsToNextTier,

    // Staked amount (from Graph account data)
    hasStakedAmount: user.hasStakedAmount,
    stakedAmountWei: user.stakedAmountWei,

    // Quick stats
    isEarlyAdopter: user.isEarlyAdopter,
    hasValidators: user.hasValidators,
    validatorCount: user.validators.total,

    // APY
    apy,

    // Status
    isLoading: user.isLoading || apyLoading,
    hasEtherFiActivity: user.hasEtherFiActivity,
  };
}
