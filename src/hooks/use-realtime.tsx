"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
