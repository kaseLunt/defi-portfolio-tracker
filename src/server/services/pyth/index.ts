/**
 * Pyth Network Price Service
 *
 * Provides real-time price streaming via Pyth Network's Hermes WebSocket.
 * Falls back to CoinGecko polling if Pyth is unavailable.
 */

import { PythWebSocketClient } from "./websocket-client";
import {
  getUniqueFeedIds,
  PYTH_ID_TO_SYMBOL,
  COINGECKO_TO_SYMBOL,
} from "./feed-ids";
import { broadcastPriceUpdate } from "@/server/lib/events";
import { getPrices as getCoinGeckoPrices, COINGECKO_IDS } from "../price";
import type { PriceState, PythPriceUpdate } from "./types";

const HERMES_WS_URL = "wss://hermes.pyth.network/ws";

// Throttle settings
const BROADCAST_THROTTLE_MS = 500;
const FALLBACK_POLL_INTERVAL_MS = 30000;

class PythPriceService {
  private client: PythWebSocketClient | null = null;
  private prices: Map<string, PriceState> = new Map();
  private isInitialized = false;
  private fallbackIntervalId: NodeJS.Timeout | null = null;

  // Throttle broadcasts to prevent flooding clients
  private lastBroadcast = 0;
  private pendingUpdates: Map<string, PriceState> = new Map();
  private broadcastTimeout: NodeJS.Timeout | null = null;

  // 24h price change cache (fetched from CoinGecko since Pyth doesn't provide)
  private priceChanges: Map<string, number> = new Map();
  private lastChangesFetch = 0;
  private changesFetchInterval = 60000; // Fetch 24h changes every minute

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const feedIds = getUniqueFeedIds();

    if (feedIds.length === 0) {
      console.warn("[PythPriceService] No valid feed IDs configured");
      this.activateFallbackMode();
      return;
    }

    console.log(
      `[PythPriceService] Initializing with ${feedIds.length} price feeds`
    );

    this.client = new PythWebSocketClient({
      url: HERMES_WS_URL,
      feedIds,
      onPriceUpdate: (update) => this.handlePriceUpdate(update),
      onError: (error) => this.handleError(error),
      onReconnect: () => this.handleReconnect(),
    });

    // Listen for max reconnects to activate fallback
    this.client.on("max_reconnects_reached", () => {
      console.log("[PythPriceService] Activating fallback after max reconnects");
      this.activateFallbackMode();
    });

