"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatEther } from "viem";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TierBadge } from "@/components/etherfi/tier-badge";
import { StakingPanel } from "@/components/etherfi/staking-panel";
import { useEtherFiUser, useEtherFiProtocol } from "@/hooks/use-etherfi";
import { useEtherFiBalances, useWeethExchangeRate, useEtherFiSupply } from "@/hooks/use-etherfi-staking";
import {
  ETHERFI_BRAND,
  ETHERFI_TIERS,
  VALIDATOR_PHASES,
  type EtherFiTier,
  type ValidatorPhase,
} from "@/lib/etherfi-constants";
import {
  ArrowLeft,
  ArrowUpRight,
  Sparkles,
  Zap,
  TrendingUp,
  Shield,
  Users,
  Activity,
  Gift,
  Clock,
  Copy,
  Check,
  Wallet,
  Flame,
  Crown,
  ChevronRight,
  ExternalLink,
  Trophy,
  Star,
  Gem,
  Target,
  ArrowRight,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  params: Promise<{ wallet: string }>;
}

export default function EtherFiWalletPage({ params }: Props) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);

  // Resolve params
  useEffect(() => {
    params.then((p) => {
      const wallet = p.wallet;
      if (/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        setWalletAddress(wallet);
      } else {
        router.replace("/etherfi");
      }
    });
  }, [params, router]);

  // Data hooks
  const user = useEtherFiUser(walletAddress || undefined);
  const balances = useEtherFiBalances(walletAddress || undefined);
  const protocol = useEtherFiProtocol();
  const exchangeRate = useWeethExchangeRate();
  const supply = useEtherFiSupply();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate total portfolio value
  const totalValue = useMemo(() => {
    if (balances.isLoading) return null;
    return calculateTotalValue(balances);
  }, [balances]);

  // Animate the value counter on load
  useEffect(() => {
    if (totalValue === null) return;
    const duration = 1500;
    const steps = 60;
    const increment = totalValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= totalValue) {
        setAnimatedValue(totalValue);
        clearInterval(timer);
      } else {
        setAnimatedValue(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [totalValue]);

  // Determine tier status
  const isPlatinum = user.tierName === "Platinum";
  const isMaxTier = isPlatinum;

  if (!mounted || !walletAddress) {
    return <PageSkeleton />;
  }

  const isOwnWallet = isConnected && address?.toLowerCase() === walletAddress.toLowerCase();
  const tierNumber = Object.entries(ETHERFI_TIERS).find(
    ([_, info]) => info.name === user.tierName
  )?.[0] ?? "0";
  const tierInfo = ETHERFI_TIERS[parseInt(tierNumber) as EtherFiTier];

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Get assets with balance for smart display
  const assetsWithBalance = getAssetsWithBalance(balances);
  const displayAssets = showAllAssets ? getAllAssets(balances) : assetsWithBalance;

  // Calculate projected yearly earnings
  const projectedYearlyEarnings = totalValue ? totalValue * (protocol.currentApy / 100) : 0;
  const projectedDailyEarnings = projectedYearlyEarnings / 365;

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f]">
      {/* Animated Background with Scan Lines */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[1000px] h-[1000px] rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: `radial-gradient(circle, ${ETHERFI_BRAND.primary} 0%, transparent 70%)` }} />
        <div className="absolute bottom-0 right-1/4 w-[800px] h-[800px] rounded-full opacity-[0.05] blur-[100px]"
          style={{ background: isPlatinum ? "radial-gradient(circle, #E5E4E2 0%, transparent 70%)" : `radial-gradient(circle, #22C55E 0%, transparent 70%)` }} />

        {/* Scan line effect */}
        <div className="scan-line" />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <Link
              href={`/dashboard/${walletAddress}`}
              className="group flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>

            <div className="flex items-center gap-4">
              <button
                onClick={copyAddress}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
              >
                <span className="font-mono text-xs text-zinc-400">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" />
                )}
              </button>

              <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                <EtherFiLogo className="w-5 h-5" />
                <span className="font-semibold text-sm tracking-tight">ether.fi</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Platinum Achievement Banner */}
      {isPlatinum && (
        <div className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          <div className="container py-3">
            <div className="flex items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Trophy className="w-5 h-5 text-[#E5E4E2]" />
                  <div className="absolute inset-0 animate-ping">
                    <Trophy className="w-5 h-5 text-[#E5E4E2] opacity-30" />
                  </div>
                </div>
                <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#E5E4E2] via-white to-[#E5E4E2] animate-shimmer-text">
                  PLATINUM ELITE ACHIEVED
                </span>
              </div>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400">Top 1% of EtherFi Stakers</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400 tabular-nums">{user.totalPoints.toLocaleString()} Lifetime Points</span>
            </div>
          </div>
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer-banner" />
        </div>
      )}

      {/* Hero Section */}
      <section className="relative py-8 md:py-12">
        <div className="container">
          <div className="grid lg:grid-cols-[1fr,320px] gap-8 items-start">
            {/* Left Column - Portfolio Value */}
            <div className="space-y-6">
              {/* Value Header */}
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                    Total Portfolio Value
                  </span>
                  {isOwnWallet && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Your Wallet
                    </span>
                  )}
                </div>

                {/* Animated Value */}
                <div className="relative">
                  {balances.isLoading ? (
                    <Skeleton className="h-20 w-80" />
                  ) : (
                    <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter">
                      <span className="relative">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-zinc-400">
                          {formatCurrency(animatedValue)}
                        </span>
                        {/* Glow effect */}
                        <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-zinc-400 blur-2xl opacity-30">
                          {formatCurrency(animatedValue)}
                        </span>
                      </span>
                    </h1>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6 pt-2">
                <StatPill
                  label="Daily Yield"
                  value={`+$${projectedDailyEarnings.toFixed(2)}`}
                  color="#22C55E"
                />
                <StatPill
                  label="APY"
                  value={`${protocol.currentApy.toFixed(2)}%`}
                  color="#22C55E"
                />
                <StatPill
                  label="Loyalty Points"
                  value={user.totalPoints.toLocaleString()}
                  icon={<Star className="w-3 h-3" />}
                />
              </div>

              {/* Achievement Badges */}
              <div className="flex flex-wrap gap-2 pt-2">
                {user.isEarlyAdopter && (
                  <AchievementBadge
                    icon={Sparkles}
                    label="Early Adopter"
                    description="Genesis Staker"
                    color="amber"
                  />
                )}
                {user.hasValidators && (
                  <AchievementBadge
                    icon={Shield}
                    label="Node Operator"
                    description={`${user.validators.total} Active`}
                    color="emerald"
                  />
                )}
                {user.validators.restakedCount > 0 && (
                  <AchievementBadge
                    icon={Zap}
                    label="EigenLayer"
                    description="Restaking Active"
                    color="blue"
                  />
                )}
              </div>
            </div>

            {/* Right Column - Tier Card */}
            <div className="relative">
              <TierCard
                tier={parseInt(tierNumber)}
                tierInfo={tierInfo}
                totalPoints={user.totalPoints}
                progress={user.progress}
                nextTier={user.nextTier}
                pointsToNextTier={user.pointsToNextTier}
                isPlatinum={isPlatinum}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <section className="container pb-12 space-y-6">
        {/* Primary Cards Row */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Holdings Card */}
          <div className="lg:col-span-3">
            <CyberCard>
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-[#735CFF]/20 to-[#735CFF]/5 border border-[#735CFF]/20">
                    <Wallet className="w-4 h-4 text-[#735CFF]" />
                  </div>
                  <h3 className="font-semibold">Portfolio Holdings</h3>
                </div>
                <button
                  onClick={() => setShowAllAssets(!showAllAssets)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  {showAllAssets ? "Hide Empty" : "Show All"}
                  {showAllAssets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <div className="p-5 space-y-1">
                {displayAssets.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-zinc-500">No positions yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Stake ETH to get started</p>
                  </div>
                ) : (
                  displayAssets.map((asset, i) => (
                    <AssetRow
                      key={asset.symbol}
                      {...asset}
                      index={i}
                    />
                  ))
                )}
              </div>

              {/* Projected Earnings Footer */}
              {totalValue && totalValue > 0 && (
                <div className="p-5 border-t border-white/5 bg-gradient-to-r from-emerald-500/5 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-zinc-400">Projected Annual Yield</span>
                    </div>
                    <span className="font-semibold text-emerald-400 tabular-nums">
                      +{formatCurrency(projectedYearlyEarnings)}/year
                    </span>
                  </div>
                </div>
              )}
            </CyberCard>
          </div>

          {/* Protocol Stats Card */}
          <div className="lg:col-span-2">
            <CyberCard className="h-full">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold">Protocol Stats</h3>
                </div>
                <a
                  href="https://app.ether.fi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  app.ether.fi
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-5 space-y-5">
                {/* TVL Highlight */}
                <div className="relative p-4 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#735CFF]/10 via-[#735CFF]/5 to-transparent" />
                  <div className="absolute inset-0 border border-[#735CFF]/20 rounded-xl" />
                  <div className="relative">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Value Locked</p>
                    <p className="text-3xl font-bold tracking-tight">{protocol.isLoading ? "—" : protocol.tvlUsd}</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Current APY" value={`${protocol.currentApy.toFixed(2)}%`} color="#22C55E" />
                  <MiniStat label="Validators" value={`~${formatCompact(protocol.activeValidators)}`} />
                  <MiniStat label="Stakers" value={`~${formatCompact(protocol.totalStakers)}`} />
                  <MiniStat label="weETH Rate" value={exchangeRate.rateFormatted} suffix="eETH" />
                </div>

                {/* Supply Visualization */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Token Supply</p>
                  <SupplyBar
                    label="eETH"
                    value={supply.isLoading ? 0 : parseFloat(formatEther(supply.eethSupply))}
                    color="#735CFF"
                  />
                  <SupplyBar
                    label="weETH"
                    value={supply.isLoading ? 0 : parseFloat(formatEther(supply.weethSupply))}
                    color="#5B3FD9"
                  />
                </div>
              </div>
            </CyberCard>
          </div>
        </div>

        {/* Stake More CTA Card */}
        <StakeMoreCard
          currentApy={protocol.currentApy}
          ethBalance={balances.eth.balance}
          isLoading={balances.isLoading}
        />

        {/* Staking Panel */}
        <StakingPanel walletAddress={walletAddress} />

        {/* Additional Cards Row */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {user.hasReferrals && (
            <CyberCard>
              <div className="flex items-center gap-3 p-5 border-b border-white/5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20">
                  <Gift className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="font-semibold">Referral Program</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Referred Stake</p>
                    <p className="text-2xl font-bold">{user.referrals?.totalStaked ?? "0"} ETH</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Points Earned</p>
                    <p className="text-lg font-semibold text-[#735CFF]">
                      {user.referrals?.points.toLocaleString() ?? 0}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://app.ether.fi/ref/${walletAddress}`);
                    toast.success("Referral link copied!");
                  }}
                  className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Referral Link
                </button>
              </div>
            </CyberCard>
          )}

          {user.hasValidators && (
            <CyberCard>
              <div className="flex items-center gap-3 p-5 border-b border-white/5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="font-semibold">Validators</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Total Active</span>
                  <span className="text-2xl font-bold">{user.validators.total}</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(user.validators.byPhase).map(([phase, count]) => {
                    const phaseInfo = VALIDATOR_PHASES[phase as ValidatorPhase];
                    if (!phaseInfo || count === 0) return null;
                    return (
                      <div key={phase} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: phaseInfo.color }} />
                          <span className="text-zinc-400">{phaseInfo.label}</span>
                        </div>
                        <span className="font-medium tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
                {user.validators.restakedCount > 0 && (
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-sm">
                    <span className="text-zinc-500">EigenLayer Restaked</span>
                    <span className="font-medium text-emerald-400">
                      {user.validators.restakedCount} / {user.validators.total}
                    </span>
                  </div>
                )}
              </div>
            </CyberCard>
          )}

          {user.hasPendingWithdrawals && (
            <CyberCard>
              <div className="flex items-center gap-3 p-5 border-b border-white/5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/20">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="font-semibold">Pending Withdrawals</h3>
              </div>
              <div className="p-5 space-y-3">
                {user.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div>
                      <p className="font-medium tabular-nums">{w.amountEeth} eETH</p>
                      <p className="text-xs text-zinc-500">#{w.id.slice(-6)}</p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Processing
                    </span>
                  </div>
                ))}
              </div>
            </CyberCard>
          )}
        </div>
      </section>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes scan-line {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }

        @keyframes shimmer-text {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes shimmer-banner {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes border-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100px;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(115, 92, 255, 0.03) 50%,
            transparent 100%
          );
          animation: scan-line 8s linear infinite;
          pointer-events: none;
        }

        .animate-shimmer-text {
          background-size: 200% auto;
          animation: shimmer-text 3s ease-in-out infinite;
        }

        .animate-shimmer-banner {
          animation: shimmer-banner 3s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .cyber-border {
          position: relative;
        }

        .cyber-border::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: inherit;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,0.1) 0%,
            rgba(255,255,255,0.05) 50%,
            rgba(255,255,255,0.1) 100%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// TIER CARD COMPONENT
// ============================================================================

function TierCard({
  tier,
  tierInfo,
  totalPoints,
  progress,
  nextTier,
  pointsToNextTier,
  isPlatinum,
}: {
  tier: number;
  tierInfo: { name: string; color: string; glowColor: string; bgGradient: string; minPoints: number };
  totalPoints: number;
  progress: number;
  nextTier: string | null;
  pointsToNextTier: number | null;
  isPlatinum: boolean;
}) {
  return (
    <div className={cn(
      "relative rounded-2xl overflow-hidden",
      isPlatinum && "animate-float"
    )}>
      {/* Holographic background for Platinum */}
      {isPlatinum && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#E5E4E2]/10 via-[#735CFF]/5 to-[#E5E4E2]/10" />
      )}

      {/* Main card */}
      <div className={cn(
        "relative p-6 rounded-2xl border",
        isPlatinum
          ? "border-[#E5E4E2]/30 bg-gradient-to-br from-[#1a1a24] to-[#12121a]"
          : "border-white/10 bg-[#12121a]"
      )}>
        {/* Platinum shimmer overlay */}
        {isPlatinum && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer-banner rounded-2xl" />
        )}

        <div className="relative space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Loyalty Tier</p>
              <h4 className={cn(
                "text-2xl font-bold tracking-tight",
                isPlatinum && "text-transparent bg-clip-text bg-gradient-to-r from-[#E5E4E2] via-white to-[#E5E4E2]"
              )} style={!isPlatinum ? { color: tierInfo.color } : undefined}>
                {tierInfo.name}
              </h4>
            </div>

            {/* Tier Badge */}
            <div className="relative">
              {isPlatinum && (
                <div className="absolute inset-0 blur-xl opacity-50" style={{ background: tierInfo.glowColor }} />
              )}
              <TierBadge tier={tier} size="lg" showLabel={false} animated />
            </div>
          </div>

          {/* Points */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{totalPoints.toLocaleString()}</span>
              <span className="text-zinc-500 text-sm">points</span>
            </div>

            {/* Progress bar */}
            {nextTier && pointsToNextTier ? (
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{
                      width: `${Math.min(100, progress)}%`,
                      background: tierInfo.bgGradient,
                    }}
                  >
                    {/* Animated shine */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer-banner" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-white">{pointsToNextTier.toLocaleString()}</span> points to {nextTier}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <Trophy className="w-4 h-4 text-[#E5E4E2]" />
                <span className="text-sm text-[#E5E4E2] font-medium">Maximum Tier Achieved</span>
              </div>
            )}
          </div>

          {/* Tier benefits preview */}
          <div className="pt-4 border-t border-white/5 space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Benefits</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 rounded text-xs bg-white/5 text-zinc-400">Priority Airdrops</span>
              <span className="px-2 py-1 rounded text-xs bg-white/5 text-zinc-400">Bonus Rewards</span>
              {isPlatinum && (
                <span className="px-2 py-1 rounded text-xs bg-[#735CFF]/10 text-[#735CFF] border border-[#735CFF]/20">VIP Access</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CYBER CARD COMPONENT
// ============================================================================

function CyberCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "relative rounded-xl bg-[#12121a] border border-white/5",
      "hover:border-white/10 transition-all duration-300",
      "overflow-hidden group",
      className
    )}>
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-[#735CFF]/30 rounded-tl-xl" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#735CFF]/30 rounded-tr-xl" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[#735CFF]/30 rounded-bl-xl" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-[#735CFF]/30 rounded-br-xl" />

      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#735CFF]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">{children}</div>
    </div>
  );
}

// ============================================================================
// STAKE MORE CTA CARD
// ============================================================================

function StakeMoreCard({
  currentApy,
  ethBalance,
  isLoading,
}: {
  currentApy: number;
  ethBalance: bigint;
  isLoading: boolean;
}) {
  const ethNum = parseFloat(formatEther(ethBalance));
  const hasEth = ethNum > 0.01;
  const projectedYearly = ethNum * 3300 * (currentApy / 100);
  const projectedMonthly = projectedYearly / 12;

  if (!hasEth) return null;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Animated gradient border */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#735CFF] via-[#22C55E] to-[#735CFF] animate-border-flow opacity-20"
        style={{ backgroundSize: "200% 100%", animation: "border-flow 3s linear infinite" }} />

      <div className="relative m-[1px] p-6 rounded-xl bg-[#12121a]">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#735CFF]" />
              <h3 className="font-semibold">Stake Your Available ETH</h3>
            </div>
            <p className="text-sm text-zinc-400">
              You have <span className="font-medium text-white">{ethNum.toFixed(4)} ETH</span> available to stake
            </p>
          </div>

          <div className="hidden sm:block text-right">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Projected Monthly</p>
            <p className="text-2xl font-bold text-emerald-400">+${projectedMonthly.toFixed(2)}</p>
          </div>

          <Link
            href="#staking-panel"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all"
            style={{
              background: ETHERFI_BRAND.gradient,
              boxShadow: `0 0 20px ${ETHERFI_BRAND.primaryGlow}`,
            }}
          >
            <Play className="w-4 h-4" />
            Stake Now
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ASSET ROW COMPONENT
// ============================================================================

interface AssetData {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  color: string;
  category: string;
}

function AssetRow({ symbol, name, balance, usdValue, color, category, index }: AssetData & { index: number }) {
  const hasBalance = balance > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 px-3 -mx-3 rounded-lg transition-all",
        hasBalance ? "hover:bg-white/5" : "opacity-40"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs text-white",
            !hasBalance && "opacity-50"
          )}
          style={{ background: hasBalance ? color : `${color}40` }}
        >
          {symbol.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="font-medium">{symbol}</span>
          <p className="text-xs text-zinc-500">{name}</p>
        </div>
      </div>
      <div className="text-right">
        <span className={cn("font-semibold tabular-nums", !hasBalance && "text-zinc-600")}>
          {formatTokenDisplay(balance)}
        </span>
        {usdValue > 0 && (
          <p className="text-xs text-zinc-500">${formatCompact(usdValue)}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

function StatPill({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/5">
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="font-semibold tabular-nums flex items-center gap-1.5" style={color ? { color } : undefined}>
          {icon}
          {value}
        </p>
      </div>
    </div>
  );
}

function AchievementBadge({
  icon: Icon,
  label,
  description,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: "amber" | "emerald" | "blue" | "purple";
}) {
  const colors = {
    amber: { bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30", text: "text-amber-400" },
    emerald: { bg: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-400" },
    blue: { bg: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/30", text: "text-blue-400" },
    purple: { bg: "from-[#735CFF]/20 to-[#735CFF]/5", border: "border-[#735CFF]/30", text: "text-[#735CFF]" },
  };
  const c = colors[color];

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border",
      `bg-gradient-to-r ${c.bg}`,
      c.border
    )}>
      <Icon className={cn("w-4 h-4", c.text)} />
      <div>
        <p className={cn("text-xs font-semibold", c.text)}>{label}</p>
        <p className="text-[10px] text-zinc-500">{description}</p>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: string;
  color?: string;
  suffix?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
        {suffix && <span className="text-xs text-zinc-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function SupplyBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const maxValue = 4000000; // 4M max for visualization
  const percentage = Math.min(100, (value / maxValue) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="font-medium tabular-nums">{formatCompact(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 relative"
          style={{ width: `${percentage}%`, background: color }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="border-b border-white/5 bg-[#0a0a0f]/80">
        <div className="container py-3">
          <Skeleton className="h-6 w-32 bg-white/5" />
        </div>
      </div>
      <div className="container py-12">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-20 w-80 bg-white/5" />
          <div className="flex gap-4">
            <Skeleton className="h-12 w-32 bg-white/5" />
            <Skeleton className="h-12 w-32 bg-white/5" />
            <Skeleton className="h-12 w-32 bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EtherFiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L3 9.5L12 13L21 9.5L12 2Z" fill="#735CFF" fillOpacity="0.9" />
      <path d="M3 14.5L12 22L21 14.5L12 17L3 14.5Z" fill="#735CFF" fillOpacity="0.6" />
      <path d="M3 9.5V14.5L12 17V13L3 9.5Z" fill="#735CFF" />
      <path d="M21 9.5V14.5L12 17V13L21 9.5Z" fill="#735CFF" fillOpacity="0.75" />
    </svg>
  );
}

// ============================================================================
// DATA HELPERS
// ============================================================================

interface BalancesForCalc {
  eth: { balance: bigint };
  eeth: { balance: bigint };
  weeth: { balance: bigint };
  ethfi: { balance: bigint };
  sethfi: { balance: bigint };
  ebtc: { balance: bigint };
  vaultEth: { shares: bigint; assetValue: bigint };
  vaultUsd: { shares: bigint; assetValue: bigint };
}

function getAssetsWithBalance(balances: BalancesForCalc): AssetData[] {
  const assets = getAllAssets(balances);
  return assets.filter(a => a.balance > 0.0001);
}

function getAllAssets(balances: BalancesForCalc): AssetData[] {
  const ethPrice = 3300;
  const ethfiPrice = 2.5;
  const btcPrice = 95000;

  return [
    {
      symbol: "eETH",
      name: "Liquid Staked ETH",
      balance: parseFloat(formatEther(balances.eeth.balance)),
      usdValue: parseFloat(formatEther(balances.eeth.balance)) * ethPrice,
      color: "#735CFF",
      category: "Staking",
    },
    {
      symbol: "weETH",
      name: "Wrapped eETH",
      balance: parseFloat(formatEther(balances.weeth.balance)),
      usdValue: parseFloat(formatEther(balances.weeth.balance)) * ethPrice * 1.05,
      color: "#5B3FD9",
      category: "Staking",
    },
    {
      symbol: "ETHFI",
      name: "EtherFi Token",
      balance: parseFloat(formatEther(balances.ethfi.balance)),
      usdValue: parseFloat(formatEther(balances.ethfi.balance)) * ethfiPrice,
      color: "#F59E0B",
      category: "Governance",
    },
    {
      symbol: "sETHFI",
      name: "Staked ETHFI",
      balance: parseFloat(formatEther(balances.sethfi.balance)),
      usdValue: parseFloat(formatEther(balances.sethfi.balance)) * ethfiPrice,
      color: "#EAB308",
      category: "Governance",
    },
    {
      symbol: "eBTC",
      name: "EtherFi BTC",
      balance: Number(balances.ebtc.balance) / 1e8,
      usdValue: (Number(balances.ebtc.balance) / 1e8) * btcPrice,
      color: "#F7931A",
      category: "Bitcoin",
    },
    {
      symbol: "ETH Vault",
      name: "Liquid ETH Vault",
      balance: parseFloat(formatEther(balances.vaultEth.assetValue)),
      usdValue: parseFloat(formatEther(balances.vaultEth.assetValue)) * ethPrice,
      color: "#22C55E",
      category: "Vaults",
    },
    {
      symbol: "USD Vault",
      name: "Liquid USD Vault",
      balance: Number(balances.vaultUsd.assetValue) / 1e6,
      usdValue: Number(balances.vaultUsd.assetValue) / 1e6,
      color: "#3B82F6",
      category: "Vaults",
    },
    {
      symbol: "ETH",
      name: "Available ETH",
      balance: parseFloat(formatEther(balances.eth.balance)),
      usdValue: parseFloat(formatEther(balances.eth.balance)) * ethPrice,
      color: "#627EEA",
      category: "Available",
    },
  ];
}

function calculateTotalValue(balances: BalancesForCalc): number {
  const ethPrice = 3300;
  const ethfiPrice = 2.5;
  const btcPrice = 95000;

  const ethNum = parseFloat(formatEther(balances.eth.balance));
  const eethNum = parseFloat(formatEther(balances.eeth.balance));
  const weethNum = parseFloat(formatEther(balances.weeth.balance));
  const vaultEthNum = parseFloat(formatEther(balances.vaultEth.assetValue));
  const ethfiNum = parseFloat(formatEther(balances.ethfi.balance));
  const sethfiNum = parseFloat(formatEther(balances.sethfi.balance));
  const ebtcNum = Number(balances.ebtc.balance) / 1e8;
  const vaultUsdNum = Number(balances.vaultUsd.assetValue) / 1e6;

  return (
    (ethNum + eethNum + weethNum * 1.05 + vaultEthNum) * ethPrice +
    (ethfiNum + sethfiNum) * ethfiPrice +
    ebtcNum * btcPrice +
    vaultUsdNum
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatTokenDisplay(num: number): string {
  if (num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(4);
  return "<0.0001";
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
