import { getFromCache, setInCache } from "@/server/lib/redis";
import type { HistoricalTimeframe } from "./types";

export interface FetchProgress {
  requestId: string;
  walletAddress: string;
  timeframe: HistoricalTimeframe;
  status: "pending" | "fetching_balances" | "fetching_prices" | "processing" | "complete" | "error";
  stage: string;
  currentStep: number;
  totalSteps: number;
  currentChain?: string;
  processedTimestamps: number;
  totalTimestamps: number;
  startedAt: Date;
  updatedAt: Date;
  error?: string;
}

const PROGRESS_TTL = 300; // 5 minutes

function getProgressKey(requestId: string): string {
  return `progress:${requestId}`;
}

export function generateRequestId(walletAddress: string, timeframe: HistoricalTimeframe): string {
  return `${walletAddress.toLowerCase()}:${timeframe}:${Date.now()}`;
}

export async function initProgress(
  requestId: string,
  walletAddress: string,
  timeframe: HistoricalTimeframe,
  totalTimestamps: number
): Promise<void> {
  const progress: FetchProgress = {
    requestId,
    walletAddress,
    timeframe,
    status: "pending",
    stage: "Initializing...",
    currentStep: 0,
    totalSteps: totalTimestamps * 2, // balances + prices for each timestamp
    processedTimestamps: 0,
    totalTimestamps,
    startedAt: new Date(),
    updatedAt: new Date(),
  };
  await setInCache(getProgressKey(requestId), progress, PROGRESS_TTL);
}

export async function updateProgress(
  requestId: string,
  update: Partial<Omit<FetchProgress, "requestId" | "walletAddress" | "timeframe" | "startedAt">>
): Promise<void> {
  const key = getProgressKey(requestId);
  const current = await getFromCache<FetchProgress>(key);
  if (!current) return;

  const updated: FetchProgress = {
    ...current,
    ...update,
    updatedAt: new Date(),
  };
  await setInCache(key, updated, PROGRESS_TTL);
}

export async function getProgress(requestId: string): Promise<FetchProgress | null> {
  return getFromCache<FetchProgress>(getProgressKey(requestId));
}

export async function clearProgress(requestId: string): Promise<void> {
  // Progress auto-expires after TTL, but we can mark it as complete
  await updateProgress(requestId, { status: "complete", stage: "Done" });
}

// Helper to create descriptive stage messages
export function getStageMessage(
  status: FetchProgress["status"],
  currentChain?: string,
  processedTimestamps?: number,
  totalTimestamps?: number
): string {
  switch (status) {
    case "pending":
      return "Preparing to fetch historical data...";
    case "fetching_balances":
      return currentChain
        ? `Fetching balances from ${currentChain}...`
        : "Fetching token balances...";
    case "fetching_prices":
      return `Getting historical prices (${processedTimestamps ?? 0}/${totalTimestamps ?? 0} timestamps)...`;
    case "processing":
      return "Calculating portfolio values...";
    case "complete":
      return "Done!";
    case "error":
      return "An error occurred";
    default:
      return "Loading...";
  }
}
