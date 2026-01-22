/**
 * Yields service - fetches real APY data from DeFi Llama
 * https://yields.llama.fi/pools
 */

import { getFromCache, setInCache } from "../lib/redis";

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";
const CACHE_KEY = "yields:defillama";
const CACHE_TTL = 600; // 10 minutes - APYs don't change that frequently

interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number | null;
  rewardTokens: string[] | null;
  underlyingTokens: string[] | null;
}

interface DefiLlamaYieldsResponse {
  status: string;
  data: DefiLlamaPool[];
}

// Cached yields data
let yieldsCache: Map<string, number> | null = null;
let lastFetch = 0;
const MEMORY_CACHE_TTL = 60000; // 1 minute in-memory cache

/**
 * Fetch all yields from DeFi Llama and cache them
 */
async function fetchYields(): Promise<Map<string, number>> {
  // Check in-memory cache first
  if (yieldsCache && Date.now() - lastFetch < MEMORY_CACHE_TTL) {
    return yieldsCache;
  }

  // Check Redis cache
  const cached = await getFromCache<Record<string, number>>(CACHE_KEY);
  if (cached) {
    yieldsCache = new Map(Object.entries(cached));
    lastFetch = Date.now();
    return yieldsCache;
  }

  // Fetch from API
  try {
    const response = await fetch(DEFILLAMA_YIELDS_URL, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`DeFi Llama yields API error: ${response.status}`);
      return yieldsCache ?? new Map();
    }

    const data: DefiLlamaYieldsResponse = await response.json();

    if (data.status !== "success" || !data.data) {
      console.error("DeFi Llama yields API returned invalid data");
      return yieldsCache ?? new Map();
    }

    // Build a map of project:symbol -> APY
    const yields = new Map<string, number>();

    for (const pool of data.data) {
      if (pool.apy !== null && pool.apy > 0) {
        // Create multiple keys for easy lookup
        const projectKey = `${pool.project.toLowerCase()}:${pool.symbol.toLowerCase()}`;
        const chainKey = `${pool.project.toLowerCase()}:${pool.chain.toLowerCase()}:${pool.symbol.toLowerCase()}`;

        yields.set(projectKey, pool.apy);
        yields.set(chainKey, pool.apy);

        // Also store by pool ID for exact matches
        yields.set(pool.pool, pool.apy);
      }
    }

    // Cache in Redis
    const cacheObj = Object.fromEntries(yields);
    await setInCache(CACHE_KEY, cacheObj, CACHE_TTL);

    // Update in-memory cache
    yieldsCache = yields;
    lastFetch = Date.now();

    console.log(`[Yields] Fetched ${yields.size} APY entries from DeFi Llama`);
    return yields;
  } catch (error) {
    console.error("Failed to fetch yields from DeFi Llama:", error);
    return yieldsCache ?? new Map();
  }
}

/**
 * Get APY for Lido staking
 * Falls back to default if API unavailable
 */
export async function getLidoApy(): Promise<number> {
  const DEFAULT_APY = 3.5;

  try {
    const yields = await fetchYields();

    // Try different key formats
    const keys = [
      "lido:steth",
      "lido:ethereum:steth",
      "lido:wsteth",
      "lido:ethereum:wsteth",
    ];

    for (const key of keys) {
      const apy = yields.get(key);
      if (apy !== undefined && apy > 0) {
        console.log(`[Yields] Lido APY: ${apy.toFixed(2)}% (from ${key})`);
        return apy;
      }
    }

    // Search by project name
    for (const [key, apy] of yields.entries()) {
      if (key.startsWith("lido:") && apy > 0) {
        console.log(`[Yields] Lido APY: ${apy.toFixed(2)}% (from ${key})`);
        return apy;
      }
    }

    console.log(`[Yields] Lido APY not found, using default: ${DEFAULT_APY}%`);
    return DEFAULT_APY;
  } catch (error) {
    console.error("Failed to get Lido APY:", error);
    return DEFAULT_APY;
  }
}

/**
 * Get APY for Ether.fi staking
 * Falls back to default if API unavailable
 */
export async function getEtherFiApy(): Promise<number> {
  const DEFAULT_APY = 3.0;

  try {
    const yields = await fetchYields();

    console.log(`[Yields] Total entries: ${yields.size}`);

    // DeFi Llama uses "ether.fi-stake" as the project name
    const keys = [
      "ether.fi-stake:weeth",
      "ether.fi-stake:ethereum:weeth",
      "ether.fi-stake:eeth",
      "ether.fi-stake:ethereum:eeth",
    ];

    for (const key of keys) {
      const apy = yields.get(key);
      console.log(`[Yields] Checking key "${key}": ${apy}`);
      if (apy !== undefined && apy > 0) {
        console.log(`[Yields] Ether.fi APY: ${apy.toFixed(2)}% (from ${key})`);
        return apy;
      }
    }

    // Search by project name - log all ether.fi keys found
    const etherfiKeys: string[] = [];
    for (const [key, apy] of yields.entries()) {
      if (key.includes("ether.fi") || key.includes("etherfi")) {
        etherfiKeys.push(`${key}=${apy}`);
        if (key.startsWith("ether.fi-stake:") && apy > 0) {
          console.log(`[Yields] Ether.fi APY: ${apy.toFixed(2)}% (from ${key})`);
          return apy;
        }
      }
    }
    console.log(`[Yields] All ether.fi keys found: ${etherfiKeys.join(", ") || "none"}`);

    console.log(`[Yields] Ether.fi APY not found, using default: ${DEFAULT_APY}%`);
    return DEFAULT_APY;
  } catch (error) {
    console.error("Failed to get Ether.fi APY:", error);
    return DEFAULT_APY;
  }
}

/**
 * Get APY for any protocol/symbol combination
 * Returns undefined if not found
 */
export async function getProtocolApy(
  project: string,
  symbol: string,
  chain?: string
): Promise<number | undefined> {
  try {
    const yields = await fetchYields();

    const projectLower = project.toLowerCase();
    const symbolLower = symbol.toLowerCase();

    // Try chain-specific first, then generic
    if (chain) {
      const chainKey = `${projectLower}:${chain.toLowerCase()}:${symbolLower}`;
      const apy = yields.get(chainKey);
      if (apy !== undefined) return apy;
    }

    const genericKey = `${projectLower}:${symbolLower}`;
    return yields.get(genericKey);
  } catch {
    return undefined;
  }
}
