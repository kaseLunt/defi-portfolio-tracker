/**
 * Fast Portfolio Service - Gold Standard UX
 *
 * Implements:
 * 1. Progressive Loading - token balances first, DeFi positions separately
 * 2. Stale-While-Revalidate - return cached data immediately, refresh in background
 * 3. Background Pre-warming - track active wallets for background refresh
 * 4. Smart Adapter Selection - only query relevant protocols based on token holdings
 */

import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { adapterRegistry } from "../adapters/registry";
import type { Position } from "../adapters/types";
import { getPrices } from "./price";
import { getFromCache, setInCache } from "../lib/redis";
import {
  enrichPositionsWithPrices,
  calculateTotalValue,
  calculateYield24h,
  calculateWeightedApy,
  groupByProtocol,
  filterDustPositions,
  sortByValue,
  MIN_POSITION_VALUE_USD,
  type EnrichedPosition,
} from "./portfolio-utils";
import Redis from "ioredis";

// Get Redis client for sorted set operations
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
let _redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!_redis) {
    try {
      _redis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      _redis.on("error", () => {
        // Silently handle errors
      });
    } catch {
      return null;
    }
  }
  return _redis;
}
import { getTokenBalances, type TokenBalance } from "./balances";

// Cache TTLs
const TOKEN_CACHE_TTL = 300; // 5 minutes - token balances change more frequently
const DEFI_CACHE_TTL = 900; // 15 minutes - DeFi positions are relatively stable
const STALE_THRESHOLD = 180; // Consider stale after 3 minutes (triggers background refresh)

// Active wallets set (for background pre-warming)
const ACTIVE_WALLETS_KEY = "active-wallets";
const ACTIVE_WALLET_TTL = 3600; // Keep wallet active for 1 hour

/**
 * Token to Protocol mapping for smart adapter selection
 * Maps token symbols/addresses to the protocols that should be queried
 */
const TOKEN_TO_PROTOCOLS: Record<string, string[]> = {
  // Lido
  stETH: ["lido"],
  wstETH: ["lido", "aave-v3", "spark", "morpho"],

  // EtherFi
  eETH: ["etherfi"],
  weETH: ["etherfi", "aave-v3", "morpho", "pendle"],

  // Aave (aTokens indicate Aave usage)
  aWETH: ["aave-v3"],
  aUSDC: ["aave-v3"],
  aUSDT: ["aave-v3"],
  aDAI: ["aave-v3"],

  // Compound
  cUSDC: ["compound-v3"],
  cWETH: ["compound-v3"],

  // Spark
  spDAI: ["spark"],
  sDAI: ["spark"],

  // EigenLayer
  "EIGEN": ["eigenlayer"],

  // Pendle
  "PT-": ["pendle"], // PT tokens
  "YT-": ["pendle"], // YT tokens

  // Common tokens that could be in lending protocols
  WETH: ["aave-v3", "compound-v3", "spark", "morpho"],
  USDC: ["aave-v3", "compound-v3", "spark", "morpho"],
  USDT: ["aave-v3", "morpho"],
  DAI: ["aave-v3", "spark", "morpho"],
  WBTC: ["aave-v3", "morpho"],

  // ETH derivatives
  rETH: ["aave-v3", "morpho", "eigenlayer"],
  cbETH: ["aave-v3", "eigenlayer"],
};

/**
 * Determine which protocols to query based on token holdings
 */
