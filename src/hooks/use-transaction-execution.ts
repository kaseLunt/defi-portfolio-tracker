"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { trpc } from "@/lib/trpc";
import { useStrategyStore } from "@/lib/strategy/store";
import type { BlockType } from "@/lib/strategy/types";

// ============================================================================
// Types
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

interface SerializedTransactionPlan {
  id: string;
  chainId: number;
  fromAddress: string;
  steps: Array<{
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
  }>;
  totalSteps: number;
  estimatedTotalGas: string;
  estimatedTotalGasUsd: number;
  strategyId?: string;
  strategyName?: string;
  createdAt: number;
  expiresAt: number;
}

interface SerializedBatchingSummary {
  hasBatches: boolean;
  batchCount: number;
  batchedStepCount: number;
  unbatchedStepCount: number;
  estimatedGasSavings: string;
  transactionReduction: number;
  description: string;
}

interface SerializedApprovalCheckResult {
  chainId: number;
  approvals: Array<{
    token: string;
    spender: string;
    owner: string;
    currentAllowance: string;
    requiredAmount: string;
    isApproved: boolean;
    needsApproval: boolean;
    isPartiallyApproved: boolean;
  }>;
  skippableStepIds: string[];
  estimatedGasSavings: string;
  checkDurationMs: number;
}

interface SerializedSimulationResult {
  success: boolean;
  totalGasUsed: string;
  totalGasCostUsd: number;
  steps: Array<{
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
    balanceChanges: Array<{
      token: string;
      symbol: string;
      decimals: number;
      before: string;
      after: string;
      change: string;
      changeUsd: number;
    }>;
    error?: string;
    revertReason?: string;
  }>;
  netBalanceChanges: Array<{
    token: string;
    symbol: string;
    decimals: number;
    before: string;
    after: string;
    change: string;
    changeUsd: number;
  }>;
  warnings: string[];
  failedAtStep?: number;
  errorMessage?: string;
  simulationId?: string;
  simulationUrl?: string;
}

export type ExecutionPhase =
  | "idle"
  | "building"
  | "preview"
  | "simulating"
  | "ready"
  | "executing"
  | "complete"
  | "error";

// ============================================================================
// Hook
// ============================================================================

