/**
 * Cross-Chain weETH Analytics Service
 *
 * Fetches weETH holdings across all supported chains (Ethereum, Arbitrum, Base, Optimism, Scroll)
 * and aggregates them into a unified analytics view.
 */

import {
  createPublicClient,
  http,
  formatUnits,
  type PublicClient,
  type Chain,
} from "viem";
import { mainnet, arbitrum, base, optimism, scroll } from "viem/chains";
import {
  type ChainWeETHHolding,
  type CrossChainWeETHAnalytics,
  WEETH_CHAINS,
} from "@/lib/analytics/types";
import { getPrice, getPrices } from "./price";
import { getEtherFiApy } from "./yields";
import { getClient, isSupportedChain } from "../lib/rpc";
import type { SupportedChainId } from "@/lib/constants";

// ERC20 balanceOf ABI - minimal for reading balance
const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// weETH getRate ABI - for exchange rate on mainnet
const WEETH_RATE_ABI = [
  {
    name: "getRate",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Chain configurations for chains not in the main SUPPORTED_CHAINS
// Scroll is specific to weETH analytics
const ANALYTICS_CHAIN_CONFIGS: Record<
  number,
  { chain: Chain; rpcUrls: string[] }
> = {
  // Scroll - not in main supported chains but has weETH
  534352: {
    chain: scroll,
    rpcUrls: [
      process.env.ALCHEMY_RPC_SCROLL || "",
      "https://rpc.scroll.io", // Official Scroll RPC
      "https://scroll.drpc.org",
      "https://1rpc.io/scroll",
    ].filter(Boolean),
  },
};

// Client cache for analytics-specific chains (Scroll)
const analyticsClientCache = new Map<number, PublicClient>();

/**
 * Get a viem client for analytics - uses existing clients where possible,
 * creates new ones for chains like Scroll that aren't in the main supported chains
 */
function getAnalyticsClient(chainId: number): PublicClient {
  // Use existing client infrastructure for supported chains
  if (isSupportedChain(chainId)) {
    return getClient(chainId as SupportedChainId);
  }

  // Check cache for analytics-specific chains
  const cached = analyticsClientCache.get(chainId);
  if (cached) {
    return cached;
  }

  // Create client for analytics-specific chains (e.g., Scroll)
  const config = ANALYTICS_CHAIN_CONFIGS[chainId];
  if (!config || config.rpcUrls.length === 0) {
    throw new Error(`No RPC configuration for chain ${chainId}`);
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrls[0], {
      timeout: 10_000,
      retryCount: 2,
      retryDelay: 1000,
    }),
  });

  analyticsClientCache.set(chainId, client);
  return client;
}

/**
 * Fetch weETH balance for a wallet on a specific chain
 */
async function fetchChainBalance(
  walletAddress: string,
  chainId: number,
  weethAddress: string
): Promise<bigint | null> {
  try {
    const client = getAnalyticsClient(chainId);

    const balance = await client.readContract({
      address: weethAddress as `0x${string}`,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    });

    return balance;
  } catch (error) {
    console.warn(
      `[Analytics] Failed to fetch weETH balance on chain ${chainId}:`,
      error
    );
    return null;
  }
}

/**
 * Fetch the weETH to ETH exchange rate from mainnet
 * weETH appreciates vs ETH over time as staking rewards accrue
 */
async function fetchWeETHExchangeRate(): Promise<number> {
  try {
    const client = getAnalyticsClient(1); // Mainnet
    const mainnetWeETH = WEETH_CHAINS.find((c) => c.chainId === 1);

    if (!mainnetWeETH) {
      return 1.0; // Fallback to 1:1
    }

    const rate = await client.readContract({
      address: mainnetWeETH.weethAddress as `0x${string}`,
      abi: WEETH_RATE_ABI,
      functionName: "getRate",
    });

    // Rate is in 18 decimals, represents how much ETH 1 weETH is worth
    return Number(formatUnits(rate, 18));
  } catch (error) {
    console.warn("[Analytics] Failed to fetch weETH exchange rate:", error);
    return 1.0; // Fallback
  }
}

/**
 * Build empty analytics response when data is unavailable
 */
function buildEmptyAnalytics(walletAddress: string): CrossChainWeETHAnalytics {
  return {
    walletAddress,
    timestamp: Date.now(),
    totalWeethBalance: 0,
    totalWeethValueUsd: 0,
    totalUnderlyingEth: 0,
    holdings: [],
    chainDistribution: [],
    weightedAverageApy: 0,
    bestYieldChain: null,
  };
}

/**
 * Main analytics function - fetches weETH holdings across all chains
 */
