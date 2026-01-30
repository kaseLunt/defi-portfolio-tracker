"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Fuel,
  Wallet,
  Sparkles,
  ShieldCheck,
  Layers,
  Zap,
} from "lucide-react";
import { formatUnits } from "viem";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ============================================================================
// Types (serialized versions from tRPC)
// ============================================================================

interface SerializedApprovalStatus {
  isApproved: boolean;
  currentAllowance: string;
  requiredAmount: string;
  canSkip: boolean;
}

interface SerializedBatchInfo {
  batchId: string;
  indexInBatch: number;
  totalInBatch: number;
  batchedWith: string[];
}

interface SerializedTransactionStep {
  id: string;
  action: string;
  protocol: string;
  chainId: number;
  description: string;
  to: string;
  data: string;
  value: string;
  tokenIn?: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  tokenOut?: {
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
  };
  estimatedGas?: string;
  sourceBlockId?: string;
  approvalStatus?: SerializedApprovalStatus;
  batchInfo?: SerializedBatchInfo;
}

interface SerializedTransactionPlan {
  id: string;
  chainId: number;
  fromAddress: string;
  steps: SerializedTransactionStep[];
  totalSteps: number;
  estimatedTotalGas: string;
  estimatedTotalGasUsd: number;
  strategyId?: string;
  strategyName?: string;
  createdAt: number;
  expiresAt: number;
}

// ============================================================================
// Props
// ============================================================================

interface ApprovalStats {
  totalApprovalSteps: number;
  alreadyApproved: number;
  needsApproval: number;
}

interface ApprovalSavings {
  skippableCount: number;
  estimatedGasSavings: string;
  checkDurationMs: number;
}

interface BatchingSummary {
  hasBatches: boolean;
  batchCount: number;
  batchedStepCount: number;
  unbatchedStepCount: number;
  estimatedGasSavings: string;
  transactionReduction: number;
  description: string;
}

interface TransactionPreviewProps {
  plan: SerializedTransactionPlan;
  isSimulating?: boolean;
  onSimulate: () => void;
  onExecute: () => void;
  simulationComplete?: boolean;
  approvalStats?: ApprovalStats | null;
  approvalSavings?: ApprovalSavings | null;
  batchingSummary?: BatchingSummary | null;
  className?: string;
}

// ============================================================================
// Action Icons & Colors
// ============================================================================

const ACTION_CONFIG: Record<
  string,
  { icon: string; color: string; bgColor: string }
