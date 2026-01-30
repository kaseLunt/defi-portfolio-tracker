/**
 * Tenderly Simulation Service
 *
 * Simulates transaction plans using Tenderly's simulation API.
 */

import type { Address, Hex } from "viem";
import { formatEther } from "viem";
import type {
  TransactionPlan,
  TenderlySimulationResult,
  SimulationStepResult,
  TokenBalanceChange,
  DecodedLog,
} from "@/lib/transactions/types";

// ============================================================================
// Configuration
// ============================================================================

const TENDERLY_API_URL = "https://api.tenderly.co/api/v1";
const TENDERLY_TIMEOUT_MS = 30000; // 30 second timeout per request

// Safely convert a string that might have decimals to BigInt
function safeBigInt(value: string | number): bigint {
  const str = String(value);
  if (str.includes('.')) {
    const intPart = str.split('.')[0];
    return BigInt(intPart || '0');
  }
  return BigInt(str);
}

interface TenderlyConfig {
  accessKey: string;
  accountSlug: string;
  projectSlug: string;
}

function getTenderlyConfig(): TenderlyConfig {
  const accessKey = process.env.TENDERLY_ACCESS_KEY;
  const accountSlug = process.env.TENDERLY_ACCOUNT_SLUG;
  const projectSlug = process.env.TENDERLY_PROJECT_SLUG;

  if (!accessKey || !accountSlug || !projectSlug) {
    throw new Error(
      "Missing Tenderly configuration. Set TENDERLY_ACCESS_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG"
    );
  }

  return { accessKey, accountSlug, projectSlug };
}

// ============================================================================
// Types for Tenderly API
// ============================================================================

interface TenderlySimulationRequest {
  network_id: string;
  from: string;
  to: string;
  input: string;
  value: string;
  gas?: number;
  gas_price?: string;
  save?: boolean;
  save_if_fails?: boolean;
  simulation_type?: "quick" | "full";
  state_objects?: Record<string, TenderlyStateObject>;
}

interface TenderlyStateObject {
  balance?: string;
  code?: string;
  storage?: Record<string, string>;
}

interface TenderlySimulationResponse {
  simulation: {
    id: string;
    status: boolean;
    gas_used: number;
    block_number: number;
    method?: string;
    error_message?: string;
  };
  transaction: {
    hash: string;
    transaction_info: {
      call_trace?: {
        calls?: TenderlyCall[];
      };
      logs?: TenderlyLog[];
      asset_changes?: TenderlyAssetChange[];
      balance_changes?: TenderlyBalanceChange[];
    };
  };
}

interface TenderlyCall {
  from: string;
  to: string;
  value?: string;
  function_name?: string;
  error?: string;
}

interface TenderlyLog {
  address: string;
  topics: string[];
  data: string;
  decoded?: {
    name: string;
    inputs: Array<{ name: string; value: unknown }>;
  };
}

interface TenderlyAssetChange {
  token_id: string;
  token_info: {
    symbol: string;
    decimals: number;
    contract_address: string;
  };
  from: string;
  to: string;
  amount: string;
  dollar_value?: string;
  type: "Transfer" | "Mint" | "Burn";
}

interface TenderlyBalanceChange {
  address: string;
  original: string;
  dirty: string;
  is_miner: boolean;
}

// ============================================================================
// Simulation Service
// ============================================================================

/**
 * Simulates a transaction plan using Tenderly.
 * Runs each step sequentially, accumulating state changes.
 */
