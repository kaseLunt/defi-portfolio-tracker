import type { Address } from "viem";
import { SUPPORTED_CHAINS, HYPERSYNC_ENDPOINTS, type SupportedChainId } from "@/lib/constants";
import { getFromCache, setInCache } from "@/server/lib/redis";
import { getBulkHistoricalBalances as getBulkHistoricalBalancesCovalent } from "./covalent";
// Note: Alchemy SDK disabled due to Referrer header bug in Node.js
// import { getTokenBalancesViaAlchemy, isAlchemyConfigured } from "@/server/lib/alchemy";
import type { TokenBalance } from "./types";
import { getHistoricalPrices } from "./defillama";

// Feature flag for HyperSync (set USE_HYPERSYNC=true in env to enable)
const USE_HYPERSYNC = process.env.USE_HYPERSYNC === "true";

// Check if HyperSync is available for a chain (without importing the module)
function isHyperSyncAvailable(chainId: SupportedChainId): boolean {
  return chainId in HYPERSYNC_ENDPOINTS;
}

// Dynamic import cache for HyperSync module
let hypersyncModule: typeof import("./hypersync") | null = null;
let hypersyncLoadFailed = false;

async function getHypersyncModule() {
  if (hypersyncLoadFailed) return null;
  if (hypersyncModule) return hypersyncModule;

  try {
    hypersyncModule = await import("./hypersync");
    return hypersyncModule;
  } catch (error) {
    console.warn("[Historical] HyperSync module not available on this platform:", error);
    hypersyncLoadFailed = true;
    return null;
  }
}

/**
 * Get bulk historical balances using the configured data source
 * Uses HyperSync if enabled, otherwise falls back to Covalent/GoldRush
 *
 * When using HyperSync:
 * 1. First fetch current balances from Alchemy (free, fast)
 * 2. Pass to HyperSync as anchor for backward reconstruction
 */
async function getBulkHistoricalBalances(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamps: Date[]
): ReturnType<typeof getBulkHistoricalBalancesCovalent> {
  if (USE_HYPERSYNC && isHyperSyncAvailable(chainId)) {
    const hsModule = await getHypersyncModule();
    if (hsModule) {
      console.log(`[Historical] Using HyperSync for chain ${chainId}`);
      try {
        let currentBalances: TokenBalance[] = [];

        // Get current balances from Covalent
        // Note: Alchemy SDK has issues in Node.js server environment (Referrer header bug)
        // TODO: Re-enable Alchemy once we have a valid API key and fix the SDK issue
        const now = new Date();
        const covalentBalances = await getBulkHistoricalBalancesCovalent(walletAddress, chainId, [now]);
        currentBalances = covalentBalances.get(now.getTime()) ?? [];
        console.log(`[Historical] Chain ${chainId}: Got ${currentBalances.length} current balances from Covalent`);

        // Now use HyperSync with current balances to reconstruct history
        return await hsModule.getBulkHistoricalBalancesViaHyperSync(
          walletAddress,
          chainId,
          timestamps,
          currentBalances
        );
      } catch (error) {
        console.warn(`[Historical] HyperSync failed, falling back to Covalent:`, error);
        return getBulkHistoricalBalancesCovalent(walletAddress, chainId, timestamps);
      }
    }
  }

  return getBulkHistoricalBalancesCovalent(walletAddress, chainId, timestamps);
}
import {
  generateTimestamps,
  generateCacheKey,
  getCacheTtl,
  calculatePercentChange,
} from "./utils";
import {
  initProgress,
  updateProgress,
  getStageMessage,
} from "./progress";
import type {
  HistoricalTimeframe,
  HistoricalDataPoint,
  HistoricalPortfolioResult,
} from "./types";

// Default chains to query if not specified
const DEFAULT_CHAINS: SupportedChainId[] = [
  SUPPORTED_CHAINS.ETHEREUM,
  SUPPORTED_CHAINS.ARBITRUM,
  SUPPORTED_CHAINS.OPTIMISM,
  SUPPORTED_CHAINS.BASE,
  SUPPORTED_CHAINS.POLYGON,
];

/**
 * Apply interpolation to fill in data gaps in historical data
 * This handles cases where the API returns 0 or anomalously low values for some timestamps
 * (e.g., when DeFi Llama doesn't have price data for a token at a specific time)
 */
