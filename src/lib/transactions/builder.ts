/**
 * Transaction Plan Builder
 *
 * Converts strategy blocks into executable transaction plans.
 * Includes automatic route optimization to insert wrap/unwrap steps
 * for token compatibility between protocols.
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import { aaveV3PoolAbi } from "../../server/lib/abis/aave-v3";
import { stETHAbi, wstETHAbi } from "../../server/lib/abis/lido";
import { weETHAbi, liquifierAbi } from "../../server/lib/abis/etherfi";
import { erc20Abi } from "../../server/lib/abis/erc20";
import type {
  TransactionPlan,
  TransactionStep,
  StrategyExecutionInput,
  TransactionAction,
} from "./types";
import type { BlockType, LendProtocol, StakeProtocol, AssetType } from "../strategy/types";
import {
  analyzeRouteCompatibility,
  TOKEN_WRAPPERS,
  type WrapStep,
} from "../strategy/route-optimizer";

// ============================================================================
// Protocol Contract Addresses (by chainId)
// ============================================================================

const PROTOCOL_ADDRESSES: Record<number, Record<string, Address>> = {
  // Ethereum Mainnet
  1: {
    // Aave V3
    "aave-v3-pool": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Lido
    stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    // EtherFi
    eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
    "etherfi-liquidity-pool": "0x308861A430be4cce5502d0A12724771Fc6DaF216",
  },
  // Arbitrum
  42161: {
    "aave-v3-pool": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529",
    weETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
  },
  // Optimism
  10: {
    "aave-v3-pool": "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    wstETH: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
  },
  // Base
  8453: {
    "aave-v3-pool": "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
    weETH: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A",
  },
};

// Common token addresses
const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  1: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  },
  42161: {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "USDC.e": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  },
  8453: {
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
};

// ============================================================================
// Transaction Builder
// ============================================================================

export interface BuildTransactionPlanOptions {
  input: StrategyExecutionInput;
  gasPrice?: bigint;
  slippageBps?: number; // Default 50 (0.5%)
}

/**
 * Builds a transaction plan from a strategy.
 * Processes blocks in topological order and generates the required transactions.
 */
export async function buildTransactionPlan(
  options: BuildTransactionPlanOptions
): Promise<TransactionPlan> {
  console.log("[builder] Starting buildTransactionPlan");
  const { input, slippageBps = 50 } = options;
  const { blocks, edges, walletAddress } = input;

  // Ensure inputAmount is a proper BigInt (handle potential number input)
  const inputAmount = typeof input.inputAmount === 'bigint'
    ? input.inputAmount
    : BigInt(Math.floor(Number(input.inputAmount)));

  console.log("[builder] Blocks:", blocks.length, "Edges:", edges.length, "InputAmount:", inputAmount.toString());

  // Get chain ID from first block (all blocks should be on same chain)
  const chainId = blocks[0]?.chainId ?? 1;
  console.log("[builder] ChainId:", chainId);

  const steps: TransactionStep[] = [];
  let stepCounter = 0;

  // Process blocks in topological order (respecting edges)
  console.log("[builder] Running topological sort...");
  const sortedBlocks = topologicalSort(blocks, edges);
  console.log("[builder] Sorted blocks:", sortedBlocks.length);

  for (const block of sortedBlocks) {
    console.log("[builder] Processing block:", block.id, block.type);
    const blockSteps = await buildBlockTransactions({
      block,
      chainId,
      walletAddress,
      inputAmount,
      slippageBps,
      stepCounter,
    });
    console.log("[builder] Block produced steps:", blockSteps.length);

    steps.push(...blockSteps);
    stepCounter += blockSteps.length;
  }

  // Calculate totals
  const estimatedTotalGas = steps.reduce(
    (sum, step) => sum + (step.estimatedGas ?? 0n),
    0n
  );

  const plan: TransactionPlan = {
    id: generatePlanId(),
    chainId,
    fromAddress: walletAddress,
    steps,
    totalSteps: steps.length,
    estimatedTotalGas,
    estimatedTotalGasUsd: 0, // Will be calculated by simulation
    strategyId: input.strategyId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute expiry
  };

  return plan;
}

// ============================================================================
// Block-specific Transaction Builders
// ============================================================================

interface BuildBlockOptions {
  block: StrategyExecutionInput["blocks"][0];
  chainId: number;
  walletAddress: Address;
  inputAmount: bigint;
  slippageBps: number;
  stepCounter: number;
}

