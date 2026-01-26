/**
 * TypeScript interfaces for Pyth Network price data
 */

export interface PythPriceFeed {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

export interface PythWebSocketMessage {
  type: "price_update" | "heartbeat" | "subscribed" | "error";
  price_feed?: PythPriceFeed;
  error?: string;
}

export interface PythPriceUpdate {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

export interface PriceState {
  priceUsd: number;
  confidence: number;
  change24h: number | null;
  source: "pyth" | "coingecko";
  updatedAt: number;
}

export interface PythWebSocketConfig {
  url: string;
  feedIds: string[];
  onPriceUpdate: (update: PythPriceUpdate) => void;
  onError: (error: Error) => void;
  onReconnect: () => void;
}