function applyInterpolation(
  dataPoints: HistoricalDataPoint[],
  currentValue?: number
): HistoricalDataPoint[] {
  if (dataPoints.length === 0) return dataPoints;

  // Make a copy to avoid mutating the original
  const result = dataPoints.map(dp => ({
    timestamp: dp.timestamp instanceof Date ? dp.timestamp : new Date(dp.timestamp),
    totalUsd: dp.totalUsd,
  }));

  // Sort by timestamp
  result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // If we have a current value, use it for the final data point
  if (currentValue !== undefined && currentValue > 0 && result.length > 0) {
    result[result.length - 1].totalUsd = currentValue;
  }

  // Find the median of non-zero values to establish a baseline
  const nonZeroValues = result.map(dp => dp.totalUsd).filter(v => v > 0).sort((a, b) => a - b);
  if (nonZeroValues.length === 0) return result;

  const medianValue = nonZeroValues[Math.floor(nonZeroValues.length / 2)];
  const maxValue = Math.max(...nonZeroValues);

  // CRITICAL: Detect corrupted data scenario
  // If currentValue is provided and is way higher than the median (10x+),
  // most of the data is likely corrupted (failed chain fetches)
  // In this case, use currentValue as the reference instead of median
  let referenceValue = medianValue;
  let dataCorrupted = false;

  if (currentValue && currentValue > medianValue * 10) {
    console.log(`[Historical] Data corruption detected: median=$${medianValue.toFixed(2)} but currentValue=$${currentValue.toFixed(2)}`);
    referenceValue = currentValue;
    dataCorrupted = true;
  }

  // A value is considered "anomalous" if it's less than 30% of the reference
  const anomalyThreshold = referenceValue * 0.3;

  // Forward pass: replace anomalous values with previous good value
  let lastGoodValue = dataCorrupted && currentValue ? currentValue : 0;
  for (let i = 0; i < result.length; i++) {
    const value = result[i].totalUsd;

    if (value < anomalyThreshold && lastGoodValue > 0) {
      // This is an anomalous drop - use the last good value
      result[i].totalUsd = lastGoodValue;
    } else if (value >= anomalyThreshold) {
      lastGoodValue = value;
    }
  }

  // Backward pass: fill any remaining leading anomalies
  let firstGoodIndex = result.findIndex(dp => dp.totalUsd >= anomalyThreshold);
  if (firstGoodIndex > 0) {
    const firstGoodValue = result[firstGoodIndex].totalUsd;
    for (let i = 0; i < firstGoodIndex; i++) {
      result[i].totalUsd = firstGoodValue * 0.98; // Slight decay
    }
  } else if (firstGoodIndex === -1 && currentValue && currentValue > 0) {
    // All values are bad, fill with currentValue
    console.log(`[Historical] All data points corrupted, filling with currentValue`);
    for (let i = 0; i < result.length; i++) {
      result[i].totalUsd = currentValue;
    }
  }

  console.log(`[Historical] Interpolation: median=$${medianValue.toFixed(2)}, ref=$${referenceValue.toFixed(2)}, threshold=$${anomalyThreshold.toFixed(2)}, max=$${maxValue.toFixed(2)}${dataCorrupted ? ' (RECOVERED)' : ''}`);

  return result;
}

/**
 * Main orchestrator for fetching historical portfolio data
 *
 * Flow:
 * 1. Check Redis cache → return if hit
 * 2. Generate timestamps based on timeframe config
 * 3. For each timestamp (3 concurrent to avoid rate limits):
 *    - Fetch balances from all chains
 *    - Fetch prices from DeFi Llama
 *    - Calculate total USD value
 * 4. Aggregate into data points
 * 5. Cache with timeframe-specific TTL
 * 6. Return result
 */
