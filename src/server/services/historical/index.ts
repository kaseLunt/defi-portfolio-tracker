import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getFromCache, setInCache } from "@/server/lib/redis";
import { getBulkHistoricalBalances } from "./covalent";
import { getHistoricalPrices } from "./defillama";
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
  TokenBalance,
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
  const maxReasonableValue = Math.max(...nonZeroValues);

  // A value is considered "anomalous" if it's less than 30% of the median
  // This catches cases where only some tokens have prices (partial data)
  const anomalyThreshold = medianValue * 0.3;

  // Forward pass: replace anomalous values with previous good value
  let lastGoodValue = 0;
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
  }

  console.log(`[Historical] Interpolation: median=$${medianValue.toFixed(2)}, threshold=$${anomalyThreshold.toFixed(2)}, max=$${maxReasonableValue.toFixed(2)}`);

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
        requestId,
      };
    }
    console.log(`[Historical] Cache MISS for ${walletAddress.slice(0, 10)}... ${timeframe}, fetching...`);
  }

  // Generate timestamps for this timeframe
  const timestamps = generateTimestamps(timeframe);

  // Initialize progress tracking if requestId provided
  if (requestId) {
    await initProgress(requestId, walletAddress, timeframe, timestamps.length);
  }

  // STEP 1: Fetch all GoldRush data upfront (1 API call per chain = 5 total)
  if (requestId) {
    await updateProgress(requestId, {
      status: "fetching_balances",
      stage: `Fetching portfolio history from ${chains.length} chains...`,
      currentStep: 0,
    });
  }

  // Fetch bulk data for all chains in parallel
  const chainDataPromises = chains.map((chainId) =>
    getBulkHistoricalBalances(walletAddress, chainId, timestamps)
  );
  const chainDataResults = await Promise.allSettled(chainDataPromises);

  // Build a map of chainId -> timestamp -> balances
  const chainBalances = new Map<SupportedChainId, Map<number, TokenBalance[]>>();
  chains.forEach((chainId, index) => {
    const result = chainDataResults[index];
    if (result.status === "fulfilled") {
      chainBalances.set(chainId, result.value);
    } else {
      chainBalances.set(chainId, new Map());
    }
  });

  if (requestId) {
    await updateProgress(requestId, {
      status: "fetching_prices",
      stage: "Fetching historical prices...",
      currentStep: 1,
    });
  }

  // STEP 2: Process each timestamp using the cached data
  const dataPoints: HistoricalDataPoint[] = [];
  let processedCount = 0;
  const chainsWithData = new Set<SupportedChainId>();

  for (const timestamp of timestamps) {
    // Gather balances from all chains for this timestamp
    const allBalances: TokenBalance[] = [];
    for (const chainId of chains) {
      const chainData = chainBalances.get(chainId);
      const balances = chainData?.get(timestamp.getTime()) ?? [];
      if (balances.length > 0) {
        chainsWithData.add(chainId);
      }
      allBalances.push(...balances);
    }

    // Fetch prices and calculate value
    let totalUsd = 0;
    if (allBalances.length > 0) {
      const tokenRequests = allBalances.map((b) => ({
        chainId: b.chainId,
        tokenAddress: b.tokenAddress,
      }));
      const prices = await getHistoricalPrices(tokenRequests, timestamp);
      totalUsd = calculateTotalValue(allBalances, prices);
    }

    // Store raw value - interpolation will be applied after all data is collected
    dataPoints.push({ timestamp, totalUsd });
    processedCount++;

    // Update progress
    if (requestId) {
      await updateProgress(requestId, {
        status: "fetching_prices",
        stage: `Processing data (${processedCount}/${timestamps.length})...`,
        processedTimestamps: processedCount,
        currentStep: processedCount + 1,
      });
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
