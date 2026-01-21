"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  Wallet,
  Activity,
  PieChart,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUSD, formatPercent } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { useLivePortfolio } from "@/hooks/use-portfolio";
import { usePortfolioHistory } from "@/hooks/use-portfolio-history";
import { PositionList } from "@/components/portfolio/position-card";
import { TokenHoldings } from "@/components/portfolio/token-holdings";
import type { HistoricalTimeframe } from "@/server/services/historical/types";
import { ChainDot } from "@/components/shared/chain-badge";
import { ValueChart } from "@/components/portfolio/value-chart";
import { QueryErrorDisplay, ErrorBoundary } from "@/components/shared/error-boundary";

// Demo wallet for testing - Ether.fi wallet with weETH
const DEMO_WALLET = "0x521c25254245bA6eE9F00825789687703E548774";

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const [customWallet, setCustomWallet] = useState("");
  const [searchWallet, setSearchWallet] = useState("");
  const [historyTimeframe, setHistoryTimeframe] = useState<HistoricalTimeframe>("7d");
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch - only use wallet state after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use connected wallet, custom search, or demo wallet
  // Before mount, always use demo wallet to match server render
  const walletToView = mounted
    ? (searchWallet || (isConnected ? address : undefined) || DEMO_WALLET)
    : DEMO_WALLET;

  const showConnectedUI = mounted && isConnected && !searchWallet;

  const {
    portfolio,
    isLoading,
    isFetching,
    error,
    refetch,
    totalValue,
    tokenBalances,
    positions,
    byProtocol,
    byChain,
    avgApy,
    yield24h,
  } = useLivePortfolio(walletToView);

  const {
    dataPoints: historyDataPoints,
    isLoading: historyLoading,
    progress: historyProgress,
  } = usePortfolioHistory(walletToView, historyTimeframe, {
    currentValue: totalValue, // Pass live portfolio value for accurate final data point
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWallet && /^0x[a-fA-F0-9]{40}$/.test(customWallet)) {
      setSearchWallet(customWallet);
    }
  };

  const uniqueChains = new Set(positions.map((p) => p.chainId));
  const uniqueProtocols = new Set(positions.map((p) => p.protocol));

  return (
    <div className="container py-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              {showConnectedUI
                ? "Your DeFi portfolio across all chains and protocols."
                : `Viewing portfolio for ${walletToView.slice(0, 6)}...${walletToView.slice(-4)}`}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Wallet Search */}
        {!showConnectedUI && (
          <form onSubmit={handleSearch} className="flex gap-2 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter wallet address (0x...)"
                value={customWallet}
                onChange={(e) => setCustomWallet(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button type="submit" size="sm">
              View Portfolio
            </Button>
          </form>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-8">
          <QueryErrorDisplay
            error={error}
            isError={!!error}
            refetch={refetch}
            title="Failed to load portfolio"
          >
            <></>
          </QueryErrorDisplay>
        </div>
      )}

      {/* Portfolio Content */}
      {!isLoading && !error && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Portfolio Value
                </CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(totalValue)}</div>
                <p className="text-xs text-muted-foreground">
                  {positions.length} position{positions.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Est. Daily Yield
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUSD(yield24h)}</div>
                <p className="text-xs text-muted-foreground">
                  Based on current APY
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Weighted Avg APY
                </CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercent(avgApy / 100)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all positions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Coverage</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{uniqueChains.size} chains</div>
                <p className="text-xs text-muted-foreground">
                  {uniqueProtocols.size} protocol{uniqueProtocols.size !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Value Chart */}
          <div className="mb-8">
            <ValueChart
              data={historyDataPoints}
              currentValue={totalValue}
              isLoading={historyLoading}
              progress={historyProgress}
              selectedTimeframe={historyTimeframe}
              onTimeframeChange={(tf) => {
                if (tf === "7d" || tf === "30d" || tf === "90d" || tf === "1y") {
                  setHistoryTimeframe(tf);
                }
              }}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Token Holdings - Primary */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Holdings</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {tokenBalances.length} asset{tokenBalances.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <TokenHoldings tokens={tokenBalances} isLoading={isLoading} />
              </CardContent>
            </Card>

            {/* Chain Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Chains</CardTitle>
              </CardHeader>
              <CardContent>
                {byChain.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No chain data
                  </div>
                ) : (
                  <div className="space-y-4">
                    {byChain.map((chain) => {
                      const chainInfo = CHAIN_INFO[chain.chainId as SupportedChainId];
                      if (!chainInfo) return null;

                      return (
                        <div key={chain.chainId}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ChainDot chainId={chain.chainId as SupportedChainId} />
                              <span className="text-sm font-medium">
                                {chainInfo.name}
                              </span>
                            </div>
                            <span className="text-sm font-medium">
                              {formatUSD(chain.totalValueUsd)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.max(chain.percentage, 2)}%`,
                                backgroundColor: chainInfo.color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* DeFi Positions - Secondary */}
          {positions.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>DeFi Positions</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {positions.length} position{positions.length !== 1 ? "s" : ""} across {byProtocol.length} protocol{byProtocol.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <PositionList
                  positions={positions}
                  protocolNames={Object.fromEntries(
                    byProtocol.map((p) => [p.protocol, p.name])
                  )}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