async function buildBlockTransactions(
  options: BuildBlockOptions
): Promise<TransactionStep[]> {
  const { block } = options;

  // Check for auto-wrap blocks first (can be type "auto-wrap" or "swap" with isAutoInserted)
  if (
    block.type === "auto-wrap" ||
    (block.params.isAutoInserted && block.params.wrapStep)
  ) {
    return buildWrapTransactions(options);
  }

  switch (block.type) {
    case "stake":
      return buildStakeTransactions(options);
    case "lend":
      return buildLendTransactions(options);
    case "borrow":
      return buildBorrowTransactions(options);
    case "swap":
      // Regular swap (not auto-wrap)
      return [];
    default:
      return [];
  }
}

// ============================================================================
// Wrap/Unwrap Transactions (Auto-inserted by route optimizer)
// ============================================================================

function buildWrapTransactions(options: BuildBlockOptions): TransactionStep[] {
  const { block, chainId, inputAmount, stepCounter } = options;
  console.log("[builder] buildWrapTransactions - block.params:", JSON.stringify(block.params, null, 2));
  const wrapStep = block.params.wrapStep as WrapStep;
  const steps: TransactionStep[] = [];

  if (!wrapStep) {
    console.log("[builder] buildWrapTransactions - NO wrapStep found, returning empty");
    return [];
  }
  console.log("[builder] buildWrapTransactions - wrapStep:", JSON.stringify(wrapStep));

  const addresses = PROTOCOL_ADDRESSES[chainId];
  if (!addresses) return [];

  const fromAsset = wrapStep.from as AssetType;
  const toAsset = wrapStep.to as AssetType;

  // Handle different wrap scenarios
  if (fromAsset === "eETH" && toAsset === "weETH") {
    // eETH → weETH (EtherFi wrap)
    const eETHAddress = addresses.eETH;
    const weETHAddress = addresses.weETH;
    if (!eETHAddress || !weETHAddress) return [];

    // Approve eETH
    steps.push({
      id: `step-${stepCounter}`,
      action: "approve",
      protocol: "etherfi",
      chainId,
      description: "Approve eETH for wrapping to weETH",
      to: eETHAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [weETHAddress, inputAmount],
      }),
      value: 0n,
      tokenIn: {
        address: eETHAddress,
        symbol: "eETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 50000n,
      sourceBlockId: block.id,
    });

    // Wrap
    steps.push({
      id: `step-${stepCounter + 1}`,
      action: "wrap",
      protocol: "etherfi",
      chainId,
      description: "Wrap eETH to weETH",
      to: weETHAddress,
      data: encodeFunctionData({
        abi: weETHAbi,
        functionName: "wrap",
        args: [inputAmount],
      }),
      value: 0n,
      tokenIn: {
        address: eETHAddress,
        symbol: "eETH",
        amount: inputAmount,
        decimals: 18,
      },
      tokenOut: {
        address: weETHAddress,
        symbol: "weETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 100000n,
      sourceBlockId: block.id,
    });
  } else if (fromAsset === "stETH" && toAsset === "wstETH") {
    // stETH → wstETH (Lido wrap)
    const stETHAddress = addresses.stETH;
    const wstETHAddress = addresses.wstETH;
    if (!stETHAddress || !wstETHAddress) return [];

    // Approve stETH
    steps.push({
      id: `step-${stepCounter}`,
      action: "approve",
      protocol: "lido",
      chainId,
      description: "Approve stETH for wrapping to wstETH",
      to: stETHAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [wstETHAddress, inputAmount],
      }),
      value: 0n,
      tokenIn: {
        address: stETHAddress,
        symbol: "stETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 50000n,
      sourceBlockId: block.id,
    });

    // Wrap
    steps.push({
      id: `step-${stepCounter + 1}`,
      action: "wrap",
      protocol: "lido",
      chainId,
      description: "Wrap stETH to wstETH",
      to: wstETHAddress,
      data: encodeFunctionData({
        abi: wstETHAbi,
        functionName: "wrap",
        args: [inputAmount],
      }),
      value: 0n,
      tokenIn: {
        address: stETHAddress,
        symbol: "stETH",
        amount: inputAmount,
        decimals: 18,
      },
      tokenOut: {
        address: wstETHAddress,
        symbol: "wstETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 100000n,
      sourceBlockId: block.id,
    });
  } else if (fromAsset === "weETH" && toAsset === "eETH") {
    // weETH → eETH (EtherFi unwrap)
    const weETHAddress = addresses.weETH;
    const eETHAddress = addresses.eETH;
    if (!weETHAddress || !eETHAddress) return [];

    steps.push({
      id: `step-${stepCounter}`,
      action: "unwrap",
      protocol: "etherfi",
      chainId,
      description: "Unwrap weETH to eETH",
      to: weETHAddress,
      data: encodeFunctionData({
        abi: weETHAbi,
        functionName: "unwrap",
        args: [inputAmount],
      }),
      value: 0n,
      tokenIn: {
        address: weETHAddress,
        symbol: "weETH",
        amount: inputAmount,
        decimals: 18,
      },
      tokenOut: {
        address: eETHAddress,
        symbol: "eETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 100000n,
      sourceBlockId: block.id,
    });
  } else if (fromAsset === "wstETH" && toAsset === "stETH") {
    // wstETH → stETH (Lido unwrap)
    const wstETHAddress = addresses.wstETH;
    const stETHAddress = addresses.stETH;
    if (!wstETHAddress || !stETHAddress) return [];

    steps.push({
      id: `step-${stepCounter}`,
      action: "unwrap",
      protocol: "lido",
      chainId,
      description: "Unwrap wstETH to stETH",
      to: wstETHAddress,
      data: encodeFunctionData({
        abi: wstETHAbi,
        functionName: "unwrap",
        args: [inputAmount],
      }),
      value: 0n,
      tokenIn: {
        address: wstETHAddress,
        symbol: "wstETH",
        amount: inputAmount,
        decimals: 18,
      },
      tokenOut: {
        address: stETHAddress,
        symbol: "stETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 100000n,
      sourceBlockId: block.id,
    });
  }

  return steps;
}

// ============================================================================
// Stake Transactions (Lido, EtherFi)
// ============================================================================

function buildStakeTransactions(options: BuildBlockOptions): TransactionStep[] {
  const { block, chainId, walletAddress, inputAmount, stepCounter } = options;
  const protocol = block.params.protocol as StakeProtocol;
  const steps: TransactionStep[] = [];

  const addresses = PROTOCOL_ADDRESSES[chainId];
  if (!addresses) return [];

  if (protocol === "lido") {
    // Stake ETH → stETH
    const stETHAddress = addresses.stETH;
    if (!stETHAddress) return [];

    steps.push({
      id: `step-${stepCounter}`,
      action: "stake",
      protocol: "lido",
      chainId,
      description: "Stake ETH to receive stETH",
      to: stETHAddress,
      data: encodeFunctionData({
        abi: stETHAbi,
        functionName: "submit",
        args: [walletAddress], // referral
      }),
      value: inputAmount,
      tokenIn: {
        address: "0x0000000000000000000000000000000000000000" as Address,
        symbol: "ETH",
        amount: inputAmount,
        decimals: 18,
      },
      tokenOut: {
        address: stETHAddress,
        symbol: "stETH",
        amount: inputAmount, // 1:1 ratio
        decimals: 18,
      },
      estimatedGas: 150000n,
      sourceBlockId: block.id,
    });

    // Optional: Wrap stETH → wstETH if needed for lending
    if (block.params.wrap) {
      const wstETHAddress = addresses.wstETH;
      if (wstETHAddress) {
        // First approve stETH
        steps.push({
          id: `step-${stepCounter + 1}`,
          action: "approve",
          protocol: "lido",
          chainId,
          description: "Approve stETH for wrapping",
          to: stETHAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [wstETHAddress, inputAmount],
          }),
          value: 0n,
          tokenIn: {
            address: stETHAddress,
            symbol: "stETH",
            amount: inputAmount,
            decimals: 18,
          },
          estimatedGas: 50000n,
          sourceBlockId: block.id,
        });

        // Then wrap
        steps.push({
          id: `step-${stepCounter + 2}`,
          action: "wrap",
          protocol: "lido",
          chainId,
          description: "Wrap stETH to wstETH",
          to: wstETHAddress,
          data: encodeFunctionData({
            abi: wstETHAbi,
            functionName: "wrap",
            args: [inputAmount],
          }),
          value: 0n,
          tokenIn: {
            address: stETHAddress,
            symbol: "stETH",
            amount: inputAmount,
            decimals: 18,
          },
          tokenOut: {
            address: wstETHAddress,
            symbol: "wstETH",
            amount: inputAmount, // Approximate
            decimals: 18,
          },
          estimatedGas: 100000n,
          sourceBlockId: block.id,
        });
      }
    }
  } else if (protocol === "etherfi") {
    // Stake ETH → eETH
    const liquidityPool = addresses["etherfi-liquidity-pool"];
    if (!liquidityPool) return [];

    steps.push({
      id: `step-${stepCounter}`,
      action: "stake",
      protocol: "etherfi",
      chainId,
      description: "Stake ETH to receive eETH",
      to: liquidityPool,
      data: encodeFunctionData({
        abi: liquifierAbi,
        functionName: "deposit",
        args: [walletAddress], // referral
      }),
      value: inputAmount,
      tokenIn: {
        address: "0x0000000000000000000000000000000000000000" as Address,
        symbol: "ETH",
        amount: inputAmount,
        decimals: 18,
      },
      tokenOut: {
        address: addresses.eETH!,
        symbol: "eETH",
        amount: inputAmount,
        decimals: 18,
      },
      estimatedGas: 200000n,
      sourceBlockId: block.id,
    });

    // Wrap eETH → weETH if needed
    if (block.params.wrap) {
      const weETHAddress = addresses.weETH;
      const eETHAddress = addresses.eETH;
      if (weETHAddress && eETHAddress) {
        steps.push({
          id: `step-${stepCounter + 1}`,
          action: "approve",
          protocol: "etherfi",
          chainId,
          description: "Approve eETH for wrapping",
          to: eETHAddress,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [weETHAddress, inputAmount],
          }),
          value: 0n,
          tokenIn: {
            address: eETHAddress,
            symbol: "eETH",
            amount: inputAmount,
            decimals: 18,
          },
          estimatedGas: 50000n,
          sourceBlockId: block.id,
        });

        steps.push({
          id: `step-${stepCounter + 2}`,
          action: "wrap",
          protocol: "etherfi",
          chainId,
          description: "Wrap eETH to weETH",
          to: weETHAddress,
          data: encodeFunctionData({
            abi: weETHAbi,
            functionName: "wrap",
            args: [inputAmount],
          }),
          value: 0n,
          tokenIn: {
            address: eETHAddress,
            symbol: "eETH",
            amount: inputAmount,
            decimals: 18,
          },
          tokenOut: {
            address: weETHAddress,
            symbol: "weETH",
            amount: inputAmount,
            decimals: 18,
          },
          estimatedGas: 100000n,
          sourceBlockId: block.id,
        });
      }
    }
  }

  return steps;
}

