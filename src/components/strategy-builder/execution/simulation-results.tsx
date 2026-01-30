"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Lightbulb,
  Wrench,
} from "lucide-react";
import { formatUnits } from "viem";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { translateError, type TranslatedError } from "@/lib/strategy/route-optimizer";

// ============================================================================
// Types (serialized versions from tRPC)
// ============================================================================

interface SerializedBalanceChange {
  token: string;
  symbol: string;
  decimals: number;
  before: string;
  after: string;
  change: string;
  changeUsd: number;
}

interface SerializedStepResult {
  stepId: string;
  success: boolean;
  gasUsed: string;
  gasPrice: string;
  gasCostWei: string;
  gasCostUsd: number;
  logs: Array<{
    address: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  balanceChanges: SerializedBalanceChange[];
  error?: string;
  revertReason?: string;
}

interface SerializedSimulationResult {
  success: boolean;
  totalGasUsed: string;
  totalGasCostUsd: number;
  steps: SerializedStepResult[];
  netBalanceChanges: SerializedBalanceChange[];
  warnings: string[];
  failedAtStep?: number;
  errorMessage?: string;
  simulationId?: string;
  simulationUrl?: string;
}

// ============================================================================
// Props
// ============================================================================

interface SimulationResultsProps {
  result: SerializedSimulationResult;
  stepDescriptions?: Record<string, string>;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SimulationResults({
  result,
  stepDescriptions = {},
  className,
}: SimulationResultsProps) {
  const successfulSteps = result.steps.filter((s) => s.success).length;
  const progressPercent = (successfulSteps / result.steps.length) * 100;

  // Translate the error message to user-friendly format
  const translatedError: TranslatedError | null = useMemo(() => {
    if (!result.errorMessage) return null;
    return translateError(result.errorMessage);
  }, [result.errorMessage]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {result.success ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">
                {result.success ? "Simulation Successful" : "Simulation Failed"}
              </CardTitle>
              <CardDescription>
                {successfulSteps} of {result.steps.length} transactions would
                succeed
              </CardDescription>
            </div>
          </div>
          {result.simulationUrl && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={result.simulationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View in Tenderly
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Transaction Progress</span>
            <span>
              {successfulSteps}/{result.steps.length}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                result.success ? "bg-green-500" : "bg-red-500"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Results */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Transaction Steps</h4>
          <div className="space-y-1">
            {result.steps.map((step, index) => (
              <motion.div
                key={step.stepId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center justify-between rounded-lg p-2",
                  step.success
                    ? "bg-green-500/5"
                    : "bg-red-500/5"
                )}
              >
                <div className="flex items-center gap-2">
                  {step.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {stepDescriptions[step.stepId] ?? `Step ${index + 1}`}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Fuel className="h-3 w-3" />
                    <span>{Number(step.gasUsed).toLocaleString()}</span>
                  </div>
                  <span>${step.gasCostUsd.toFixed(2)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Error Message - Enhanced with translation */}
        {result.errorMessage && translatedError && (
          <div className="space-y-3">
            {/* Main Error Card */}
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-500">
                    {translatedError.title}
                  </p>
                  <p className="text-sm text-red-400/90 mt-1">
                    {translatedError.description}
                  </p>
                  {translatedError.technicalDetails && (
                    <p className="text-xs text-red-400/60 mt-2 font-mono">
                      {translatedError.technicalDetails}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Failed at step {(result.failedAtStep ?? 0) + 1}
                  </p>
                </div>
              </div>
            </div>

            {/* Suggested Fixes */}
            {translatedError.suggestedFixes.length > 0 && (
              <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">
                    Suggested Fixes
                  </span>
                </div>
                <div className="space-y-2">
                  {translatedError.suggestedFixes.map((fix, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md bg-purple-500/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3.5 w-3.5 text-purple-400/70" />
                        <span className="text-sm text-purple-200">
                          {fix.label}
                        </span>
                      </div>
                      {fix.action === "add_wrap" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="space-y-2">
            {result.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm"
              >
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-yellow-600 dark:text-yellow-400">
                  {warning}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border" />

        {/* Balance Changes */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Expected Balance Changes</h4>
          <div className="grid gap-2">
            {result.netBalanceChanges.map((change, index) => {
              const changeValue = BigInt(change.change);
              const isPositive = changeValue > 0n;
              const formattedAmount = formatUnits(
                changeValue < 0n ? -changeValue : changeValue,
                change.decimals
              );

              return (
                <motion.div
                  key={`${change.token}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center justify-between rounded-lg p-3",
                    isPositive ? "bg-green-500/5" : "bg-red-500/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        isPositive ? "bg-green-500/10" : "bg-red-500/10"
                      )}
                    >
                      {isPositive ? (
                        <ArrowDownRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{change.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {change.token.slice(0, 6)}...{change.token.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "font-medium",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {isPositive ? "+" : "-"}
                      {Number(formattedAmount).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}{" "}
                      {change.symbol}
                    </p>
                    {change.changeUsd !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        {isPositive ? "+" : "-"}$
                        {Math.abs(change.changeUsd).toFixed(2)}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Gas Summary */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Total Gas Cost</span>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {Number(result.totalGasUsed).toLocaleString()} gas
            </p>
            <p className="text-sm text-muted-foreground">
              ~${result.totalGasCostUsd.toFixed(2)} USD
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
