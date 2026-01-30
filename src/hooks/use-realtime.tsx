"use client";

import { useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subscribeToSSE, onSSEConnect, onSSEDisconnect, isSSEConnected, reconnectSSE } from "@/lib/sse-connection";

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
 * Uses singleton SSE connection to prevent connection exhaustion
 */
export function useRealtime() {
  const queryClient = useQueryClient();

  const [state, setState] = useState<RealtimeState>({
    isConnected: isSSEConnected(),
    lastPriceUpdate: null,
    connectionError: null,
  });

  // Handle price updates
  const handlePriceUpdate = useCallback((event: MessageEvent) => {
    const data: PriceUpdate = JSON.parse(event.data);
    setState((prev) => ({ ...prev, lastPriceUpdate: data }));
    queryClient.invalidateQueries({ queryKey: ["price"] });
  }, [queryClient]);

  // Handle notifications
  const handleNotification = useCallback((event: MessageEvent) => {
    const data: NotificationUpdate = JSON.parse(event.data);
    console.log("New notification:", data.title);
    queryClient.invalidateQueries({ queryKey: ["notification"] });
  }, [queryClient]);

  // Handle position updates
  const handlePositionUpdate = useCallback((event: MessageEvent) => {
    const data: PositionUpdate = JSON.parse(event.data);
    console.log("Position update:", data.positionId, data.changePercent);
    queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  }, [queryClient]);

  // Handle alert triggered
  const handleAlertTriggered = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    console.log("Alert triggered:", data.ruleName);
    queryClient.invalidateQueries({ queryKey: ["notification"] });
    queryClient.invalidateQueries({ queryKey: ["alertRules"] });
  }, [queryClient]);

  // Handle transaction detected
  const handleTransactionDetected = useCallback((event: MessageEvent) => {
    const data: TransactionDetectedUpdate = JSON.parse(event.data);
    console.log("Transaction detected:", data.direction, data.tokenSymbol);

    const symbol = data.tokenSymbol || "tokens";
    const amount = data.valueFormatted?.toFixed(4) || "some";
    const usdValue = data.valueUsd ? `($${data.valueUsd.toFixed(2)})` : "";

    if (data.direction === "in") {
      toast.success(`Received ${amount} ${symbol} ${usdValue}`, {
        description: "View transaction on explorer",
        action: {
          label: "View",
          onClick: () => {
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

    queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  }, [queryClient]);

  // Handle connection event
  const handleConnected = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    console.log("[useRealtime] SSE connected as:", data.userId);
  }, []);

  useEffect(() => {
    // Subscribe to all events using singleton connection
    const unsubscribers = [
      subscribeToSSE("connected", handleConnected),
      subscribeToSSE("price:update", handlePriceUpdate),
      subscribeToSSE("notification:new", handleNotification),
      subscribeToSSE("position:update", handlePositionUpdate),
      subscribeToSSE("alert:triggered", handleAlertTriggered),
      subscribeToSSE("transaction:detected", handleTransactionDetected),
    ];

    // Track connection state
    const unsubConnect = onSSEConnect(() => {
      setState((prev) => ({
        ...prev,
        isConnected: true,
        connectionError: null,
      }));
    });

    const unsubDisconnect = onSSEDisconnect(() => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        connectionError: "Connection lost",
      }));
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
      unsubConnect();
      unsubDisconnect();
    };
  }, [
    handleConnected,
    handlePriceUpdate,
    handleNotification,
    handlePositionUpdate,
    handleAlertTriggered,
    handleTransactionDetected,
  ]);

  // Reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !state.isConnected) {
        reconnectSSE();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.isConnected]);

  return {
    ...state,
    connect: reconnectSSE,
    disconnect: () => {}, // No-op, singleton manages lifecycle
  };
}

/**
 * Provider component to establish SSE connection at app level
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  return <>{children}</>;
}
