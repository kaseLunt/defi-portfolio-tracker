"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { cn } from "@/lib/utils";
import { formatEther, parseEther } from "viem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useStakeEth,
  useWrapEeth,
  useUnwrapWeeth,
  useEtherFiBalances,
  type StakingTab,
  type TransactionStatus,
} from "@/hooks/use-etherfi-staking";
import { ETHERFI_BRAND, STAKING_LIMITS } from "@/lib/etherfi-constants";
import { ETHERFI_CHAIN_ID } from "@/lib/etherfi-contracts";
import {
  ArrowDownUp,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface StakingPanelProps {
  walletAddress?: string;
}

/**
 * Staking Panel with tabs for Stake, Wrap, Unwrap
 * Gaming-inspired design with animated states
 */
export function StakingPanel({ walletAddress }: StakingPanelProps) {
  const { isConnected, address: connectedAddress, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<StakingTab>("stake");

  const isWrongChain = isConnected && chainId !== ETHERFI_CHAIN_ID;

  // Check if viewing another wallet (not the connected one)
  const isViewingOtherWallet = !!(walletAddress &&
    connectedAddress &&
    walletAddress.toLowerCase() !== connectedAddress.toLowerCase());

  // Check if viewing without being connected
  const isViewOnlyMode = !isConnected || isViewingOtherWallet;

  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        "border-2 border-transparent",
        "hover:border-[#735CFF]/20 transition-colors duration-300"
      )}
    >
      {/* Gradient accent line */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: ETHERFI_BRAND.gradient }}
      />

      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-display">
          <Zap className="w-5 h-5" style={{ color: ETHERFI_BRAND.primary }} />
          Staking Actions
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/50">
          {(["stake", "wrap", "unwrap"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
              style={
                activeTab === tab
                  ? {
                      boxShadow: `0 0 20px ${ETHERFI_BRAND.primaryGlow}`,
                    }
                  : undefined
              }
            >
              {tab === "stake"
                ? "Stake ETH"
                : tab === "wrap"
                  ? "Wrap eETH"
                  : "Unwrap weETH"}
            </button>
          ))}
        </div>

        {/* View Only Mode Notice */}
        {isViewOnlyMode && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-blue-400">View-only mode</span>
              <span className="text-muted-foreground">
                {" "}— {isViewingOtherWallet
                  ? "You're viewing another wallet's holdings"
                  : "Connect your wallet to stake"}
              </span>
            </div>
          </div>
        )}

        {/* Wrong Chain Warning */}
        {isWrongChain && !isViewOnlyMode && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span className="text-sm">
                Please switch to Ethereum Mainnet
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => switchChain?.({ chainId: ETHERFI_CHAIN_ID })}
              className="shrink-0"
            >
              Switch Network
            </Button>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === "stake" && <StakeTab disabled={isWrongChain || isViewOnlyMode} walletAddress={walletAddress} />}
        {activeTab === "wrap" && <WrapTab disabled={isWrongChain || isViewOnlyMode} walletAddress={walletAddress} />}
        {activeTab === "unwrap" && <UnwrapTab disabled={isWrongChain || isViewOnlyMode} walletAddress={walletAddress} />}
      </CardContent>
    </Card>
  );
}

/**
 * Stake ETH -> eETH Tab
 */