export async function getHistoricalPortfolio(
  walletAddress: Address,
  timeframe: HistoricalTimeframe,
  options?: {
    chains?: SupportedChainId[];
    skipCache?: boolean;
    requestId?: string; // Client-provided requestId for progress tracking
    currentValue?: number; // Live portfolio value to use as ground truth for "now"
  }
): Promise<HistoricalPortfolioResult & { requestId?: string }> {
  const chains = options?.chains?.length ? options.chains : DEFAULT_CHAINS;
  const cacheKey = generateCacheKey(walletAddress, timeframe, chains);
  const requestId = options?.requestId;

  // Check cache first (unless skipCache is true)
  if (!options?.skipCache) {
    const cached = await getFromCache<HistoricalPortfolioResult>(cacheKey);
    if (cached) {
      console.log(`[Historical] Cache HIT for ${walletAddress.slice(0, 10)}... ${timeframe}`);
      // Apply interpolation to cached data in case it has $0 gaps
      const interpolatedData = applyInterpolation(cached.dataPoints, options?.currentValue);
      return {
        ...cached,
        dataPoints: interpolatedData,
        startValue: interpolatedData[0]?.totalUsd ?? 0,
        endValue: interpolatedData[interpolatedData.length - 1]?.totalUsd ?? 0,
        change: (interpolatedData[interpolatedData.length - 1]?.totalUsd ?? 0) - (interpolatedData[0]?.totalUsd ?? 0),
        cacheHit: true,
        tokenPriceHistory: cached.tokenPriceHistory ?? {},
        requestId,
      };
    }
    console.log(`[Historical] Cache MISS for ${walletAddress.slice(0, 10)}... ${timeframe}, fetching...`);
  }

  // Generate timestamps for this timeframe
  const timestamps = generateTimestamps(timeframe);

  // STEP 1: Fetch all chain data in PARALLEL (rate limiter handles throttling)
  // All 5 chains at once - much faster than sequential batches
  const chainBalances = new Map<SupportedChainId, Map<number, TokenBalance[]>>();

  const chainResults = await Promise.allSettled(
    chains.map((chainId) => getBulkHistoricalBalances(walletAddress, chainId, timestamps))
  );

  chains.forEach((chainId, index) => {
    const result = chainResults[index];
    if (result.status === "fulfilled") {
      chainBalances.set(chainId, result.value);
    } else {
      console.warn(`[Historical] Chain ${chainId} fetch failed:`, result.reason);
      chainBalances.set(chainId, new Map());
    }
  });

  // STEP 2: Process timestamps in PARALLEL for speed
  const PRICE_CONCURRENCY = 5;
  const dataPoints: HistoricalDataPoint[] = new Array(timestamps.length);
  const tokenPriceHistory: Record<string, number[]> = {};
  const chainsWithData = new Set<SupportedChainId>();

  // Prepare all timestamp data upfront
  const timestampData = timestamps.map((timestamp, index) => {
    const allBalances: TokenBalance[] = [];
    for (const chainId of chains) {
      const chainData = chainBalances.get(chainId);
      const balances = chainData?.get(timestamp.getTime()) ?? [];
      if (balances.length > 0) {
        chainsWithData.add(chainId);
      }
      allBalances.push(...balances);
    }
    return { timestamp, index, allBalances };
  });

  // Process in parallel batches
  for (let i = 0; i < timestampData.length; i += PRICE_CONCURRENCY) {
    const batch = timestampData.slice(i, i + PRICE_CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async ({ timestamp, index, allBalances }) => {
        let totalUsd = 0;
        const prices = new Map<string, number>();

        if (allBalances.length > 0) {
          const tokenRequests = allBalances.map((b) => ({
            chainId: b.chainId,
            tokenAddress: b.tokenAddress,
          }));
          const fetchedPrices = await getHistoricalPrices(tokenRequests, timestamp);
          totalUsd = calculateTotalValue(allBalances, fetchedPrices);

          for (const [key, price] of fetchedPrices.entries()) {
            prices.set(key, price);
          }
        }

        return { timestamp, index, totalUsd, prices };
      })
    );

    // Store results in correct order
    for (const { timestamp, index, totalUsd, prices } of batchResults) {
      dataPoints[index] = { timestamp, totalUsd };

      for (const [tokenKey, price] of prices.entries()) {
        if (!tokenPriceHistory[tokenKey]) {
          tokenPriceHistory[tokenKey] = [];
        }
        while (tokenPriceHistory[tokenKey].length < index) {
          tokenPriceHistory[tokenKey].push(0);
        }
        tokenPriceHistory[tokenKey][index] = price;
      }
    }
  }

  // Mark processing stage
  if (requestId) {
    await updateProgress(requestId, {
      status: "processing",
      stage: getStageMessage("processing"),
      currentStep: timestamps.length + 1,
    });
  }

  // Apply interpolation to fill any $0 gaps
  const interpolatedData = applyInterpolation(dataPoints, options?.currentValue);

  // Calculate summary statistics
  const startValue = interpolatedData[0]?.totalUsd ?? 0;
  const endValue = interpolatedData[interpolatedData.length - 1]?.totalUsd ?? 0;
  const change = endValue - startValue;
  const changePercent = calculatePercentChange(startValue, endValue);

  const result: HistoricalPortfolioResult = {
    walletAddress,
    timeframe,
    dataPoints: interpolatedData,
    startValue,
    endValue,
    change,
    changePercent,
    fetchedAt: new Date(),
    cacheHit: false,
    chainsWithData: Array.from(chainsWithData),
    tokenPriceHistory,
  };

  // Log summary for debugging
  console.log(`[Historical] ${walletAddress.slice(0, 10)}... ${timeframe}: ` +
    `${interpolatedData.length} points, start: $${startValue.toFixed(2)}, end: $${endValue.toFixed(2)}, chains: ${Array.from(chainsWithData).join(", ") || "none"}`
  );

  // Cache the result with timeframe-specific TTL
  const cacheTtl = getCacheTtl(timeframe);
  await setInCache(cacheKey, result, cacheTtl);

  // Mark complete
  if (requestId) {
    await updateProgress(requestId, {
      status: "complete",
      stage: "Done!",
      currentStep: timestamps.length * 2,
    });
  }

  return { ...result, requestId };
}

/**
 * Calculates total USD value from balances and prices
 */
function calculateTotalValue(
  balances: TokenBalance[],
  prices: Map<string, number>
): number {
  let total = 0;

  for (const balance of balances) {
    const priceKey = `${balance.chainId}:${balance.tokenAddress.toLowerCase()}`;
    const price = prices.get(priceKey);

    if (price !== undefined) {
      total += balance.balance * price;
    }
    // If price is missing, we count it as 0 (underestimate rather than fail)
  }

  return total;
}

// Re-export types and utilities for convenience
export type {
  HistoricalTimeframe,
  HistoricalDataPoint,
  HistoricalPortfolioResult,
} from "./types";

export { getProgress } from "./progress";
export type { FetchProgress } from "./progress";