export async function simulateTransactionPlan(
  plan: TransactionPlan,
  ethPriceUsd: number = 2500
): Promise<TenderlySimulationResult> {
  const config = getTenderlyConfig();
  const steps: SimulationStepResult[] = [];
  const allBalanceChanges: Map<string, TokenBalanceChange> = new Map();
  const warnings: string[] = [];

  let totalGasUsed = 0n;
  const stateOverrides: Record<string, TenderlyStateObject> = {};
  let failedAtStep: number | undefined;
  let errorMessage: string | undefined;

  // Override wallet balance with 1000 ETH for simulation
  // This allows simulating transactions even if the wallet has no real funds
  stateOverrides[plan.fromAddress.toLowerCase()] = {
    balance: "0x3635C9ADC5DEA00000", // 1000 ETH in hex
  };

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    try {
      const result = await simulateSingleTransaction({
        config,
        chainId: plan.chainId,
        from: plan.fromAddress,
        to: step.to,
        data: step.data,
        value: step.value,
        stateOverrides,
      });

      const gasUsed = safeBigInt(result.simulation.gas_used);
      const gasCostWei = gasUsed * BigInt(30e9); // Assume 30 gwei
      const gasCostEth = Number(formatEther(gasCostWei));
      const gasCostUsd = gasCostEth * ethPriceUsd;

      // Decode logs
      const logs = decodeTransactionLogs(
        result.transaction.transaction_info.logs ?? []
      );

      // Extract balance changes
      const balanceChanges = extractBalanceChanges(
        result.transaction.transaction_info.asset_changes ?? [],
        ethPriceUsd
      );

      // Merge balance changes
      for (const change of balanceChanges) {
        const key = change.token.toLowerCase();
        const existing = allBalanceChanges.get(key);
        if (existing) {
          existing.after = change.after;
          existing.change = existing.after - existing.before;
          existing.changeUsd =
            Number(formatEther(existing.change)) * ethPriceUsd;
        } else {
          allBalanceChanges.set(key, change);
        }
      }

      const stepResult: SimulationStepResult = {
        stepId: step.id,
        success: result.simulation.status,
        gasUsed,
        gasPrice: BigInt(30e9),
        gasCostWei,
        gasCostUsd,
        logs,
        balanceChanges,
      };

      if (!result.simulation.status) {
        stepResult.error = result.simulation.error_message ?? "Transaction reverted";
        stepResult.revertReason = result.simulation.error_message;
        failedAtStep = i;
        errorMessage = stepResult.error;
      }

      steps.push(stepResult);
      totalGasUsed += gasUsed;

      // If step failed, stop simulation
      if (!result.simulation.status) {
        break;
      }

      // Accumulate state for next simulation
      // In a real implementation, you'd extract state changes from the response
      // For now, we'll rely on Tenderly's state persistence
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      steps.push({
        stepId: step.id,
        success: false,
        gasUsed: 0n,
        gasPrice: 0n,
        gasCostWei: 0n,
        gasCostUsd: 0,
        logs: [],
        balanceChanges: [],
        error: errorMsg,
      });
      failedAtStep = i;
      errorMessage = errorMsg;
      break;
    }
  }

  const totalGasCostEth = Number(formatEther(totalGasUsed * BigInt(30e9)));
  const totalGasCostUsd = totalGasCostEth * ethPriceUsd;

  return {
    success: failedAtStep === undefined,
    totalGasUsed,
    totalGasCostUsd,
    steps,
    netBalanceChanges: Array.from(allBalanceChanges.values()),
    warnings,
    failedAtStep,
    errorMessage,
  };
}

// ============================================================================
// Single Transaction Simulation
// ============================================================================

interface SimulateTxOptions {
  config: TenderlyConfig;
  chainId: number;
  from: Address;
  to: Address;
  data: Hex;
  value: bigint;
  stateOverrides?: Record<string, TenderlyStateObject>;
}