function getRelevantProtocols(tokens: TokenBalance[]): Set<string> {
  const protocols = new Set<string>();

  for (const token of tokens) {
    const symbol = token.tokenSymbol.toUpperCase();

    // Check exact match
    if (TOKEN_TO_PROTOCOLS[symbol]) {
      TOKEN_TO_PROTOCOLS[symbol].forEach(p => protocols.add(p));
      continue;
    }

    // Check prefix match (for PT-*, YT-*, a*, c*, sp* tokens)
    for (const [prefix, prots] of Object.entries(TOKEN_TO_PROTOCOLS)) {
      if (prefix.endsWith("-") && symbol.startsWith(prefix)) {
        prots.forEach(p => protocols.add(p));
      }
    }

    // Check for Aave aTokens (start with 'a' followed by uppercase)
    if (/^A[A-Z]/.test(symbol)) {
      protocols.add("aave-v3");
    }

    // Check for Compound cTokens
    if (/^C[A-Z]/.test(symbol) && symbol !== "COMP") {
      protocols.add("compound-v3");
    }
  }

  // Always check staking protocols if user has ETH or ETH derivatives
  const hasEthOrDerivatives = tokens.some(t =>
    ["ETH", "WETH", "STETH", "WSTETH", "EETH", "WEETH", "RETH", "CBETH"].includes(t.tokenSymbol.toUpperCase())
  );

  if (hasEthOrDerivatives) {
    protocols.add("lido");
    protocols.add("etherfi");
    protocols.add("eigenlayer");
  }

  return protocols;
}

/**
 * Mark a wallet as active (for background pre-warming)
 */
export async function markWalletActive(walletAddress: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const normalizedAddress = walletAddress.toLowerCase();
    await redis.zadd(ACTIVE_WALLETS_KEY, Date.now(), normalizedAddress);
    // Trim old entries (older than 1 hour)
    const cutoff = Date.now() - (ACTIVE_WALLET_TTL * 1000);
    await redis.zremrangebyscore(ACTIVE_WALLETS_KEY, 0, cutoff);
  } catch {
    // Silently fail
  }
}

/**
 * Get list of active wallets for pre-warming
 */
export async function getActiveWallets(): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) return [];

  try {
    const cutoff = Date.now() - (ACTIVE_WALLET_TTL * 1000);
    return redis.zrangebyscore(ACTIVE_WALLETS_KEY, cutoff, "+inf");
  } catch {
    return [];
  }
}

export interface TokenBalancesResult {
  balances: TokenBalance[];
  totalValueUsd: number;
  byChain: { chainId: SupportedChainId; totalValueUsd: number; percentage: number }[];
  fetchedAt: string;
  stale: boolean;
  refreshing: boolean;
}

/**
 * Get token balances (FAST - ~600ms)
 * Returns cached data immediately, triggers background refresh if stale
 */
export async function getTokenBalancesFast(
  walletAddress: Address,
  chains?: SupportedChainId[]
): Promise<TokenBalancesResult> {
  const normalizedAddress = walletAddress.toLowerCase();
  const chainKey = chains?.sort().join(",") || "all";
  const cacheKey = `tokens:${normalizedAddress}:${chainKey}`;
  const timestampKey = `${cacheKey}:ts`;
  const redis = getRedisClient();

  // Mark wallet as active for pre-warming
  await markWalletActive(normalizedAddress);

  // Check cache
  const [cached, timestamp] = await Promise.all([
    getFromCache<TokenBalance[]>(cacheKey),
    redis?.get(timestampKey).catch(() => null) ?? Promise.resolve(null),
  ]);

  const cachedTimestamp = timestamp ? parseInt(timestamp, 10) : 0;
  const age = Date.now() - cachedTimestamp;
  const isStale = age > STALE_THRESHOLD * 1000;

  // If we have cached data
  if (cached) {
    // If stale, trigger background refresh
    if (isStale) {
      // Don't await - let it run in background
      refreshTokenBalances(walletAddress, chains, cacheKey, timestampKey).catch(err => {
        console.error("[Portfolio] Background token refresh failed:", err);
      });
    }

    return formatTokenResult(cached, isStale, isStale);
  }

  // No cache - fetch synchronously
  console.log(`[Portfolio] Token cache MISS for ${normalizedAddress.slice(0, 10)}...`);
  const balances = await getTokenBalances(walletAddress, chains);

  // Cache the result
  await setInCache(cacheKey, balances, TOKEN_CACHE_TTL);
  if (redis) {
    await redis.set(timestampKey, Date.now().toString(), "EX", TOKEN_CACHE_TTL).catch(() => {});
  }

  return formatTokenResult(balances, false, false);
}

