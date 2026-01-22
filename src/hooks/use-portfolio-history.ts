"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { STALE_TIMES } from "@/lib/constants";
import type { HistoricalTimeframe } from "@/server/services/historical/types";

// Order of timeframes to preload after 7d
const PRELOAD_ORDER: HistoricalTimeframe[] = ["30d", "90d", "1y"];

export interface FetchProgressState {
  status: "idle" | "pending" | "fetching_balances" | "fetching_prices" | "processing" | "complete" | "error";
  stage: string;
  percent: number;
  processedChains: number;
  totalChains: number;
  processedTimestamps: number;
  totalTimestamps: number;
}

// Simulated progress stages with expected durations
const PROGRESS_STAGES = [
  { status: "fetching_balances", stage: "Scanning Ethereum...", percent: 5, durationMs: 2000 },
  { status: "fetching_balances", stage: "Scanning Arbitrum...", percent: 10, durationMs: 2000 },
  { status: "fetching_balances", stage: "Scanning Optimism...", percent: 15, durationMs: 1500 },
  { status: "fetching_balances", stage: "Scanning Base...", percent: 20, durationMs: 1500 },
  { status: "fetching_balances", stage: "Scanning Polygon...", percent: 25, durationMs: 1500 },
  { status: "fetching_prices", stage: "Fetching historical prices...", percent: 35, durationMs: 3000 },
  { status: "fetching_prices", stage: "Looking up token values...", percent: 50, durationMs: 3000 },
  { status: "fetching_prices", stage: "Processing data points...", percent: 65, durationMs: 3000 },
  { status: "fetching_prices", stage: "Building chart data...", percent: 80, durationMs: 2000 },
  { status: "processing", stage: "Finalizing...", percent: 92, durationMs: 2000 },
] as const;

// Generate a deterministic request ID that can be known before the request starts
function generateClientRequestId(walletAddress: string, timeframe: string): string {
  return `${walletAddress.toLowerCase()}:${timeframe}`;
}

/**
 * Hook to fetch historical portfolio data for any wallet address
 * Works instantly without requiring prior wallet connection or data accumulation
 * Includes progress tracking for long-running fetches
 */