async function simulateSingleTransaction(
  options: SimulateTxOptions
): Promise<TenderlySimulationResponse> {
  const { config, chainId, from, to, data, value, stateOverrides } = options;

  const url = `${TENDERLY_API_URL}/account/${config.accountSlug}/project/${config.projectSlug}/simulate`;

  const body: TenderlySimulationRequest = {
    network_id: chainId.toString(),
    from,
    to,
    input: data,
    value: value.toString(),
    save: false,
    save_if_fails: true,
    simulation_type: "full",
    state_objects: stateOverrides,
  };

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TENDERLY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": config.accessKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tenderly API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Tenderly API timeout after ${TENDERLY_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Bundle Simulation (multiple txs in one call)
// ============================================================================

/**
 * Simulates multiple transactions as a bundle.
 * More efficient than individual simulations for multi-step plans.
 */
export async function simulateTransactionBundle(
  plan: TransactionPlan,
  ethPriceUsd: number = 2500
): Promise<TenderlySimulationResult> {
  console.log("[simulate] simulateTransactionBundle called with", plan.steps.length, "steps");
  console.log("[simulate] Plan chainId:", plan.chainId, "fromAddress:", plan.fromAddress);

  // Handle empty plans
  if (plan.steps.length === 0) {
    console.log("[simulate] No steps to simulate, returning empty result");
    return {
      success: true,
      totalGasUsed: 0n,
      totalGasCostUsd: 0,
      steps: [],
      netBalanceChanges: [],
      warnings: ["No transactions to simulate"],
    };
  }

  console.log("[simulate] Getting Tenderly config...");
  const config = getTenderlyConfig();
  console.log("[simulate] Got Tenderly config, account:", config.accountSlug, "project:", config.projectSlug);

  const url = `${TENDERLY_API_URL}/account/${config.accountSlug}/project/${config.projectSlug}/simulate-bundle`;
  console.log("[simulate] Tenderly URL:", url);

  // Override wallet balance with 1000 ETH for simulation
  const stateOverrides: Record<string, TenderlyStateObject> = {
    [plan.fromAddress.toLowerCase()]: {
      balance: "0x3635C9ADC5DEA00000", // 1000 ETH in hex
    },
  };

  console.log("[simulate] Building simulations array...");
  const simulations = plan.steps.map((step, i) => {
    console.log(`[simulate] Step ${i}: action=${step.action}, to=${step.to}, value=${step.value}`);
    // Log calldata for deposit steps to verify amount encoding
    if (step.action === "deposit") {
      console.log(`[simulate] Step ${i} calldata (first 200 chars): ${step.data.slice(0, 200)}`);
    }
    // Only apply state overrides to the first simulation
    // Subsequent simulations should inherit state from previous ones
    const simulation: Record<string, unknown> = {
      network_id: plan.chainId.toString(),
      from: plan.fromAddress,
      to: step.to,
      input: step.data,
      value: step.value.toString(),
      save: false,
    };
    if (i === 0) {
      simulation.state_objects = stateOverrides;
    }
    return simulation;
  });
  console.log("[simulate] Built", simulations.length, "simulations");

  // Add timeout to prevent hanging (longer for bundles)
  const bundleTimeout = TENDERLY_TIMEOUT_MS * 2; // 60 seconds for bundles
  console.log("[simulate] Setting up timeout:", bundleTimeout, "ms");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log("[simulate] TIMEOUT triggered after", bundleTimeout, "ms - aborting request");
    controller.abort();
  }, bundleTimeout);

  let results;
  try {
    console.log("[simulate] Making fetch request to Tenderly...");
    const fetchStartTime = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": config.accessKey,
      },
      body: JSON.stringify({ simulations }),
      signal: controller.signal,
    });
    console.log("[simulate] Fetch completed in", Date.now() - fetchStartTime, "ms, status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log("[simulate] Response not OK, error:", errorText);
      throw new Error(`Tenderly bundle API error: ${response.status} - ${errorText}`);
    }

    console.log("[simulate] Parsing response JSON...");
    results = await response.json();
    console.log("[simulate] Response parsed, got", results?.simulation_results?.length ?? 0, "results");
  } catch (error) {
    console.log("[simulate] Caught error:", error instanceof Error ? error.message : error);
    console.log("[simulate] Error name:", error instanceof Error ? error.name : "unknown");
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Tenderly bundle API timeout after ${bundleTimeout / 1000}s`);
    }
    throw error;
  } finally {
    console.log("[simulate] Clearing timeout");
    clearTimeout(timeoutId);
  }

  // Process bundle results
  console.log("[simulate] Processing bundle results...");
  const steps: SimulationStepResult[] = [];
  let totalGasUsed = 0n;
  let failedAtStep: number | undefined;
  let errorMessage: string | undefined;
  const allBalanceChanges: Map<string, TokenBalanceChange> = new Map();

  // Guard against unexpected response structure
  if (!results?.simulation_results || !Array.isArray(results.simulation_results)) {
    console.log("[simulate] ERROR: Unexpected response structure:", JSON.stringify(results).slice(0, 500));
    throw new Error("Tenderly API returned unexpected response structure");
  }

  for (let i = 0; i < results.simulation_results.length; i++) {
    const result = results.simulation_results[i];
    const step = plan.steps[i];
    console.log(`[simulate] Processing result ${i}/${results.simulation_results.length}, status:`, result?.simulation?.status);

    try {
      const gasUsed = safeBigInt(result?.simulation?.gas_used ?? 0);
      const gasCostWei = gasUsed * BigInt(30e9);
      const gasCostUsd = Number(formatEther(gasCostWei)) * ethPriceUsd;

      const logs = decodeTransactionLogs(
        result?.transaction?.transaction_info?.logs ?? []
      );
      const balanceChanges = extractBalanceChanges(
        result?.transaction?.transaction_info?.asset_changes ?? [],
        ethPriceUsd
      );

      steps.push({
        stepId: step.id,
        success: result?.simulation?.status ?? false,
        gasUsed,
        gasPrice: BigInt(30e9),
        gasCostWei,
        gasCostUsd,
        logs,
        balanceChanges,
        error: result?.simulation?.error_message,
        revertReason: result?.simulation?.error_message,
      });

      totalGasUsed += gasUsed;

      if (!result?.simulation?.status && failedAtStep === undefined) {
        failedAtStep = i;
        errorMessage = result?.simulation?.error_message ?? "Unknown error";
        console.log(`[simulate] Step ${i} FAILED:`);
        console.log(`  - error_message: ${result?.simulation?.error_message}`);
        console.log(`  - method: ${result?.simulation?.method}`);
        console.log(`  - gas_used: ${result?.simulation?.gas_used}`);
        // Log call trace error info if available
        const callTrace = result?.transaction?.transaction_info?.call_trace;
        if (callTrace?.error) {
          console.log(`  - call_trace.error: ${callTrace.error}`);
        }
        if (callTrace?.error_reason) {
          console.log(`  - call_trace.error_reason: ${callTrace.error_reason}`);
        }
      }
    } catch (stepError) {
      console.log(`[simulate] Error processing step ${i}:`, stepError);
      steps.push({
        stepId: step.id,
        success: false,
        gasUsed: 0n,
        gasPrice: 0n,
        gasCostWei: 0n,
        gasCostUsd: 0,
        logs: [],
        balanceChanges: [],
        error: stepError instanceof Error ? stepError.message : "Failed to process simulation result",
      });
      if (failedAtStep === undefined) {
        failedAtStep = i;
        errorMessage = stepError instanceof Error ? stepError.message : "Failed to process simulation result";
      }
    }
  }

  console.log("[simulate] Done processing, totalGasUsed:", totalGasUsed.toString(), "failedAtStep:", failedAtStep);
  return {
    success: failedAtStep === undefined,
    totalGasUsed,
    totalGasCostUsd: Number(formatEther(totalGasUsed * BigInt(30e9))) * ethPriceUsd,
    steps,
    netBalanceChanges: Array.from(allBalanceChanges.values()),
    warnings: [],
    failedAtStep,
    errorMessage,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function decodeTransactionLogs(logs: TenderlyLog[]): DecodedLog[] {
  return logs.map((log) => {
    const decoded: DecodedLog = {
      address: log.address as Address,
      name: log.decoded?.name ?? "Unknown",
      args: {},
      raw: {
        topics: log.topics as Hex[],
        data: log.data as Hex,
      },
    };

    if (log.decoded?.inputs) {
      for (const input of log.decoded.inputs) {
        decoded.args[input.name] = input.value;
      }
    }

    return decoded;
  });
}

function extractBalanceChanges(
  changes: TenderlyAssetChange[],
  _ethPriceUsd: number
): TokenBalanceChange[] {
  const result: TokenBalanceChange[] = [];

  for (const change of changes) {
    const amount = safeBigInt(change.amount);

    result.push({
      token: change.token_info.contract_address as Address,
      symbol: change.token_info.symbol,
      decimals: change.token_info.decimals,
      before: 0n, // Tenderly doesn't always give us "before" value
      after: amount,
      change: amount,
      changeUsd: change.dollar_value ? parseFloat(change.dollar_value) : 0,
    });
  }

  return result;
}

// ============================================================================
// Gas Price Service
// ============================================================================

export interface GasEstimate {
  baseFee: bigint;
  maxPriorityFee: bigint;
  maxFee: bigint;
  estimatedCostWei: bigint;
  estimatedCostUsd: number;
}

/**
 * Gets current gas price estimates for a chain.
 */
export async function getGasEstimate(
  chainId: number,
  gasLimit: bigint,
  ethPriceUsd: number
): Promise<GasEstimate> {
  // In production, you'd call an RPC or gas API here
  // For now, return reasonable defaults
  const baseFee = BigInt(20e9); // 20 gwei
  const maxPriorityFee = BigInt(2e9); // 2 gwei
  const maxFee = baseFee + maxPriorityFee;

  const estimatedCostWei = maxFee * gasLimit;
  const estimatedCostEth = Number(formatEther(estimatedCostWei));
  const estimatedCostUsd = estimatedCostEth * ethPriceUsd;

  return {
    baseFee,
    maxPriorityFee,
    maxFee,
    estimatedCostWei,
    estimatedCostUsd,
  };
}
