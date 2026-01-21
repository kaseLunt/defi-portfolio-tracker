// Supported chains
export const SUPPORTED_CHAINS = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  BASE: 8453,
  POLYGON: 137,
} as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[keyof typeof SUPPORTED_CHAINS];

// Chain metadata
export const CHAIN_INFO: Record<SupportedChainId, {
  name: string;
  shortName: string;
  nativeCurrency: string;
  explorerUrl: string;
  color: string;
}> = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    name: "Ethereum",
    shortName: "ETH",
    nativeCurrency: "ETH",
    explorerUrl: "https://etherscan.io",
    color: "#627EEA",
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    name: "Arbitrum",
    shortName: "ARB",
    nativeCurrency: "ETH",
    explorerUrl: "https://arbiscan.io",
    color: "#28A0F0",
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    name: "Optimism",
    shortName: "OP",
    nativeCurrency: "ETH",
    explorerUrl: "https://optimistic.etherscan.io",
    color: "#FF0420",
  },
  [SUPPORTED_CHAINS.BASE]: {
    name: "Base",
    shortName: "BASE",
    nativeCurrency: "ETH",
    explorerUrl: "https://basescan.org",
    color: "#0052FF",
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    name: "Polygon",
    shortName: "MATIC",
    nativeCurrency: "MATIC",
    explorerUrl: "https://polygonscan.com",
    color: "#8247E5",
  },
};

// Protocol slugs
export const PROTOCOLS = {
  AAVE_V3: "aave-v3",
  LIDO: "lido",
  COMPOUND_V3: "compound-v3",
  UNISWAP_V3: "uniswap-v3",
  ETHERFI: "etherfi",
} as const;

// Time constants
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// Refresh intervals
export const REFRESH_INTERVALS = {
  PRICES: 30 * 1000, // 30 seconds
  POSITIONS: 5 * MINUTE,
  YIELDS: 15 * MINUTE,
} as const;

// Stale times for React Query
export const STALE_TIMES = {
  PRICES: 30 * 1000,
  POSITIONS: 2 * MINUTE,
  YIELDS: 10 * MINUTE,
  PROTOCOLS: 1 * HOUR,
  HISTORY: 20 * MINUTE,
} as const;

// Historical portfolio timeframe configurations
export const TIMEFRAME_CONFIGS = {
  "7d": { days: 7, dataPoints: 28, intervalHours: 6, cacheTtl: 3600 },
  "30d": { days: 30, dataPoints: 30, intervalHours: 24, cacheTtl: 86400 },
  "90d": { days: 90, dataPoints: 45, intervalHours: 48, cacheTtl: 86400 * 3 },
  "1y": { days: 365, dataPoints: 52, intervalHours: 168, cacheTtl: 86400 * 7 },
} as const;

export type TimeframeConfig = (typeof TIMEFRAME_CONFIGS)[keyof typeof TIMEFRAME_CONFIGS];

// Covalent API chain name mappings
export const COVALENT_CHAIN_NAMES: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "eth-mainnet",
  [SUPPORTED_CHAINS.ARBITRUM]: "arbitrum-mainnet",
  [SUPPORTED_CHAINS.OPTIMISM]: "optimism-mainnet",
  [SUPPORTED_CHAINS.BASE]: "base-mainnet",
  [SUPPORTED_CHAINS.POLYGON]: "matic-mainnet",
};

// DeFi Llama chain prefix mappings
export const DEFILLAMA_CHAIN_PREFIXES: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "ethereum",
  [SUPPORTED_CHAINS.ARBITRUM]: "arbitrum",
  [SUPPORTED_CHAINS.OPTIMISM]: "optimism",
  [SUPPORTED_CHAINS.BASE]: "base",
  [SUPPORTED_CHAINS.POLYGON]: "polygon",
};
