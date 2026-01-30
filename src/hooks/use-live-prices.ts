"use client";

import { useState, useEffect, useCallback } from "react";
import { subscribeToSSE, onSSEConnect, onSSEDisconnect } from "@/lib/sse-connection";
import type { PriceUpdateEvent } from "@/server/lib/events";

interface PriceData {
  usd: number;
  change24h: number | null;
  updatedAt: number;
}

interface UseLivePricesResult {
  prices: Record<string, PriceData>;
  isConnected: boolean;
  lastUpdate: number | null;
  recentlyUpdated: Set<string>;
}

/**
 * Hook to receive live price updates via Server-Sent Events
 * Uses singleton SSE connection to prevent connection exhaustion
 */
export function useLivePrices(): UseLivePricesResult {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());

  const handlePriceUpdate = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as PriceUpdateEvent["data"];
      const updatedTokens = new Set<string>();

      setPrices((prev) => {
        const next = { ...prev };
        for (const [tokenId, priceInfo] of Object.entries(data.prices)) {
          if (prev[tokenId]?.usd !== priceInfo.usd) {
            updatedTokens.add(tokenId);
          }
          next[tokenId] = {
            ...priceInfo,
            updatedAt: data.timestamp,
          };
        }
        return next;
      });

      setLastUpdate(data.timestamp);

      if (updatedTokens.size > 0) {
        setRecentlyUpdated((prev) => new Set([...prev, ...updatedTokens]));
        setTimeout(() => {
          setRecentlyUpdated((prev) => {
            const next = new Set(prev);
            updatedTokens.forEach((t) => next.delete(t));
            return next;
          });
        }, 2000);
      }
    } catch (error) {
      console.error("[useLivePrices] Failed to parse price update:", error);
    }
  }, []);

  useEffect(() => {
    // Subscribe to events using singleton connection
    const unsubscribePrice = subscribeToSSE("price:update", handlePriceUpdate);
    const unsubscribeConnected = subscribeToSSE("connected", (event) => {
      console.log("[useLivePrices] Connection confirmed:", JSON.parse(event.data));
    });

    // Track connection state
    const unsubscribeOnConnect = onSSEConnect(() => setIsConnected(true));
    const unsubscribeOnDisconnect = onSSEDisconnect(() => setIsConnected(false));

    return () => {
      unsubscribePrice();
      unsubscribeConnected();
      unsubscribeOnConnect();
      unsubscribeOnDisconnect();
    };
  }, [handlePriceUpdate]);

  return {
    prices,
    isConnected,
    lastUpdate,
    recentlyUpdated,
  };
}

/**
 * Get a normalized token ID for price lookup
 * Format: chainId:tokenAddress (lowercase)
 */
export function getTokenPriceId(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}
