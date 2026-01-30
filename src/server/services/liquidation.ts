/**
 * Liquidation Risk Service
 *
 * Fetches Aave V3 positions and calculates liquidation risk metrics including:
 * - Portfolio-level health factor (the correct Aave approach)
 * - Per-collateral liquidation prices
 * - Risk contribution per position
 *
 * IMPORTANT: In Aave V3, health factor is calculated at the PORTFOLIO level:
 * HF = Sum(collateral_i * threshold_i) / Total Debt
 *
 * Individual positions don't have their own health factor - they contribute
 * to the overall portfolio health.
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
 * Format balance from raw wei to human-readable number with improved precision.
 *
 * NOTE: JavaScript Number has ~15 significant digits of precision. For typical
 * DeFi amounts (< $1B), this is acceptable. For larger amounts, consider using
 * a BigNumber library.
 *
 * @param rawBalance - The raw balance as bigint (in wei or smallest unit)
 * @param decimals - Number of decimal places for the token
 * @returns The formatted balance as a number
 */
function formatBalance(rawBalance: bigint, decimals: number): number {
  if (rawBalance === 0n) return 0;

  const divisor = BigInt(10 ** decimals);
  const whole = rawBalance / divisor;
  const remainder = rawBalance % divisor;

  // Combine whole and fractional parts
  // This preserves more precision than Number(rawBalance) / 10**decimals
  return Number(whole) + Number(remainder) / Number(divisor);
}

/**
 * Parse liquidation threshold from subgraph response.
 * Aave stores thresholds as basis points (10000 = 100%) in some subgraphs.
 */
function parseLiquidationThreshold(value: string | undefined): number {
  if (!value) return 0;

  const parsed = parseFloat(value);
  if (isNaN(parsed)) return 0;

  // If value > 1, it's in basis points (e.g., 8250 = 82.5%)
  if (parsed > 1) {
    return parsed / 10000;
  }
  return parsed;
}

// Intermediate type for collecting position data
interface CollateralData {
  symbol: string;
  amount: number;
  rawAmount: bigint;
  valueUsd: number;
  liquidationThreshold: number;
  maxLtv: number;
  currentPrice: number;
  weightedThreshold: number; // valueUsd * threshold
}

interface DebtData {
  symbol: string;
  amount: number;
  rawAmount: bigint;
  valueUsd: number;
}

/**
 * Get wallet risk summary for Aave V3 positions
 *
 * Calculates the PORTFOLIO-LEVEL health factor following Aave's formula:
 * HF = Sum(collateral_i * liquidationThreshold_i) / totalDebt
 */
