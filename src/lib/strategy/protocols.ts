/**
 * DeFi Strategy Builder - Protocol Definitions
 *
 * Protocol configurations, APY sources, and risk parameters
 * for the strategy builder simulation.
 */

import type { StakeProtocol, LendProtocol, AssetType } from "./types";

// ============================================================================
// Staking Protocol Definitions
// ============================================================================

export interface StakingProtocolConfig {
  id: StakeProtocol;
  name: string;
  inputAsset: AssetType;
  outputAsset: AssetType;
  defiLlamaPoolId: string;
  logo: string;
  tvl: number; // Placeholder, fetched from API
  riskScore: number; // 0-100, lower is safer
}

export const STAKING_PROTOCOLS: StakingProtocolConfig[] = [
  {
    id: "etherfi",
    name: "EtherFi",
    inputAsset: "ETH",
    outputAsset: "eETH",
    defiLlamaPoolId: "ether.fi-stake",
    logo: "🔷",
    tvl: 6000000000, // ~$6B
    riskScore: 25,
  },
  {
    id: "lido",
    name: "Lido",
    inputAsset: "ETH",
    outputAsset: "stETH",
    defiLlamaPoolId: "lido",
    logo: "🔵",
    tvl: 25000000000, // ~$25B
    riskScore: 15,
  },
  {
    id: "rocketpool",
    name: "Rocket Pool",
    inputAsset: "ETH",
    outputAsset: "rETH",
    defiLlamaPoolId: "rocket-pool",
    logo: "🚀",
    tvl: 3000000000, // ~$3B
    riskScore: 20,
  },
  {
    id: "frax",
    name: "Frax Finance",
    inputAsset: "ETH",
    outputAsset: "sfrxETH",
    defiLlamaPoolId: "frax-ether",
    logo: "⚡",
    tvl: 1500000000, // ~$1.5B
    riskScore: 30,
  },
  {
    id: "coinbase",
    name: "Coinbase",
    inputAsset: "ETH",
    outputAsset: "cbETH",
    defiLlamaPoolId: "coinbase-wrapped-staked-eth",
    logo: "🔹",
    tvl: 2500000000, // ~$2.5B
    riskScore: 10,
  },
];

// ============================================================================
// Lending Protocol Definitions
// ============================================================================

export interface LendingMarket {
  asset: AssetType;
  chain: number;
  supplyApy: number;
  borrowApy: number;
  maxLtv: number;
  liquidationThreshold: number;
  defiLlamaPoolId: string;
}

export interface LendingProtocolConfig {
  id: LendProtocol;
  name: string;
  logo: string;
  riskScore: number;
  supportedChains: number[];
  markets: LendingMarket[];
}