export function useTransactionExecution() {
  const { address, isConnected } = useAccount();
  const blocks = useStrategyStore((state) => state.blocks);
  const edges = useStrategyStore((state) => state.edges);
  const optimizeStrategy = useStrategyStore((state) => state.optimizeStrategy);
  const getRouteIncompatibilities = useStrategyStore((state) => state.getRouteIncompatibilities);
  const validateStrategy = useStrategyStore((state) => state.validateStrategy);

  const [phase, setPhase] = useState<ExecutionPhase>("idle");
  const [plan, setPlan] = useState<SerializedTransactionPlan | null>(null);
  const [simulationResult, setSimulationResult] =
    useState<SerializedSimulationResult | null>(null);
  const [approvalCheck, setApprovalCheck] =
    useState<SerializedApprovalCheckResult | null>(null);
  const [batchingSummary, setBatchingSummary] =
    useState<SerializedBatchingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations
  const buildPlanWithApprovalsMutation = trpc.transaction.buildPlanWithApprovals.useMutation();
  const simulateMutation = trpc.transaction.simulate.useMutation();

  // Check if strategy can be executed
  const canExecute =
    isConnected &&
    address &&
    blocks.length > 0 &&
    blocks.some(
      (b) =>
        b.type === "stake" ||
        b.type === "lend" ||
        b.type === "borrow" ||
        b.type === "swap"
    );

  // Build transaction plan from current strategy
  const buildPlan = useCallback(async () => {
    console.log("[buildPlan] Starting...", { address, blocksCount: blocks.length });
    if (!address || blocks.length === 0) {
      console.log("[buildPlan] No wallet or empty strategy");
      setError("No wallet connected or strategy empty");
      return;
    }

    setPhase("building");
    setError(null);

    try {
      // Step 1: Check for route incompatibilities and auto-optimize
      const incompatibilities = getRouteIncompatibilities();
      if (incompatibilities.length > 0) {
        console.log("[buildPlan] Found route incompatibilities, auto-optimizing...", incompatibilities);
        const { insertedCount } = optimizeStrategy();
        console.log("[buildPlan] Auto-inserted", insertedCount, "wrap blocks");
      }

      // Step 2: Validate the strategy
      const validation = validateStrategy();
      if (!validation.isValid) {
        console.log("[buildPlan] Validation failed:", validation.errors);
        setError(validation.errors.map(e => e.message).join("; "));
        setPhase("error");
        return;
      }

      // Get the latest blocks/edges after optimization
      const currentBlocks = useStrategyStore.getState().blocks;
      const currentEdges = useStrategyStore.getState().edges;

      // Find input block to get the amount
      const inputBlock = currentBlocks.find((b) => b.type === "input");
      const inputAmount = Number(inputBlock?.data?.amount ?? 1);
      const inputAsset = (inputBlock?.data?.asset as string) ?? "ETH";

      // Convert amount to wei (assuming ETH for now)
      const inputAmountWei = BigInt(Math.floor(inputAmount * 1e18)).toString();

      // Get chainId from first non-input block
      const chainBlock = currentBlocks.find((b) => b.type !== "input");
      const chainId = (chainBlock?.data as { chain?: number })?.chain ?? 1;

      console.log("[buildPlan] Calling mutation with:", { inputAmount, chainId, blocksCount: currentBlocks.length });

      const result = await buildPlanWithApprovalsMutation.mutateAsync({
        strategyId: `strategy-${Date.now()}`,
        blocks: currentBlocks.map((b) => ({
          id: b.id,
          type: b.type as BlockType,
          protocol: (b.data as { protocol?: string })?.protocol,
          chainId,
          params: b.data as Record<string, unknown>,
        })),
        edges: currentEdges.map((e) => ({
          source: e.source,
          target: e.target,
          flowPercent: (e.data?.flowPercent as number) ?? 100,
        })),
        inputAmount: inputAmountWei,
        inputAsset: inputAsset as string,
        walletAddress: address,
      });

      console.log("[buildPlan] Got result:", result);
      setPlan(result.plan);
      setApprovalCheck(result.approvalCheck);
      setBatchingSummary(result.batchingSummary);
      setPhase("preview");
    } catch (err) {
      console.error("[buildPlan] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to build plan");
      setPhase("error");
    }
  }, [address, blocks, edges, buildPlanWithApprovalsMutation, getRouteIncompatibilities, optimizeStrategy, validateStrategy]);

  // Simulate the transaction plan
  const simulate = useCallback(async () => {
    if (!plan) {
      setError("No plan to simulate");
      return;
    }

    setPhase("simulating");
    setError(null);

    try {
      const result = await simulateMutation.mutateAsync({
        plan,
        useBundle: true,
      });

      setSimulationResult(result);
      setPhase(result.success ? "ready" : "error");

      if (!result.success) {
        setError(result.errorMessage ?? "Simulation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setPhase("error");
    }
  }, [plan, simulateMutation]);

  // Execute the transactions (placeholder - needs wallet integration)
  const execute = useCallback(async () => {
    if (!plan || !simulationResult?.success) {
      setError("Cannot execute: simulation not successful");
      return;
    }

    setPhase("executing");
    // TODO: Implement actual transaction execution with wagmi
    // This would involve:
    // 1. For each step, prepare the transaction
    // 2. Request user signature
    // 3. Send to network
    // 4. Wait for confirmation
    // 5. Update UI with progress

    // For now, just mark as complete after a delay
    setTimeout(() => {
      setPhase("complete");
    }, 2000);
  }, [plan, simulationResult]);

  // Reset to initial state
  const reset = useCallback(() => {
    setPhase("idle");
    setPlan(null);
    setSimulationResult(null);
    setApprovalCheck(null);
    setBatchingSummary(null);
    setError(null);
  }, []);

  // Step descriptions for UI
  const stepDescriptions =
    plan?.steps.reduce(
      (acc, step) => {
        acc[step.id] = step.description;
        return acc;
      },
      {} as Record<string, string>
    ) ?? {};

  // Compute approval savings info
  const approvalSavings = approvalCheck
    ? {
        skippableCount: approvalCheck.skippableStepIds.length,
        estimatedGasSavings: approvalCheck.estimatedGasSavings,
        checkDurationMs: approvalCheck.checkDurationMs,
      }
    : null;

  // Count steps by approval status
  const approvalStats = plan
    ? {
        totalApprovalSteps: plan.steps.filter((s) => s.action === "approve").length,
        alreadyApproved: plan.steps.filter(
          (s) => s.action === "approve" && s.approvalStatus?.isApproved
        ).length,
        needsApproval: plan.steps.filter(
          (s) => s.action === "approve" && !s.approvalStatus?.isApproved
        ).length,
      }
    : null;

  return {
    // State
    phase,
    plan,
    simulationResult,
    approvalCheck,
    batchingSummary,
    error,
    canExecute,
    stepDescriptions,

    // Approval info
    approvalSavings,
    approvalStats,

    // Computed
    isBuilding: phase === "building",
    isSimulating: phase === "simulating",
    isExecuting: phase === "executing",
    isReady: phase === "ready",
    hasError: phase === "error",

    // Actions
    buildPlan,
    simulate,
    execute,
    reset,
  };
}
