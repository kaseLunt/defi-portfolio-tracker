/**
 * Multicall Batching Service
 *
 * Batches compatible transactions using the Multicall3 contract to save gas.
 * Multicall3 is deployed at the same address on all major EVM chains.
 *
 * Gas savings come from:
 * - Reduced base transaction cost (21000 gas per tx → shared once)
 * - Reduced calldata overhead
 * - Single signature required
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import type { TransactionStep, TransactionPlan } from "./types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Multicall3 is deployed at the same address on all major chains:
 * Ethereum, Arbitrum, Optimism, Base, Polygon, etc.
 * https://www.multicall3.com/
 */
export const MULTICALL3_ADDRESS: Address =
  "0xcA11bde05977b3631167028862bE2a173976CA11";

/**
 * Multicall3 ABI (only the functions we need)
 */
export const multicall3Abi = [
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "value", type: "uint256" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3Value",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// Base transaction cost that's saved when batching
const BASE_TX_GAS = 21000n;

// Estimated overhead per call in multicall (calldata, CALL opcode, etc.)
const MULTICALL_OVERHEAD_PER_CALL = 2500n;

// ============================================================================
// Types
// ============================================================================

export interface BatchableGroup {
  /** Unique identifier for this batch */
  batchId: string;
  /** Steps included in this batch */
  steps: TransactionStep[];
  /** Whether all steps in the batch have no ETH value */
  isValueless: boolean;
  /** Total ETH value for the batch (if using aggregate3Value) */
  totalValue: bigint;
  /** Reason why these steps are grouped */
  batchReason: string;
}

export interface BatchAnalysis {
  /** Groups of steps that can be batched together */
  batchableGroups: BatchableGroup[];
  /** Steps that must remain unbatched */
  unbatchableSteps: TransactionStep[];
  /** Estimated gas savings from batching */
  estimatedGasSavings: bigint;
  /** Number of transactions after batching */
  finalTxCount: number;
  /** Original number of transactions */
  originalTxCount: number;
}

export interface BatchedTransactionStep extends TransactionStep {
  /** If this step is part of a batch */
  batchInfo?: {
    batchId: string;
    indexInBatch: number;
    totalInBatch: number;
    /** IDs of other steps in the same batch */
    batchedWith: string[];
  };
}

export interface BatchedTransactionPlan extends Omit<TransactionPlan, "steps"> {
  steps: BatchedTransactionStep[];
  /** Batch analysis info */
  batchAnalysis?: BatchAnalysis;
}

// ============================================================================
// Batching Logic
// ============================================================================

/**
 * Analyze a transaction plan and identify batchable groups.
 *
 * Rules for batching:
 * 1. Steps must be on the same chain
 * 2. Approval steps can be batched with their following action
 * 3. Steps with ETH value can only be batched using aggregate3Value
 * 4. Sequential dependencies must be respected (can't batch if step N needs output of step N-1)
 */
export function analyzeBatchability(plan: TransactionPlan): BatchAnalysis {
  const batchableGroups: BatchableGroup[] = [];
  const unbatchableSteps: TransactionStep[] = [];
  const processedStepIds = new Set<string>();

  let batchCounter = 0;
  const steps = plan.steps;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Skip if already processed
    if (processedStepIds.has(step.id)) continue;

    // Skip if step can be skipped (already approved)
    if (step.approvalStatus?.canSkip) {
      processedStepIds.add(step.id);
      continue;
    }

    // Check if this is an approval that can be batched with the next step
    if (step.action === "approve" && i + 1 < steps.length) {
      const nextStep = steps[i + 1];

      // Can batch approval with the action that uses it
      if (canBatchApprovalWithAction(step, nextStep)) {
        const batchSteps = [step, nextStep];
        const totalValue = step.value + nextStep.value;

        batchableGroups.push({
          batchId: `batch-${batchCounter++}`,
          steps: batchSteps,
          isValueless: totalValue === 0n,
          totalValue,
          batchReason: `Approve + ${nextStep.action}`,
        });

        processedStepIds.add(step.id);
        processedStepIds.add(nextStep.id);
        continue;
      }
    }

    // Check for consecutive same-protocol steps that can be batched
    const consecutiveGroup = findConsecutiveBatchableSteps(steps, i, processedStepIds);
    if (consecutiveGroup.length > 1) {
      const totalValue = consecutiveGroup.reduce((sum, s) => sum + s.value, 0n);

      batchableGroups.push({
        batchId: `batch-${batchCounter++}`,
        steps: consecutiveGroup,
        isValueless: totalValue === 0n,
        totalValue,
        batchReason: `${consecutiveGroup.length} ${consecutiveGroup[0].protocol} operations`,
      });

      for (const s of consecutiveGroup) {
        processedStepIds.add(s.id);
      }
      continue;
    }

    // Can't batch this step
    unbatchableSteps.push(step);
    processedStepIds.add(step.id);
  }

  // Calculate gas savings
  const batchedStepCount = batchableGroups.reduce((sum, g) => sum + g.steps.length, 0);
  const batchCount = batchableGroups.length;

  // Each batch saves (stepsInBatch - 1) * BASE_TX_GAS, minus multicall overhead
  let estimatedGasSavings = 0n;
  for (const group of batchableGroups) {
    const savedBaseFees = BigInt(group.steps.length - 1) * BASE_TX_GAS;
    const multicallOverhead = BigInt(group.steps.length) * MULTICALL_OVERHEAD_PER_CALL;
    estimatedGasSavings += savedBaseFees - multicallOverhead;
  }

  // Ensure savings don't go negative
  if (estimatedGasSavings < 0n) estimatedGasSavings = 0n;

  return {
    batchableGroups,
    unbatchableSteps,
    estimatedGasSavings,
    finalTxCount: batchCount + unbatchableSteps.length,
    originalTxCount: steps.filter((s) => !s.approvalStatus?.canSkip).length,
  };
}

