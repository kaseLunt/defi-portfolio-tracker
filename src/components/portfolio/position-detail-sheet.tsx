"use client";

import { ExternalLink, Info, TrendingUp, AlertTriangle, Wallet } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatUSD, formatPercent, formatTokenAmount } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { ChainBadge } from "@/components/shared/chain-badge";
import { ProtocolLogo } from "@/components/portfolio/position-card";
import { getProtocolMeta, getProtocolColor, POSITION_TYPE_INFO } from "@/lib/protocol-metadata";

interface Position {
  protocol: string;
  chainId: SupportedChainId;
  positionType: string;
  tokenSymbol: string;
  tokenAddress?: string;
  balance: number;
  balanceUsd: number;
  apy?: number;
  healthFactor?: number;
  liquidationPrice?: number;
}

interface PositionDetailSheetProps {
  position: Position | null;
  protocolName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PositionDetailSheet({
  position,
  protocolName,
  open,
  onOpenChange,
}: PositionDetailSheetProps) {
  if (!position) return null;

  const meta = getProtocolMeta(position.protocol);
  const displayName = protocolName ?? meta?.name ?? position.protocol;
  const protocolColor = getProtocolColor(position.protocol);
  const chainInfo = CHAIN_INFO[position.chainId];
  const typeInfo = POSITION_TYPE_INFO[position.positionType];

  const dailyYield = position.apy && position.balanceUsd
    ? (position.balanceUsd * (position.apy / 100)) / 365
    : 0;

  const monthlyYield = dailyYield * 30;
  const yearlyYield = dailyYield * 365;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="pb-6">
          <div className="flex items-center gap-3">
            <ProtocolLogo
              protocolId={position.protocol}
              protocolName={displayName}
              size="lg"
            />
            <div>
              <SheetTitle>{displayName}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: typeInfo?.color ? `${typeInfo.color}20` : `${protocolColor}20`,
                    color: typeInfo?.color ?? protocolColor,
                  }}
                >
                  {typeInfo?.label ?? position.positionType}
                </span>
                <ChainBadge chainId={position.chainId} size="sm" />
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Main Value */}
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <div className="text-sm text-muted-foreground mb-1">Position Value</div>
            <div className="text-3xl font-bold tabular-nums">
              {formatUSD(position.balanceUsd)}
            </div>
            <div className="text-sm text-muted-foreground mt-1 tabular-nums">
              {formatTokenAmount(BigInt(Math.floor(position.balance * 1e18)), 18, 6)} {position.tokenSymbol}
            </div>
          </div>

          {/* Yield Info */}
          {position.apy !== undefined && position.apy > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Yield
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/30">
                  <div className="text-xs text-muted-foreground">APY</div>
                  <div className="text-lg font-semibold text-green-500 tabular-nums">
                    {formatPercent(position.apy / 100)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <div className="text-xs text-muted-foreground">Daily Est.</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatUSD(dailyYield)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <div className="text-xs text-muted-foreground">Monthly Est.</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatUSD(monthlyYield)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <div className="text-xs text-muted-foreground">Yearly Est.</div>
                  <div className="text-lg font-semibold tabular-nums">
                    {formatUSD(yearlyYield)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Borrow Warning */}
          {position.positionType === "borrow" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-red-500">Debt Position</div>
                <div className="text-xs text-muted-foreground mt-1">
                  This is a borrowed position. Interest accrues over time. Monitor your health factor to avoid liquidation.
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4" />
              Details
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Token</span>
                <span className="font-medium">{position.tokenSymbol}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">{chainInfo?.name ?? "Unknown"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Protocol</span>
                <span className="font-medium">{displayName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{typeInfo?.label ?? position.positionType}</span>
              </div>
              {position.tokenAddress && (
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Contract</span>
                  <span className="font-mono text-xs">
                    {position.tokenAddress.slice(0, 6)}...{position.tokenAddress.slice(-4)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4">
            {meta?.url && (
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open(meta.url, "_blank")}
              >
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Manage on {displayName}
                </span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            {chainInfo?.explorerUrl && position.tokenAddress && (
              <Button
                variant="ghost"
                className="w-full justify-between text-muted-foreground"
                onClick={() =>
                  window.open(
                    `${chainInfo.explorerUrl}/address/${position.tokenAddress}`,
                    "_blank"
                  )
                }
              >
                <span>View on {chainInfo.name} Explorer</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
