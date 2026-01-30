/**
 * Token Approval Checking Service
 *
 * Queries on-chain ERC20 allowances to determine if approval transactions
 * are needed. Helps skip redundant approve txs and provides status indicators.
 */

import type { Address } from "viem";
import { getClient, isSupportedChain } from "@/server/lib/rpc";
import { erc20Abi } from "@/server/lib/abis/erc20";
import type { TransactionStep, TransactionPlan } from "./types";
import type { SupportedChainId } from "@/lib/constants";

// ============================================================================
// Types
// ============================================================================

export interface TokenApproval {
  token: Address;
  spender: Address;
  owner: Address;
  currentAllowance: bigint;
  requiredAmount: bigint;
  isApproved: boolean;
  needsApproval: boolean;
  /** If allowance is non-zero but less than required */
  isPartiallyApproved: boolean;
}

export interface ApprovalCheckResult {
  chainId: number;
  approvals: TokenApproval[];
  /** Steps that can be skipped due to existing approvals */
  skippableStepIds: string[];
  /** Total gas that would be saved by skipping */
  estimatedGasSavings: bigint;
  /** Time taken to check (ms) */
  checkDurationMs: number;
}

export interface ApprovalRequest {
  token: Address;
  spender: Address;
  amount: bigint;
  stepId: string;
}

// ============================================================================
// Approval Checking
// ============================================================================

/**
 * Extract approval requests from a transaction plan.
 * Identifies which tokens need approval for which spenders.
 */
export function extractApprovalRequests(plan: TransactionPlan): ApprovalRequest[] {
  const requests: ApprovalRequest[] = [];

  for (const step of plan.steps) {
    if (step.action === "approve") {
      // The 'to' field is the token address for approve txs
      // We need to decode the calldata to get the spender and amount
      // For now, we'll use a heuristic based on the next step
      const nextStepIndex = plan.steps.findIndex((s) => s.id === step.id) + 1;
      const nextStep = plan.steps[nextStepIndex];

      if (nextStep) {
        requests.push({
          token: step.to,
          spender: nextStep.to, // The spender is typically the next step's target
          amount: step.tokenIn?.amount ?? 0n,
          stepId: step.id,
        });
      }
    }
  }

  return requests;
}

/**
 * Check on-chain allowances for a list of approval requests.
 * Uses multicall to batch all allowance queries into a single RPC call.
 */
export async function checkApprovals(
  chainId: number,
  owner: Address,
  requests: ApprovalRequest[]
): Promise<ApprovalCheckResult> {
  const startTime = performance.now();

  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const client = getClient(chainId as SupportedChainId);
  const approvals: TokenApproval[] = [];
  const skippableStepIds: string[] = [];
  let estimatedGasSavings = 0n;

  // Batch all allowance checks using multicall
  const allowanceResults = await Promise.allSettled(
    requests.map(async (req) => {
      const allowance = await client.readContract({
        address: req.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, req.spender],
      });
      return { ...req, allowance: allowance as bigint };
    })
  );

  for (let i = 0; i < allowanceResults.length; i++) {
    const result = allowanceResults[i];
    const request = requests[i];

    if (result.status === "fulfilled") {
      const currentAllowance = result.value.allowance;
      const isApproved = currentAllowance >= request.amount;
      const isPartiallyApproved = currentAllowance > 0n && currentAllowance < request.amount;

      approvals.push({
        token: request.token,
        spender: request.spender,
        owner,
        currentAllowance,
        requiredAmount: request.amount,
        isApproved,
        needsApproval: !isApproved,
        isPartiallyApproved,
      });

      if (isApproved) {
        skippableStepIds.push(request.stepId);
        // Standard approve tx costs ~46k gas
        estimatedGasSavings += 46000n;
      }
    } else {
      // If allowance check fails, assume approval is needed
      console.warn(
        `[approvals] Failed to check allowance for ${request.token}:`,
        result.reason
      );
      approvals.push({
        token: request.token,
        spender: request.spender,
        owner,
        currentAllowance: 0n,
        requiredAmount: request.amount,
        isApproved: false,
        needsApproval: true,
        isPartiallyApproved: false,
      });
    }
  }

  const checkDurationMs = performance.now() - startTime;

  return {
    chainId,
    approvals,
    skippableStepIds,
    estimatedGasSavings,
    checkDurationMs,
  };
}

/**
 * Filter a transaction plan to remove steps that aren't needed
 * based on existing on-chain approvals.
 */
export function filterApprovedSteps(
  plan: TransactionPlan,
  checkResult: ApprovalCheckResult
): TransactionPlan {
  const filteredSteps = plan.steps.filter(
    (step) => !checkResult.skippableStepIds.includes(step.id)
  );

  // Recalculate totals
  const estimatedTotalGas = filteredSteps.reduce(
    (sum, step) => sum + (step.estimatedGas ?? 0n),
    0n
  );

  return {
    ...plan,
    steps: filteredSteps,
    totalSteps: filteredSteps.length,
    estimatedTotalGas,
  };
}

// ============================================================================
// Approval Status Helpers
// ============================================================================

export type ApprovalStatus = "approved" | "needs-approval" | "partial" | "unknown";

/**
 * Get a human-readable approval status for display.
 */
export function getApprovalStatus(approval: TokenApproval): ApprovalStatus {
  if (approval.isApproved) return "approved";
  if (approval.isPartiallyApproved) return "partial";
  if (approval.needsApproval) return "needs-approval";
  return "unknown";
}

/**
 * Get approval status message for UI display.
 */
export function getApprovalStatusMessage(approval: TokenApproval): string {
  if (approval.isApproved) {
    return "Already approved";
  }
  if (approval.isPartiallyApproved) {
    return "Partially approved - needs increase";
  }
  return "Approval required";
}

// ============================================================================
// Max Approval Checking
// ============================================================================

const MAX_UINT256 = 2n ** 256n - 1n;
const HIGH_APPROVAL_THRESHOLD = MAX_UINT256 / 2n;

/**
 * Check if a token has a "max approval" (effectively unlimited).
 * Some users prefer to set max approvals to avoid repeated approval txs.
 */
export function hasMaxApproval(approval: TokenApproval): boolean {
  return approval.currentAllowance >= HIGH_APPROVAL_THRESHOLD;
}

/**
 * Get the recommended approval amount.
 * Returns exact amount for better security, or MAX_UINT256 if user prefers.
 */
export function getRecommendedApprovalAmount(
  requiredAmount: bigint,
  preferMaxApproval: boolean = false
): bigint {
  if (preferMaxApproval) {
    return MAX_UINT256;
  }
  // Add 1% buffer for rounding/slippage
  return (requiredAmount * 101n) / 100n;
}
