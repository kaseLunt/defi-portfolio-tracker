/**
 * Liquidation Risk Service
 *
 * Fetches Aave V3 positions and calculates liquidation risk metrics including:
 * - Health factors
 * - Liquidation prices
 * - Risk levels
 */

import { gql } from "graphql-request";
import { type SupportedChainId, SUPPORTED_CHAINS } from "@/lib/constants";
import {
  type LendingPosition,
  type WalletRiskSummary,
  getRiskLevel,
} from "@/lib/liquidation/types";
import {
  getGraphClient,
  executeGraphQuery,
  SUBGRAPH_IDS,
} from "@/server/adapters/graph/client";
import { getPrice, COINGECKO_IDS } from "./price";

// Token symbol to CoinGecko ID mapping (extends base mapping for Aave-specific tokens)
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  WETH: "weth",
  ETH: "ethereum",
  USDC: "usd-coin",
  "USDC.e": "usd-coin",
  USDT: "tether",
  DAI: "dai",
  WBTC: "wrapped-bitcoin",
  wstETH: "wrapped-steth",
  stETH: "staked-ether",
  rETH: "rocket-pool-eth",
  cbETH: "coinbase-wrapped-staked-eth",
  USDe: "ethena-usde",
  sUSDe: "ethena-staked-usde",
  WMATIC: "wmatic",
  MATIC: "matic-network",
  weETH: "wrapped-eeth",
  ezETH: "renzo-restaked-eth",
  GHO: "gho",
  LUSD: "liquity-usd",
  FRAX: "frax",
  MKR: "maker",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  CRV: "curve-dao-token",
  ...COINGECKO_IDS,
};

// GraphQL query for user reserves with liquidation data
const USER_RESERVES_QUERY = gql`
  query GetUserReserves($user: String!) {
    userReserves(where: { user: $user }) {
      id
      currentATokenBalance
      currentVariableDebt
      currentStableDebt
      reserve {
        symbol
        name
        decimals
        underlyingAsset
        liquidationThreshold
        baseLTVasCollateral
        reserveLiquidationThreshold
        reserveLiquidationBonus
        usageAsCollateralEnabled
        price {
          priceInEth
        }
      }
    }
  }
`;

// Types for subgraph response
interface GraphReservePrice {
  priceInEth: string;
}

interface GraphReserve {
  symbol: string;
  name: string;
  decimals: number;
  underlyingAsset: string;
  liquidationThreshold: string;
  baseLTVasCollateral: string;
  reserveLiquidationThreshold: string;
  reserveLiquidationBonus: string;
  usageAsCollateralEnabled: boolean;
  price: GraphReservePrice | null;
}

interface GraphUserReserve {
  id: string;
  currentATokenBalance: string;
  currentVariableDebt: string;
  currentStableDebt: string;
  reserve: GraphReserve;
}

interface UserReservesResponse {
  userReserves: GraphUserReserve[];
}

/**
 * Get the CoinGecko ID for a token symbol
 */
function getCoingeckoId(symbol: string): string | undefined {
  return SYMBOL_TO_COINGECKO[symbol] || COINGECKO_IDS[symbol];
}

/**
 * Format balance from raw wei to human-readable number
 */
function formatBalance(rawBalance: bigint, decimals: number): number {
  return Number(rawBalance) / Math.pow(10, decimals);
}

/**
 * Get wallet risk summary for Aave V3 positions
 */
