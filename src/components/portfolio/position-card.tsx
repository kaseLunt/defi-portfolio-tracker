"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatUSD, formatPercent, formatTokenAmount } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { ChainDot } from "@/components/shared/chain-badge";
import {
  getProtocolMeta,
  getProtocolLogo,
  getProtocolColor,
} from "@/lib/protocol-metadata";
import { SkeletonRow } from "@/components/ui/skeleton";
import { Layers, TrendingUp, ArrowRight, Zap } from "lucide-react";

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

const POSITION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof TrendingUp; color: string }
> = {
  supply: {
    label: "Supplied",
    icon: TrendingUp,
    color: "text-emerald-400 bg-emerald-500/10",
  },
  borrow: {
    label: "Borrowed",
    icon: ArrowRight,
    color: "text-red-400 bg-red-500/10",
  },
  stake: {
    label: "Staked",
    icon: Zap,
    color: "text-amber-400 bg-amber-500/10",
  },
  lp: {
    label: "LP",
    icon: Layers,
    color: "text-violet-400 bg-violet-500/10",
  },
  vault: {
    label: "Vault",
    icon: Layers,
    color: "text-cyan-400 bg-cyan-500/10",
  },
};

function ProtocolLogo({
  protocolId,
  protocolName,
  size = "md",
}: {
  protocolId: string;
  protocolName: string;
  size?: "sm" | "md" | "lg";
}) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = getProtocolLogo(protocolId);
  const color = getProtocolColor(protocolId);

  const sizeClasses = {
    sm: "w-9 h-9 text-[10px]",
    md: "w-11 h-11 text-xs",
    lg: "w-14 h-14 text-sm",
  };

  if (imageError || !logoUrl) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-xl flex items-center justify-center font-bold shadow-lg transition-transform group-hover:scale-105`}
        style={{
          background: `linear-gradient(135deg, ${color}30, ${color}10)`,
          color: color,
          boxShadow: `0 4px 12px ${color}20`,
        }}
      >
        {protocolName.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={logoUrl}
        alt={protocolName}
        className={`${sizeClasses[size]} rounded-xl bg-secondary object-cover shadow-lg transition-transform group-hover:scale-105`}
        onError={() => setImageError(true)}
      />
      <div
        className="absolute inset-0 rounded-xl ring-1 ring-white/10"
        style={{ boxShadow: `0 4px 12px ${color}15` }}
      />
    </div>
  );
}

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
  const config = POSITION_TYPE_CONFIG[positionType] ?? {
    label: positionType,
    icon: Layers,
    color: "text-muted-foreground bg-secondary",
  };
  const TypeIcon = config.icon;
  const protocolColor = getProtocolColor(protocol);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-xl transition-all duration-200",
        "bg-card/50 hover:bg-card border border-transparent hover:border-border/50",
        "hover:shadow-lg hover:shadow-black/5",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Protocol Logo with Chain Indicator */}
      <div className="relative flex-shrink-0">
        <ProtocolLogo protocolId={protocol} protocolName={protocolName} />
        <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
          <ChainDot chainId={chainId} size="sm" />
        </div>
      </div>

      {/* Position Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold truncate">{protocolName}</span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold ${config.color}`}
          >
            <TypeIcon className="h-3 w-3" />
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums font-medium">
            {formatTokenAmount(BigInt(Math.floor(balance * 1e18)), 18, 4)}
          </span>
          <span className="text-muted-foreground/70">{tokenSymbol}</span>
        </div>
      </div>

      {/* Value & APY */}
      <div className="text-right flex-shrink-0 space-y-1">
        <div className="font-semibold tabular-nums text-lg">
          {formatUSD(balanceUsd)}
        </div>
        {apy !== undefined && apy > 0 && (
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
            <TrendingUp className="h-3 w-3" />
            <span className="tabular-nums">{formatPercent(apy / 100)}</span>
          </div>
        )}
        {positionType === "borrow" && (
          <div className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md inline-block">
            Debt
          </div>
        )}
      </div>

      {/* Hover Arrow */}
      {onClick && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
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
  isLoading?: boolean;
  className?: string;
}

export function PositionList({
  positions,
  protocolNames = {},
  onPositionClick,
  isLoading,
  className,
}: PositionListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary mb-4">
          <Layers className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">
          No DeFi positions found
        </p>
        <p className="text-muted-foreground/70 text-sm mt-1.5">
          Positions from Lido, Aave, EigenLayer and more will appear here
        </p>
      </div>
    );
  }

  // Group positions by protocol for better visual organization
  const groupedByProtocol = positions.reduce(
    (acc, position) => {
      if (!acc[position.protocol]) {
        acc[position.protocol] = [];
      }
      acc[position.protocol].push(position);
      return acc;
    },
    {} as Record<string, typeof positions>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {positions.map((position, index) => {
        const meta = getProtocolMeta(position.protocol);
        const displayName =
          protocolNames[position.protocol] ?? meta?.name ?? position.protocol;

        return (
          <div
            key={`${position.protocol}-${position.chainId}-${position.tokenSymbol}-${position.positionType}-${index}`}
            className="animate-in"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <PositionCard
              protocol={position.protocol}
              protocolName={displayName}
              chainId={position.chainId}
              positionType={position.positionType}
              tokenSymbol={position.tokenSymbol}
              balance={position.balance}
              balanceUsd={position.balanceUsd}
              apy={position.apy}
              onClick={
                onPositionClick ? () => onPositionClick(position) : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

export { ProtocolLogo };
