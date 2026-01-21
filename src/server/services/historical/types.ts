import type { SupportedChainId } from "@/lib/constants";

export type HistoricalTimeframe = "7d" | "30d" | "90d" | "1y";

export interface HistoricalDataPoint {
  timestamp: Date;
  totalUsd: number;
}

export interface HistoricalPortfolioResult {
  walletAddress: string;
  timeframe: HistoricalTimeframe;
  dataPoints: HistoricalDataPoint[];
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
  fetchedAt: Date;
  cacheHit: boolean;
  chainsWithData?: SupportedChainId[]; // Chains that actually had historical data
}

export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  balance: number;
  balanceRaw: string;
  chainId: SupportedChainId;
}

export interface CovalentHistoricalResponse {
  data: {
    items: Array<{
      contract_decimals: number;
      contract_name: string;
      contract_ticker_symbol: string;
      contract_address: string;
      holdings: Array<{
        timestamp: string;
        close: {
          balance: string;
          quote: number;
        };
      }>;
    }>;
  };
}

export interface DefiLlamaPriceResponse {
  coins: Record<string, {
    price: number;
    symbol: string;
    timestamp: number;
    confidence: number;
  }>;
}
