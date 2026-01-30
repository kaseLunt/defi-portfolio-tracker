import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Address } from "viem";
import { router, publicProcedure } from "../trpc";
import { buildTransactionPlan } from "@/lib/transactions/builder";
import {
  extractApprovalRequests,
  checkApprovals,
  filterApprovedSteps,
  type ApprovalCheckResult,
} from "@/lib/transactions/approvals";
import {
  optimizePlanWithBatching,
  getBatchingSummary,
  type BatchAnalysis,
} from "@/lib/transactions/multicall";
import {
  simulateTransactionPlan,
  simulateTransactionBundle,
  getGasEstimate,
} from "../services/simulation";
import { getPriceBySymbol } from "../services/price";
import type {
  TransactionPlan,
  TenderlySimulationResult,
  StrategyExecutionInput,
} from "@/lib/transactions/types";
import type { BlockType } from "@/lib/strategy/types";

// ============================================================================
// Input Schemas
// ============================================================================

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const blockSchema = z.object({
  id: z.string(),
  type: z.enum(["input", "stake", "lend", "borrow", "swap", "lp", "loop", "auto-wrap"]),
  protocol: z.string().optional(),
  chainId: z.number(),
  params: z.record(z.string(), z.unknown()),
});

const edgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  flowPercent: z.number().min(0).max(100),
});

const strategyExecutionInputSchema = z.object({
  strategyId: z.string(),
  blocks: z.array(blockSchema),
  edges: z.array(edgeSchema),
  inputAmount: z.string(), // BigInt as string
  inputAsset: z.string(),
  walletAddress: addressSchema,
});

const transactionPlanSchema = z.object({
  id: z.string(),
  chainId: z.number(),
  fromAddress: addressSchema,
  steps: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      protocol: z.string(),
      chainId: z.number(),
      description: z.string(),
      to: addressSchema,
      data: z.string(),
      value: z.string(),
      tokenIn: z
        .object({
          address: addressSchema,
          symbol: z.string(),
          amount: z.string(),
          decimals: z.number(),
        })
        .optional(),
      tokenOut: z
        .object({
          address: addressSchema,
          symbol: z.string(),
          amount: z.string(),
          decimals: z.number(),
        })
        .optional(),
      estimatedGas: z.string().optional(),
      sourceBlockId: z.string().optional(),
    })
  ),
  totalSteps: z.number(),
  estimatedTotalGas: z.string(),
  estimatedTotalGasUsd: z.number(),
  strategyId: z.string().optional(),
  strategyName: z.string().optional(),
  createdAt: z.number(),
  expiresAt: z.number(),
});

// ============================================================================
// Router
// ============================================================================

