import type { Address } from "viem";
import { erc20Abi } from "viem";
import { getClient } from "@/server/lib/rpc";
import { type SupportedChainId } from "@/lib/constants";
import type { TokenBalance } from "./types";
import { getRateLimiter, sleep } from "@/server/lib/rate-limiter";

// Rate limiter for RPC calls per chain
// Free RPCs typically allow ~10-25 req/s, but we're conservative
const rpcRateLimiters = new Map<SupportedChainId, ReturnType<typeof getRateLimiter>>();

function getRpcRateLimiter(chainId: SupportedChainId) {
  let limiter = rpcRateLimiters.get(chainId);
  if (!limiter) {
    // Conservative: 3 req/s per chain to avoid hitting free RPC limits
    limiter = getRateLimiter(`rpc-${chainId}`, {
      ratePerSecond: 3,
      maxBurst: 5,
    });
    rpcRateLimiters.set(chainId, limiter);
  }
  return limiter;
}

// Common tokens to check per chain (top tokens by usage)
// This is a simplified approach - GoldRush returns ALL tokens, this checks known ones
const COMMON_TOKENS: Record<SupportedChainId, Array<{ address: Address; symbol: string; decimals: number }>> = {
  1: [ // Ethereum
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EescdeCB5BE3830", symbol: "DAI", decimals: 18 },
    { address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", symbol: "wstETH", decimals: 18 },
    { address: "0xae78736Cd615f374D3085123A210448E74Fc6393", symbol: "rETH", decimals: 18 },
    { address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", symbol: "cbETH", decimals: 18 },
    { address: "0x35fA164735182de50811E8e2E824cFb9B6118ac2", symbol: "eETH", decimals: 18 },
    { address: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee", symbol: "weETH", decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18 },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18 },
    { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", symbol: "AAVE", decimals: 18 },
  ],
  42161: [ // Arbitrum
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", symbol: "USDC.e", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x5979D7b546E38E414F7E9822514be443A4800529", symbol: "wstETH", decimals: 18 },
    { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8 },
    { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", decimals: 18 },
  ],
  10: [ // Optimism
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    { address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", symbol: "USDC.e", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb", symbol: "wstETH", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP", decimals: 18 },
  ],
  8453: [ // Base
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", symbol: "USDbC", decimals: 6 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18 },
    { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", symbol: "wstETH", decimals: 18 },
    { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol: "cbETH", decimals: 18 },
    { address: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A", symbol: "weETH", decimals: 18 },
  ],
  137: [ // Polygon
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
    { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WMATIC", decimals: 18 },
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC.e", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18 },
    { address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", symbol: "WBTC", decimals: 8 },
    { address: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD", symbol: "wstETH", decimals: 18 },
  ],
};

// Cache for block numbers to avoid repeated lookups
const blockNumberCache = new Map<string, bigint>();

/**
 * Get the block number closest to a timestamp using estimation + limited binary search
 * Uses caching to avoid repeated lookups for similar timestamps
 */
async function getBlockNumberForTimestamp(
  chainId: SupportedChainId,
  timestamp: Date
): Promise<bigint> {
  // Check cache first (round to nearest hour for cache key)
  const cacheKey = `${chainId}:${Math.floor(timestamp.getTime() / 3600000) * 3600000}`;
  const cached = blockNumberCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = getClient(chainId);
  const rateLimiter = getRpcRateLimiter(chainId);
  const targetTime = BigInt(Math.floor(timestamp.getTime() / 1000));

  // Rate limit the initial block fetch
  await rateLimiter.acquire();
  const latestBlock = await client.getBlock({ blockTag: "latest" });

  // If target is in the future or very recent, use latest
  if (targetTime >= latestBlock.timestamp) {
    return latestBlock.number;
  }

  // Estimate starting point based on average block time
  const avgBlockTime = chainId === 1 ? 12n : 2n; // Ethereum ~12s, L2s ~2s
  const timeDiff = latestBlock.timestamp - targetTime;
  const estimatedBlocksBack = timeDiff / avgBlockTime;
  let estimatedBlock = latestBlock.number - estimatedBlocksBack;

  // Clamp to valid range
  if (estimatedBlock < 1n) estimatedBlock = 1n;

  // For historical queries, the estimation is usually good enough
  // Only do a few refinement iterations to save RPC calls
  let closestBlock = estimatedBlock;
  const maxIterations = 5; // Reduced from 20 to save RPC calls

  for (let i = 0; i < maxIterations; i++) {
    try {
      await rateLimiter.acquire();
      const block = await client.getBlock({ blockNumber: closestBlock });

      const diff = block.timestamp - targetTime;

      // If we're within 1 hour, that's close enough for historical data
      if (diff >= -3600n && diff <= 3600n) {
        break;
      }

      // Adjust estimate
      const adjustment = diff / avgBlockTime;
      closestBlock = closestBlock - adjustment;

      if (closestBlock < 1n) closestBlock = 1n;
      if (closestBlock > latestBlock.number) closestBlock = latestBlock.number;
    } catch {
      // On error, just use current estimate
      break;
    }
  }

  // Cache the result
  blockNumberCache.set(cacheKey, closestBlock);

  return closestBlock;
}

/**
 * Fetches historical token balances using RPC calls at a specific block
 * This is a fallback when GoldRush is not available
 * Uses rate limiting to avoid hitting free RPC limits
 */
export async function getHistoricalBalancesViaRpc(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamp: Date
): Promise<TokenBalance[]> {
  const client = getClient(chainId);
  const rateLimiter = getRpcRateLimiter(chainId);
  const tokens = COMMON_TOKENS[chainId] || [];

  if (tokens.length === 0) {
    console.warn(`No common tokens configured for chain ${chainId}`);
    return [];
  }

  try {
    // Get block number for this timestamp (already rate-limited internally)
    const blockNumber = await getBlockNumberForTimestamp(chainId, timestamp);

    // Rate limit the native balance fetch
    await rateLimiter.acquire();
    const nativeBalance = await client.getBalance({
      address: walletAddress,
      blockNumber,
    });

    const balances: TokenBalance[] = [];

    // Add native balance if non-zero
    if (nativeBalance > 0n) {
      const nativeSymbol = chainId === 137 ? "MATIC" : "ETH";
      balances.push({
        tokenAddress: "0x0000000000000000000000000000000000000000",
        tokenSymbol: nativeSymbol,
        tokenDecimals: 18,
        balance: Number(nativeBalance) / 1e18,
        balanceRaw: nativeBalance.toString(),
        chainId,
      });
    }

    // Rate limit the multicall
    await rateLimiter.acquire();
    // Fetch ERC20 balances using multicall for efficiency
    const balanceResults = await client.multicall({
      contracts: tokens.map((token) => ({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddress],
      })),
      blockNumber,
      allowFailure: true,
    });

    // Process results
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const result = balanceResults[i];

      if (result.status === "success" && result.result) {
        const rawBalance = result.result as bigint;
        if (rawBalance > 0n) {
          const balance = Number(rawBalance) / Math.pow(10, token.decimals);
          balances.push({
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenDecimals: token.decimals,
            balance,
            balanceRaw: rawBalance.toString(),
            chainId,
          });
        }
      }
    }

    return balances;
  } catch (error) {
    console.warn(`RPC historical balance fetch failed for chain ${chainId}:`, error);
    return [];
  }
}

/**
 * Fetches historical balances across multiple chains via RPC
 */
export async function getMultiChainHistoricalBalancesViaRpc(
  walletAddress: Address,
  chains: SupportedChainId[],
  timestamp: Date
): Promise<TokenBalance[]> {
  const results = await Promise.allSettled(
    chains.map((chainId) => getHistoricalBalancesViaRpc(walletAddress, chainId, timestamp))
  );

  const balances: TokenBalance[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      balances.push(...result.value);
    }
  }

  return balances;
}
