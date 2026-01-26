/**
 * EtherFi Protocol Constants
 *
 * Tier thresholds, colors, and configuration for the EtherFi integration.
 */

/**
 * Loyalty tier definitions
 * Based on EtherFi's MembershipNFT tier system (0-3)
 */
export const ETHERFI_TIERS = {
  0: {
    name: "Bronze",
    color: "#CD7F32",
    glowColor: "rgba(205, 127, 50, 0.25)",
    bgGradient: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)",
    minPoints: 0,
  },
  1: {
    name: "Silver",
    color: "#C0C0C0",
    glowColor: "rgba(192, 192, 192, 0.25)",
    bgGradient: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)",
    minPoints: 5000,
  },
  2: {
    name: "Gold",
    color: "#FFD700",
    glowColor: "rgba(255, 215, 0, 0.25)",
    bgGradient: "linear-gradient(135deg, #FFD700 0%, #B8860B 100%)",
    minPoints: 15000,
  },
  3: {
    name: "Platinum",
    color: "#E5E4E2",
    glowColor: "rgba(229, 228, 226, 0.3)",
    bgGradient: "linear-gradient(135deg, #E5E4E2 0%, #A9A9A9 100%)",
    minPoints: 50000,
    // Platinum gets a shimmer effect
    shimmer: true,
  },
} as const;

export type EtherFiTier = keyof typeof ETHERFI_TIERS;

/**
 * Get tier info from tier number
 */
export function getTierInfo(tier: number) {
  return ETHERFI_TIERS[tier as EtherFiTier] ?? ETHERFI_TIERS[0];
}

/**
 * Calculate points needed for next tier
 */
export function getPointsToNextTier(
  currentTier: number,
  currentPoints: number
): { nextTier: string; pointsNeeded: number } | null {
  const nextTierNum = currentTier + 1;
  if (nextTierNum > 3) {
    return null; // Already at max tier
  }

  const nextTierInfo = ETHERFI_TIERS[nextTierNum as EtherFiTier];
  return {
    nextTier: nextTierInfo.name,
    pointsNeeded: nextTierInfo.minPoints - currentPoints,
  };
}

/**
 * Calculate progress percentage to next tier
 */
export function getTierProgress(
  currentTier: number,
  currentPoints: number
): number {
  if (currentTier >= 3) return 100;

  const currentTierMin = ETHERFI_TIERS[currentTier as EtherFiTier].minPoints;
  const nextTierMin = ETHERFI_TIERS[(currentTier + 1) as EtherFiTier].minPoints;

  const pointsInTier = currentPoints - currentTierMin;
  const pointsNeededForTier = nextTierMin - currentTierMin;

  return Math.min(100, Math.max(0, (pointsInTier / pointsNeededForTier) * 100));
}

/**
 * EtherFi brand colors
 */
export const ETHERFI_BRAND = {
  primary: "#735CFF",
  primaryLight: "#8F7AFF",
  primaryDark: "#5B3FD9",
  primaryGlow: "rgba(115, 92, 255, 0.25)",
  gradient: "linear-gradient(135deg, #735CFF 0%, #5B3FD9 100%)",
  gradientHover: "linear-gradient(135deg, #8F7AFF 0%, #735CFF 100%)",
} as const;

/**
 * Validator phase definitions
 */
export const VALIDATOR_PHASES = {
  NOT_INITIALIZED: {
    label: "Not Initialized",
    color: "#6B7280",
    bgColor: "rgba(107, 114, 128, 0.1)",
  },
  STAKE_DEPOSITED: {
    label: "Pending",
    color: "#F59E0B",
    bgColor: "rgba(245, 158, 11, 0.1)",
  },
  LIVE: {
    label: "Active",
    color: "#22C55E",
    bgColor: "rgba(34, 197, 94, 0.1)",
  },
  EXITED: {
    label: "Exited",
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.1)",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#6B7280",
    bgColor: "rgba(107, 114, 128, 0.1)",
  },
  BEING_SLASHED: {
    label: "Slashed",
    color: "#DC2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
  },
} as const;

export type ValidatorPhase = keyof typeof VALIDATOR_PHASES;

/**
 * Early adopter status
 */
export const EARLY_ADOPTER_STATUS = {
  DEPOSITED: { label: "Active", color: "#22C55E" },
  WITHDRAWN: { label: "Withdrawn", color: "#6B7280" },
  MIGRATED: { label: "Migrated", color: "#3B82F6" },
} as const;

export type EarlyAdopterStatus = keyof typeof EARLY_ADOPTER_STATUS;

/**
 * Staking minimums and limits
 */
export const STAKING_LIMITS = {
  minStakeEth: 0.01,
  minWrapEeth: 0.001,
  minUnwrapWeeth: 0.001,
  gasBufferEth: 0.005, // Reserve for gas when staking max
} as const;

/**
 * Graph query timeframes
 */
export const HISTORY_TIMEFRAMES = {
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
  "90d": 90 * 24 * 60 * 60,
  all: 365 * 24 * 60 * 60, // 1 year max
} as const;

export type HistoryTimeframe = keyof typeof HISTORY_TIMEFRAMES;