export const transactionRouter = router({
  /**
   * Build a transaction plan from a strategy.
   * Converts strategy blocks into an ordered list of transactions.
   */
  buildPlan: publicProcedure
    .input(strategyExecutionInputSchema)
    .mutation(async ({ input }) => {
      console.log("[buildPlan] Starting with input:", JSON.stringify(input, null, 2));
      try {
        // Convert string amounts to BigInt
        console.log("[buildPlan] Converting input...");
        const executionInput: StrategyExecutionInput = {
          strategyId: input.strategyId,
          inputAmount: BigInt(input.inputAmount),
          inputAsset: input.inputAsset as StrategyExecutionInput["inputAsset"],
          walletAddress: input.walletAddress as Address,
          blocks: input.blocks.map((b) => ({
            ...b,
            type: b.type as BlockType,
          })),
          edges: input.edges,
        };

        console.log("[buildPlan] Calling buildTransactionPlan...");
        const plan = await buildTransactionPlan({
          input: executionInput,
        });

        console.log("[buildPlan] Plan built successfully, steps:", plan.steps.length);
        // Convert BigInts to strings for JSON serialization
        return serializeTransactionPlan(plan);
      } catch (error) {
        console.error("[buildPlan] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to build transaction plan",
        });
      }
    }),

  /**
   * Check existing on-chain approvals for a transaction plan.
   * Returns which approve steps can be skipped and estimated gas savings.
   */
  checkApprovals: publicProcedure
    .input(
      z.object({
        plan: transactionPlanSchema,
      })
    )
    .mutation(async ({ input }) => {
      try {
        const plan = deserializeTransactionPlan(input.plan);

        // Extract approval requests from the plan
        const approvalRequests = extractApprovalRequests(plan);

        if (approvalRequests.length === 0) {
          return {
            chainId: plan.chainId,
            approvals: [],
            skippableStepIds: [],
            estimatedGasSavings: "0",
            checkDurationMs: 0,
          };
        }

        // Check on-chain allowances
        const result = await checkApprovals(
          plan.chainId,
          plan.fromAddress,
          approvalRequests
        );

        // Serialize for JSON response
        return serializeApprovalCheckResult(result);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to check approvals",
        });
      }
    }),

  /**
   * Build and check approvals in one call.
   * Returns plan with approval status on each step.
   */
  buildPlanWithApprovals: publicProcedure
    .input(strategyExecutionInputSchema)
    .mutation(async ({ input }) => {
      try {
        // Convert string amounts to BigInt
        const executionInput: StrategyExecutionInput = {
          strategyId: input.strategyId,
          inputAmount: BigInt(input.inputAmount),
          inputAsset: input.inputAsset as StrategyExecutionInput["inputAsset"],
          walletAddress: input.walletAddress as Address,
          blocks: input.blocks.map((b) => ({
            ...b,
            type: b.type as BlockType,
          })),
          edges: input.edges,
        };

        // Build the plan
        console.log("[buildPlanWithApprovals] Building plan...");
        const plan = await buildTransactionPlan({
          input: executionInput,
        });
        console.log("[buildPlanWithApprovals] Plan built, steps:", plan.steps.length);
        console.log("[buildPlanWithApprovals] Step actions:", plan.steps.map(s => `${s.id}: ${s.action}`));

        // Check approvals
        const approvalRequests = extractApprovalRequests(plan);
        console.log("[buildPlanWithApprovals] Approval requests:", approvalRequests.length);
        console.log("[buildPlanWithApprovals] Approval details:", JSON.stringify(approvalRequests.map(r => ({
          stepId: r.stepId,
          token: r.token,
          spender: r.spender,
          amount: r.amount.toString()
        })), null, 2));

        let approvalResult: ApprovalCheckResult | null = null;

        if (approvalRequests.length > 0) {
          approvalResult = await checkApprovals(
            plan.chainId,
            plan.fromAddress,
            approvalRequests
          );
          console.log("[buildPlanWithApprovals] Approval check result:", JSON.stringify({
            skippableStepIds: approvalResult.skippableStepIds,
            approvals: approvalResult.approvals.map(a => ({
              token: a.token,
              isApproved: a.isApproved,
              currentAllowance: a.currentAllowance.toString(),
              requiredAmount: a.requiredAmount.toString()
            }))
          }, null, 2));
        }

        // Annotate steps with approval status
        const annotatedPlan = annotateStepsWithApprovalStatus(plan, approvalResult);
        console.log("[buildPlanWithApprovals] Annotated plan steps:", annotatedPlan.steps.length);
        console.log("[buildPlanWithApprovals] Annotated step statuses:", annotatedPlan.steps.map(s => ({
          id: s.id,
          action: s.action,
          canSkip: s.approvalStatus?.canSkip
        })));

        // Analyze batching opportunities
        const batchedPlan = optimizePlanWithBatching(annotatedPlan);
        console.log("[buildPlanWithApprovals] Batched plan steps:", batchedPlan.steps.length);
        console.log("[buildPlanWithApprovals] Final step actions:", batchedPlan.steps.map(s => `${s.id}: ${s.action}`));

        const batchingSummary = batchedPlan.batchAnalysis
          ? getBatchingSummary(batchedPlan.batchAnalysis)
          : null;

        return {
          plan: serializeTransactionPlan(batchedPlan),
          approvalCheck: approvalResult
            ? serializeApprovalCheckResult(approvalResult)
            : null,
          batchingSummary: batchingSummary
            ? serializeBatchingSummary(batchingSummary)
            : null,
        };
      } catch (error) {
        console.error("[buildPlanWithApprovals] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to build transaction plan",
        });
      }
    }),

  /**
   * Simulate a transaction plan using Tenderly.
   * Returns gas estimates and balance changes.
   */
  simulate: publicProcedure
    .input(
      z.object({
        plan: transactionPlanSchema,
        useBundle: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[simulate endpoint] Started, useBundle:", input.useBundle);
      console.log("[simulate endpoint] Plan has", input.plan.steps.length, "steps");

      try {
        // Get ETH price for USD calculations
        console.log("[simulate endpoint] Fetching ETH price...");
        const ethPriceData = await getPriceBySymbol("ETH");
        const ethPrice = ethPriceData?.priceUsd ?? 2500;
        console.log("[simulate endpoint] ETH price:", ethPrice);

        // Deserialize the plan
        console.log("[simulate endpoint] Deserializing plan...");
        const plan = deserializeTransactionPlan(input.plan);
        console.log("[simulate endpoint] Plan deserialized, steps:", plan.steps.length);

        // Run simulation
        console.log("[simulate endpoint] Calling simulation function...");
        const startTime = Date.now();
        const result = input.useBundle
          ? await simulateTransactionBundle(plan, ethPrice)
          : await simulateTransactionPlan(plan, ethPrice);
        console.log("[simulate endpoint] Simulation completed in", Date.now() - startTime, "ms");

        // Serialize for JSON response
        console.log("[simulate endpoint] Serializing result...");
        const serialized = serializeSimulationResult(result);
        console.log("[simulate endpoint] Done, success:", result.success);
        return serialized;
      } catch (error) {
        console.error("[simulate endpoint] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Simulation failed",
        });
      }
    }),

  /**
   * Get gas estimate for a chain.
   */
  getGasEstimate: publicProcedure
    .input(
      z.object({
        chainId: z.number(),
        gasLimit: z.string(), // BigInt as string
      })
    )
    .query(async ({ input }) => {
      const ethPriceData = await getPriceBySymbol("ETH");
      const ethPrice = ethPriceData?.priceUsd ?? 2500;
      const estimate = await getGasEstimate(
        input.chainId,
        BigInt(input.gasLimit),
        ethPrice
      );

      return {
        baseFee: estimate.baseFee.toString(),
        maxPriorityFee: estimate.maxPriorityFee.toString(),
        maxFee: estimate.maxFee.toString(),
        estimatedCostWei: estimate.estimatedCostWei.toString(),
        estimatedCostUsd: estimate.estimatedCostUsd,
      };
    }),

  /**
   * Get transaction plan by ID.
   * Plans are stored temporarily and expire after 5 minutes.
   */
  getPlan: publicProcedure
    .input(z.object({ planId: z.string() }))
    .query(async ({ input: _input }) => {
      // In production, you'd fetch this from Redis or a database
      // For now, return null (client should rebuild if needed)
      return null;
    }),
});

