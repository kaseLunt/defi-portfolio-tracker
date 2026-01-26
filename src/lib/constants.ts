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
// Optimized for fast loading while maintaining chart smoothness
export const TIMEFRAME_CONFIGS = {
  "7d": { days: 7, dataPoints: 14, intervalHours: 12, cacheTtl: 3600 },      // Every 12h - fast initial load
  "30d": { days: 30, dataPoints: 15, intervalHours: 48, cacheTtl: 86400 },   // Every 2 days
  "90d": { days: 90, dataPoints: 18, intervalHours: 120, cacheTtl: 86400 * 3 }, // Every 5 days
  "1y": { days: 365, dataPoints: 24, intervalHours: 336, cacheTtl: 86400 * 7 }, // Every 2 weeks
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

// Envio HyperSync endpoints (free, high-performance historical data)
export const HYPERSYNC_ENDPOINTS: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "https://eth.hypersync.xyz",
  [SUPPORTED_CHAINS.ARBITRUM]: "https://arbitrum.hypersync.xyz",
  [SUPPORTED_CHAINS.OPTIMISM]: "https://optimism.hypersync.xyz",
  [SUPPORTED_CHAINS.BASE]: "https://base.hypersync.xyz",
  [SUPPORTED_CHAINS.POLYGON]: "https://polygon.hypersync.xyz",
};

// ERC20 Transfer event topic (keccak256("Transfer(address,address,uint256)"))
export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