// ============================================================================
// Lend Transactions (Aave V3)
// ============================================================================

/**
 * Calculate expected weETH output from wrapping eETH.
 * weETH uses a share-based system where weETH = eETH * 1e18 / rate
 * We apply a small buffer (99.5%) to account for any rounding/slippage.
 */
function estimateWeETHFromOriginalETH(originalETHAmount: bigint): bigint {
  // When the lend block has a dynamic asset (weETH from auto-wrap),
  // inputAmount is still the original ETH, not the intermediate eETH.
  // We must account for BOTH conversions:
  //
  // ETH → eETH:   ~0.96 (staking rate ~1.04, varies with TVL)
  // eETH → weETH: ~0.9563 (wrapping rate ~1.0457, varies with accumulated yields)
  // Combined:     ~0.918
  //
  // Use 85% as base estimate, plus additional buffer for small amounts
  // where integer division rounding errors are proportionally larger
  const baseEstimate = (originalETHAmount * 85n) / 100n;

  // For small amounts (< 10 ETH), subtract additional 1% buffer for rounding
  const TEN_ETH = 10n * 10n ** 18n;
  if (originalETHAmount < TEN_ETH) {
    return (originalETHAmount * 84n) / 100n;
  }

  return baseEstimate;
}

/**
 * Calculate expected wstETH output from wrapping stETH.
 * Similar share-based system.
 */