> = {
  approve: { icon: "✓", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  deposit: { icon: "↓", color: "text-green-500", bgColor: "bg-green-500/10" },
  supply: { icon: "↓", color: "text-green-500", bgColor: "bg-green-500/10" },
  withdraw: { icon: "↑", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  stake: { icon: "⚡", color: "text-purple-500", bgColor: "bg-purple-500/10" },
  unstake: { icon: "⚡", color: "text-purple-400", bgColor: "bg-purple-400/10" },
  wrap: { icon: "📦", color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
  unwrap: { icon: "📦", color: "text-cyan-400", bgColor: "bg-cyan-400/10" },
  borrow: { icon: "💰", color: "text-red-500", bgColor: "bg-red-500/10" },
  repay: { icon: "💸", color: "text-green-500", bgColor: "bg-green-500/10" },
  swap: { icon: "🔄", color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
  claim: { icon: "🎁", color: "text-pink-500", bgColor: "bg-pink-500/10" },
};

// ============================================================================
// Component
// ============================================================================

export function TransactionPreview({
  plan,
  isSimulating = false,
  onSimulate,
  onExecute,
  simulationComplete = false,
  approvalStats,
  approvalSavings,
  batchingSummary,
  className,
}: TransactionPreviewProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Count skippable approvals
  const hasApprovalOptimizations = approvalSavings && approvalSavings.skippableCount > 0;
  const hasBatchingOptimizations = batchingSummary && batchingSummary.hasBatches;

  // Calculate total gas savings
  const totalGasSavings =
    (hasApprovalOptimizations ? Number(approvalSavings.estimatedGasSavings) : 0) +
    (hasBatchingOptimizations ? Number(batchingSummary.estimatedGasSavings) : 0);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formatAmount = (amount: string, decimals: number) => {
    const value = Number(formatUnits(BigInt(amount), decimals));
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const isExpired = plan.expiresAt < Date.now();
  const timeRemaining = Math.max(0, plan.expiresAt - Date.now());
  const minutesRemaining = Math.floor(timeRemaining / 60000);
  const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Transaction Preview</CardTitle>
            <CardDescription>
              {plan.totalSteps} transaction{plan.totalSteps !== 1 ? "s" : ""} to
              execute
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                isExpired
                  ? "bg-red-500/10 text-red-500"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isExpired
                ? "Expired"
                : `${minutesRemaining}:${secondsRemaining.toString().padStart(2, "0")}`}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Optimization Banners */}
        {(hasApprovalOptimizations || hasBatchingOptimizations) && (
          <div className="space-y-2">
            {/* Approval Optimization Banner */}
            {hasApprovalOptimizations && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    {approvalSavings.skippableCount} approval
                    {approvalSavings.skippableCount !== 1 ? "s" : ""} can be skipped
                  </p>
                  <p className="text-xs text-green-600/70 dark:text-green-400/70">
                    Saving ~{Number(approvalSavings.estimatedGasSavings).toLocaleString()} gas
                  </p>
                </div>
              </motion.div>
            )}

            {/* Batching Optimization Banner */}
            {hasBatchingOptimizations && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: hasApprovalOptimizations ? 0.1 : 0 }}
                className="flex items-center gap-3 rounded-lg bg-purple-500/10 border border-purple-500/20 p-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20">
                  <Layers className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    {batchingSummary.batchedStepCount} steps batched into{" "}
                    {batchingSummary.batchCount} transaction
                    {batchingSummary.batchCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-purple-600/70 dark:text-purple-400/70">
                    {batchingSummary.transactionReduction > 0 && (
                      <>
                        {batchingSummary.transactionReduction} fewer signature
                        {batchingSummary.transactionReduction !== 1 ? "s" : ""} required •{" "}
                      </>
                    )}
                    Saving ~{Number(batchingSummary.estimatedGasSavings).toLocaleString()} gas
                  </p>
                </div>
                <Zap className="h-5 w-5 text-purple-500" />
              </motion.div>
            )}

            {/* Combined Savings Summary */}
            {totalGasSavings > 0 && (hasApprovalOptimizations && hasBatchingOptimizations) && (
              <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>
                  Total optimization: ~{totalGasSavings.toLocaleString()} gas saved
                </span>
              </div>
            )}
          </div>
        )}

        {/* Transaction Steps */}
        <div className="space-y-2">
          {plan.steps.map((step, index) => {
            const config = ACTION_CONFIG[step.action] ?? {
              icon: "•",
              color: "text-gray-500",
              bgColor: "bg-gray-500/10",
            };
            const isExpanded = expandedSteps.has(step.id);
            const isApprovalStep = step.action === "approve";
            const canSkipApproval = step.approvalStatus?.canSkip ?? false;
            const isBatched = !!step.batchInfo;
            const isFirstInBatch = step.batchInfo?.indexInBatch === 0;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "rounded-lg border",
                  canSkipApproval
                    ? "bg-green-500/5 border-green-500/30"
                    : config.bgColor,
                  "border-border/50",
                  canSkipApproval && "opacity-75"
                )}
              >
                <button
                  onClick={() => toggleStep(step.id)}
                  className="w-full"
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          canSkipApproval ? "bg-green-500/20" : config.bgColor
                        )}
                      >
                        {canSkipApproval ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className={config.color}>{config.icon}</span>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium capitalize",
                            canSkipApproval && "line-through text-muted-foreground"
                          )}>
                            {step.action}
                          </span>
                          <span className="px-2 py-0.5 rounded border text-xs bg-background">
                            {step.protocol}
                          </span>
                          {/* Approval Status Badge */}
                          {isApprovalStep && step.approvalStatus && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                step.approvalStatus.isApproved
                                  ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                  : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              )}
                            >
                              {step.approvalStatus.isApproved
                                ? "Already Approved"
                                : "Needs Approval"}
                            </span>
                          )}
                          {/* Batch Badge */}
                          {isBatched && (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center gap-1"
                            >
                              <Layers className="h-3 w-3" />
                              Batch {step.batchInfo!.batchId.replace("batch-", "")}
                              <span className="text-purple-400/60">
                                ({step.batchInfo!.indexInBatch + 1}/{step.batchInfo!.totalInBatch})
                              </span>
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          "text-sm text-muted-foreground",
                          canSkipApproval && "line-through"
                        )}>
                          {canSkipApproval
                            ? "Will be skipped (already approved)"
                            : step.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Token Flow */}
                      {step.tokenIn && step.tokenOut && (
                        <div className="flex items-center gap-2 text-sm">
                          <span>
                            {formatAmount(
                              step.tokenIn.amount,
                              step.tokenIn.decimals
                            )}{" "}
                            {step.tokenIn.symbol}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatAmount(
                              step.tokenOut.amount,
                              step.tokenOut.decimals
                            )}{" "}
                            {step.tokenOut.symbol}
                          </span>
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50" />
                      <div className="space-y-2 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Contract</span>
                          <code className="font-mono text-xs">
                            {step.to.slice(0, 6)}...{step.to.slice(-4)}
                          </code>
                        </div>
                        {step.estimatedGas && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Est. Gas
                            </span>
                            <span>
                              {Number(step.estimatedGas).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {step.value !== "0" && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              ETH Value
                            </span>
                            <span>
                              {formatAmount(step.value, 18)} ETH
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="border-t border-border/50 pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fuel className="h-4 w-4" />
              <span>Estimated Gas</span>
            </div>
            <span>
              {Number(plan.estimatedTotalGas).toLocaleString()} (~$
              {plan.estimatedTotalGasUsd.toFixed(2)})
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span>From</span>
            </div>
            <code className="font-mono text-xs">
              {plan.fromAddress.slice(0, 6)}...{plan.fromAddress.slice(-4)}
            </code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {!simulationComplete ? (
            <Button
              onClick={onSimulate}
              disabled={isSimulating || isExpired}
              className="flex-1"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                "Simulate Transaction"
              )}
            </Button>
          ) : (
            <Button
              onClick={onExecute}
              disabled={isExpired}
              className="flex-1"
              variant="default"
            >
              <Check className="mr-2 h-4 w-4" />
              Execute Transaction
            </Button>
          )}
        </div>

        {isExpired && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span>
              This transaction plan has expired. Please rebuild to get fresh
              quotes.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
