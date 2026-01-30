"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Layers, Wallet, TrendingUp, Coins, ArrowRightLeft, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { ConnectButton } from "@/components/wallet/connect-button";
import { WEETH_CHAINS } from "@/lib/analytics/types";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { ETHERFI_BRAND } from "@/lib/etherfi-constants";
import { formatAddress } from "@/lib/utils";

// Extended chain info to include Scroll (not in main CHAIN_INFO)
const EXTENDED_CHAIN_INFO: Record<number, { name: string; shortName: string; color: string }> = {
  1: { name: "Ethereum", shortName: "ETH", color: "#627EEA" },
  42161: { name: "Arbitrum", shortName: "ARB", color: "#28A0F0" },
  10: { name: "Optimism", shortName: "OP", color: "#FF0420" },
  8453: { name: "Base", shortName: "BASE", color: "#0052FF" },
  534352: { name: "Scroll", shortName: "SCROLL", color: "#FFEEDA" },
};

// Format USD values with smart abbreviation
function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Format token amount with appropriate precision
function formatTokenAmount(value: number, decimals = 4): string {
  if (value === 0) return "0";
  if (value < 0.0001) return "<0.0001";
  if (value < 1) return value.toFixed(decimals);
  if (value < 1000) return value.toFixed(3);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Format percentage
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-6">
      {/* Total Holdings Card Skeleton */}
      <Card className="overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-8 w-24 mx-auto mb-2" />
                <Skeleton className="h-4 w-20 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chain Distribution Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

// Not Connected State
function NotConnectedState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${ETHERFI_BRAND.primary}15` }}
        >
          <Wallet className="w-10 h-10" style={{ color: ETHERFI_BRAND.primary }} />
        </div>
        <h3 className="text-xl font-semibold mb-3">Connect Your Wallet</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Connect your wallet to view your weETH holdings across Ethereum, Arbitrum, Base, Optimism, and Scroll.
        </p>
        <ConnectButton />
      </CardContent>
    </Card>
  );
}

// Empty Holdings State
function EmptyHoldingsState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: `${ETHERFI_BRAND.primary}15` }}
        >
          <Coins className="w-10 h-10" style={{ color: ETHERFI_BRAND.primary }} />
        </div>
        <h3 className="text-xl font-semibold mb-3">No weETH Found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          No weETH found across supported chains. Start staking with EtherFi to earn yield on your ETH.
        </p>
      </CardContent>
    </Card>
  );
}

// Error State
function ErrorState({ error }: { error: string }) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <Globe className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-3">Error Loading Analytics</h3>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
      </CardContent>
    </Card>
  );
}

// Chain Distribution Bar
function ChainDistributionBar({
  distribution,
}: {
  distribution: Array<{ chainId: number; chainName: string; percentage: number; valueUsd: number }>;
}) {
  if (distribution.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Visual Bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-secondary/50">
        {distribution.map((chain, idx) => {
          const chainInfo = EXTENDED_CHAIN_INFO[chain.chainId];
          return (
            <div
              key={chain.chainId}
              className="h-full transition-all duration-500"
              style={{
                width: `${chain.percentage}%`,
                backgroundColor: chainInfo?.color || "#666",
                marginLeft: idx > 0 ? "2px" : "0",
              }}
              title={`${chain.chainName}: ${formatPercent(chain.percentage)}`}
              aria-label={`${chain.chainName}: ${formatPercent(chain.percentage)} of holdings`}
              role="img"
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {distribution.map((chain) => {
          const chainInfo = EXTENDED_CHAIN_INFO[chain.chainId];
          return (
            <div key={chain.chainId} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: chainInfo?.color || "#666" }}
              />
              <span className="text-sm text-muted-foreground">
                {chain.chainName} ({formatPercent(chain.percentage)})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Total Holdings Summary Card
function TotalHoldingsCard({
  totalWeethBalance,
  totalWeethValueUsd,
  totalUnderlyingEth,
  weightedAverageApy,
  holdings,
}: {
  totalWeethBalance: number;
  totalWeethValueUsd: number;
  totalUnderlyingEth: number;
  weightedAverageApy: number;
  holdings: Array<{ weethToEthRate: number }>;
}) {
  // Get exchange rate from first holding (same across all chains)
  const exchangeRate = holdings.length > 0 ? holdings[0].weethToEthRate : 1;

  return (
    <Card
      className="overflow-hidden border-2"
      style={{ borderColor: `${ETHERFI_BRAND.primary}30` }}
    >
      {/* Gradient header accent */}
      <div
        className="h-1"
        style={{ background: ETHERFI_BRAND.gradient }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: ETHERFI_BRAND.gradient }}
          >
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Total weETH Holdings</CardTitle>
            <CardDescription>Aggregated across all chains</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {/* Total weETH */}
          <div className="text-center">
            <div className="text-3xl font-bold font-mono" style={{ color: ETHERFI_BRAND.primary }}>
              {formatTokenAmount(totalWeethBalance)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">weETH Balance</div>
          </div>

          {/* USD Value */}
          <div className="text-center">
            <div className="text-3xl font-bold font-mono">{formatUsd(totalWeethValueUsd)}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Value</div>
          </div>

          {/* Underlying ETH */}
          <div className="text-center">
            <div className="text-3xl font-bold font-mono">{formatTokenAmount(totalUnderlyingEth)}</div>
            <div className="text-sm text-muted-foreground mt-1">Underlying ETH</div>
          </div>

          {/* Exchange Rate */}
          <div className="text-center">
            <div className="text-3xl font-bold font-mono">{exchangeRate.toFixed(4)}</div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              weETH/ETH Rate
            </div>
          </div>

          {/* APY */}
          <div className="text-center">
            <div className="text-3xl font-bold font-mono text-green-500">
              {weightedAverageApy > 0 ? `${weightedAverageApy.toFixed(2)}%` : "--"}
            </div>
            <div className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3" />
              EtherFi APY
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Per-Chain Holding Card
function ChainHoldingCard({
  chainId,
  chainName,
  weethBalanceFormatted,
  weethValueUsd,
  percentage,
  underlyingEthAmount,
  apy,
}: {
  chainId: number;
  chainName: string;
  weethBalanceFormatted: number;
  weethValueUsd: number;
  percentage: number;
  underlyingEthAmount: number;
  apy?: number;
}) {
  const chainInfo = EXTENDED_CHAIN_INFO[chainId];

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: chainInfo?.color || "#666" }}
            >
              {chainInfo?.shortName.slice(0, 2) || "?"}
            </div>
            <div>
              <CardTitle className="text-lg">{chainName}</CardTitle>
              <CardDescription className="text-xs">
                {formatPercent(percentage)} of total
              </CardDescription>
            </div>
          </div>
          {apy && apy > 0 && (
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                <TrendingUp className="w-3 h-3" />
                {apy.toFixed(2)}% APY
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xl font-bold font-mono">{formatTokenAmount(weethBalanceFormatted)}</div>
            <div className="text-xs text-muted-foreground">weETH</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono">{formatUsd(weethValueUsd)}</div>
            <div className="text-xs text-muted-foreground">USD Value</div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono">{formatTokenAmount(underlyingEthAmount)}</div>
            <div className="text-xs text-muted-foreground">ETH Equivalent</div>
          </div>
        </div>

        {/* Visual percentage bar */}
        <div className="mt-4">
          <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${percentage}%`,
                backgroundColor: chainInfo?.color || "#666",
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Page Component
export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: analytics,
    isLoading,
    error,
  } = trpc.analytics.getWeETHAnalytics.useQuery(
    { walletAddress: address ?? "" },
    { enabled: !!address && isConnected }
  );

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="container py-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-80 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <LoadingState />
      </div>
    );
  }

  const hasHoldings = analytics && analytics.holdings.length > 0;

  // Memoize sorted holdings to avoid sorting on every render
  const sortedHoldings = useMemo(() => {
    if (!analytics?.holdings) return [];
    return [...analytics.holdings].sort((a, b) => b.weethValueUsd - a.weethValueUsd);
  }, [analytics?.holdings]);

  return (
    <div className="container py-8">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full blur-3xl opacity-10"
          style={{ background: ETHERFI_BRAND.gradient }}
        />
        <div
          className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-5"
          style={{ background: ETHERFI_BRAND.gradient }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: ETHERFI_BRAND.gradient }}
            >
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">weETH Cross-Chain Analytics</h1>
              <p className="text-muted-foreground">
                {isConnected && address
                  ? `Tracking holdings for ${formatAddress(address)}`
                  : "Connect your wallet to view your weETH holdings"}
              </p>
            </div>
          </div>
        </div>

        {/* Supported Chains Badge */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border text-sm text-muted-foreground">
            <span>Supported Chains:</span>
            <div className="flex items-center gap-1">
              {WEETH_CHAINS.map((chain) => {
                const chainInfo = EXTENDED_CHAIN_INFO[chain.chainId];
                return (
                  <div
                    key={chain.chainId}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: chainInfo?.color || "#666" }}
                    title={chain.name}
                  >
                    {chainInfo?.shortName.slice(0, 1) || "?"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        {!isConnected ? (
          <NotConnectedState />
        ) : isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error?.message ?? "Failed to load analytics"} />
        ) : !hasHoldings ? (
          <EmptyHoldingsState />
        ) : (
          <div className="space-y-8">
            {/* Total Holdings Card */}
            <TotalHoldingsCard
              totalWeethBalance={analytics.totalWeethBalance}
              totalWeethValueUsd={analytics.totalWeethValueUsd}
              totalUnderlyingEth={analytics.totalUnderlyingEth}
              weightedAverageApy={analytics.weightedAverageApy}
              holdings={analytics.holdings}
            />

            {/* Chain Distribution */}
            {analytics.chainDistribution.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Chain Distribution</CardTitle>
                  <CardDescription>
                    Your weETH is distributed across {analytics.chainDistribution.length} chains
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChainDistributionBar distribution={analytics.chainDistribution} />
                </CardContent>
              </Card>
            )}

            {/* Per-Chain Holdings */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Holdings by Chain</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedHoldings.map((holding) => {
                  const distribution = analytics.chainDistribution.find(
                    (d) => d.chainId === holding.chainId
                  );
                  return (
                    <ChainHoldingCard
                      key={holding.chainId}
                      chainId={holding.chainId}
                      chainName={holding.chainName}
                      weethBalanceFormatted={holding.weethBalanceFormatted}
                      weethValueUsd={holding.weethValueUsd}
                      percentage={distribution?.percentage ?? 0}
                      underlyingEthAmount={holding.underlyingEthAmount}
                      apy={holding.apy}
                    />
                  );
                })}
              </div>
            </div>

            {/* Best Yield Info */}
            {analytics.bestYieldChain && (
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Best Yield Available</p>
                      <p className="font-semibold">
                        {analytics.bestYieldChain.apy.toFixed(2)}% APY on {analytics.bestYieldChain.chainName}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
