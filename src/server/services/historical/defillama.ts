import {
  DEFILLAMA_CHAIN_PREFIXES,
  type SupportedChainId,
} from "@/lib/constants";
import type { DefiLlamaPriceResponse } from "./types";
import { fetchWithRetry, getRateLimiter, sleep } from "@/server/lib/rate-limiter";

const DEFILLAMA_BASE_URL = "https://coins.llama.fi";
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_TOKENS_PER_REQUEST = 100;

// DeFi Llama is free but we add conservative rate limiting to be a good citizen
const defillamaRateLimiter = getRateLimiter("defillama", {
  ratePerSecond: 5,
  maxBurst: 10,
});

interface TokenPriceRequest {
  chainId: SupportedChainId;
  tokenAddress: string;
}

/**
 * Formats a token for DeFi Llama API
 * Format: "chain:address" (e.g., "ethereum:0x...")
 */
function formatCoinId(chainId: SupportedChainId, tokenAddress: string): string {
  const prefix = DEFILLAMA_CHAIN_PREFIXES[chainId];
  if (!prefix) {
    return "";
  }
  return `${prefix}:${tokenAddress.toLowerCase()}`;
}

/**
 * Fetches historical prices for multiple tokens at a specific timestamp
 * Uses DeFi Llama's free API (no key required)
 * Returns a Map of "chainId:tokenAddress" -> price in USD
 */
export async function getHistoricalPrices(
  tokens: TokenPriceRequest[],
  timestamp: Date
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  if (tokens.length === 0) {
    return priceMap;
  }

  // Format coin IDs and filter out invalid ones
  const coinIds: string[] = [];
  const coinIdToKey = new Map<string, string>();

  for (const token of tokens) {
    const coinId = formatCoinId(token.chainId, token.tokenAddress);
    if (coinId) {
      coinIds.push(coinId);
      coinIdToKey.set(coinId, `${token.chainId}:${token.tokenAddress.toLowerCase()}`);
    }
  }

  if (coinIds.length === 0) {
    return priceMap;
  }

  // Batch requests if more than MAX_TOKENS_PER_REQUEST
  const batches: string[][] = [];
  for (let i = 0; i < coinIds.length; i += MAX_TOKENS_PER_REQUEST) {
    batches.push(coinIds.slice(i, i + MAX_TOKENS_PER_REQUEST));
  }

  const unixTimestamp = Math.floor(timestamp.getTime() / 1000);

  // Process batches with small delays to avoid rate limiting
  const results: PromiseSettledResult<Map<string, number>>[] = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      await sleep(200); // 200ms between batches
    }
    const result = await Promise.allSettled([fetchPriceBatch(batches[i], unixTimestamp)]);
    results.push(result[0]);
  }

  // Aggregate results from all batches
  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const [coinId, price] of result.value.entries()) {
        const key = coinIdToKey.get(coinId);
        if (key) {
          priceMap.set(key, price);
        }
      }
    }
  }

  return priceMap;
}

/**
 * Fetches prices for a batch of coins
 * Uses rate limiting and retry with exponential backoff
 */
async function fetchPriceBatch(
  coinIds: string[],
  unixTimestamp: number
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  const coinsParam = coinIds.join(",");
  const url = `${DEFILLAMA_BASE_URL}/prices/historical/${unixTimestamp}/${coinsParam}`;

  try {
    // Rate limit
    await defillamaRateLimiter.acquire();

    const response = await fetchWithRetry(
      url,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          "Content-Type": "application/json",
        },
      },
      {
        maxRetries: 2,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryStatusCodes: [429, 500, 502, 503, 504],
      }
    );

    if (!response.ok) {
      console.warn(
        `DeFi Llama API error: ${response.status} ${response.statusText}`
      );
      return priceMap;
    }

    const data = (await response.json()) as DefiLlamaPriceResponse;

    if (!data.coins) {
      return priceMap;
    }

    for (const [coinId, priceData] of Object.entries(data.coins)) {
      if (priceData?.price !== undefined && priceData.price > 0) {
        priceMap.set(coinId, priceData.price);
      }
    }

    return priceMap;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("DeFi Llama request timed out");
    } else {
      console.warn("DeFi Llama request failed:", error);
    }
    return priceMap;
  }
}

/**
 * Gets current prices for multiple tokens
 * Uses the current timestamp endpoint for live prices
 */
export async function getCurrentPrices(
  tokens: TokenPriceRequest[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  if (tokens.length === 0) {
    return priceMap;
  }

  const coinIds: string[] = [];
  const coinIdToKey = new Map<string, string>();

  for (const token of tokens) {
    const coinId = formatCoinId(token.chainId, token.tokenAddress);
    if (coinId) {
      coinIds.push(coinId);
      coinIdToKey.set(coinId, `${token.chainId}:${token.tokenAddress.toLowerCase()}`);
    }
  }

  if (coinIds.length === 0) {
    return priceMap;
  }

  const batches: string[][] = [];
  for (let i = 0; i < coinIds.length; i += MAX_TOKENS_PER_REQUEST) {
    batches.push(coinIds.slice(i, i + MAX_TOKENS_PER_REQUEST));
  }

  const results = await Promise.allSettled(
    batches.map((batch) => fetchCurrentPriceBatch(batch))
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const [coinId, price] of result.value.entries()) {
        const key = coinIdToKey.get(coinId);
        if (key) {
          priceMap.set(key, price);
        }
      }
    }
  }

  return priceMap;
}

/**
 * Fetches current prices for a batch of coins
 * Uses rate limiting and retry with exponential backoff
 */
async function fetchCurrentPriceBatch(
  coinIds: string[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  const coinsParam = coinIds.join(",");
  const url = `${DEFILLAMA_BASE_URL}/prices/current/${coinsParam}`;

  try {
    // Rate limit
    await defillamaRateLimiter.acquire();

    const response = await fetchWithRetry(
      url,
      {
        timeout: REQUEST_TIMEOUT,
        headers: {
          "Content-Type": "application/json",
        },
      },
      {
        maxRetries: 2,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryStatusCodes: [429, 500, 502, 503, 504],
      }
    );

    if (!response.ok) {
      console.warn(
        `DeFi Llama API error: ${response.status} ${response.statusText}`
      );
      return priceMap;
    }

    const data = (await response.json()) as DefiLlamaPriceResponse;

    if (!data.coins) {
      return priceMap;
    }

    for (const [coinId, priceData] of Object.entries(data.coins)) {
      if (priceData?.price !== undefined && priceData.price > 0) {
        priceMap.set(coinId, priceData.price);
      }
    }

    return priceMap;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("DeFi Llama request timed out");
    } else {
      console.warn("DeFi Llama request failed:", error);
    }
    return priceMap;
  }
}
