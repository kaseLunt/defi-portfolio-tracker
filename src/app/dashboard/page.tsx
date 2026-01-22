"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  TrendingUp,
  Wallet,
  Activity,
  Layers,
  RefreshCw,
  Search,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Zap,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { LoadingOrchestrator } from "@/components/shared/loading-orchestrator";
import {
  HeroSkeleton,
  StatCardsSkeleton,
  ChartSkeleton,
  DashboardSkeleton,
} from "@/components/shared/dashboard-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUSD, formatPercent } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { useFastPortfolio } from "@/hooks/use-portfolio-fast";
import { usePortfolioHistory } from "@/hooks/use-portfolio-history";
import { PositionList } from "@/components/portfolio/position-card";
import { TokenHoldings } from "@/components/portfolio/token-holdings";
import { PositionDetailSheet } from "@/components/portfolio/position-detail-sheet";
import type { HistoricalTimeframe } from "@/server/services/historical/types";
import { ChainDot } from "@/components/shared/chain-badge";
import { ValueChart } from "@/components/portfolio/value-chart";
import { QueryErrorDisplay } from "@/components/shared/error-boundary";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { useLivePrices } from "@/hooks/use-live-prices";

// Demo wallet for testing - Ether.fi wallet with weETH
const DEMO_WALLET = "0x521c25254245bA6eE9F00825789687703E548774";

