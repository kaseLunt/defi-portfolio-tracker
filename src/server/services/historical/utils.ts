import { TIMEFRAME_CONFIGS, type SupportedChainId } from "@/lib/constants";
import type { HistoricalTimeframe } from "./types";

/**
 * Generates timestamps for data points based on the timeframe configuration
 * Returns an array of timestamps from oldest to newest
 */
export function generateTimestamps(timeframe: HistoricalTimeframe): Date[] {
  const config = TIMEFRAME_CONFIGS[timeframe];
  const now = new Date();
  const timestamps: Date[] = [];
  const intervalMs = config.intervalHours * 60 * 60 * 1000;

  // Generate timestamps from oldest to newest
  for (let i = config.dataPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMs);
    timestamps.push(timestamp);
  }

  return timestamps;
}

/**
 * Generates a cache key for historical portfolio data
 * Format: history:{wallet}:{timeframe}:{chains|all}
 */
export function generateCacheKey(
  walletAddress: string,
  timeframe: HistoricalTimeframe,
  chains?: SupportedChainId[]
): string {
  const chainPart = chains?.length ? chains.sort().join(",") : "all";
  return `history:${walletAddress.toLowerCase()}:${timeframe}:${chainPart}`;
}

/**
 * Gets the cache TTL for a specific timeframe
 */
export function getCacheTtl(timeframe: HistoricalTimeframe): number {
  return TIMEFRAME_CONFIGS[timeframe].cacheTtl;
}

/**
 * Chunks an array into smaller arrays of a specified size
 * Used for batching concurrent requests
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Delays execution for a specified number of milliseconds
 * Used for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes promises with a concurrency limit
 * Useful for avoiding rate limits when making many API calls
 */
export async function promisePool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = fn(item).then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        if (
          await Promise.race([
            executing[i].then(() => true),
            Promise.resolve(false),
          ])
        ) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Calculates percentage change between two values
 */
export function calculatePercentChange(startValue: number, endValue: number): number {
  if (startValue === 0) {
    return endValue > 0 ? 100 : 0;
  }
  return ((endValue - startValue) / startValue) * 100;
}