// ============================================================================
// Serialization Helpers
// ============================================================================

function serializeTransactionPlan(plan: TransactionPlan) {
  return {
    ...plan,
    estimatedTotalGas: plan.estimatedTotalGas.toString(),
    steps: plan.steps.map((step) => ({
      ...step,
      value: step.value.toString(),
      estimatedGas: step.estimatedGas?.toString(),
      tokenIn: step.tokenIn
        ? {
            ...step.tokenIn,
            amount: step.tokenIn.amount.toString(),
          }
        : undefined,
      tokenOut: step.tokenOut
        ? {
            ...step.tokenOut,
            amount: step.tokenOut.amount.toString(),
          }
        : undefined,
      approvalStatus: step.approvalStatus
        ? {
            ...step.approvalStatus,
            currentAllowance: step.approvalStatus.currentAllowance.toString(),
            requiredAmount: step.approvalStatus.requiredAmount.toString(),
          }
        : undefined,
      // Include batch info if present (from BatchedTransactionStep)
      batchInfo: (step as { batchInfo?: { batchId: string; indexInBatch: number; totalInBatch: number; batchedWith: string[] } }).batchInfo,
    })),
  };
}

// Safely convert a string that might have decimals to BigInt
function safeBigInt(value: string): bigint {
  // If it contains a decimal, truncate it
  if (value.includes('.')) {
    const intPart = value.split('.')[0];
    return BigInt(intPart || '0');
  }
  return BigInt(value);
}

