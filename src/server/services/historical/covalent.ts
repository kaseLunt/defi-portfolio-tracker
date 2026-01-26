import type { Address } from "viem";
import {
  COVALENT_CHAIN_NAMES,
  type SupportedChainId,
} from "@/lib/constants";
import type { TokenBalance, CovalentHistoricalResponse } from "./types";
import { getHistoricalBalancesViaRpc } from "./alchemy";
import {
  fetchWithRetry,
  getRateLimiter,
  sleep,
} from "@/server/lib/rate-limiter";

const COVALENT_API_KEY = process.env.COVALENT_API_KEY;
const COVALENT_BASE_URL = "https://api.covalenthq.com/v1";
const REQUEST_TIMEOUT = 8000; // 8 seconds - fail fast, show partial data

// GoldRush rate limit: 4 requests per second for free tier
const goldRushRateLimiter = getRateLimiter("goldrush", {
  ratePerSecond: 4, // Use full rate limit - we fail fast anyway
  maxBurst: 5,
});

// Cache for GoldRush responses to avoid duplicate API calls
// Key: `${walletAddress}:${chainId}:${days}`
const goldRushCache = new Map<string, {
  data: CovalentHistoricalResponse;
  fetchedAt: number;
}>();

const CACHE_TTL = 60 * 1000; // 1 minute cache for in-flight deduplication

// Track in-flight requests to avoid duplicate parallel calls
const inFlightRequests = new Map<string, Promise<CovalentHistoricalResponse | null>>();

/**
 * Fetches full portfolio history from GoldRush for a chain (single API call)
 * Returns the raw response for extracting multiple timestamps
 * Uses rate limiting and exponential backoff for 429 errors
 */
async function fetchGoldRushPortfolio(
  walletAddress: Address,
  chainId: SupportedChainId,
  days: number
): Promise<CovalentHistoricalResponse | null> {
  if (!COVALENT_API_KEY) {
    return null;
  }

  const chainName = COVALENT_CHAIN_NAMES[chainId];
  if (!chainName) {
    return null;
  }

  // Check cache first
  const cacheKey = `${walletAddress.toLowerCase()}:${chainId}:${days}`;
  const cached = goldRushCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  // Check if there's already an in-flight request for this key
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const url = `${COVALENT_BASE_URL}/${chainName}/address/${walletAddress}/portfolio_v2/?quote-currency=USD&days=${days}`;

  // Create the request promise
  const requestPromise = (async (): Promise<CovalentHistoricalResponse | null> => {
    try {
      // Wait for rate limit token
      await goldRushRateLimiter.acquire();

      const response = await fetchWithRetry(
        url,
        {
          timeout: REQUEST_TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${COVALENT_API_KEY}`,
          },
        },
        {
          maxRetries: 2, // Fail faster - show partial data
          baseDelayMs: 1500,
          maxDelayMs: 5000,
          retryStatusCodes: [429, 500, 502, 503, 504],
        }
      );

      if (!response.ok) {
        console.warn(
          `GoldRush API error for ${chainName}: ${response.status} ${response.statusText}`
        );
        return null;
      }

      const data = (await response.json()) as CovalentHistoricalResponse;

      // Cache the response
      goldRushCache.set(cacheKey, { data, fetchedAt: Date.now() });

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(`GoldRush request timed out for ${chainName}`);
      } else {
        console.warn(`GoldRush request failed for ${chainName}:`, error);
      }
      return null;
    } finally {
      // Clean up in-flight tracking
      inFlightRequests.delete(cacheKey);
    }
  })();

  // Track the in-flight request
  inFlightRequests.set(cacheKey, requestPromise);

  return requestPromise;
}

/**
 * Extracts balances for a specific timestamp from GoldRush response
 */
function extractBalancesForTimestamp(
  data: CovalentHistoricalResponse,
  chainId: SupportedChainId,
  timestamp: Date
): TokenBalance[] {
  if (!data.data?.items) {
    return [];
  }

  const targetTime = timestamp.getTime();
  const balances: TokenBalance[] = [];

  for (const item of data.data.items) {
    if (!item.holdings || item.holdings.length === 0) continue;

    // Find the holding entry closest to our target timestamp
    let closestHolding = item.holdings[0];
    let closestDiff = Math.abs(
      new Date(item.holdings[0].timestamp).getTime() - targetTime
    );

    for (const holding of item.holdings) {
      const diff = Math.abs(new Date(holding.timestamp).getTime() - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestHolding = holding;
      }
    }

    // Skip zero balances
    const balanceRaw = closestHolding.close.balance;
    if (balanceRaw === "0" || !balanceRaw) continue;

    const decimals = item.contract_decimals || 18;
    const balance = parseFloat(balanceRaw) / Math.pow(10, decimals);

    if (balance <= 0) continue;

    balances.push({
      tokenAddress: item.contract_address,
      tokenSymbol: item.contract_ticker_symbol || "UNKNOWN",
      tokenDecimals: decimals,
      balance,
      balanceRaw,
      chainId,
    });
  }

  return balances;
}

/**
 * Fetches historical token balances for a wallet at a specific date
 * Uses cached GoldRush data if available, otherwise falls back to RPC
 */
export async function getHistoricalBalances(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamp: Date
): Promise<TokenBalance[]> {
  // Calculate days needed
  const now = new Date();
  const daysAgo = Math.ceil((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24));

  // Try GoldRush first (will use cache if available)
  const goldRushData = await fetchGoldRushPortfolio(walletAddress, chainId, Math.max(daysAgo + 1, 1));

  if (goldRushData) {
    return extractBalancesForTimestamp(goldRushData, chainId, timestamp);
  }

  // Fallback to RPC
  return getHistoricalBalancesViaRpc(walletAddress, chainId, timestamp);
}

/**
 * Fetches historical balances for multiple timestamps efficiently
 * Makes ONE GoldRush API call per chain, then extracts all timestamps
 */
export async function getBulkHistoricalBalances(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamps: Date[]
): Promise<Map<number, TokenBalance[]>> {
  const results = new Map<number, TokenBalance[]>();

  if (timestamps.length === 0) {
    return results;
  }

  // Calculate max days needed (from oldest timestamp)
  const now = new Date();
  const oldestTimestamp = timestamps.reduce((oldest, ts) =>
    ts.getTime() < oldest.getTime() ? ts : oldest
  );
  const maxDays = Math.ceil((now.getTime() - oldestTimestamp.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Fetch once from GoldRush
  const goldRushData = await fetchGoldRushPortfolio(walletAddress, chainId, maxDays);

  // Extract balances for each timestamp
  for (const timestamp of timestamps) {
    if (goldRushData) {
      results.set(timestamp.getTime(), extractBalancesForTimestamp(goldRushData, chainId, timestamp));
    } else {
      // Fallback to RPC for this timestamp
      const balances = await getHistoricalBalancesViaRpc(walletAddress, chainId, timestamp);
      results.set(timestamp.getTime(), balances);
    }
  }

  return results;
}

/**
 * Fetches historical balances across multiple chains
 * Returns aggregated balances with graceful degradation
 */
export async function getMultiChainHistoricalBalances(
  walletAddress: Address,
  chains: SupportedChainId[],
  timestamp: Date
): Promise<TokenBalance[]> {
  const results = await Promise.allSettled(
    chains.map((chainId) => getHistoricalBalances(walletAddress, chainId, timestamp))
  );

  const balances: TokenBalance[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      balances.push(...result.value);
    }
  }

  return balances;
}

/**
 * Clears the GoldRush cache (useful for testing)
 */
export function clearGoldRushCache(): void {
  goldRushCache.clear();
}
