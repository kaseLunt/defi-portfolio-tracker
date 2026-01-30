"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { AlertTriangle, Shield, TrendingDown, Wallet, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton, SkeletonCard, SkeletonRow } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { formatAddress } from "@/lib/utils";
import type { RiskLevel, LendingPosition, WalletRiskSummary } from "@/lib/liquidation/types";

// Risk level to color mapping
const riskColors: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  safe: { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30" },
  moderate: { text: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  warning: { text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  danger: { text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  critical: { text: "text-red-700", bg: "bg-red-700/10", border: "border-red-700/30" },
};

const riskLabels: Record<RiskLevel, string> = {
  safe: "Safe",
  moderate: "Moderate",
  warning: "Warning",
  danger: "Danger",
  critical: "Critical",
};

// Format USD values
function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// Format health factor display
function formatHealthFactor(hf: number): string {
  if (hf >= 999) return "No Debt";
  if (hf >= 100) return ">100";
  return hf.toFixed(2);
}

// Format percentage
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// Risk Badge Component
function RiskBadge({ level }: { level: RiskLevel }) {
  const colors = riskColors[level];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}
    >
      {riskLabels[level]}
    </span>
  );
}

// Health Factor Display Component
function HealthFactorDisplay({ value, riskLevel }: { value: number; riskLevel: RiskLevel }) {
  const colors = riskColors[riskLevel];
  const displayValue = formatHealthFactor(value);

  return (
    <div className="flex flex-col items-center">
      <span className={`text-5xl font-bold font-mono ${colors.text}`}>{displayValue}</span>
      <span className="text-sm text-muted-foreground mt-1">Health Factor</span>
    </div>
  );
}

// Position Row Component
function PositionRow({ position, chainId }: { position: LendingPosition; chainId: number }) {
  const isAtRisk = position.priceDropToLiquidation < 0.25;
  const chainInfo = CHAIN_INFO[chainId as SupportedChainId];

  return (
    <tr className={`border-b border-border/50 ${isAtRisk ? "bg-red-500/5" : ""}`}>
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold">{position.collateralToken.slice(0, 2)}</span>
          </div>
          <div>
            <div className="font-medium">{position.collateralToken}</div>
            <div className="text-xs text-muted-foreground">{chainInfo?.name || `Chain ${chainId}`}</div>
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <div className="font-mono">{formatUsd(position.collateralValueUsd)}</div>
        <div className="text-xs text-muted-foreground">
          {formatPercent(position.riskContribution)} of risk
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <span className={`font-mono ${position.healthFactor < 1.5 ? "text-orange-500" : ""}`}>
          {formatHealthFactor(position.healthFactor)}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <div className="font-mono">${position.liquidationPrice.toFixed(2)}</div>
        <div className="text-xs text-muted-foreground">Current: ${position.currentPrice.toFixed(2)}</div>
      </td>
      <td className="py-4 px-4 text-right">
        <div className={`font-mono ${isAtRisk ? "text-red-500" : "text-green-500"}`}>
          {position.priceDropToLiquidation >= 1 ? ">100%" : formatPercent(position.priceDropToLiquidation)}
        </div>
        {isAtRisk && (
          <div className="flex items-center justify-end gap-1 text-xs text-red-500">
            <AlertTriangle className="w-3 h-3" />
            At Risk
          </div>
        )}
      </td>
    </tr>
  );
}

// Chain Summary Card
function ChainSummaryCard({ summary }: { summary: WalletRiskSummary }) {
  const chainInfo = CHAIN_INFO[summary.chainId as SupportedChainId];
  const colors = riskColors[summary.overallRiskLevel];

  const sortedPositions = [...summary.positions].sort(
    (a, b) => a.priceDropToLiquidation - b.priceDropToLiquidation
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: chainInfo?.color || "#666" }}
            >
              {chainInfo?.shortName.slice(0, 2) || "?"}
            </div>
            <div>
              <CardTitle>{chainInfo?.name || `Chain ${summary.chainId}`}</CardTitle>
              <CardDescription>Aave V3</CardDescription>
            </div>
          </div>
          <RiskBadge level={summary.overallRiskLevel} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className={`text-2xl font-bold font-mono ${colors.text}`}>
              {formatHealthFactor(summary.overallHealthFactor)}
            </div>
            <div className="text-xs text-muted-foreground">Health Factor</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">{formatUsd(summary.totalCollateralUsd)}</div>
            <div className="text-xs text-muted-foreground">Collateral</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">{formatUsd(summary.totalDebtUsd)}</div>
            <div className="text-xs text-muted-foreground">Debt</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono">{formatUsd(summary.netWorthUsd)}</div>
            <div className="text-xs text-muted-foreground">Net Worth</div>
          </div>
        </div>

        {sortedPositions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 px-4 text-left font-medium">Collateral</th>
                  <th className="py-2 px-4 text-right font-medium">Value</th>
                  <th className="py-2 px-4 text-right font-medium">HF</th>
                  <th className="py-2 px-4 text-right font-medium">Liq. Price</th>
                  <th className="py-2 px-4 text-right font-medium">Drop to Liq.</th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((position, idx) => (
                  <PositionRow
                    key={`${position.collateralToken}-${idx}`}
                    position={position}
                    chainId={summary.chainId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Empty State - No Positions
function EmptyPositionsState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Aave V3 Positions Found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          No lending positions found on Aave V3 across the supported chains.
          Positions will appear here once collateral is supplied and borrowed on Aave.
        </p>
      </CardContent>
    </Card>
  );
}

// Error State
function ErrorState({ error }: { error: string }) {
  return (
    <Card className="border-destructive">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
      </CardContent>
    </Card>
  );
}

// Aggregate Summary Component
function AggregatedSummary({ summaries }: { summaries: WalletRiskSummary[] }) {
  const totalCollateral = summaries.reduce((sum, s) => sum + s.totalCollateralUsd, 0);
  const totalDebt = summaries.reduce((sum, s) => sum + s.totalDebtUsd, 0);
  const netWorth = totalCollateral - totalDebt;
  const totalPositionsAtRisk = summaries.reduce((sum, s) => sum + s.positionsAtRisk, 0);

  const worstHF = Math.min(...summaries.map((s) => s.overallHealthFactor));
  const worstRiskLevel = summaries.reduce(
    (worst, s) => {
      const riskOrder: RiskLevel[] = ["safe", "moderate", "warning", "danger", "critical"];
      return riskOrder.indexOf(s.overallRiskLevel) > riskOrder.indexOf(worst)
        ? s.overallRiskLevel
        : worst;
    },
    "safe" as RiskLevel
  );

  const colors = riskColors[worstRiskLevel];

  return (
    <Card className={`${colors.border} border-2`}>
      <CardContent className="py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-1 flex justify-center">
            <HealthFactorDisplay value={worstHF} riskLevel={worstRiskLevel} />
          </div>
          <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Collateral</div>
              <div className="text-2xl font-bold font-mono">{formatUsd(totalCollateral)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Debt</div>
              <div className="text-2xl font-bold font-mono">{formatUsd(totalDebt)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Net Worth</div>
              <div className="text-2xl font-bold font-mono">{formatUsd(netWorth)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Risk Status</div>
              <div className="flex items-center gap-2">
                <RiskBadge level={worstRiskLevel} />
                {totalPositionsAtRisk > 0 && (
                  <span className="text-sm text-red-500">
                    {totalPositionsAtRisk} at risk
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  params: Promise<{ wallet: string }>;
}

export default function LiquidationWalletPage({ params }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const { address, isConnected } = useAccount();

  // Resolve params
  useEffect(() => {
    params.then((p) => {
      const wallet = p.wallet;
      if (/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        setWalletAddress(wallet);
        setSearchInput(wallet);
      } else {
        router.replace("/liquidation");
      }
    });
  }, [params, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: summaries,
    isLoading,
    error,
  } = trpc.liquidation.getRiskSummaryAllChains.useQuery(
    { walletAddress: walletAddress ?? "" },
    { enabled: !!walletAddress }
  );

  const isOwnWallet = isConnected && address?.toLowerCase() === walletAddress?.toLowerCase();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput && /^0x[a-fA-F0-9]{40}$/.test(searchInput)) {
      router.push(`/liquidation/${searchInput}`);
    } else if (searchInput) {
      toast.error("Invalid address", {
        description: "Please enter a valid Ethereum address (0x...)",
      });
    }
  };

  if (!mounted || !walletAddress) {
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

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Liquidation Risk Monitor</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              Monitoring positions for {formatAddress(walletAddress)}
              {isOwnWallet && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Your wallet
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
          <div className="flex-1 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Enter wallet address (0x...)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card/50 text-sm focus:outline-none focus:border-primary focus:bg-card transition-all font-mono"
            />
          </div>
          <Button type="submit" className="gap-2">
            View
            <ArrowRight className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error.message} />
      ) : !summaries || summaries.length === 0 ? (
        <EmptyPositionsState />
      ) : (
        <div className="space-y-6">
          <AggregatedSummary summaries={summaries} />
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Positions by Chain</h2>
            {summaries.map((summary) => (
              <ChainSummaryCard key={summary.chainId} summary={summary} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