function deserializeTransactionPlan(
  input: z.infer<typeof transactionPlanSchema>
): TransactionPlan {
  return {
    ...input,
    fromAddress: input.fromAddress as Address,
    estimatedTotalGas: safeBigInt(input.estimatedTotalGas),
    steps: input.steps.map((step) => ({
      ...step,
      action: step.action as TransactionPlan["steps"][0]["action"],
      to: step.to as Address,
      data: step.data as `0x${string}`,
      value: safeBigInt(step.value),
      estimatedGas: step.estimatedGas ? safeBigInt(step.estimatedGas) : undefined,
      tokenIn: step.tokenIn
        ? {
            ...step.tokenIn,
            address: step.tokenIn.address as Address,
            amount: safeBigInt(step.tokenIn.amount),
          }
        : undefined,
      tokenOut: step.tokenOut
        ? {
            ...step.tokenOut,
            address: step.tokenOut.address as Address,
            amount: safeBigInt(step.tokenOut.amount),
          }
        : undefined,
    })),
  };
}

function serializeSimulationResult(result: TenderlySimulationResult) {
  return {
    ...result,
    totalGasUsed: result.totalGasUsed.toString(),
    steps: result.steps.map((step) => ({
      ...step,
      gasUsed: step.gasUsed.toString(),
      gasPrice: step.gasPrice.toString(),
      gasCostWei: step.gasCostWei.toString(),
      balanceChanges: step.balanceChanges.map((bc) => ({
        ...bc,
        before: bc.before.toString(),
        after: bc.after.toString(),
        change: bc.change.toString(),
      })),
    })),
    netBalanceChanges: result.netBalanceChanges.map((bc) => ({
      ...bc,
      before: bc.before.toString(),
      after: bc.after.toString(),
      change: bc.change.toString(),
    })),
  };
}

function serializeApprovalCheckResult(result: ApprovalCheckResult) {
  return {
    ...result,
    estimatedGasSavings: result.estimatedGasSavings.toString(),
    approvals: result.approvals.map((a) => ({
      ...a,
      currentAllowance: a.currentAllowance.toString(),
      requiredAmount: a.requiredAmount.toString(),
    })),
  };
}

/**
 * Annotate transaction steps with their approval status.
 * This adds `approvalStatus` to approve steps based on on-chain data.
 */
function annotateStepsWithApprovalStatus(
  plan: TransactionPlan,
  approvalResult: ApprovalCheckResult | null
): TransactionPlan {
  if (!approvalResult) return plan;

  // Create a map of step ID to approval info
  const approvalMap = new Map<string, (typeof approvalResult.approvals)[0]>();
  for (const approval of approvalResult.approvals) {
    // Find the step ID that corresponds to this approval
    const stepId = approvalResult.skippableStepIds.find((id) => {
      const step = plan.steps.find((s) => s.id === id);
      return step?.to === approval.token;
    });

    // If not skippable, find any step matching this token
    if (!stepId) {
      const step = plan.steps.find(
        (s) => s.action === "approve" && s.to === approval.token
      );
      if (step) {
        approvalMap.set(step.id, approval);
      }
    } else {
      approvalMap.set(stepId, approval);
    }
  }

  // Also map by token address for steps we couldn't match by ID
  const tokenApprovalMap = new Map<string, (typeof approvalResult.approvals)[0]>();
  for (const approval of approvalResult.approvals) {
    tokenApprovalMap.set(approval.token.toLowerCase(), approval);
  }

  return {
    ...plan,
    steps: plan.steps.map((step) => {
      if (step.action !== "approve") return step;

      // Try to find approval info by step ID first, then by token address
      const approvalInfo =
        approvalMap.get(step.id) ||
        tokenApprovalMap.get(step.to.toLowerCase());

      if (!approvalInfo) return step;

      return {
        ...step,
        approvalStatus: {
          isApproved: approvalInfo.isApproved,
          currentAllowance: approvalInfo.currentAllowance,
          requiredAmount: approvalInfo.requiredAmount,
          canSkip: approvalInfo.isApproved,
        },
      };
    }),
  };
}

function serializeBatchingSummary(summary: ReturnType<typeof getBatchingSummary>) {
  return {
    ...summary,
    estimatedGasSavings: summary.estimatedGasSavings.toString(),
  };
}
