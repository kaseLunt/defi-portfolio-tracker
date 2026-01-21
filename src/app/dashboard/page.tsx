"use client";

import { useState } from "react";
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

  // Use connected wallet, custom search, or demo wallet
  const walletToView = searchWallet || (isConnected ? address : undefined) || DEMO_WALLET;

  const {
    portfolio,
    isLoading,
    isFetching,
    error,
    refetch,
    totalValue,
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
              {isConnected
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
        {!isConnected && (
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Positions List */}
            <Card className="col-span-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Positions</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No positions found for this wallet
                  </div>
                ) : (
                  <PositionList
                    positions={positions}
                    protocolNames={Object.fromEntries(
                      byProtocol.map((p) => [p.protocol, p.name])
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Protocol Breakdown */}
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>By Protocol</CardTitle>
              </CardHeader>
              <CardContent>
                {byProtocol.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No protocol data
                  </div>
                ) : (
                  <div className="space-y-4">
                    {byProtocol.map((proto) => (
                      <div
                        key={proto.protocol}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {proto.name[0]}
                          </div>
                          <div>
                            <div className="font-medium">{proto.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {proto.category}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {formatUSD(proto.totalValueUsd)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {proto.positions.length} position
                            {proto.positions.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chain Breakdown */}
          {byChain.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Chain Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-wrap">
                  {byChain.map((chain) => {
                    const chainInfo = CHAIN_INFO[chain.chainId as SupportedChainId];
                    if (!chainInfo) return null;

                    return (
                      <div key={chain.chainId} className="flex-1 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ChainDot chainId={chain.chainId as SupportedChainId} />
                            <span className="text-sm font-medium">
                              {chainInfo.name}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {chain.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${chain.percentage}%`,
                              backgroundColor: chainInfo.color,
                            }}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatUSD(chain.totalValueUsd)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