// TODO: Fetch LTV/liquidation thresholds from Aave API or on-chain
// These are fallback values - real data should come from:
// - Aave: https://aave-api-v2.aave.com/data/markets-data
// - Or on-chain via Aave Pool contract getReserveData()
export const LENDING_PROTOCOLS: LendingProtocolConfig[] = [
  {
    id: "aave-v3",
    name: "Aave V3",
    logo: "👻",
    riskScore: 15,
    supportedChains: [1, 42161, 10, 8453, 137],
    markets: [
      {
        asset: "ETH",
        chain: 1,
        supplyApy: 1.8,       // Fallback - real APY from DeFi Llama
        borrowApy: 2.5,       // Fallback - real APY from DeFi Llama
        maxLtv: 80.5,         // Aave V3 Ethereum (as of 2025)
        liquidationThreshold: 83,
        defiLlamaPoolId: "aave-v3:eth",
      },
      {
        asset: "weETH",
        chain: 1,
        supplyApy: 0.1,       // Minimal supply APY for LSTs
        borrowApy: 0,         // weETH not borrowable
        maxLtv: 72.5,         // Aave V3 weETH E-Mode parameters
        liquidationThreshold: 75,
        defiLlamaPoolId: "aave-v3:weeth",
      },
      {
        asset: "stETH",
        chain: 1,
        supplyApy: 0.1,
        borrowApy: 0,         // stETH not borrowable
        maxLtv: 74,
        liquidationThreshold: 76,
        defiLlamaPoolId: "aave-v3:steth",
      },
      {
        asset: "USDC",
        chain: 1,
        supplyApy: 5.0,
        borrowApy: 6.5,
        maxLtv: 77,
        liquidationThreshold: 80,
        defiLlamaPoolId: "aave-v3:usdc",
      },
    ],
  },
  {
    id: "compound-v3",
    name: "Compound V3",
    logo: "🧪",
    riskScore: 15,
    supportedChains: [1, 42161, 10, 8453, 137],
    markets: [
      {
        asset: "ETH",
        chain: 1,
        supplyApy: 2.0,
        borrowApy: 3.1,
        maxLtv: 83,
        liquidationThreshold: 85,
        defiLlamaPoolId: "compound-v3:eth",
      },
      {
        asset: "USDC",
        chain: 1,
        supplyApy: 7.8,
        borrowApy: 9.5,
        maxLtv: 83,
        liquidationThreshold: 85,
        defiLlamaPoolId: "compound-v3:usdc",
      },
    ],
  },
  {
    id: "morpho",
    name: "Morpho",
    logo: "🦋",
    riskScore: 25,
    supportedChains: [1, 8453],
    markets: [
      {
        asset: "ETH",
        chain: 1,
        supplyApy: 2.5,
        borrowApy: 3.0,
        maxLtv: 86,
        liquidationThreshold: 91.5,
        defiLlamaPoolId: "morpho:eth",
      },
      {
        asset: "weETH",
        chain: 1,
        supplyApy: 1.0,
        borrowApy: 0,
        maxLtv: 86,
        liquidationThreshold: 91.5,
        defiLlamaPoolId: "morpho:weeth",
      },
      {
        asset: "USDC",
        chain: 1,
        supplyApy: 10.2,
        borrowApy: 11.5,
        maxLtv: 86,
        liquidationThreshold: 91.5,
        defiLlamaPoolId: "morpho:usdc",
      },
    ],
  },
  {
    id: "spark",
    name: "Spark Protocol",
    logo: "✨",
    riskScore: 20,
    supportedChains: [1],
    markets: [
      {
        asset: "ETH",
        chain: 1,
        supplyApy: 2.2,
        borrowApy: 2.9,
        maxLtv: 80,
        liquidationThreshold: 82.5,
        defiLlamaPoolId: "spark:eth",
      },
      {
        asset: "DAI",
        chain: 1,
        supplyApy: 8.0,
        borrowApy: 9.5,
        maxLtv: 77,
        liquidationThreshold: 80,
        defiLlamaPoolId: "spark:dai",
      },
    ],
  },
];

// ============================================================================
// Default APYs (fallback when API unavailable)
// ============================================================================

export const DEFAULT_APYS: Record<string, number> = {
  // Staking (updated Jan 2025 from DeFi Llama)
  etherfi: 3.0,
  lido: 2.9,
  rocketpool: 2.8,
  frax: 3.5,
  coinbase: 2.6,

  // Lending supply
  "aave-v3:eth": 1.8,
  "aave-v3:weeth": 0.4,
  "aave-v3:steth": 0.3,
  "aave-v3:usdc": 5.5,
  "compound-v3:eth": 1.5,
  "compound-v3:usdc": 5.2,
  "morpho:eth": 2.2,
  "morpho:weeth": 0.8,
  "morpho:usdc": 7.5,
  "spark:eth": 2.0,
  "spark:dai": 6.5,

  // Lending borrow
  "aave-v3:eth:borrow": 3.2,
  "aave-v3:usdc:borrow": 7.5,
  "compound-v3:eth:borrow": 3.6,
  "compound-v3:usdc:borrow": 7.0,
  "morpho:eth:borrow": 3.6,
  "morpho:usdc:borrow": 9.0,
  "spark:eth:borrow": 3.5,
  "spark:dai:borrow": 8.0,
};

// ============================================================================
// Gas Cost Estimates (in USD)
// Based on ~3 gwei gas price and ~$2700 ETH (2025/2026 L1 conditions)
// L2s would be 10-100x cheaper
// ============================================================================

export const GAS_COSTS = {
  stake: 2,      // ~150k gas @ 3 gwei = ~$1.20
  unstake: 2.5,  // ~200k gas
  lend: 3,       // ~250k gas (supply to Aave)
  borrow: 3.5,   // ~300k gas
  repay: 2.5,    // ~200k gas
  withdraw: 2.5, // ~200k gas
  swap: 1.5,     // ~120k gas (Uniswap)
  approve: 0.5,  // ~50k gas
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getStakingProtocol(id: StakeProtocol): StakingProtocolConfig | undefined {
  return STAKING_PROTOCOLS.find((p) => p.id === id);
}

export function getLendingProtocol(id: LendProtocol): LendingProtocolConfig | undefined {
  return LENDING_PROTOCOLS.find((p) => p.id === id);
}

export function getLendingMarket(
  protocolId: LendProtocol,
  asset: AssetType,
  chain: number = 1
): LendingMarket | undefined {
  const protocol = getLendingProtocol(protocolId);
  return protocol?.markets.find((m) => m.asset === asset && m.chain === chain);
}

export function getDefaultApy(key: string): number {
  return DEFAULT_APYS[key] ?? 0;
}