export async function getWalletRiskSummary(
  walletAddress: string,
  chainId: SupportedChainId = SUPPORTED_CHAINS.ETHEREUM
): Promise<WalletRiskSummary> {
  const positions: LendingPosition[] = [];

  // Query Aave V3 subgraph
  const client = getGraphClient("aave-v3", chainId);
  if (!client) {
    console.warn(`[Liquidation] No Graph client available for chain ${chainId}`);
    return buildEmptySummary(walletAddress, chainId);
  }

  const response = await executeGraphQuery<UserReservesResponse>(
    client,
    USER_RESERVES_QUERY,
    { user: walletAddress.toLowerCase() }
  );

  if (!response || response.userReserves.length === 0) {
    return buildEmptySummary(walletAddress, chainId);
  }

  // Collect unique tokens to fetch prices for
  const tokensToPrice = new Set<string>();
  for (const userReserve of response.userReserves) {
    const coingeckoId = getCoingeckoId(userReserve.reserve.symbol);
    if (coingeckoId) {
      tokensToPrice.add(coingeckoId);
    }
  }

  // Fetch current prices
  const priceMap = new Map<string, number>();
  for (const coingeckoId of tokensToPrice) {
    const priceData = await getPrice(coingeckoId);
    if (priceData) {
      priceMap.set(coingeckoId, priceData.priceUsd);
    }
  }

  // Calculate metrics for each position
  let totalCollateralUsd = 0;
  let totalDebtUsd = 0;
  let weightedLiquidationThreshold = 0;

  // Group by collateral/debt relationship
  // For simplicity, we'll calculate per-token positions
  for (const userReserve of response.userReserves) {
    const { reserve } = userReserve;
    const decimals = reserve.decimals;
    const symbol = reserve.symbol;

    const coingeckoId = getCoingeckoId(symbol);
    const currentPrice = coingeckoId ? (priceMap.get(coingeckoId) ?? 0) : 0;

    // Parse liquidation threshold (stored as basis points in some subgraphs, or as percentage)
    // Aave stores as 10000 = 100%, so we need to normalize
    let liquidationThreshold = parseFloat(reserve.liquidationThreshold || reserve.reserveLiquidationThreshold || "0");
    if (liquidationThreshold > 1) {
      liquidationThreshold = liquidationThreshold / 10000; // Convert from basis points
    }

    let maxLtv = parseFloat(reserve.baseLTVasCollateral || "0");
    if (maxLtv > 1) {
      maxLtv = maxLtv / 10000; // Convert from basis points
    }

    // Supply (collateral) position
    const aTokenBalance = BigInt(userReserve.currentATokenBalance);
    if (aTokenBalance > 0n && reserve.usageAsCollateralEnabled) {
      const collateralAmount = formatBalance(aTokenBalance, decimals);
      const collateralValueUsd = collateralAmount * currentPrice;
      totalCollateralUsd += collateralValueUsd;
      weightedLiquidationThreshold += collateralValueUsd * liquidationThreshold;
    }

    // Debt positions (variable + stable)
    const variableDebt = BigInt(userReserve.currentVariableDebt);
    const stableDebt = BigInt(userReserve.currentStableDebt);
    const totalDebt = variableDebt + stableDebt;

    if (totalDebt > 0n) {
      const debtAmount = formatBalance(totalDebt, decimals);
      const debtValueUsd = debtAmount * currentPrice;
      totalDebtUsd += debtValueUsd;
    }

    // If there's both collateral and debt for this token, create a position entry
    if (aTokenBalance > 0n && reserve.usageAsCollateralEnabled) {
      const collateralAmount = formatBalance(aTokenBalance, decimals);
      const collateralValueUsd = collateralAmount * currentPrice;

      // For each collateral token, we calculate risk against total debt
      // This is simplified - in reality, Aave allows multiple collaterals
      if (totalDebtUsd > 0 && collateralValueUsd > 0) {
        const healthFactor = (collateralValueUsd * liquidationThreshold) / totalDebtUsd;
        const currentLtv = totalDebtUsd / collateralValueUsd;

        // Liquidation price calculation
        // Liquidation occurs when: collateralValue * liquidationThreshold = debtValue
        // liquidationPrice = (debtValueUsd / (collateralAmount * liquidationThreshold))
        const liquidationPrice = totalDebtUsd / (collateralAmount * liquidationThreshold);
        const priceDropToLiquidation = currentPrice > 0
          ? Math.max(0, 1 - (liquidationPrice / currentPrice))
          : 0;

        positions.push({
          protocol: "aave-v3",
          chainId,
          collateralToken: symbol,
          collateralAmount: aTokenBalance.toString(),
          collateralValueUsd,
          debtToken: "MULTI", // Simplified - actual debt could be in multiple tokens
          debtAmount: totalDebt.toString(),
          debtValueUsd: totalDebtUsd,
          healthFactor,
          liquidationThreshold,
          currentLtv,
          maxLtv,
          liquidationPrice,
          currentPrice,
          priceDropToLiquidation,
        });
      }
    }
  }

  // Calculate overall health factor
  const avgLiquidationThreshold = totalCollateralUsd > 0
    ? weightedLiquidationThreshold / totalCollateralUsd
    : 0;
  const overallHealthFactor = totalDebtUsd > 0
    ? (totalCollateralUsd * avgLiquidationThreshold) / totalDebtUsd
    : Infinity;

  // Find positions at risk and most at risk position
  const positionsAtRisk = positions.filter((p) => p.healthFactor < 1.5).length;
  const mostAtRiskPosition = positions.length > 0
    ? positions.reduce((min, p) => (p.healthFactor < min.healthFactor ? p : min))
    : null;

  return {
    address: walletAddress,
    chainId,
    totalCollateralUsd,
    totalDebtUsd,
    netWorthUsd: totalCollateralUsd - totalDebtUsd,
    overallHealthFactor: Number.isFinite(overallHealthFactor) ? overallHealthFactor : 0,
    overallRiskLevel: getRiskLevel(overallHealthFactor),
    positions,
    positionsAtRisk,
    mostAtRiskPosition,
  };
}

/**
 * Get risk summary across all supported chains
 */
export async function getWalletRiskSummaryAllChains(
  walletAddress: string
): Promise<WalletRiskSummary[]> {
  const supportedChains = Object.values(SUPPORTED_CHAINS).filter(
    (chainId) => SUBGRAPH_IDS["aave-v3"]?.[chainId]
  ) as SupportedChainId[];

  const results = await Promise.allSettled(
    supportedChains.map((chainId) => getWalletRiskSummary(walletAddress, chainId))
  );

  const summaries: WalletRiskSummary[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.positions.length > 0) {
      summaries.push(result.value);
    }
  }

  return summaries;
}

/**
 * Build an empty summary for wallets with no positions
 */
function buildEmptySummary(
  walletAddress: string,
  chainId: SupportedChainId
): WalletRiskSummary {
  return {
    address: walletAddress,
    chainId,
    totalCollateralUsd: 0,
    totalDebtUsd: 0,
    netWorthUsd: 0,
    overallHealthFactor: 0,
    overallRiskLevel: "safe",
    positions: [],
    positionsAtRisk: 0,
    mostAtRiskPosition: null,
  };
}