export async function getWalletRiskSummary(
  walletAddress: string,
  chainId: SupportedChainId = SUPPORTED_CHAINS.ETHEREUM
): Promise<WalletRiskSummary> {
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

  // First pass: collect all collateral and debt data
  const collaterals: CollateralData[] = [];
  const debts: DebtData[] = [];
  const skippedTokens: string[] = [];

  for (const userReserve of response.userReserves) {
    const { reserve } = userReserve;
    const decimals = reserve.decimals;
    const symbol = reserve.symbol;

    const coingeckoId = getCoingeckoId(symbol);
    const currentPrice = coingeckoId ? (priceMap.get(coingeckoId) ?? 0) : 0;

    // Skip positions where we can't get a price - don't treat as $0
    if (currentPrice === 0) {
      const hasBalance =
        BigInt(userReserve.currentATokenBalance) > 0n ||
        BigInt(userReserve.currentVariableDebt) > 0n ||
        BigInt(userReserve.currentStableDebt) > 0n;

      if (hasBalance) {
        console.warn(`[Liquidation] Missing price for ${symbol}, skipping position`);
        skippedTokens.push(symbol);
      }
      continue;
    }

    const liquidationThreshold = parseLiquidationThreshold(
      reserve.liquidationThreshold || reserve.reserveLiquidationThreshold
    );
    const maxLtv = parseLiquidationThreshold(reserve.baseLTVasCollateral);

    // Collect collateral data
    const aTokenBalance = BigInt(userReserve.currentATokenBalance);
    if (aTokenBalance > 0n && reserve.usageAsCollateralEnabled) {
      const amount = formatBalance(aTokenBalance, decimals);
      const valueUsd = amount * currentPrice;

      collaterals.push({
        symbol,
        amount,
        rawAmount: aTokenBalance,
        valueUsd,
        liquidationThreshold,
        maxLtv,
        currentPrice,
        weightedThreshold: valueUsd * liquidationThreshold,
      });
    }

    // Collect debt data
    const variableDebt = BigInt(userReserve.currentVariableDebt);
    const stableDebt = BigInt(userReserve.currentStableDebt);
    const totalDebt = variableDebt + stableDebt;

    if (totalDebt > 0n) {
      const amount = formatBalance(totalDebt, decimals);
      const valueUsd = amount * currentPrice;

      debts.push({
        symbol,
        amount,
        rawAmount: totalDebt,
        valueUsd,
      });
    }
  }

  // Calculate portfolio totals
  const totalCollateralUsd = collaterals.reduce((sum, c) => sum + c.valueUsd, 0);
  const totalDebtUsd = debts.reduce((sum, d) => sum + d.valueUsd, 0);
  const totalWeightedThreshold = collaterals.reduce((sum, c) => sum + c.weightedThreshold, 0);

  // Calculate portfolio-level health factor
  // HF = Sum(collateral_i * threshold_i) / Total Debt
  let overallHealthFactor: number;
  if (totalDebtUsd === 0) {
    // No debt = infinite health (no liquidation possible)
    overallHealthFactor = Infinity;
  } else if (totalWeightedThreshold === 0) {
    // No collateral but has debt = instant liquidation
    overallHealthFactor = 0;
  } else {
    overallHealthFactor = totalWeightedThreshold / totalDebtUsd;
  }

  // Build debt summary for positions
  const debtSummary =
    debts.length === 0
      ? { token: "NONE", amount: "0", valueUsd: 0 }
      : debts.length === 1
        ? { token: debts[0].symbol, amount: debts[0].rawAmount.toString(), valueUsd: debts[0].valueUsd }
        : { token: "MULTI", amount: "0", valueUsd: totalDebtUsd };

  // Build positions with risk contribution and per-collateral liquidation prices
  const positions: LendingPosition[] = [];

  for (const collateral of collaterals) {
    // Risk contribution: what percentage of the weighted collateral does this position represent?
    const riskContribution =
      totalWeightedThreshold > 0 ? collateral.weightedThreshold / totalWeightedThreshold : 0;

    // Calculate liquidation price for this specific collateral
    // Liquidation occurs when portfolio HF = 1.0
    // If THIS collateral's price drops while others stay constant:
    // (otherWeightedThreshold + newValue * threshold) / totalDebt = 1.0
    // Solving for the price at which this collateral causes HF = 1.0:
    //
    // For a single-collateral scenario:
    // liquidationPrice = totalDebtUsd / (collateralAmount * threshold)
    //
    // For multi-collateral, we calculate the price at which this collateral's
    // drop would bring HF to 1.0, assuming other collaterals stay constant:
    const otherWeightedThreshold = totalWeightedThreshold - collateral.weightedThreshold;

    let liquidationPrice: number;
    let priceDropToLiquidation: number;

    if (totalDebtUsd === 0 || collateral.liquidationThreshold === 0) {
      // No debt or no liquidation risk for this asset
      liquidationPrice = 0;
      priceDropToLiquidation = 1; // 100% drop needed (effectively infinite)
    } else {
      // Required weighted value from this collateral to reach HF = 1.0
      const requiredWeightedValue = totalDebtUsd - otherWeightedThreshold;

      if (requiredWeightedValue <= 0) {
        // Other collaterals alone cover the debt - this one can go to 0
        liquidationPrice = 0;
        priceDropToLiquidation = 1;
      } else {
        // liquidationPrice * amount * threshold = requiredWeightedValue
        liquidationPrice = requiredWeightedValue / (collateral.amount * collateral.liquidationThreshold);

        // Calculate percentage drop needed
        if (collateral.currentPrice > 0 && liquidationPrice < collateral.currentPrice) {
          priceDropToLiquidation = 1 - liquidationPrice / collateral.currentPrice;
        } else {
          priceDropToLiquidation = 0; // Already at or below liquidation price
        }
      }
    }

    // Current LTV for this collateral (debt / collateral value)
    const currentLtv = collateral.valueUsd > 0 ? totalDebtUsd / collateral.valueUsd : 0;

    // Per-position "health factor" - what HF would be if this were the only collateral
    // This is informational, showing how healthy this individual collateral is
    const positionHealthFactor =
      totalDebtUsd > 0 ? collateral.weightedThreshold / totalDebtUsd : Infinity;

    positions.push({
      protocol: "aave-v3",
      chainId,
      collateralToken: collateral.symbol,
      collateralAmount: collateral.rawAmount.toString(),
      collateralValueUsd: collateral.valueUsd,
      debtToken: debtSummary.token,
      debtAmount: debtSummary.amount,
      debtValueUsd: debtSummary.valueUsd,
      healthFactor: Number.isFinite(positionHealthFactor) ? positionHealthFactor : 999,
      liquidationThreshold: collateral.liquidationThreshold,
      currentLtv,
      maxLtv: collateral.maxLtv,
      riskContribution,
      liquidationPrice,
      currentPrice: collateral.currentPrice,
      priceDropToLiquidation: Math.max(0, Math.min(1, priceDropToLiquidation)),
    });
  }

  // Find positions at risk (where this collateral's price drop would trigger liquidation soon)
  const positionsAtRisk = positions.filter((p) => p.priceDropToLiquidation < 0.25).length;

  // Most at risk = smallest price drop to liquidation
  const mostAtRiskPosition =
    positions.length > 0
      ? positions.reduce((min, p) =>
          p.priceDropToLiquidation < min.priceDropToLiquidation ? p : min
        )
      : null;

  // Log warning about skipped tokens
  if (skippedTokens.length > 0) {
    console.warn(
      `[Liquidation] Skipped ${skippedTokens.length} tokens due to missing prices: ${skippedTokens.join(", ")}`
    );
  }

  return {
    address: walletAddress,
    chainId,
    totalCollateralUsd,
    totalDebtUsd,
    netWorthUsd: totalCollateralUsd - totalDebtUsd,
    overallHealthFactor: Number.isFinite(overallHealthFactor) ? overallHealthFactor : 999,
    overallRiskLevel: getRiskLevel(
      Number.isFinite(overallHealthFactor) ? overallHealthFactor : 999
    ),
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
    overallHealthFactor: 999, // Use high value instead of 0 for "safe" with no positions
    overallRiskLevel: "safe",
    positions: [],
    positionsAtRisk: 0,
    mostAtRiskPosition: null,
  };
}