// Premium stat card with glow effects
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  trend,
  accent = "default",
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  loading?: boolean;
  trend?: "up" | "down" | "neutral";
  accent?: "default" | "success" | "warning";
  delay?: number;
}) {
  const accentColors = {
    default: "from-primary/20 to-primary/5 text-primary",
    success: "from-emerald-500/20 to-emerald-500/5 text-emerald-400",
    warning: "from-amber-500/20 to-amber-500/5 text-amber-400",
  };

  return (
    <div
      className="animate-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Card className="group relative overflow-hidden hover-lift card-glow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div
            className={`h-9 w-9 rounded-xl bg-gradient-to-br ${accentColors[accent]} flex items-center justify-center transition-transform group-hover:scale-110`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
              <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
          ) : (
            <>
              <div className="text-2xl font-semibold tracking-tight tabular-nums font-display">
                {value}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
            </>
          )}
        </CardContent>
        {/* Accent line */}
        <div
          className={`absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent ${
            accent === "success"
              ? "via-emerald-500/50"
              : accent === "warning"
                ? "via-amber-500/50"
                : "via-primary/30"
          } to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
        />
      </Card>
    </div>
  );
}

// Hero section with total value
function PortfolioHero({
  totalValue,
  change24h,
  changePercent,
  isLoading,
  walletAddress,
  onCopy,
  copied,
  isConnected,
}: {
  totalValue: number;
  change24h: number;
  changePercent: number;
  isLoading: boolean;
  walletAddress: string;
  onCopy: () => void;
  copied: boolean;
  isConnected: boolean;
}) {
  const isPositive = change24h >= 0;

  return (
    <div className="relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative container py-12 md:py-16">
        <div className="animate-in" style={{ animationDelay: "0ms" }}>
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border">
              <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-glow" />
              <span className="text-xs font-medium text-muted-foreground">
                Live Portfolio
              </span>
            </div>
            {!isConnected && (
              <button
                onClick={onCopy}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 hover:bg-secondary border border-border text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          {/* Main value */}
          <div className="space-y-2">
            <h1 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              Total Portfolio Value
            </h1>
            {isLoading ? (
              <div className="h-16 flex items-center">
                <div className="h-8 w-64 rounded-lg shimmer" />
              </div>
            ) : (
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="text-5xl md:text-6xl font-bold tracking-tight font-display text-gradient">
                  {formatUSD(totalValue)}
                </span>
                {changePercent !== 0 && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      isPositive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    <ArrowUpRight
                      className={`h-4 w-4 ${!isPositive ? "rotate-90" : ""}`}
                    />
                    <span className="tabular-nums">
                      {isPositive ? "+" : ""}
                      {changePercent.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const [customWallet, setCustomWallet] = useState("");
  const [searchWallet, setSearchWallet] = useState("");
  const [historyTimeframe, setHistoryTimeframe] =
    useState<HistoricalTimeframe>("7d");
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<{
    protocol: string;
    chainId: SupportedChainId;
    positionType: string;
    tokenSymbol: string;
    balance: number;
    balanceUsd: number;
    apy?: number;
  } | null>(null);
  const prevFetchingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to 7d when wallet changes for faster initial load
  const prevWalletRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevWalletRef.current !== undefined && prevWalletRef.current !== searchWallet) {
      setHistoryTimeframe("7d");
    }
    prevWalletRef.current = searchWallet;
  }, [searchWallet]);

  const walletToView = mounted
    ? searchWallet || (isConnected ? address : undefined) || DEMO_WALLET
    : DEMO_WALLET;

  const showConnectedUI = mounted && isConnected && !searchWallet;

  const {
    tokenBalances,
    tokenTotalUsd,
    tokensLoading,
    tokensFetching,
    tokensStale,
    tokensError,
    positions,
    defiTotalUsd,
    defiLoading,
    byProtocol,
    totalValue,
    byChain,
    avgApy,
    yield24h,
    isLoading,
    isFetching,
    refetch,
  } = useFastPortfolio(walletToView);

  const {
    dataPoints: historyDataPoints,
    isLoading: historyLoading,
    progress: historyProgress,
    tokenPriceHistory,
  } = usePortfolioHistory(walletToView, historyTimeframe, {
    currentValue: totalValue,
  });

  // Live price updates
  const { isConnected: livePricesConnected } = useLivePrices();

  // Calculate 24h change from history
  const firstValue = historyDataPoints?.[0]?.totalUsd ?? totalValue;
  const change24h = totalValue - firstValue;
  const changePercent = firstValue > 0 ? (change24h / firstValue) * 100 : 0;

  // Toast when refresh completes
  useEffect(() => {
    if (prevFetchingRef.current && !isFetching && !isLoading) {
      toast.success("Portfolio refreshed", {
        description: `${tokenBalances.length} tokens \u2022 ${positions.length} positions`,
      });
    }
    prevFetchingRef.current = isFetching;
  }, [isFetching, isLoading, tokenBalances.length, positions.length]);

  // Toast on error
  useEffect(() => {
    if (tokensError) {
      toast.error("Failed to load portfolio", {
        description: tokensError.message || "Please try again",
      });
    }
  }, [tokensError]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWallet && /^0x[a-fA-F0-9]{40}$/.test(customWallet)) {
      setSearchWallet(customWallet);
      toast.success("Viewing portfolio", {
        description: `${customWallet.slice(0, 6)}...${customWallet.slice(-4)}`,
      });
    } else if (customWallet) {
      toast.error("Invalid address", {
        description: "Please enter a valid Ethereum address (0x...)",
      });
    }
  };

  const copyAddress = async () => {
    if (!walletToView) return;
    try {
      await navigator.clipboard.writeText(walletToView);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const uniqueChains = new Set(tokenBalances.map((t) => t.chainId));
  const uniqueProtocols = new Set(positions.map((p) => p.protocol));

  return (
    <div className="min-h-screen pb-16">
      {/* Hero Section */}
      <PortfolioHero
        totalValue={totalValue}
        change24h={change24h}
        changePercent={changePercent}
        isLoading={tokensLoading}
        walletAddress={walletToView}
        onCopy={copyAddress}
        copied={copied}
        isConnected={showConnectedUI}
      />

      <div className="container space-y-8">
        {/* Controls Bar */}
        <div
          className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between animate-in"
          style={{ animationDelay: "50ms" }}
        >
          {/* Wallet Search */}
          {!showConnectedUI && (
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Enter wallet address (0x...)"
                  value={customWallet}
                  onChange={(e) => setCustomWallet(e.target.value)}
                  className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card/50 text-sm focus:outline-none focus:border-primary focus:bg-card transition-all font-mono"
                />
              </div>
              <Button type="submit" className="shrink-0">
                View
              </Button>
            </form>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <LiveIndicator isConnected={livePricesConnected} />
            {(tokensStale || isFetching) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing...
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Loading State - Premium Experience */}
        {tokensLoading && (
          <LoadingOrchestrator
            progress={historyProgress?.percent ?? 0}
            stage={historyProgress?.stage}
            status={historyProgress?.status}
            processedChains={historyProgress?.processedChains}
            totalChains={historyProgress?.totalChains}
            tokensLoaded={!tokensLoading}
            defiLoaded={!defiLoading}
            historyLoaded={!historyLoading}
          />
        )}

        {/* Error State */}
        {tokensError && (
          <div className="animate-in" style={{ animationDelay: "100ms" }}>
            <QueryErrorDisplay
              error={tokensError}
              isError={!!tokensError}
              refetch={refetch}
              title="Failed to load portfolio"
            >
              <></>
            </QueryErrorDisplay>
          </div>
        )}

        {/* Portfolio Content */}
        {!tokensLoading && !tokensError && (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Token Holdings"
                value={formatUSD(tokenTotalUsd)}
                subtitle={`${tokenBalances.length} token${tokenBalances.length !== 1 ? "s" : ""} across ${uniqueChains.size} chain${uniqueChains.size !== 1 ? "s" : ""}`}
                icon={Wallet}
                delay={100}
              />
              <StatCard
                title="DeFi Positions"
                value={formatUSD(defiTotalUsd)}
                subtitle={`${positions.length} position${positions.length !== 1 ? "s" : ""} in ${uniqueProtocols.size} protocol${uniqueProtocols.size !== 1 ? "s" : ""}`}
                icon={Layers}
                loading={defiLoading}
                delay={150}
              />
              <StatCard
                title="Daily Yield"
                value={formatUSD(yield24h)}
                subtitle="Estimated earnings per day"
                icon={Zap}
                loading={defiLoading}
                accent="success"
                delay={200}
              />
              <StatCard
                title="Avg APY"
                value={formatPercent(avgApy / 100)}
                subtitle="Weighted across positions"
                icon={TrendingUp}
                loading={defiLoading}
                accent="warning"
                delay={250}
              />
            </div>

            {/* Portfolio Value Chart */}
            <div className="animate-in" style={{ animationDelay: "300ms" }}>
              <ValueChart
                data={historyDataPoints}
                currentValue={totalValue}
                isLoading={historyLoading}
                progress={historyProgress}
                selectedTimeframe={historyTimeframe}
                onTimeframeChange={setHistoryTimeframe}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Token Holdings - Primary */}
              <div
                className="lg:col-span-2 animate-in"
                style={{ animationDelay: "350ms" }}
              >
                <Card className="card-glow">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display">Holdings</CardTitle>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {tokenBalances.length} asset
                        {tokenBalances.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TokenHoldings
                      tokens={tokenBalances}
                      isLoading={isLoading}
                      tokenPriceHistory={tokenPriceHistory}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Chain Distribution */}
              <div className="animate-in" style={{ animationDelay: "400ms" }}>
                <Card className="card-glow h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="font-display">Chains</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {byChain.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No chain data
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {byChain.map((chain, idx) => {
                          const chainInfo =
                            CHAIN_INFO[chain.chainId as SupportedChainId];
                          if (!chainInfo) return null;

                          return (
                            <div
                              key={chain.chainId}
                              className="space-y-2 animate-in"
                              style={{ animationDelay: `${450 + idx * 50}ms` }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <ChainDot
                                    chainId={chain.chainId as SupportedChainId}
                                  />
                                  <span className="text-sm font-medium">
                                    {chainInfo.name}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-medium tabular-nums">
                                    {formatUSD(chain.totalValueUsd)}
                                  </span>
                                </div>
                              </div>
                              <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                                  style={{
                                    width: `${Math.max(chain.percentage, 2)}%`,
                                    backgroundColor: chainInfo.color,
                                    boxShadow: `0 0 12px ${chainInfo.color}40`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {chain.percentage.toFixed(1)}% of portfolio
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* DeFi Positions */}
            <div className="animate-in" style={{ animationDelay: "500ms" }}>
              <Card className="card-glow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Shield className="h-5 w-5 text-primary" />
                      DeFi Positions
                      {defiLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </CardTitle>
                    {!defiLoading && positions.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {positions.length} position
                        {positions.length !== 1 ? "s" : ""} across{" "}
                        {byProtocol.length} protocol
                        {byProtocol.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {defiLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                          <div className="h-14 w-14 rounded-xl border-2 border-primary/20 border-t-primary animate-spin" />
                          <Activity className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium mb-1">
                            Discovering DeFi positions
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Scanning Lido, Aave, EigenLayer, and more...
                          </p>
                        </div>
                        {/* Mini protocol indicators */}
                        <div className="flex gap-2 flex-wrap justify-center max-w-xs">
                          {["lido", "aave-v3", "eigenlayer", "etherfi"].map(
                            (p, i) => (
                              <span
                                key={p}
                                className="text-xs px-2 py-1 rounded-md bg-secondary text-muted-foreground animate-pulse"
                                style={{ animationDelay: `${i * 200}ms` }}
                              >
                                {p}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ) : positions.length > 0 ? (
                    <PositionList
                      positions={positions}
                      protocolNames={Object.fromEntries(
                        byProtocol.map((p) => [p.protocol, p.name])
                      )}
                      onPositionClick={setSelectedPosition}
                    />
                  ) : (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary mb-4">
                        <Layers className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">
                        No DeFi positions found
                      </p>
                      <p className="text-muted-foreground/70 text-sm mt-1">
                        Positions from Lido, Aave, EigenLayer and more will
                        appear here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Position Detail Sheet */}
      <PositionDetailSheet
        position={selectedPosition}
        protocolName={
          selectedPosition
            ? byProtocol.find((p) => p.protocol === selectedPosition.protocol)
                ?.name
            : undefined
        }
        open={!!selectedPosition}
        onOpenChange={(open) => !open && setSelectedPosition(null)}
      />
    </div>
  );
}