function estimateWstETHFromOriginalETH(originalETHAmount: bigint): bigint {
  // For Lido: ETH → stETH is 1:1 (no staking rate conversion)
  // stETH → wstETH: ~0.84 (wrapping rate ~1.19, varies with accumulated yields)
  // Use 80% as base, with additional buffer for small amounts
  const TEN_ETH = 10n * 10n ** 18n;
  if (originalETHAmount < TEN_ETH) {
    return (originalETHAmount * 78n) / 100n;
  }
  return (originalETHAmount * 80n) / 100n;
}

function buildLendTransactions(options: BuildBlockOptions): TransactionStep[] {
  const { block, chainId, walletAddress, inputAmount, stepCounter } = options;
  const protocol = block.params.protocol as LendProtocol;
  const steps: TransactionStep[] = [];

  const addresses = PROTOCOL_ADDRESSES[chainId];
  if (!addresses) return [];

  if (protocol === "aave-v3") {
    const poolAddress = addresses["aave-v3-pool"];
    const assetAddress = (block.params.asset as Address) ?? addresses.wstETH;
    if (!poolAddress || !assetAddress) return [];

    // Check if asset was dynamically set by route optimization (e.g., weETH from wrap step)
    // If so, calculate expected wrapped amount instead of using inputAmount
    const isDynamicAsset = Boolean(block.params.asset);
    const assetSymbol = (block.params.assetSymbol as string) ?? "token";

    let supplyAmount = inputAmount;
    if (isDynamicAsset) {
      // Estimate wrapped token amount based on the asset type
      // inputAmount is the original ETH amount, not the intermediate token
      if (assetSymbol === "weETH") {
        supplyAmount = estimateWeETHFromOriginalETH(inputAmount);
      } else if (assetSymbol === "wstETH") {
        supplyAmount = estimateWstETHFromOriginalETH(inputAmount);
      }
    }
    console.log(`[builder] Lend block - isDynamicAsset: ${isDynamicAsset}, assetSymbol: ${assetSymbol}, supplyAmount: ${supplyAmount.toString()}`);

    // First approve the asset
    steps.push({
      id: `step-${stepCounter}`,
      action: "approve",
      protocol: "aave-v3",
      chainId,
      description: `Approve ${assetSymbol} for Aave`,
      to: assetAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [poolAddress, supplyAmount],
      }),
      value: 0n,
      tokenIn: {
        address: assetAddress,
        symbol: assetSymbol,
        amount: inputAmount, // Display amount for UI
        decimals: 18,
      },
      estimatedGas: 50000n,
      sourceBlockId: block.id,
    });

    // Then supply - use max uint256 for dynamic assets (Aave will supply full balance)
    steps.push({
      id: `step-${stepCounter + 1}`,
      action: "deposit",
      protocol: "aave-v3",
      chainId,
      description: `Supply ${assetSymbol} to Aave`,
      to: poolAddress,
      data: encodeFunctionData({
        abi: aaveV3PoolAbi,
        functionName: "supply",
        args: [assetAddress, supplyAmount, walletAddress, 0],
      }),
      value: 0n,
      tokenIn: {
        address: assetAddress,
        symbol: assetSymbol,
        amount: inputAmount, // Display amount for UI (actual amount determined by balance)
        decimals: 18,
      },
      estimatedGas: 300000n,
      sourceBlockId: block.id,
    });
  }

  return steps;
}