async function refreshTokenBalances(
  walletAddress: Address,
  chains: SupportedChainId[] | undefined,
  cacheKey: string,
  timestampKey: string
): Promise<void> {
  console.log(`[Portfolio] Background refreshing tokens for ${walletAddress.slice(0, 10)}...`);
  const redis = getRedisClient();
  const balances = await getTokenBalances(walletAddress, chains);
  await setInCache(cacheKey, balances, TOKEN_CACHE_TTL);
  if (redis) {
    await redis.set(timestampKey, Date.now().toString(), "EX", TOKEN_CACHE_TTL).catch(() => {});
  }
}

function formatTokenResult(
  balances: TokenBalance[],
  stale: boolean,
  refreshing: boolean
): TokenBalancesResult {
  // Filter dust
  const filtered = balances.filter(b => b.quoteUsd >= MIN_POSITION_VALUE_USD);
  const totalValueUsd = filtered.reduce((sum, b) => sum + b.quoteUsd, 0);

  // Group by chain
  const chainMap = new Map<SupportedChainId, number>();
  for (const balance of filtered) {
    const current = chainMap.get(balance.chainId) ?? 0;
    chainMap.set(balance.chainId, current + balance.quoteUsd);
  }

  const byChain = Array.from(chainMap.entries())
    .map(([chainId, value]) => ({
      chainId,
      totalValueUsd: value,
      percentage: totalValueUsd > 0 ? (value / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  return {
    balances: filtered,
    totalValueUsd,
    byChain,
    fetchedAt: new Date().toISOString(),
    stale,
    refreshing,
  };
}

// Re-export EnrichedPosition for backwards compatibility
export type { EnrichedPosition } from "./portfolio-utils";

export interface DefiPositionsResult {
  positions: EnrichedPosition[];
  totalValueUsd: number;
  totalYield24h: number;
  avgApy: number;
  byProtocol: {
    protocol: string;
    name: string;
    category: string;
    positions: EnrichedPosition[];
    totalValueUsd: number;
  }[];
  fetchedAt: string;
  stale: boolean;
  refreshing: boolean;
  protocolsQueried: string[];
}

/**
 * Get DeFi positions (SLOW - uses smart adapter selection)
 * Returns cached data immediately, triggers background refresh if stale
 */
export async function getDefiPositionsFast(
  walletAddress: Address,
  tokenBalances: TokenBalance[],
  chains?: SupportedChainId[]
): Promise<DefiPositionsResult> {
  const normalizedAddress = walletAddress.toLowerCase();
  const chainKey = chains?.sort().join(",") || "all";
  const cacheKey = `defi:${normalizedAddress}:${chainKey}`;
  const timestampKey = `${cacheKey}:ts`;
  const redis = getRedisClient();

  // Check cache
  const [cached, timestamp] = await Promise.all([
    getFromCache<{ positions: Position[]; protocolsQueried: string[] }>(cacheKey),
    redis?.get(timestampKey).catch(() => null) ?? Promise.resolve(null),
  ]);

  const cachedTimestamp = timestamp ? parseInt(timestamp, 10) : 0;
  const age = Date.now() - cachedTimestamp;
  const isStale = age > STALE_THRESHOLD * 1000;

  // Determine which protocols to query based on token holdings
  const relevantProtocols = getRelevantProtocols(tokenBalances);
  const protocolsToQuery = Array.from(relevantProtocols);

  // If we have cached data
  if (cached) {
    // If stale, trigger background refresh
    if (isStale) {
      refreshDefiPositions(walletAddress, protocolsToQuery, chains, cacheKey, timestampKey).catch(err => {
        console.error("[Portfolio] Background DeFi refresh failed:", err);
      });
    }

    return enrichAndFormatPositions(cached.positions, cached.protocolsQueried, isStale, isStale);
  }

  // No cache - fetch synchronously with smart adapter selection
  console.log(`[Portfolio] DeFi cache MISS for ${normalizedAddress.slice(0, 10)}..., querying: ${protocolsToQuery.join(", ") || "none"}`);

  const positions = await fetchPositionsFromProtocols(walletAddress, protocolsToQuery, chains);

  // Cache the result
  const cacheData = { positions, protocolsQueried: protocolsToQuery };
  await setInCache(cacheKey, cacheData, DEFI_CACHE_TTL);
  if (redis) {
    await redis.set(timestampKey, Date.now().toString(), "EX", DEFI_CACHE_TTL).catch(() => {});
  }

  return enrichAndFormatPositions(positions, protocolsToQuery, false, false);
}

async function refreshDefiPositions(
  walletAddress: Address,
  protocols: string[],
  chains: SupportedChainId[] | undefined,
  cacheKey: string,
  timestampKey: string
): Promise<void> {
  console.log(`[Portfolio] Background refreshing DeFi for ${walletAddress.slice(0, 10)}...`);
  const redis = getRedisClient();
  const positions = await fetchPositionsFromProtocols(walletAddress, protocols, chains);
  const cacheData = { positions, protocolsQueried: protocols };
  await setInCache(cacheKey, cacheData, DEFI_CACHE_TTL);
  if (redis) {
    await redis.set(timestampKey, Date.now().toString(), "EX", DEFI_CACHE_TTL).catch(() => {});
  }
}

async function fetchPositionsFromProtocols(
  walletAddress: Address,
  protocols: string[],
  chains?: SupportedChainId[]
): Promise<Position[]> {
  if (protocols.length === 0) {
    return [];
  }

  const fetchStart = Date.now();
  const results = await Promise.allSettled(
    protocols.map(protocolId =>
      adapterRegistry.getPositionsFromProtocol(protocolId, walletAddress)
    )
  );

  let positions: Position[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      positions.push(...result.value);
    }
  }

  // Filter by chain if specified
  if (chains?.length) {
    positions = positions.filter(p => chains.includes(p.chainId));
  }

  console.log(`[Portfolio] Smart adapters (${protocols.length} protocols) took ${Date.now() - fetchStart}ms`);

  return positions;
}

async function enrichAndFormatPositions(
  positions: Position[],
  protocolsQueried: string[],
  stale: boolean,
  refreshing: boolean
): Promise<DefiPositionsResult> {
  // Collect unique coingecko IDs for price fetching
  const coingeckoIds = new Set<string>();
  for (const position of positions) {
    if (position.coingeckoId) {
      coingeckoIds.add(position.coingeckoId);
    }
  }

  // Fetch prices
  const prices = await getPrices(Array.from(coingeckoIds));

  // Enrich, sort, and filter using shared utilities
  const enrichedPositions = enrichPositionsWithPrices(positions, prices);
  const sortedPositions = sortByValue(enrichedPositions);
  const filtered = filterDustPositions(sortedPositions);

  // Calculate aggregates using shared utilities
  const totalValueUsd = calculateTotalValue(filtered);
  const totalYield24h = calculateYield24h(filtered);
  const avgApy = calculateWeightedApy(filtered);
  const byProtocol = groupByProtocol(filtered);

  return {
    positions: filtered,
    totalValueUsd,
    totalYield24h,
    avgApy,
    byProtocol,
    fetchedAt: new Date().toISOString(),
    stale,
    refreshing,
    protocolsQueried,
  };
}

/**
 * Pre-warm cache for a wallet (called by background job)
 */
export async function prewarmWalletCache(walletAddress: Address): Promise<void> {
  console.log(`[Prewarm] Starting cache warm for ${walletAddress.slice(0, 10)}...`);
  const start = Date.now();

  // Fetch token balances first
  const tokenResult = await getTokenBalancesFast(walletAddress);

  // Then fetch DeFi positions using smart selection
  await getDefiPositionsFast(walletAddress, tokenResult.balances);

  console.log(`[Prewarm] Completed for ${walletAddress.slice(0, 10)}... in ${Date.now() - start}ms`);
}
