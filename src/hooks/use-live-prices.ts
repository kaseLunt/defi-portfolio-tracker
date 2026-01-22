"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SSEEvent, PriceUpdateEvent } from "@/server/lib/events";

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
 * Tracks recently updated tokens for visual feedback
 */
export function useLivePrices(): UseLivePricesResult {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Don't reconnect if already connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    try {
      const eventSource = new EventSource("/api/events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log("[SSE] Connected to price updates");
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect after delay
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 5000);
        }
      };

      // Handle price update events
      eventSource.addEventListener("price:update", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as PriceUpdateEvent["data"];
          const updatedTokens = new Set<string>();

          setPrices((prev) => {
            const next = { ...prev };
            for (const [tokenId, priceInfo] of Object.entries(data.prices)) {
              // Check if price actually changed
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

          // Track recently updated tokens for animation
          if (updatedTokens.size > 0) {
            setRecentlyUpdated((prev) => new Set([...prev, ...updatedTokens]));
            // Clear after animation duration
            setTimeout(() => {
              setRecentlyUpdated((prev) => {
                const next = new Set(prev);
                updatedTokens.forEach((t) => next.delete(t));
                return next;
              });
            }, 2000);
          }
        } catch (error) {
          console.error("[SSE] Failed to parse price update:", error);
        }
      });

      // Handle connection event
      eventSource.addEventListener("connected", (event: MessageEvent) => {
        console.log("[SSE] Connection confirmed:", JSON.parse(event.data));
      });
    } catch (error) {
      console.error("[SSE] Failed to create EventSource:", error);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

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
