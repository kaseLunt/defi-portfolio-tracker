/**
 * Pyth Network WebSocket client with reconnection logic
 */

import WebSocket from "ws";
import { EventEmitter } from "events";
import type { PythWebSocketConfig, PythPriceUpdate } from "./types";

export class PythWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: PythWebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(config: PythWebSocketConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        console.log("[Pyth WS] Connecting to Hermes...");
        this.ws = new WebSocket(this.config.url);

        this.ws.on("open", () => {
          console.log("[Pyth WS] Connected to Hermes");
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.subscribe();
          this.startPingInterval();
          this.emit("connected");
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on("error", (error) => {
          console.error("[Pyth WS] Error:", error.message);
          this.config.onError(error);
        });

        this.ws.on("close", (code, reason) => {
          console.log(
            `[Pyth WS] Connection closed: ${code} - ${reason.toString()}`
          );
          this.isConnecting = false;
          this.stopPingInterval();
          this.emit("disconnected");

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        });

        // Timeout for initial connection
        const timeout = setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        this.ws.on("open", () => clearTimeout(timeout));
        this.ws.on("error", () => clearTimeout(timeout));
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Pyth Hermes WebSocket subscription format
    const subscribeMessage = JSON.stringify({
      type: "subscribe",
      ids: this.config.feedIds,
      verbose: true,
      binary: false,
    });

    this.ws.send(subscribeMessage);
    console.log(
      `[Pyth WS] Subscribed to ${this.config.feedIds.length} price feeds`
    );
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      // Debug: log message structure and errors
      if (message.type === "response" && message.error) {
        console.error(`[Pyth WS] Error response:`, message.error);
      } else if (message.type === "response") {
        console.log(`[Pyth WS] Response: status=${message.status}`);
      }


      // Handle different message types
      if (message.type === "price_update" && message.price_feed) {
        // Single price update
        this.config.onPriceUpdate(message.price_feed as PythPriceUpdate);
      } else if (Array.isArray(message)) {
        // Batch of price updates
        for (const item of message) {
          if (item.price_feed) {
            this.config.onPriceUpdate(item.price_feed as PythPriceUpdate);
          } else if (item.id && item.price) {
            // Alternative format
            this.config.onPriceUpdate(item as PythPriceUpdate);
          }
        }
      } else if (message.id && message.price) {
        // Direct price feed format
        this.config.onPriceUpdate(message as PythPriceUpdate);
      } else if (message.type === "subscribed") {
        console.log("[Pyth WS] Subscription confirmed");
      } else if (message.type === "error") {
        console.error("[Pyth WS] Server error:", message.error);
      }
      // Ignore heartbeats and other messages
    } catch (error) {
      // Not all messages are JSON - some are binary/heartbeats
      // Only log if it seems like it should be parseable
      if (data.toString().startsWith("{") || data.toString().startsWith("[")) {
        console.error("[Pyth WS] Failed to parse message:", error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Pyth WS] Max reconnection attempts reached");
      this.emit("max_reconnects_reached");
      return;
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30s delay
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    this.reconnectAttempts++;
    console.log(
      `[Pyth WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.config.onReconnect();
        this.connect().catch((err) => {
          console.error("[Pyth WS] Reconnection failed:", err);
        });
      }
    }, delay);
  }

  private startPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPingInterval();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    console.log("[Pyth WS] Disconnected");
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