// ============================================================================
// Borrow Transactions (Aave V3)
// ============================================================================

function buildBorrowTransactions(
  options: BuildBlockOptions
): TransactionStep[] {
  const { block, chainId, walletAddress, inputAmount, stepCounter } = options;
  const protocol = block.params.protocol as LendProtocol;
  const steps: TransactionStep[] = [];

  const addresses = PROTOCOL_ADDRESSES[chainId];
  if (!addresses) return [];

  if (protocol === "aave-v3") {
    const poolAddress = addresses["aave-v3-pool"];
    const assetAddress = block.params.borrowAsset as Address;
    if (!poolAddress || !assetAddress) return [];

    const borrowAmount = block.params.borrowAmount as bigint;

    steps.push({
      id: `step-${stepCounter}`,
      action: "borrow",
      protocol: "aave-v3",
      chainId,
      description: `Borrow ${block.params.borrowAssetSymbol ?? "token"} from Aave`,
      to: poolAddress,
      data: encodeFunctionData({
        abi: aaveV3PoolAbi,
        functionName: "borrow",
        args: [
          assetAddress,
          borrowAmount,
          2n, // Variable rate
          0, // Referral code
          walletAddress,
        ],
      }),
      value: 0n,
      tokenOut: {
        address: assetAddress,
        symbol: (block.params.borrowAssetSymbol as string) ?? "TOKEN",
        amount: borrowAmount,
        decimals: (block.params.borrowAssetDecimals as number) ?? 18,
      },
      estimatedGas: 350000n,
      sourceBlockId: block.id,
    });
  }

  return steps;
}

// ============================================================================
// Helpers
// ============================================================================

function generatePlanId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Topological sort of blocks based on edges.
 * Ensures dependent blocks are processed after their dependencies.
 */
function topologicalSort(
  blocks: StrategyExecutionInput["blocks"],
  edges: StrategyExecutionInput["edges"]
): StrategyExecutionInput["blocks"] {
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const block of blocks) {
    inDegree.set(block.id, 0);
    adjacency.set(block.id, []);
  }

  // Build graph
  for (const edge of edges) {
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: StrategyExecutionInput["blocks"] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const block = blockMap.get(current);
    if (block) sorted.push(block);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

// ============================================================================
// Exports
// ============================================================================

export { PROTOCOL_ADDRESSES, TOKEN_ADDRESSES };