/**
 * Check if an approval step can be batched with the following action step.
 */
function canBatchApprovalWithAction(
  approveStep: TransactionStep,
  actionStep: TransactionStep
): boolean {
  // Must be an approval
  if (approveStep.action !== "approve") return false;

  // Action must be a non-approval DeFi action
  if (actionStep.action === "approve") return false;

  // Must be same chain
  if (approveStep.chainId !== actionStep.chainId) return false;

  // Approval is typically for the next step's protocol
  // Check if the approval's token matches the action's tokenIn
  if (approveStep.tokenIn && actionStep.tokenIn) {
    // Different tokens means different operations
    if (approveStep.tokenIn.address !== actionStep.tokenIn.address) {
      return false;
    }
  }

  return true;
}

/**
 * Find consecutive steps that can be batched together.
 * Steps are batchable if:
 * - Same protocol
 * - Same chain
 * - No dependencies on previous step outputs (simplified check)
 */
function findConsecutiveBatchableSteps(
  steps: TransactionStep[],
  startIndex: number,
  processedIds: Set<string>
): TransactionStep[] {
  const result: TransactionStep[] = [];
  const firstStep = steps[startIndex];

  if (processedIds.has(firstStep.id)) return result;
  if (firstStep.approvalStatus?.canSkip) return result;

  result.push(firstStep);

  for (let i = startIndex + 1; i < steps.length; i++) {
    const step = steps[i];

    if (processedIds.has(step.id)) break;
    if (step.approvalStatus?.canSkip) continue;

    // Must be same protocol and chain
    if (step.protocol !== firstStep.protocol) break;
    if (step.chainId !== firstStep.chainId) break;

    // Stop if this step likely depends on previous output
    // (e.g., using tokenOut from previous as tokenIn)
    const prevStep = result[result.length - 1];
    if (hasOutputDependency(prevStep, step)) break;

    result.push(step);
  }

  return result;
}

/**
 * Check if a step depends on the output of a previous step.
 * This is a simplified heuristic - in practice, more analysis may be needed.
 */
