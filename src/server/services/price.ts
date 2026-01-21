import type { PrismaClient } from "@prisma/client";

// CoinGecko API base URL (free tier)
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Rate limit: 10-30 calls/minute for free tier, cache aggressively
const CACHE_TTL_MS = 60_000; // 1 minute cache

// In-memory cache for price data
interface PriceCacheEntry {
  priceUsd: number;
  priceEth: number | null;
  change24hPct: number | null;
  fetchedAt: number;
}

const memoryCache = new Map<string, PriceCacheEntry>();

// Common token coingecko IDs mapping
export const COINGECKO_IDS: Record<string, string> = {
  // Native tokens
  ETH: "ethereum",
  WETH: "weth",
  MATIC: "matic-network",
  WMATIC: "wmatic",

  // Stablecoins
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  FRAX: "frax",

  // Liquid staking tokens
  stETH: "staked-ether",
  wstETH: "wrapped-steth",
  rETH: "rocket-pool-eth",
  cbETH: "coinbase-wrapped-staked-eth",
  eETH: "ether-fi-staked-eth",
  weETH: "wrapped-eeth",

  // DeFi tokens
  AAVE: "aave",
  COMP: "compound-governance-token",
  UNI: "uniswap",
  LDO: "lido-dao",
  ETHFI: "ether-fi",

  // Wrapped BTC
  WBTC: "wrapped-bitcoin",

  // Ethena
  USDe: "ethena-usde",
  sUSDe: "ethena-staked-usde",
};

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
  eth?: number;
}

interface CoinGeckoPriceResponse {
  [id: string]: CoinGeckoPrice;
}

/**
 * Fetch prices from CoinGecko API
 */
async function fetchPricesFromCoinGecko(
  coingeckoIds: string[]
): Promise<Map<string, PriceCacheEntry>> {
  const result = new Map<string, PriceCacheEntry>();

  if (coingeckoIds.length === 0) return result;

  // Deduplicate and filter empty
  const uniqueIds = [...new Set(coingeckoIds.filter(Boolean))];

  try {
    const url = new URL(`${COINGECKO_API}/simple/price`);
    url.searchParams.set("ids", uniqueIds.join(","));
    url.searchParams.set("vs_currencies", "usd,eth");
    url.searchParams.set("include_24hr_change", "true");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return result;
    }

    const data: CoinGeckoPriceResponse = await response.json();
    const now = Date.now();

    for (const [id, price] of Object.entries(data)) {
      const entry: PriceCacheEntry = {
        priceUsd: price.usd,
        priceEth: price.eth ?? null,
        change24hPct: price.usd_24h_change ?? null,
        fetchedAt: now,
      };
      result.set(id, entry);
      memoryCache.set(id, entry);
    }
  } catch (error) {
    console.error("Failed to fetch prices from CoinGecko:", error);
  }

  return result;
}

/**
 * Get price for a single token by its CoinGecko ID
 */
export async function getPrice(coingeckoId: string): Promise<PriceCacheEntry | null> {
  // Check memory cache first
  const cached = memoryCache.get(coingeckoId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Fetch from API
  const prices = await fetchPricesFromCoinGecko([coingeckoId]);
  return prices.get(coingeckoId) ?? null;
}

/**
 * Get prices for multiple tokens by their CoinGecko IDs
 */
export async function getPrices(
  coingeckoIds: string[]
): Promise<Map<string, PriceCacheEntry>> {
  const result = new Map<string, PriceCacheEntry>();
  const toFetch: string[] = [];
  const now = Date.now();

  // Check cache for each ID
  for (const id of coingeckoIds) {
    const cached = memoryCache.get(id);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      result.set(id, cached);
    } else {
      toFetch.push(id);
    }
  }

  // Fetch missing prices
  if (toFetch.length > 0) {
    const fetched = await fetchPricesFromCoinGecko(toFetch);
    for (const [id, price] of fetched) {
      result.set(id, price);
    }
  }

  return result;
}

/**
 * Get price by token symbol (using COINGECKO_IDS mapping)
 */
export async function getPriceBySymbol(symbol: string): Promise<PriceCacheEntry | null> {
  const coingeckoId = COINGECKO_IDS[symbol.toUpperCase()];
  if (!coingeckoId) {
    console.warn(`No CoinGecko ID mapping for symbol: ${symbol}`);
    return null;
  }
  return getPrice(coingeckoId);
}

/**
 * Sync prices to database cache
 */
export async function syncPricesToDatabase(prisma: PrismaClient): Promise<number> {
  // Get all tokens with coingecko IDs
  const tokens = await prisma.token.findMany({
    where: {
      coingeckoId: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      coingeckoId: true,
    },
  });

  const coingeckoIds = tokens
    .map((t) => t.coingeckoId)
    .filter((id): id is string => id !== null);

  // Fetch prices
  const prices = await getPrices(coingeckoIds);

  // Update database
  let updated = 0;
  for (const token of tokens) {
    if (!token.coingeckoId) continue;
    const price = prices.get(token.coingeckoId);
    if (!price) continue;

    await prisma.priceCache.upsert({
      where: { tokenId: token.id },
      create: {
        tokenId: token.id,
        priceUsd: price.priceUsd,
        priceEth: price.priceEth,
        change24hPct: price.change24hPct,
      },
      update: {
        priceUsd: price.priceUsd,
        priceEth: price.priceEth,
        change24hPct: price.change24hPct,
        updatedAt: new Date(),
      },
    });
    updated++;
  }

  return updated;
}

/**
 * Get cached price from database
 */
export async function getCachedPrice(
  prisma: PrismaClient,
  tokenId: string
): Promise<{ priceUsd: number; change24hPct: number | null } | null> {
  const cached = await prisma.priceCache.findUnique({
    where: { tokenId },
  });

  if (!cached) return null;

  return {
    priceUsd: cached.priceUsd,
    change24hPct: cached.change24hPct,
  };
}

/**
 * Clear the in-memory cache
 */
export function clearPriceCache(): void {
  memoryCache.clear();
}