    try {
      await this.client.connect();
      this.isInitialized = true;

      // Start fetching 24h changes in background
      this.fetch24hChanges();

      console.log("[PythPriceService] Initialized with WebSocket streaming");
    } catch (error) {
      console.error(
        "[PythPriceService] Failed to initialize WebSocket:",
        error
      );
      this.activateFallbackMode();
    }
  }

  private handlePriceUpdate(update: PythPriceUpdate): void {
    // Normalize ID - Pyth sometimes sends with or without 0x prefix
    let pythId = update.id.toLowerCase();
    if (!pythId.startsWith("0x")) {
      pythId = "0x" + pythId;
    }

    const symbol = PYTH_ID_TO_SYMBOL[pythId];

    if (!symbol) {
      // Unknown price feed, skip
      return;
    }


    // Parse Pyth price format (scaled integer with exponent)
    // Price is stored as: actual_price = price * 10^expo
    const rawPrice = parseInt(update.price.price);
    const expo = update.price.expo;
    const priceUsd = rawPrice * Math.pow(10, expo);

    // Confidence interval
    const rawConf = parseInt(update.price.conf);
    const confidence = rawConf * Math.pow(10, expo);

    // Get cached 24h change
    const change24h = this.priceChanges.get(symbol) ?? null;

    const priceState: PriceState = {
      priceUsd,
      confidence,
      change24h,
      source: "pyth",
      updatedAt: Date.now(),
    };

    this.prices.set(symbol, priceState);
    this.pendingUpdates.set(symbol, priceState);

    this.scheduleBroadcast();
  }

  private scheduleBroadcast(): void {
    if (this.broadcastTimeout) return;

    const timeSinceLastBroadcast = Date.now() - this.lastBroadcast;
    const delay = Math.max(0, BROADCAST_THROTTLE_MS - timeSinceLastBroadcast);

    this.broadcastTimeout = setTimeout(() => {
      this.doBroadcast();
    }, delay);
  }

  private async doBroadcast(): Promise<void> {
    this.broadcastTimeout = null;

    if (this.pendingUpdates.size === 0) return;

    const updates: Record<string, { usd: number; change24h: number | null }> =
      {};

    for (const [symbol, state] of this.pendingUpdates) {
      // Map symbol to CoinGecko ID for client compatibility
      const coingeckoId = COINGECKO_IDS[symbol] || COINGECKO_IDS[symbol.toUpperCase()];

      if (coingeckoId) {
        updates[coingeckoId] = {
          usd: state.priceUsd,
          change24h: state.change24h,
        };
      }
    }

    this.pendingUpdates.clear();
    this.lastBroadcast = Date.now();

    if (Object.keys(updates).length > 0) {
      try {
        await broadcastPriceUpdate(updates);
      } catch (error) {
        console.error("[PythPriceService] Broadcast failed:", error);
      }
    }
  }

  private async fetch24hChanges(): Promise<void> {
    // Only fetch if enough time has passed
    if (Date.now() - this.lastChangesFetch < this.changesFetchInterval) {
      return;
    }

    this.lastChangesFetch = Date.now();

    try {
      const coingeckoIds = Object.values(COINGECKO_IDS).filter(Boolean);
      const prices = await getCoinGeckoPrices(coingeckoIds);

      for (const [coingeckoId, priceData] of prices) {
        // Find symbol for this CoinGecko ID
        const symbol = COINGECKO_TO_SYMBOL[coingeckoId];
        if (symbol && priceData.change24hPct !== null) {
          this.priceChanges.set(symbol, priceData.change24hPct);
        }
      }
    } catch (error) {
      console.error("[PythPriceService] Failed to fetch 24h changes:", error);
    }

    // Schedule next fetch
    setTimeout(() => this.fetch24hChanges(), this.changesFetchInterval);
  }

  private handleError(error: Error): void {
    console.error("[PythPriceService] WebSocket error:", error.message);
  }

  private handleReconnect(): void {
    console.log("[PythPriceService] Attempting to reconnect...");
  }

  private activateFallbackMode(): void {
    if (this.fallbackIntervalId) {
      return; // Already in fallback mode
    }

    console.log("[PythPriceService] Activating CoinGecko fallback mode");

    // Poll CoinGecko at regular intervals as fallback
    this.fallbackIntervalId = setInterval(() => {
      this.fetchFromCoinGecko();
    }, FALLBACK_POLL_INTERVAL_MS);

    // Fetch immediately
    this.fetchFromCoinGecko();
  }

  private async fetchFromCoinGecko(): Promise<void> {
    try {
      const coingeckoIds = Object.values(COINGECKO_IDS).filter(Boolean);
      const prices = await getCoinGeckoPrices(coingeckoIds);

      const updates: Record<string, { usd: number; change24h: number | null }> =
        {};

      for (const [coingeckoId, priceData] of prices) {
        updates[coingeckoId] = {
          usd: priceData.priceUsd,
          change24h: priceData.change24hPct,
        };

        // Update internal state
        const symbol = COINGECKO_TO_SYMBOL[coingeckoId];
        if (symbol) {
          this.prices.set(symbol, {
            priceUsd: priceData.priceUsd,
            confidence: 0,
            change24h: priceData.change24hPct,
            source: "coingecko",
            updatedAt: Date.now(),
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        await broadcastPriceUpdate(updates);
      }
    } catch (error) {
      console.error("[PythPriceService] CoinGecko fallback failed:", error);
    }
  }

  // Public API

  getPrice(symbol: string): PriceState | null {
    return this.prices.get(symbol.toUpperCase()) ?? null;
  }

  getAllPrices(): Map<string, PriceState> {
    return new Map(this.prices);
  }

  isUsingPyth(): boolean {
    return this.client?.isConnected() ?? false;
  }

  isInFallbackMode(): boolean {
    return this.fallbackIntervalId !== null;
  }

  getStatus(): {
    connected: boolean;
    source: "pyth" | "coingecko" | "disconnected";
    priceCount: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.client?.isConnected() ?? false,
      source: this.client?.isConnected()
        ? "pyth"
        : this.fallbackIntervalId
          ? "coingecko"
          : "disconnected",
      priceCount: this.prices.size,
      reconnectAttempts: this.client?.getReconnectAttempts() ?? 0,
    };
  }

  async shutdown(): Promise<void> {
    console.log("[PythPriceService] Shutting down...");

    if (this.fallbackIntervalId) {
      clearInterval(this.fallbackIntervalId);
      this.fallbackIntervalId = null;
    }

    if (this.broadcastTimeout) {
      clearTimeout(this.broadcastTimeout);
      this.broadcastTimeout = null;
    }

    this.client?.disconnect();
    this.client = null;
    this.isInitialized = false;

    console.log("[PythPriceService] Shutdown complete");
  }
}

// Singleton instance
let pythPriceService: PythPriceService | null = null;

export function getPythPriceService(): PythPriceService {
  if (!pythPriceService) {
    pythPriceService = new PythPriceService();
  }
  return pythPriceService;
}

export async function initializePythPrices(): Promise<void> {
  const service = getPythPriceService();
  await service.initialize();
}

export async function shutdownPythPrices(): Promise<void> {
  if (pythPriceService) {
    await pythPriceService.shutdown();
    pythPriceService = null;
  }
}

export { PythPriceService };
