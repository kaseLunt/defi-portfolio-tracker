"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PriceUpdate {
  prices: Record<string, { usd: number; change24h: number | null }>;
  timestamp: number;
}

interface NotificationUpdate {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  createdAt: string;
}

interface PositionUpdate {
  userId: string;
  positionId: string;
  balanceUsd: number;
  changePercent: number;
}

interface TransactionDetectedUpdate {
  userId: string;
  walletAddress: string;
  direction: "in" | "out";
  chainId: number;
  tokenAddress: string;
  tokenSymbol?: string;
  value: string;
  valueFormatted?: number;
  valueUsd?: number;
  transactionHash: string;
  timestamp: number;
}

// Block explorer URLs by chain ID
const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  42161: "https://arbiscan.io",
  10: "https://optimistic.etherscan.io",
  8453: "https://basescan.org",
  137: "https://polygonscan.com",
};

function getExplorerUrl(chainId: number, txHash: string): string {
  const baseUrl = EXPLORER_URLS[chainId] || "https://etherscan.io";
  return `${baseUrl}/tx/${txHash}`;
}

interface RealtimeState {
  isConnected: boolean;
  lastPriceUpdate: PriceUpdate | null;
  connectionError: string | null;
}

/**
 * Hook for real-time updates via Server-Sent Events
 *
 * Features:
 * - Auto-reconnect on disconnect
 * - Invalidates React Query cache on updates
 * - Provides connection state
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    lastPriceUpdate: null,
    connectionError: null,
  });

  const connect = useCallback(() => {
    // Don't connect if already connected
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource("/api/events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("SSE connected");
        reconnectAttempts.current = 0;
        setState((prev) => ({
          ...prev,
          isConnected: true,
          connectionError: null,
        }));
      };

      eventSource.onerror = () => {
        console.error("SSE connection error");
        eventSource.close();
        setState((prev) => ({
          ...prev,
          isConnected: false,
          connectionError: "Connection lost",
        }));

        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting SSE (attempt ${reconnectAttempts.current})...`);
          connect();
        }, delay);
      };

      // Handle connection event
      eventSource.addEventListener("connected", (event) => {
        const data = JSON.parse(event.data);
        console.log("SSE connected as:", data.userId);
      });

      // Handle price updates
      eventSource.addEventListener("price:update", (event) => {
        const data: PriceUpdate = JSON.parse(event.data);
        setState((prev) => ({ ...prev, lastPriceUpdate: data }));

        // Invalidate price-related queries
        queryClient.invalidateQueries({ queryKey: ["price"] });
      });

      // Handle new notifications
      eventSource.addEventListener("notification:new", (event) => {
        const data: NotificationUpdate = JSON.parse(event.data);
        console.log("New notification:", data.title);

        // Invalidate notification queries to show new notification
        queryClient.invalidateQueries({ queryKey: ["notification"] });
      });

      // Handle position updates
      eventSource.addEventListener("position:update", (event) => {
        const data: PositionUpdate = JSON.parse(event.data);
        console.log("Position update:", data.positionId, data.changePercent);

        // Invalidate portfolio queries
        queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      });

      // Handle alert triggered
      eventSource.addEventListener("alert:triggered", (event) => {
        const data = JSON.parse(event.data);
        console.log("Alert triggered:", data.ruleName);

        // Invalidate alert and notification queries
        queryClient.invalidateQueries({ queryKey: ["notification"] });
        queryClient.invalidateQueries({ queryKey: ["alertRules"] });
      });

      // Handle real-time transaction detected
      eventSource.addEventListener("transaction:detected", (event) => {
        const data: TransactionDetectedUpdate = JSON.parse(event.data);
        console.log("Transaction detected:", data.direction, data.tokenSymbol);

        // Show toast notification
        const symbol = data.tokenSymbol || "tokens";
        const amount = data.valueFormatted?.toFixed(4) || "some";
        const usdValue = data.valueUsd ? `($${data.valueUsd.toFixed(2)})` : "";

        if (data.direction === "in") {
          toast.success(`Received ${amount} ${symbol} ${usdValue}`, {
            description: "View transaction on explorer",
            action: {
              label: "View",
              onClick: () => {
                // Open transaction in block explorer
                const explorerUrl = getExplorerUrl(data.chainId, data.transactionHash);
                window.open(explorerUrl, "_blank");
              },
            },
          });
        } else {
          toast.info(`Sent ${amount} ${symbol} ${usdValue}`, {
            description: "View transaction on explorer",
            action: {
              label: "View",
              onClick: () => {
                const explorerUrl = getExplorerUrl(data.chainId, data.transactionHash);
                window.open(explorerUrl, "_blank");
              },
            },
          });
        }

        // Invalidate portfolio queries to refresh balances
        queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      });
    } catch (error) {
      console.error("Failed to create EventSource:", error);
      setState((prev) => ({
        ...prev,
        isConnected: false,
        connectionError: "Failed to connect",
      }));
    }
  }, [queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !state.isConnected) {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connect, state.isConnected]);

  return {
    ...state,
    connect,
    disconnect,
  };
}

/**
 * Provider component to establish SSE connection at app level
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  return <>{children}</>;
}