function StakeTab({ disabled, walletAddress }: { disabled?: boolean; walletAddress?: string }) {
  const { isConnected } = useAccount();
  const balances = useEtherFiBalances(walletAddress);
  const stake = useStakeEth();

  const handleMax = () => {
    const maxBalance =
      balances.eth.balance > parseEther(STAKING_LIMITS.gasBufferEth.toString())
        ? balances.eth.balance -
          parseEther(STAKING_LIMITS.gasBufferEth.toString())
        : 0n;
    stake.setAmount(formatEther(maxBalance));
  };

  const isValid =
    stake.amountWei > 0n &&
    stake.amountWei <= balances.eth.balance &&
    parseFloat(stake.amount) >= STAKING_LIMITS.minStakeEth;

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">You stake</span>
          <button
            onClick={handleMax}
            className="text-xs text-primary hover:underline font-medium"
          >
            Max: {parseFloat(balances.eth.formatted).toFixed(4)} ETH
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={stake.amount}
            onChange={(e) => stake.setAmount(e.target.value)}
            disabled={disabled || !isConnected}
            className={cn(
              "w-full py-4 px-4 pr-20 rounded-xl text-2xl font-semibold tabular-nums",
              "bg-secondary/50 border border-border",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              "placeholder:text-muted-foreground/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            ETH
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Output */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">You receive</span>
        <div className="py-4 px-4 rounded-xl bg-secondary/30 border border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold tabular-nums text-muted-foreground">
              ~{stake.estimatedOutput || "0.0"}
            </span>
            <span className="text-muted-foreground font-medium">eETH</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Exchange rate: 1 ETH = ~1 eETH
        </p>
      </div>

      {/* Action Button */}
      <TransactionButton
        status={stake.status}
        isReady={stake.isReady}
        isValid={isValid}
        isConnected={isConnected}
        disabled={disabled}
        txHash={stake.txHash}
        onExecute={stake.stake}
        onReset={stake.reset}
        label="Stake ETH"
        loadingLabel="Staking..."
        error={stake.error}
      />
    </div>
  );
}

/**
 * Wrap eETH -> weETH Tab
 */
function WrapTab({ disabled, walletAddress }: { disabled?: boolean; walletAddress?: string }) {
  const { isConnected } = useAccount();
  const balances = useEtherFiBalances(walletAddress);
  const wrap = useWrapEeth();

  const handleMax = () => {
    wrap.setAmount(balances.eeth.formatted);
  };

  const isValid =
    wrap.amountWei > 0n &&
    wrap.amountWei <= balances.eeth.balance &&
    parseFloat(wrap.amount) >= STAKING_LIMITS.minWrapEeth;

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">You wrap</span>
          <button
            onClick={handleMax}
            className="text-xs text-primary hover:underline font-medium"
          >
            Max: {parseFloat(balances.eeth.formatted).toFixed(4)} eETH
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={wrap.amount}
            onChange={(e) => wrap.setAmount(e.target.value)}
            disabled={disabled || !isConnected}
            className={cn(
              "w-full py-4 px-4 pr-20 rounded-xl text-2xl font-semibold tabular-nums",
              "bg-secondary/50 border border-border",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              "placeholder:text-muted-foreground/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            eETH
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Output */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">You receive</span>
        <div className="py-4 px-4 rounded-xl bg-secondary/30 border border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold tabular-nums text-muted-foreground">
              ~{wrap.estimatedOutput || "0.0"}
            </span>
            <span className="text-muted-foreground font-medium">weETH</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          weETH is non-rebasing and ideal for DeFi
        </p>
      </div>

      {/* Approval Warning */}
      {wrap.needsApproval && isValid && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Approval required before wrapping</span>
        </div>
      )}

      {/* Action Button */}
      {wrap.needsApproval && isValid ? (
        <TransactionButton
          status={wrap.status}
          isReady={true}
          isValid={isValid}
          isConnected={isConnected}
          disabled={disabled}
          txHash={wrap.txHash}
          onExecute={wrap.approve}
          onReset={wrap.reset}
          label="Approve eETH"
          loadingLabel="Approving..."
          error={wrap.error}
        />
      ) : (
        <TransactionButton
          status={wrap.status}
          isReady={wrap.isReady}
          isValid={isValid}
          isConnected={isConnected}
          disabled={disabled}
          txHash={wrap.txHash}
          onExecute={wrap.wrap}
          onReset={wrap.reset}
          label="Wrap eETH"
          loadingLabel="Wrapping..."
          error={wrap.error}
        />
      )}
    </div>
  );
}

/**
 * Unwrap weETH -> eETH Tab
 */
function UnwrapTab({ disabled, walletAddress }: { disabled?: boolean; walletAddress?: string }) {
  const { isConnected } = useAccount();
  const balances = useEtherFiBalances(walletAddress);
  const unwrap = useUnwrapWeeth();

  const handleMax = () => {
    unwrap.setAmount(balances.weeth.formatted);
  };

  const isValid =
    unwrap.amountWei > 0n &&
    unwrap.amountWei <= balances.weeth.balance &&
    parseFloat(unwrap.amount) >= STAKING_LIMITS.minUnwrapWeeth;

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">You unwrap</span>
          <button
            onClick={handleMax}
            className="text-xs text-primary hover:underline font-medium"
          >
            Max: {parseFloat(balances.weeth.formatted).toFixed(4)} weETH
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={unwrap.amount}
            onChange={(e) => unwrap.setAmount(e.target.value)}
            disabled={disabled || !isConnected}
            className={cn(
              "w-full py-4 px-4 pr-20 rounded-xl text-2xl font-semibold tabular-nums",
              "bg-secondary/50 border border-border",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              "placeholder:text-muted-foreground/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            weETH
          </span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Output */}
      <div className="space-y-2">
        <span className="text-sm text-muted-foreground">You receive</span>
        <div className="py-4 px-4 rounded-xl bg-secondary/30 border border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold tabular-nums text-muted-foreground">
              ~{unwrap.estimatedOutput || "0.0"}
            </span>
            <span className="text-muted-foreground font-medium">eETH</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <TransactionButton
        status={unwrap.status}
        isReady={unwrap.isReady}
        isValid={isValid}
        isConnected={isConnected}
        disabled={disabled}
        txHash={unwrap.txHash}
        onExecute={unwrap.unwrap}
        onReset={unwrap.reset}
        label="Unwrap weETH"
        loadingLabel="Unwrapping..."
        error={unwrap.error}
      />
    </div>
  );
}

/**
 * Transaction button with all states
 */
function TransactionButton({
  status,
  isReady,
  isValid,
  isConnected,
  disabled,
  txHash,
  onExecute,
  onReset,
  label,
  loadingLabel,
  error,
}: {
  status: TransactionStatus;
  isReady: boolean;
  isValid: boolean;
  isConnected: boolean;
  disabled?: boolean;
  txHash?: `0x${string}`;
  onExecute: () => void;
  onReset: () => void;
  label: string;
  loadingLabel: string;
  error?: string | null;
}) {
  // Success state
  if (status === "success") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center animate-confetti">
            <Check className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-emerald-400">
            Transaction Successful!
          </span>
        </div>
        {txHash && (
          <a
            href={`https://etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View on Etherscan
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <Button onClick={onReset} variant="outline" className="w-full">
          <Sparkles className="w-4 h-4 mr-2" />
          {label.replace(/^(Stake|Wrap|Unwrap)/, "$1 More")}
        </Button>
      </div>
    );
  }

  // Error state
  if (status === "error" && error) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
        <Button onClick={onReset} variant="outline" className="w-full">
          Try Again
        </Button>
      </div>
    );
  }

  // Loading states
  const isLoading = ["simulating", "confirming", "pending"].includes(status);
  const buttonLabel =
    status === "simulating"
      ? "Calculating..."
      : status === "confirming"
        ? "Confirm in Wallet"
        : status === "pending"
          ? loadingLabel
          : label;

  return (
    <Button
      onClick={onExecute}
      disabled={
        disabled ||
        !isConnected ||
        !isValid ||
        (!isReady && status === "idle") ||
        isLoading
      }
      className={cn(
        "w-full py-6 text-base font-semibold transition-all duration-300",
        isReady && isValid && !isLoading && "shadow-[0_0_30px_rgba(115,92,255,0.3)]"
      )}
      style={
        isReady && isValid && !isLoading
          ? { background: ETHERFI_BRAND.gradient }
          : undefined
      }
    >
      {isLoading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
      {buttonLabel}
      {!isLoading && isReady && isValid && (
        <ArrowRight className="w-5 h-5 ml-2" />
      )}
    </Button>
  );
}