export async function getWeETHAnalytics(
  walletAddress: string
): Promise<CrossChainWeETHAnalytics> {
  const holdings: ChainWeETHHolding[] = [];

  // Fetch prices and exchange rate in parallel
  const [priceData, weethToEthRate, etherfiApy] = await Promise.all([
    getPrices(["wrapped-eeth", "ethereum"]),
    fetchWeETHExchangeRate(),
    getEtherFiApy(),
  ]);

  const weethPrice = priceData.get("wrapped-eeth")?.priceUsd ?? 0;
  const ethPrice = priceData.get("ethereum")?.priceUsd ?? 0;

  // Early return if prices are missing - prevents 0 USD calculations
  if (!weethPrice || !ethPrice) {
    console.warn(
      "[Analytics] Missing price data - weETH or ETH price unavailable"
    );
    return buildEmptyAnalytics(walletAddress);
  }

  // Fetch balances from all chains in parallel
  const balancePromises = WEETH_CHAINS.map(async (chainInfo) => {
    const balance = await fetchChainBalance(
      walletAddress,
      chainInfo.chainId,
      chainInfo.weethAddress
    );

    return { chainInfo, balance };
  });

  const results = await Promise.all(balancePromises);

  // Process results
  for (const result of results) {
    if (!result.balance || result.balance === 0n) continue;

    const { chainInfo, balance } = result;
    const formattedBalance = Number(formatUnits(balance, 18));
    const valueUsd = formattedBalance * weethPrice;
    const underlyingEth = formattedBalance * weethToEthRate;

    holdings.push({
      chainId: chainInfo.chainId,
      chainName: chainInfo.name,
      weethBalance: balance.toString(),
      weethBalanceFormatted: formattedBalance,
      weethValueUsd: valueUsd,
      underlyingEthAmount: underlyingEth,
      weethToEthRate,
      source: "wallet",
      apy: etherfiApy,
      apySource: "native",
    });
  }

  // Calculate totals
  const totalWeethBalance = holdings.reduce(
    (sum, h) => sum + h.weethBalanceFormatted,
    0
  );
  const totalWeethValueUsd = holdings.reduce(
    (sum, h) => sum + h.weethValueUsd,
    0
  );
  const totalUnderlyingEth = holdings.reduce(
    (sum, h) => sum + h.underlyingEthAmount,
    0
  );

  // Calculate chain distribution
  const chainDistribution = holdings.map((h) => ({
    chainId: h.chainId,
    chainName: h.chainName,
    percentage:
      totalWeethValueUsd > 0 ? (h.weethValueUsd / totalWeethValueUsd) * 100 : 0,
    valueUsd: h.weethValueUsd,
  }));

  // Sort by value descending
  chainDistribution.sort((a, b) => b.valueUsd - a.valueUsd);

  // Find best yield chain (for now all chains have the same native APY)
  // In the future, this could factor in additional protocol yields per chain
  const bestYieldChain =
    holdings.length > 0 && etherfiApy > 0
      ? {
          chainId: holdings[0].chainId,
          chainName: holdings[0].chainName,
          apy: etherfiApy,
        }
      : null;

  return {
    walletAddress,
    timestamp: Date.now(),
    totalWeethBalance,
    totalWeethValueUsd,
    totalUnderlyingEth,
    holdings,
    chainDistribution,
    weightedAverageApy: etherfiApy, // Same across all chains for native weETH
    bestYieldChain,
  };
}

/**
 * Get analytics for multiple wallets (useful for aggregated views)
 */
export async function getMultiWalletWeETHAnalytics(
  walletAddresses: string[]
): Promise<CrossChainWeETHAnalytics[]> {
  const results = await Promise.all(
    walletAddresses.map((address) => getWeETHAnalytics(address))
  );

  return results;
}

/**
 * Get aggregated analytics across multiple wallets
 */
export async function getAggregatedWeETHAnalytics(
  walletAddresses: string[]
): Promise<CrossChainWeETHAnalytics> {
  const allAnalytics = await getMultiWalletWeETHAnalytics(walletAddresses);

  // Merge all holdings
  const holdingsByChain = new Map<number, ChainWeETHHolding>();

  for (const analytics of allAnalytics) {
    for (const holding of analytics.holdings) {
      const existing = holdingsByChain.get(holding.chainId);
      if (existing) {
        // Aggregate balances
        const newBalance =
          BigInt(existing.weethBalance) + BigInt(holding.weethBalance);
        holdingsByChain.set(holding.chainId, {
          ...existing,
          weethBalance: newBalance.toString(),
          weethBalanceFormatted:
            existing.weethBalanceFormatted + holding.weethBalanceFormatted,
          weethValueUsd: existing.weethValueUsd + holding.weethValueUsd,
          underlyingEthAmount:
            existing.underlyingEthAmount + holding.underlyingEthAmount,
        });
      } else {
        holdingsByChain.set(holding.chainId, { ...holding });
      }
    }
  }

  const holdings = Array.from(holdingsByChain.values());

  // Calculate totals
  const totalWeethBalance = holdings.reduce(
    (sum, h) => sum + h.weethBalanceFormatted,
    0
  );
  const totalWeethValueUsd = holdings.reduce(
    (sum, h) => sum + h.weethValueUsd,
    0
  );
  const totalUnderlyingEth = holdings.reduce(
    (sum, h) => sum + h.underlyingEthAmount,
    0
  );

  // Calculate chain distribution
  const chainDistribution = holdings.map((h) => ({
    chainId: h.chainId,
    chainName: h.chainName,
    percentage:
      totalWeethValueUsd > 0 ? (h.weethValueUsd / totalWeethValueUsd) * 100 : 0,
    valueUsd: h.weethValueUsd,
  }));

  chainDistribution.sort((a, b) => b.valueUsd - a.valueUsd);

  // Get APY from first analytics result
  const weightedAverageApy = allAnalytics[0]?.weightedAverageApy ?? 0;
  const bestYieldChain = allAnalytics[0]?.bestYieldChain ?? null;

  return {
    walletAddress: walletAddresses.join(","),
    timestamp: Date.now(),
    totalWeethBalance,
    totalWeethValueUsd,
    totalUnderlyingEth,
    holdings,
    chainDistribution,
    weightedAverageApy,
    bestYieldChain,
  };
}
