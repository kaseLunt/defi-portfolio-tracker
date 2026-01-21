"use client";

import { cn } from "@/lib/utils";
import { formatUSD, formatPercent, formatTokenAmount } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { TokenWithChain } from "@/components/shared/token-icon";
import { ChainBadge } from "@/components/shared/chain-badge";

interface PositionCardProps {
  protocol: string;
  protocolName: string;
  chainId: SupportedChainId;
  positionType: string;
  tokenSymbol: string;
  balance: number;
  balanceUsd: number;
  apy?: number;
  onClick?: () => void;
  className?: string;
}

const POSITION_TYPE_LABELS: Record<string, string> = {
  supply: "Supplied",
  borrow: "Borrowed",
  stake: "Staked",
  lp: "LP Position",
  vault: "Vault",
};

const PROTOCOL_COLORS: Record<string, string> = {
  lido: "#00A3FF",
  etherfi: "#6C41F2",
  "aave-v3": "#B6509E",
  "compound-v3": "#00D395",
  "uniswap-v3": "#FF007A",
};

export function PositionCard({
  protocol,
  protocolName,
  chainId,
  positionType,
  tokenSymbol,
  balance,
  balanceUsd,
  apy,
  onClick,
  className,
}: PositionCardProps) {
  const chain = CHAIN_INFO[chainId];
  const typeLabel = POSITION_TYPE_LABELS[positionType] ?? positionType;
  const protocolColor = PROTOCOL_COLORS[protocol] ?? "#6B7280";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border bg-card transition-colors",
        onClick && "hover:bg-accent/50 cursor-pointer",
        className
      )}
    >
      <div className="flex items-center gap-4">
        <TokenWithChain
          symbol={tokenSymbol}
          chainColor={chain?.color}
          size="lg"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{protocolName}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${protocolColor}20`,
                color: protocolColor,
              }}
            >
              {typeLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {formatTokenAmount(BigInt(Math.floor(balance * 1e18)), 18, 4)} {tokenSymbol}
            </span>
            <span>on</span>
            <ChainBadge chainId={chainId} size="sm" />
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium">{formatUSD(balanceUsd)}</div>
        {apy !== undefined && apy > 0 && (
          <div className="text-sm text-green-500">{formatPercent(apy / 100)} APY</div>
        )}
        {positionType === "borrow" && (
          <div className="text-sm text-red-500">Debt</div>
        )}
      </div>
    </div>
  );
}

interface PositionListProps {
  positions: Array<{
    protocol: string;
    chainId: SupportedChainId;
    positionType: string;
    tokenSymbol: string;
    balance: number;
    balanceUsd: number;
    apy?: number;
  }>;
  protocolNames?: Record<string, string>;
  onPositionClick?: (position: PositionListProps["positions"][0]) => void;
  className?: string;
}

export function PositionList({
  positions,
  protocolNames = {},
  onPositionClick,
  className,
}: PositionListProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No positions found
      </div>
    );
  }

  const defaultNames: Record<string, string> = {
    lido: "Lido",
    etherfi: "Ether.fi",
    "aave-v3": "Aave V3",
    "compound-v3": "Compound V3",
    "uniswap-v3": "Uniswap V3",
  };

  return (
    <div className={cn("space-y-3", className)}>
      {positions.map((position, index) => (
        <PositionCard
          key={`${position.protocol}-${position.chainId}-${position.tokenSymbol}-${position.positionType}-${index}`}
          protocol={position.protocol}
          protocolName={
            protocolNames[position.protocol] ??
            defaultNames[position.protocol] ??
            position.protocol
          }
          chainId={position.chainId}
          positionType={position.positionType}
          tokenSymbol={position.tokenSymbol}
          balance={position.balance}
          balanceUsd={position.balanceUsd}
          apy={position.apy}
          onClick={onPositionClick ? () => onPositionClick(position) : undefined}
        />
      ))}
    </div>
  );
}