export function usePortfolioHistory(
  walletAddress: string | undefined,
  timeframe: HistoricalTimeframe = "7d",
  options?: {
    chains?: number[];
    enabled?: boolean;
    currentValue?: number; // Live portfolio value to anchor the final data point
  }
) {
  // Generate requestId client-side so we can poll BEFORE data returns
  const requestId = useMemo(() => {
    if (!walletAddress) return null;
    return generateClientRequestId(walletAddress, timeframe);
  }, [walletAddress, timeframe]);

  const [progress, setProgress] = useState<FetchProgressState>({
    status: "idle",
    stage: "",
    percent: 0,
    processedChains: 0,
    totalChains: 5,
    processedTimestamps: 0,
    totalTimestamps: 0,
  });

  // Track when fetching started for simulated progress
  const fetchStartTime = useRef<number | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, error, refetch, isFetching } =
    trpc.history.getPortfolioHistory.useQuery(
      {
        walletAddress: walletAddress!,
        timeframe,
        chains: options?.chains,
        requestId: requestId!,
        currentValue: options?.currentValue,
      },
      {
        enabled: !!walletAddress && options?.enabled !== false,
        staleTime: STALE_TIMES.HISTORY,
        refetchOnWindowFocus: false,
      }
    );

  // Simulated progress based on elapsed time
  // This provides smooth, predictable feedback while the actual fetch happens
  const updateSimulatedProgress = useCallback(() => {
    if (!fetchStartTime.current) return;

    const elapsed = Date.now() - fetchStartTime.current;
    let cumulativeTime = 0;

    // Find current stage based on elapsed time
    for (let i = 0; i < PROGRESS_STAGES.length; i++) {
      cumulativeTime += PROGRESS_STAGES[i].durationMs;
      if (elapsed < cumulativeTime) {
        const stage = PROGRESS_STAGES[i];
        const stageElapsed = elapsed - (cumulativeTime - stage.durationMs);
        const stageProgress = stageElapsed / stage.durationMs;

        // Interpolate percent within this stage
        const prevPercent = i > 0 ? PROGRESS_STAGES[i - 1].percent : 0;
        const percentRange = stage.percent - prevPercent;
        const interpolatedPercent = prevPercent + Math.round(percentRange * stageProgress);

        setProgress({
          status: stage.status as FetchProgressState["status"],
          stage: stage.stage,
          percent: Math.min(interpolatedPercent, 95), // Cap at 95% until complete
          processedChains: stage.status === "fetching_balances" ? Math.min(i + 1, 5) : 5,
          totalChains: 5,
          processedTimestamps: stage.status === "fetching_prices" ? Math.round((i - 4) * 3) : 0,
          totalTimestamps: 14,
        });
        return;
      }
    }

    // If we've exceeded all stages, show 95% "almost done"
    setProgress({
      status: "processing",
      stage: "Almost done...",
      percent: 95,
      processedChains: 5,
      totalChains: 5,
      processedTimestamps: 14,
      totalTimestamps: 14,
    });
  }, []);

  // Start/stop simulated progress when fetching state changes
  useEffect(() => {
    if (isFetching && !data?.dataPoints?.length) {
      // Start simulated progress
      fetchStartTime.current = Date.now();
      updateSimulatedProgress();

      // Update every 200ms for smooth progress
      progressInterval.current = setInterval(updateSimulatedProgress, 200);
    } else {
      // Stop simulation
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      fetchStartTime.current = null;

      // Set final state
      if (data) {
        setProgress({
          status: "complete",
          stage: data.cacheHit ? "Loaded from cache" : "Done!",
          percent: 100,
          processedChains: 5,
          totalChains: 5,
          processedTimestamps: data.dataPoints.length,
          totalTimestamps: data.dataPoints.length,
        });
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isFetching, data, updateSimulatedProgress]);

  // Reset progress when wallet or timeframe changes
  useEffect(() => {
    setProgress({
      status: "idle",
      stage: "",
      percent: 0,
      processedChains: 0,
      totalChains: 5,
      processedTimestamps: 0,
      totalTimestamps: 0,
    });
  }, [walletAddress, timeframe]);

  // Preload other timeframes after initial load completes (7d -> 30d -> 90d -> 1y)
  const utils = trpc.useUtils();
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only preload after 7d successfully loads
    if (!data || !walletAddress || timeframe !== "7d" || isLoading) return;

    // Generate a key to track what we've preloaded for this wallet
    const walletKey = walletAddress.toLowerCase();

    // Don't preload if we already did for this wallet
    if (preloadedRef.current.has(walletKey)) return;
    preloadedRef.current.add(walletKey);

    // Stagger preloading to avoid overwhelming the API
    const preloadTimeframe = (tf: HistoricalTimeframe, delayMs: number) => {
      setTimeout(() => {
        const preloadRequestId = `${walletAddress.toLowerCase()}:${tf}`;
        utils.history.getPortfolioHistory.prefetch({
          walletAddress,
          timeframe: tf,
          requestId: preloadRequestId,
          currentValue: options?.currentValue,
        }).catch(() => {
          // Silently ignore prefetch errors
        });
      }, delayMs);
    };

    // Preload 30d after 2s, 90d after 5s, 1y after 8s
    preloadTimeframe("30d", 2000);
    preloadTimeframe("90d", 5000);
    preloadTimeframe("1y", 8000);

    console.log(`[History] Starting background preload for ${walletAddress.slice(0, 10)}...`);
  }, [data, walletAddress, timeframe, isLoading, utils, options?.currentValue]);

  return {
    history: data,
    isLoading,
    isFetching,
    error,
    refetch,
    progress,
    // Derived data
    dataPoints: data?.dataPoints.map((dp) => ({
      ...dp,
      timestamp: new Date(dp.timestamp),
    })) ?? [],
    startValue: data?.startValue ?? 0,
    endValue: data?.endValue ?? 0,
    change: data?.change ?? 0,
    changePercent: data?.changePercent ?? 0,
    cacheHit: data?.cacheHit ?? false,
    // Per-token price history for sparklines
    // Key format: "chainId:tokenAddress" (lowercase)
    tokenPriceHistory: data?.tokenPriceHistory ?? {},
  };
}
