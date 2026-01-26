/**
 * Yields service - fetches real APY data from DeFi Llama
 * https://yields.llama.fi/pools
 */

import { getFromCache, setInCache } from "../lib/redis";

const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";
const CACHE_KEY = "yields:defillama";
const CACHE_TTL = 86400; // 24 hours - good for strategy planning

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
        return apy;
      }
    }

    // Search by project name
    for (const [key, apy] of yields.entries()) {
      if (key.startsWith("lido:") && apy > 0) {
        return apy;
      }
    }

    return DEFAULT_APY;
  } catch (error) {
    console.error("[Yields] Failed to get Lido APY:", error);
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

    // DeFi Llama uses "ether.fi-stake" as the project name
    const keys = [
      "ether.fi-stake:weeth",
      "ether.fi-stake:ethereum:weeth",
      "ether.fi-stake:eeth",
      "ether.fi-stake:ethereum:eeth",
    ];

    for (const key of keys) {
      const apy = yields.get(key);
      if (apy !== undefined && apy > 0) {
        return apy;
      }
    }

    // Search by project name
    for (const [key, apy] of yields.entries()) {
      if (key.startsWith("ether.fi-stake:") && apy > 0) {
        return apy;
      }
    }

    return DEFAULT_APY;
  } catch (error) {
    console.error("[Yields] Failed to get Ether.fi APY:", error);
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

/**
 * EtherFi Protocol Stats
 */
interface EtherFiProtocolStats {
  tvl: number;
  tvlUsd: string;
}

const ETHERFI_STATS_CACHE_KEY = "etherfi:protocol-stats";
const ETHERFI_STATS_CACHE_TTL = 300; // 5 minutes

/**
 * Get EtherFi protocol TVL from their official API
 */
export async function getEtherFiProtocolStats(): Promise<EtherFiProtocolStats> {
  const DEFAULT_STATS: EtherFiProtocolStats = {
    tvl: 0,
    tvlUsd: "—",
  };

  try {
    // Check cache first
    const cached = await getFromCache<EtherFiProtocolStats>(ETHERFI_STATS_CACHE_KEY);
    if (cached) {
      return cached;
    }

    // Fetch from EtherFi's official API
    const response = await fetch("https://ether.fi/api/dapp/protocol/tvl", {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[EtherFi Stats] API error: ${response.status}`);
      return DEFAULT_STATS;
    }

    const data = await response.json();

    // EtherFi API returns TVL directly
    const tvl = data.tvl ?? 0;

    const stats: EtherFiProtocolStats = {
      tvl,
      tvlUsd: formatTvl(tvl),
    };

    // Cache result
    await setInCache(ETHERFI_STATS_CACHE_KEY, stats, ETHERFI_STATS_CACHE_TTL);

    console.log(`[EtherFi Stats] TVL: ${stats.tvlUsd}`);
    return stats;
  } catch (error) {
    console.error("[EtherFi Stats] Failed to fetch:", error);
    return DEFAULT_STATS;
  }
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) {
    return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
  }
  if (tvl >= 1_000_000) {
    return `$${(tvl / 1_000_000).toFixed(0)}M`;
  }
  if (tvl === 0) {
    return "—";
  }
  return `$${tvl.toLocaleString()}`;
}

/**
 * Strategy APY data structure
 * Used by the Strategy Builder for real-time APY display
 */
export interface LendingAssetRates {
  supply: number;
  borrow: number;
}

export interface ProtocolLendingRates {
  ETH: LendingAssetRates;
  weETH: LendingAssetRates;
  stETH: LendingAssetRates;
  eETH: LendingAssetRates;
  rETH: LendingAssetRates;
  cbETH: LendingAssetRates;
  USDC: LendingAssetRates;
}

export interface StrategyApyData {
  staking: {
    etherfi: number;
    lido: number;
    rocketpool: number;
    frax: number;
    coinbase: number;
  };
  lending: {
    "aave-v3": ProtocolLendingRates;
    "compound-v3": ProtocolLendingRates;
    morpho: ProtocolLendingRates;
    spark: ProtocolLendingRates;
  };
  lastUpdated: number;
}

// Default lending rates by asset (updated Jan 2025)
const DEFAULT_LENDING_RATES: ProtocolLendingRates = {
  ETH: { supply: 1.8, borrow: 2.5 },
  weETH: { supply: 0.5, borrow: 0 },    // LSTs have low supply APY (already earning yield)
  stETH: { supply: 0.3, borrow: 0 },
  eETH: { supply: 0.5, borrow: 0 },     // Same as weETH
  rETH: { supply: 0.4, borrow: 0 },
  cbETH: { supply: 0.3, borrow: 0 },
  USDC: { supply: 5.5, borrow: 7.5 },
};

// Default APYs as fallback (updated Jan 2025)
const DEFAULT_STRATEGY_APYS: StrategyApyData = {
  staking: {
    etherfi: 3.0,
    lido: 2.9,
    rocketpool: 2.8,
    frax: 3.5,
    coinbase: 2.6,
  },
  lending: {
    "aave-v3": { ...DEFAULT_LENDING_RATES },
    "compound-v3": { ...DEFAULT_LENDING_RATES },
    morpho: { ...DEFAULT_LENDING_RATES },
    spark: { ...DEFAULT_LENDING_RATES },
  },
  lastUpdated: 0,
};

const STRATEGY_APYS_CACHE_KEY = "yields:strategy-apys";

/**
 * Get all APYs needed for the Strategy Builder in one call
 * Returns cached data instantly, fetches fresh data in background if stale
 */
export async function getStrategyApys(): Promise<StrategyApyData> {
  // Check Redis cache first
  const cached = await getFromCache<StrategyApyData>(STRATEGY_APYS_CACHE_KEY);
  if (cached) {
    console.log("[Yields] Returning cached strategy APYs");
    return cached;
  }

  try {
    const yields = await fetchYields();
    console.log(`[Yields] Fetched ${yields.size} yield entries from DeFi Llama`);

    // Helper to find APY with fallback
    const findApy = (name: string, patterns: string[], fallback: number): number => {
      for (const pattern of patterns) {
        for (const [key, apy] of yields.entries()) {
          if (key.toLowerCase().includes(pattern.toLowerCase()) && apy > 0) {
            console.log(`[Yields] Found ${name}: ${apy.toFixed(2)}% (key: ${key})`);
            return apy;
          }
        }
      }
      console.log(`[Yields] Using fallback for ${name}: ${fallback}%`);
      return fallback;
    };

    // Helper to build lending rates for a protocol
    const buildLendingRates = (protocol: string, patterns: Record<string, string[]>): ProtocolLendingRates => ({
      ETH: {
        supply: findApy(`${protocol} ETH Supply`, patterns.eth || [`${protocol}:weth`, `${protocol}:eth`], 1.8),
        borrow: findApy(`${protocol} ETH Borrow`, patterns.eth || [`${protocol}:weth`], 2.5),
      },
      weETH: {
        supply: findApy(`${protocol} weETH Supply`, patterns.weeth || [`${protocol}:weeth`], 0.5),
        borrow: 0, // LSTs typically not borrowable
      },
      stETH: {
        supply: findApy(`${protocol} stETH Supply`, patterns.steth || [`${protocol}:steth`, `${protocol}:wsteth`], 0.3),
        borrow: 0,
      },
      eETH: {
        supply: findApy(`${protocol} eETH Supply`, patterns.weeth || [`${protocol}:weeth`, `${protocol}:eeth`], 0.5),
        borrow: 0,
      },
      rETH: {
        supply: findApy(`${protocol} rETH Supply`, patterns.reth || [`${protocol}:reth`], 0.4),
        borrow: 0,
      },
      cbETH: {
        supply: findApy(`${protocol} cbETH Supply`, patterns.cbeth || [`${protocol}:cbeth`], 0.3),
        borrow: 0,
      },
      USDC: {
        supply: findApy(`${protocol} USDC Supply`, patterns.usdc || [`${protocol}:usdc`], 5.5),
        borrow: findApy(`${protocol} USDC Borrow`, patterns.usdc || [`${protocol}:usdc`], 7.5),
      },
    });

    const data: StrategyApyData = {
      staking: {
        // Updated fallbacks to match current DeFi Llama values
        etherfi: findApy("EtherFi", ["ether.fi-stake:weeth", "ether.fi-stake", "ether.fi"], 3.0),
        lido: findApy("Lido", ["lido:steth", "lido:wsteth", "lido"], 2.9),
        rocketpool: findApy("RocketPool", ["rocket-pool:reth", "rocket-pool", "reth"], 2.8),
        frax: findApy("Frax", ["frax-ether:sfrxeth", "frax-ether", "sfrxeth"], 3.5),
        coinbase: findApy("Coinbase", ["coinbase-wrapped-staked-eth:cbeth", "cbeth"], 2.6),
      },
      lending: {
        "aave-v3": buildLendingRates("aave-v3", {
          eth: ["aave-v3:ethereum:weth", "aave-v3:weth"],
          weeth: ["aave-v3:ethereum:weeth", "aave-v3:weeth"],
          steth: ["aave-v3:ethereum:steth", "aave-v3:steth", "aave-v3:wsteth"],
          usdc: ["aave-v3:ethereum:usdc", "aave-v3:usdc"],
        }),
        "compound-v3": buildLendingRates("compound-v3", {
          eth: ["compound-v3:weth", "compound-v3:eth"],
          usdc: ["compound-v3:usdc"],
        }),
        morpho: buildLendingRates("morpho", {
          eth: ["morpho-blue:weth", "morpho:weth"],
          weeth: ["morpho-blue:weeth", "morpho:weeth"],
          usdc: ["morpho-blue:usdc", "morpho:usdc"],
        }),
        spark: buildLendingRates("spark", {
          eth: ["spark:weth", "spark:eth", "spark-lend:weth"],
          usdc: ["spark:usdc", "spark-lend:usdc"],
        }),
      },
      lastUpdated: Date.now(),
    };

    // Cache for 24 hours
    await setInCache(STRATEGY_APYS_CACHE_KEY, data, CACHE_TTL);

    console.log("[Yields] Fetched strategy APYs from DeFi Llama");
    return data;
  } catch (error) {
    console.error("[Yields] Failed to fetch strategy APYs:", error);
    return DEFAULT_STRATEGY_APYS;
  }
}
