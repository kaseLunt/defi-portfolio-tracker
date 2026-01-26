/**
 * EtherFi tRPC Router
 *
 * Endpoints for EtherFi-specific data including membership tiers,
 * validators, referrals, and protocol statistics.
 */

import { z } from "zod";
import type { Address } from "viem";
import { router, publicProcedure } from "../trpc";
import { etherfiGraphService } from "../services/etherfi-graph";
import { getEtherFiApy, getEtherFiProtocolStats } from "../services/yields";
import {
  getTierInfo,
  getPointsToNextTier,
  getTierProgress,
} from "@/lib/etherfi-constants";
import type { HistoryTimeframe } from "@/lib/etherfi-constants";

const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

const historyTimeframeSchema = z.enum(["7d", "30d", "90d", "all"]);

export const etherfiRouter = router({
  /**
   * Get user's membership data (tier, points, progress)
   */
  getMembership: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const membership = await etherfiGraphService.getMembership(
        input.walletAddress as Address
      );

      if (!membership) {
        return null;
      }

      const tier = membership.tier;
      const tierInfo = getTierInfo(tier);
      const loyaltyPoints = parseInt(membership.loyaltyPoints || "0");
      const tierPoints = parseInt(membership.tierPoints || "0");
      const totalPoints = loyaltyPoints + tierPoints;
      const nextTierInfo = getPointsToNextTier(tier, totalPoints);
      const progress = getTierProgress(tier, totalPoints);

      return {
        tier,
        tierName: tierInfo.name,
        tierColor: tierInfo.color,
        tierGlow: tierInfo.glowColor,
        loyaltyPoints,
        tierPoints,
        totalPoints,
        progress,
        nextTier: nextTierInfo?.nextTier ?? null,
        pointsToNextTier: nextTierInfo?.pointsNeeded ?? null,
        stakedAmount: membership.amount,
      };
    }),

  /**
   * Get user's early adopter status
   */
  getEarlyAdopter: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const earlyAdopter = await etherfiGraphService.getEarlyAdopter(
        input.walletAddress as Address
      );

      if (!earlyAdopter) {
        return null;
      }

      return {
        isEarlyAdopter: true,
        amount: earlyAdopter.amount,
        points: parseInt(earlyAdopter.points || "0"),
        status: earlyAdopter.status,
        depositTime: earlyAdopter.depositTime,
      };
    }),

  /**
   * Get user's validators
   */
  getValidators: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const validators = await etherfiGraphService.getValidators(
        input.walletAddress as Address
      );

      // Group by phase
      const byPhase: Record<string, number> = {};
      let restakedCount = 0;

      for (const v of validators) {
        byPhase[v.phase] = (byPhase[v.phase] || 0) + 1;
        if (v.restaked) restakedCount++;
      }

      return {
        total: validators.length,
        byPhase,
        restakedCount,
        validators: validators.map((v) => ({
          id: v.id,
          phase: v.phase,
          pubKey: v.validatorPubKey,
          restaked: v.restaked,
          isSoloStaker: v.isSoloStaker,
        })),
      };
    }),

  /**
   * Get user's T-NFTs (staking receipts)
   */
  getTnfts: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const tnfts = await etherfiGraphService.getTnfts(
        input.walletAddress as Address
      );

      return tnfts.map((t) => ({
        id: t.id,
        validatorPubKey: t.validator?.validatorPubKey,
        phase: t.validator?.phase,
        restaked: t.validator?.restaked,
      }));
    }),

  /**
   * Get user's pending withdrawal requests
   */
  getWithdrawals: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const withdrawals = await etherfiGraphService.getWithdrawalRequests(
        input.walletAddress as Address
      );

      return withdrawals.map((w) => ({
        id: w.id,
        amountEeth: w.amountOfEEth,
        shareOfEeth: w.shareOfEEth,
        fee: w.fee,
        isClaimed: w.isClaimed,
      }));
    }),

  /**
   * Get user's referral data
   */
  getReferrals: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const referrals = await etherfiGraphService.getReferrals(
        input.walletAddress as Address
      );

      if (!referrals) {
        return null;
      }

      return {
        totalStaked: referrals.stakedAmount,
        points: parseInt(referrals.points || "0"),
      };
    }),

  /**
   * Get all user data in one call (for initial page load)
   */
  getUserData: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const data = await etherfiGraphService.getAllUserData(
        input.walletAddress as Address
      );

      // Process membership
      let membership = null;
      if (data.membership) {
        const tier = data.membership.tier;
        const tierInfo = getTierInfo(tier);
        const loyaltyPoints = parseInt(data.membership.loyaltyPoints || "0");
        const tierPoints = parseInt(data.membership.tierPoints || "0");
        const totalPoints = loyaltyPoints + tierPoints;
        const nextTierInfo = getPointsToNextTier(tier, totalPoints);
        const progress = getTierProgress(tier, totalPoints);

        membership = {
          tier,
          tierName: tierInfo.name,
          tierColor: tierInfo.color,
          tierGlow: tierInfo.glowColor,
          loyaltyPoints,
          tierPoints,
          totalPoints,
          progress,
          nextTier: nextTierInfo?.nextTier ?? null,
          pointsToNextTier: nextTierInfo?.pointsNeeded ?? null,
        };
      }

      // Process validators
      const validatorsByPhase: Record<string, number> = {};
      let restakedCount = 0;
      for (const v of data.validators) {
        validatorsByPhase[v.phase] = (validatorsByPhase[v.phase] || 0) + 1;
        if (v.restaked) restakedCount++;
      }

      return {
        membership,
        earlyAdopter: data.earlyAdopter
          ? {
              isEarlyAdopter: true,
              amount: data.earlyAdopter.amount,
              points: parseInt(data.earlyAdopter.points || "0"),
              status: data.earlyAdopter.status,
            }
          : null,
        validators: {
          total: data.validators.length,
          byPhase: validatorsByPhase,
          restakedCount,
        },
        tnfts: data.tnfts.map((t) => ({
          id: t.id,
          phase: t.validator?.phase,
          restaked: t.validator?.restaked,
        })),
        withdrawals: data.withdrawals.map((w) => ({
          id: w.id,
          amountEeth: w.amountOfEEth,
          isClaimed: w.isClaimed,
        })),
        referrals: data.referrals
          ? {
              totalStaked: data.referrals.stakedAmount,
              points: parseInt(data.referrals.points || "0"),
            }
          : null,
        account: data.account
          ? { stakedAmount: data.account.stakedAmount }
          : null,
      };
    }),

  /**
   * Get protocol-level statistics
   * Uses EtherFi's official API for TVL, DeFi Llama for APY
   * Validator/staker counts estimated from TVL
   */
  getProtocolStats: publicProcedure.query(async () => {
    const [protocolStats, apy] = await Promise.all([
      getEtherFiProtocolStats(),
      getEtherFiApy(),
    ]);

    // Estimate validator/staker counts from TVL
    // EtherFi has ~$5-6B TVL with ~2M+ ETH staked
    const ETH_PRICE = 3300;
    const totalStakedEth = protocolStats.tvl > 0 ? protocolStats.tvl / ETH_PRICE : 0;

    return {
      // Estimated from TVL (~32 ETH per validator)
      totalValidators: Math.floor(totalStakedEth / 32),
      activeValidators: Math.floor(totalStakedEth / 32 * 0.95),
      pendingValidators: Math.floor(totalStakedEth / 32 * 0.05),
      // Estimated (~2.5 ETH average stake per user)
      totalStakers: Math.floor(totalStakedEth / 2.5),
      totalStakedEth: Math.floor(totalStakedEth),
      // From EtherFi API
      tvlUsd: protocolStats.tvlUsd,
      // From DeFi Llama
      currentApy: apy,
    };
  }),

  /**
   * Get APY history from rebase events
   */
  getApyHistory: publicProcedure
    .input(z.object({ timeframe: historyTimeframeSchema }))
    .query(async ({ input }) => {
      const events = await etherfiGraphService.getRebaseEvents(
        input.timeframe as HistoryTimeframe
      );

      // Process rebase events into APY data points
      // Note: Actual APY calculation depends on subgraph schema
      return events.map((e) => ({
        timestamp: parseInt(e.timestamp),
        // APY would be calculated from rebase event data
      }));
    }),

  /**
   * Get current APY from DeFi Llama
   */
  getCurrentApy: publicProcedure.query(async () => {
    const apy = await getEtherFiApy();
    return { apy };
  }),

  /**
   * Get top membership NFT holders (for testing/demo)
   * Returns wallets with highest tier points
   */
  getTopMembers: publicProcedure.query(async () => {
    const members = await etherfiGraphService.getTopMembers();
    return members.map((m) => ({
      owner: m.owner,
      tier: m.tier,
      loyaltyPoints: parseInt(m.loyaltyPoints || "0"),
      tierPoints: parseInt(m.tierPoints || "0"),
      totalPoints: parseInt(m.loyaltyPoints || "0") + parseInt(m.tierPoints || "0"),
    }));
  }),
});
