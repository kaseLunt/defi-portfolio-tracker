"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { STALE_TIMES } from "@/lib/constants";
import type { HistoricalTimeframe } from "@/server/services/historical/types";

export interface FetchProgressState {
  status: "idle" | "pending" | "fetching_balances" | "fetching_prices" | "processing" | "complete" | "error";
  stage: string;
  percent: number;
  processedTimestamps: number;
  totalTimestamps: number;
}

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
    processedTimestamps: 0,
    totalTimestamps: 0,
  });

  const { data, isLoading, error, refetch, isFetching } =
    trpc.history.getPortfolioHistory.useQuery(
      {
        walletAddress: walletAddress!,
        timeframe,
        chains: options?.chains,
        requestId: requestId!, // Pass client-generated requestId
        currentValue: options?.currentValue, // Pass live portfolio value for accurate final data point
      },
      {
        enabled: !!walletAddress && options?.enabled !== false,
        staleTime: STALE_TIMES.HISTORY,
        refetchOnWindowFocus: false,
      }
    );

  // Poll for progress while loading (using client-generated requestId)
  const { data: progressData } = trpc.history.getProgress.useQuery(
    { requestId: requestId! },
    {
      enabled: !!requestId && isLoading && !data,
      refetchInterval: 500, // Poll every 500ms
      refetchIntervalInBackground: false,
    }
  );

  // Update progress state from polled data
  useEffect(() => {
    if (progressData) {
      const percent = progressData.totalSteps > 0
        ? Math.round((progressData.currentStep / progressData.totalSteps) * 100)
        : 0;

      setProgress({
        status: progressData.status as FetchProgressState["status"],
        stage: progressData.stage,
        percent,
        processedTimestamps: progressData.processedTimestamps,
        totalTimestamps: progressData.totalTimestamps,
      });
    } else if (isLoading && !data) {
      setProgress({
        status: "pending",
        stage: "Fetching portfolio history...",
        percent: 5,
        processedTimestamps: 0,
        totalTimestamps: 0,
      });
    } else if (data) {
      setProgress({
        status: "complete",
        stage: data.cacheHit ? "Loaded from cache" : "Done!",
        percent: 100,
        processedTimestamps: data.dataPoints.length,
        totalTimestamps: data.dataPoints.length,
      });
    }
  }, [progressData, isLoading, data]);

  // Reset progress when wallet or timeframe changes
  useEffect(() => {
    setProgress({
      status: "idle",
      stage: "",
      percent: 0,
      processedTimestamps: 0,
      totalTimestamps: 0,
    });
  }, [walletAddress, timeframe]);

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
  };
}
