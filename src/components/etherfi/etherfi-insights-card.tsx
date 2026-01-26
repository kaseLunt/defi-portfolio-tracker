"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils";
import { formatEther } from "viem";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge, TierProgress } from "./tier-badge";
import { useEtherFiCard } from "@/hooks/use-etherfi";
import { useEtherFiBalances } from "@/hooks/use-etherfi-staking";
import { ETHERFI_BRAND, ETHERFI_TIERS, type EtherFiTier } from "@/lib/etherfi-constants";
import {
  ArrowRight,
  Sparkles,
  Zap,
  TrendingUp,
  Shield,
  ExternalLink,
} from "lucide-react";

interface EtherFiInsightsCardProps {
  className?: string;
  walletAddress?: string;
}

/**
 * EtherFi Insights Card for the dashboard
 * Shows tier badge, points progress, and quick stats
 * Gaming-inspired design with animated glows
 */
export function EtherFiInsightsCard({ className, walletAddress }: EtherFiInsightsCardProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  // Use provided wallet or fall back to connected wallet
  const activeWallet = walletAddress || address;

  // Fetch EtherFi data
  const {
    hasMembership,
    tierName,
    tierColor,
    totalPoints,
    progress,
    nextTier,
    pointsToNextTier,
    hasStakedAmount,
    stakedAmountWei,
    isEarlyAdopter,
    hasValidators,
    validatorCount,
    apy,
    isLoading,
    hasEtherFiActivity,
  } = useEtherFiCard(activeWallet);

  // Fetch balances for the active wallet
  const balances = useEtherFiBalances(activeWallet);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <EtherFiCardSkeleton className={className} />;
  }

  // Need either a provided wallet or connected wallet
  if (!activeWallet) {
    return null;
  }

  // Show empty state if no EtherFi activity
  if (!isLoading && !hasEtherFiActivity && balances.weeth.balance === 0n) {
    return <EtherFiEmptyState className={className} apy={apy} walletAddress={activeWallet} />;
  }

  const handleClick = () => {
    router.push(`/etherfi/${activeWallet}`);
  };

  // Get tier number from tierName for badge
  const tierNumber = Object.entries(ETHERFI_TIERS).find(
    ([_, info]) => info.name === tierName
  )?.[0] ?? "0";

  const tierInfo = ETHERFI_TIERS[parseInt(tierNumber) as EtherFiTier];

  return (
    <Card
      onClick={handleClick}
      className={cn(
        "group relative overflow-hidden cursor-pointer",
        "border-etherfi/20 hover:border-etherfi/40",
        "transition-all duration-300",
        "hover:shadow-[0_0_40px_rgba(115,92,255,0.15)]",
        className
      )}
      style={{
        "--etherfi": ETHERFI_BRAND.primary,
        "--etherfi-glow": ETHERFI_BRAND.primaryGlow,
      } as React.CSSProperties}
    >
      {/* Animated background gradient */}
      <div
        className={cn(
          "absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06]",
          "transition-opacity duration-500",
          "bg-gradient-to-br from-etherfi via-transparent to-transparent"
        )}
        style={{
          background: `radial-gradient(ellipse at top right, ${ETHERFI_BRAND.primary}20, transparent 60%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <EtherFiLogo className="w-5 h-5" />
          <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
            Ether.Fi
          </span>
          {isEarlyAdopter && (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">
              <Sparkles className="w-2.5 h-2.5" />
              OG
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="px-5 pb-5">
          <div className="flex items-start gap-4">
            <Skeleton className="w-14 h-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 space-y-4">
          {/* Tier section */}
          {hasMembership ? (
            <div className="flex items-start gap-4">
              <TierBadge
                tier={parseInt(tierNumber)}
                size="md"
                showLabel={false}
                animated
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-bold text-lg uppercase tracking-wide"
                    style={{ color: tierColor }}
                  >
                    {tierName}
                  </span>
                  <span className="text-xs text-muted-foreground">Tier</span>
                </div>
                <p className="text-sm tabular-nums">
                  <span className="font-semibold">{totalPoints.toLocaleString()}</span>
                  <span className="text-muted-foreground"> loyalty points</span>
                </p>
                <TierProgress
                  progress={progress}
                  tierColor={tierColor}
                  tierGlow={tierInfo?.glowColor ?? ETHERFI_BRAND.primaryGlow}
                  pointsToNext={pointsToNextTier}
                  nextTier={nextTier}
                  size="sm"
                />
              </div>
            </div>
          ) : hasStakedAmount ? (
            <div className="flex items-center gap-3 py-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: ETHERFI_BRAND.gradient }}
              >
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Active Staker</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatStakedAmount(stakedAmountWei)}
                  </span>{" "}
                  ETH staked
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: ETHERFI_BRAND.gradient }}
              >
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium">Start Earning</p>
                <p className="text-xs text-muted-foreground">
                  Stake to unlock loyalty tiers
                </p>
              </div>
            </div>
          )}

          {/* Quick stats grid - dynamic based on what user holds */}
          <div className="grid grid-cols-4 gap-3 pt-1">
            {/* Always show weETH */}
            <QuickStat
              label="weETH"
              value={formatBalance(balances.weeth.balance)}
              icon={<Shield className="w-3 h-3" />}
            />
            {/* Show ETHFI if user has any */}
            {balances.ethfi.balance > 0n ? (
              <QuickStat
                label="ETHFI"
                value={formatBalance(balances.ethfi.balance)}
                valueColor="#F59E0B"
                icon={<Sparkles className="w-3 h-3" />}
              />
            ) : (
              <QuickStat
                label="Restaking"
                value={hasValidators ? "Active" : "—"}
                valueColor={hasValidators ? "#22C55E" : undefined}
                icon={<Zap className="w-3 h-3" />}
              />
            )}
            {/* Show eBTC if user has any, else validators */}
            {balances.ebtc.balance > 0n ? (
              <QuickStat
                label="eBTC"
                value={formatBtcBalance(balances.ebtc.balance)}
                valueColor="#F7931A"
                icon={<Shield className="w-3 h-3" />}
              />
            ) : hasValidators ? (
              <QuickStat
                label="Validators"
                value={validatorCount.toString()}
                icon={<Shield className="w-3 h-3" />}
              />
            ) : (
              <QuickStat
                label="eETH"
                value={formatBalance(balances.eeth.balance)}
                icon={<Shield className="w-3 h-3" />}
              />
            )}
            {/* APY */}
            <QuickStat
              label="APY"
              value={apy > 0 ? `${apy.toFixed(1)}%` : "—"}
              valueColor="#22C55E"
              icon={<TrendingUp className="w-3 h-3" />}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Quick stat display
 */
function QuickStat({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string;
  value: string;
  valueColor?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className="text-sm font-semibold tabular-nums truncate"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Empty state with CTA to stake
 */
function EtherFiEmptyState({
  className,
  apy,
  walletAddress,
}: {
  className?: string;
  apy: number;
  walletAddress: string;
}) {
  const router = useRouter();

  return (
    <Card
      onClick={() => router.push(`/etherfi/${walletAddress}`)}
      className={cn(
        "group relative overflow-hidden cursor-pointer",
        "border-etherfi/20 hover:border-etherfi/40",
        "transition-all duration-300",
        "hover:shadow-[0_0_40px_rgba(115,92,255,0.15)]",
        className
      )}
    >
      {/* Background */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          background: `radial-gradient(ellipse at bottom left, ${ETHERFI_BRAND.primary}40, transparent 60%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 p-5 pb-3">
        <EtherFiLogo className="w-5 h-5" />
        <span className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
          Ether.Fi
        </span>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 space-y-4">
        <div>
          <h3 className="font-bold text-lg">Stake ETH. Earn More.</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Liquid restaking with EigenLayer rewards
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
            </span>
            <span>
              <span className="font-semibold text-emerald-400">
                {apy > 0 ? `${apy.toFixed(1)}%` : "~3%"}
              </span>{" "}
              APY on staked ETH
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
            </span>
            <span>Earn EigenLayer points</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Shield className="w-2.5 h-2.5 text-amber-400" />
            </span>
            <span>Unlock loyalty rewards</span>
          </li>
        </ul>

        {/* CTA */}
        <button
          className={cn(
            "w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white",
            "transition-all duration-300",
            "group-hover:shadow-[0_0_20px_rgba(115,92,255,0.3)]"
          )}
          style={{
            background: ETHERFI_BRAND.gradient,
          }}
        >
          <span className="flex items-center justify-center gap-2">
            Stake ETH
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
      </div>
    </Card>
  );
}

/**
 * Skeleton loader
 */
function EtherFiCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * EtherFi logo SVG
 */
function EtherFiLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ color: ETHERFI_BRAND.primary }}
    >
      <path
        d="M12 2L3 9.5L12 13L21 9.5L12 2Z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M3 14.5L12 22L21 14.5L12 17L3 14.5Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
      <path d="M3 9.5V14.5L12 17V13L3 9.5Z" fill="currentColor" />
      <path
        d="M21 9.5V14.5L12 17V13L21 9.5Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
    </svg>
  );
}

/**
 * Format token balance for display (18 decimals)
 */
function formatBalance(balance: bigint): string {
  if (balance === 0n) return "—";
  const formatted = formatEther(balance);
  const num = parseFloat(formatted);
  if (num < 0.001) return "<0.001";
  if (num < 1) return num.toFixed(4);
  if (num < 100) return num.toFixed(3);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Format eBTC balance for display (8 decimals)
 */
function formatBtcBalance(balance: bigint): string {
  if (balance === 0n) return "—";
  const num = Number(balance) / 1e8;
  if (num < 0.0001) return "<0.0001";
  if (num < 1) return num.toFixed(6);
  return num.toFixed(4);
}

/**
 * Format staked amount (from Graph account data)
 */
function formatStakedAmount(amountWei: bigint): string {
  if (amountWei === 0n) return "0";
  const num = parseFloat(formatEther(amountWei));
  if (num < 0.01) return "<0.01";
  if (num < 1) return num.toFixed(4);
  if (num < 100) return num.toFixed(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