function hasOutputDependency(
  prevStep: TransactionStep,
  currentStep: TransactionStep
): boolean {
  // If previous step has tokenOut and current has tokenIn
  // and they match, current likely depends on previous
  if (prevStep.tokenOut && currentStep.tokenIn) {
    if (prevStep.tokenOut.address === currentStep.tokenIn.address) {
      return true;
    }
  }

  // Wrap/unwrap output is used by next step
  if (
    (prevStep.action === "wrap" || prevStep.action === "unwrap") &&
    prevStep.tokenOut &&
    currentStep.tokenIn
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Batch Encoding
// ============================================================================

/**
 * Encode a batch of steps into a single Multicall3 transaction.
 */
export function encodeBatch(group: BatchableGroup): {
  to: Address;
  data: Hex;
  value: bigint;
} {
  if (group.isValueless) {
    // Use aggregate3 for calls without ETH value
    const calls = group.steps.map((step) => ({
      target: step.to,
      allowFailure: false, // We want atomic execution
      callData: step.data,
    }));

    const data = encodeFunctionData({
      abi: multicall3Abi,
      functionName: "aggregate3",
      args: [calls],
    });

    return {
      to: MULTICALL3_ADDRESS,
      data,
      value: 0n,
    };
  } else {
    // Use aggregate3Value for calls with ETH value
    const calls = group.steps.map((step) => ({
      target: step.to,
      allowFailure: false,
      value: step.value,
      callData: step.data,
    }));

    const data = encodeFunctionData({
      abi: multicall3Abi,
      functionName: "aggregate3Value",
      args: [calls],
    });

    return {
      to: MULTICALL3_ADDRESS,
      data,
      value: group.totalValue,
    };
  }
}

// ============================================================================
// Plan Optimization
// ============================================================================

/**
 * Optimize a transaction plan by batching compatible steps.
 * Returns a new plan with batch information attached to steps.
 */
export function optimizePlanWithBatching(plan: TransactionPlan): BatchedTransactionPlan {
  const analysis = analyzeBatchability(plan);

  // Create new steps array with batch info
  const optimizedSteps: BatchedTransactionStep[] = [];

  // Add batched steps with their batch info
  for (const group of analysis.batchableGroups) {
    const batchedWith = group.steps.map((s) => s.id);

    for (let i = 0; i < group.steps.length; i++) {
      const step = group.steps[i];
      optimizedSteps.push({
        ...step,
        batchInfo: {
          batchId: group.batchId,
          indexInBatch: i,
          totalInBatch: group.steps.length,
          batchedWith: batchedWith.filter((id) => id !== step.id),
        },
      });
    }
  }

  // Add unbatched steps without batch info
  for (const step of analysis.unbatchableSteps) {
    optimizedSteps.push(step);
  }

  // Sort steps to maintain original order
  const originalOrder = new Map(plan.steps.map((s, i) => [s.id, i]));
  optimizedSteps.sort((a, b) => {
    const orderA = originalOrder.get(a.id) ?? 999;
    const orderB = originalOrder.get(b.id) ?? 999;
    return orderA - orderB;
  });

  // Calculate new gas estimate
  const originalGas = plan.estimatedTotalGas;
  const newEstimatedGas = originalGas - analysis.estimatedGasSavings;

  return {
    ...plan,
    steps: optimizedSteps,
    totalSteps: optimizedSteps.length, // Update totalSteps to match actual step count
    estimatedTotalGas: newEstimatedGas > 0n ? newEstimatedGas : originalGas,
    batchAnalysis: analysis,
  };
}

/**
 * Get a summary of batching optimizations for display.
 */
export function getBatchingSummary(analysis: BatchAnalysis): {
  hasBatches: boolean;
  batchCount: number;
  batchedStepCount: number;
  unbatchedStepCount: number;
  estimatedGasSavings: bigint;
  transactionReduction: number;
  description: string;
} {
  const batchedStepCount = analysis.batchableGroups.reduce(
    (sum, g) => sum + g.steps.length,
    0
  );

  const transactionReduction = analysis.originalTxCount - analysis.finalTxCount;

  let description = "";
  if (analysis.batchableGroups.length > 0) {
    const batchDescriptions = analysis.batchableGroups
      .map((g) => g.batchReason)
      .join(", ");
    description = `Batching ${batchedStepCount} steps into ${analysis.batchableGroups.length} transaction(s): ${batchDescriptions}`;
  } else {
    description = "No batching opportunities found";
  }

  return {
    hasBatches: analysis.batchableGroups.length > 0,
    batchCount: analysis.batchableGroups.length,
    batchedStepCount,
    unbatchedStepCount: analysis.unbatchableSteps.length,
    estimatedGasSavings: analysis.estimatedGasSavings,
    transactionReduction,
    description,
  };
}
