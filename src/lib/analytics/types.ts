/**
 * Cross-Chain weETH Analytics Types
 *
 * Types for tracking EtherFi's weETH holdings and yields across multiple chains
 * (Ethereum, Arbitrum, Base, Optimism, Scroll) to provide users with a unified
 * view of their EtherFi positions.
 */

/**
 * Chain-specific weETH holding representing a user's weETH position on a single chain
 */
export interface ChainWeETHHolding {
  chainId: number;
  chainName: string;

  // weETH balance
  weethBalance: string; // raw amount in wei
  weethBalanceFormatted: number;
  weethValueUsd: number;

  // Underlying ETH value (weETH appreciates vs ETH)
  underlyingEthAmount: number;
  weethToEthRate: number; // current exchange rate

  // Source of holding (wallet, staked in protocol, etc.)
  source: "wallet" | "aave" | "compound" | "morpho" | "other";
  protocol?: string; // specific protocol name if applicable

  // APY if earning yield
  apy?: number;
  apySource?: string; // "native" for weETH appreciation, protocol name otherwise
}

/**
 * Aggregated cross-chain analytics providing a complete view of weETH holdings
 */
export interface CrossChainWeETHAnalytics {
  walletAddress: string;
  timestamp: number;

  // Totals across all chains
  totalWeethBalance: number; // formatted
  totalWeethValueUsd: number;
  totalUnderlyingEth: number;

  // Chain breakdown
  holdings: ChainWeETHHolding[];

  // Distribution percentages
  chainDistribution: Array<{
    chainId: number;
    chainName: string;
    percentage: number;
    valueUsd: number;
  }>;

  // Yield info
  weightedAverageApy: number;
  bestYieldChain: {
    chainId: number;
    chainName: string;
    apy: number;
  } | null;

  // EtherFi loyalty info (if applicable)
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  totalEtherFiPoints?: number;
}

/**
 * Historical data point for weETH performance charts
 */
export interface WeETHHistoricalDataPoint {
  timestamp: number;
  totalValueUsd: number;
  totalWeethBalance: number;
  weethPrice: number;
  ethPrice: number;
  weethToEthRate: number;
}

/**
 * Comparison metrics for evaluating weETH performance vs holding plain ETH
 */
export interface YieldComparison {
  holdingPeriodDays: number;

  // weETH performance
  weethStartValue: number;
  weethEndValue: number;
  weethReturn: number;
  weethReturnPercent: number;

  // What if held ETH instead
  ethStartValue: number;
  ethEndValue: number;
  ethReturn: number;
  ethReturnPercent: number;

  // Difference (weETH advantage)
  additionalYield: number;
  additionalYieldPercent: number;
}

/**
 * weETH contract addresses across supported chains
 */
export const WEETH_CHAINS = [
  {
    chainId: 1,
    name: "Ethereum",
    weethAddress: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    weethAddress: "0x35751007a407ca6feffe80b3cb397736d2cf4dbe",
  },
  {
    chainId: 8453,
    name: "Base",
    weethAddress: "0x04c0599ae5a44757c0af6f9ec3b93da8976c150a",
  },
  {
    chainId: 10,
    name: "Optimism",
    weethAddress: "0x346e03f8cce9fe01dcb3d0da3e9d00dc2c0e08f0",
  },
  {
    chainId: 534352,
    name: "Scroll",
    weethAddress: "0x01f0a31698c4d065659b9bdc21b3610292a1c506",
  },
] as const;

/**
 * Union type of supported chain IDs for weETH
 */
export type SupportedWeETHChain = (typeof WEETH_CHAINS)[number]["chainId"];
