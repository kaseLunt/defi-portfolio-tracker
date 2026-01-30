/**
 * Liquidation Risk Types
 *
 * Types for monitoring health factors, liquidation prices, and risk levels
 * for DeFi lending positions (Aave V3, Compound V3, etc.)
 */

// Health factor ranges for risk classification
export type RiskLevel = "safe" | "moderate" | "warning" | "danger" | "critical";

// Individual lending position with liquidation data
export interface LendingPosition {
  protocol: string; // "aave-v3", "compound-v3", etc.
  chainId: number;

  // Collateral info
  collateralToken: string; // e.g., "weETH"
  collateralAmount: string; // raw amount in wei
  collateralValueUsd: number;

  // Debt info
  debtToken: string; // e.g., "USDC"
  debtAmount: string;
  debtValueUsd: number;

  // Risk metrics
  healthFactor: number; // 1.0 = liquidation threshold
  liquidationThreshold: number; // e.g., 0.825 (82.5%)
  currentLtv: number; // current loan-to-value
  maxLtv: number; // maximum allowed LTV

  // Liquidation price (price at which position gets liquidated)
  liquidationPrice: number;
  currentPrice: number;
  priceDropToLiquidation: number; // percentage drop needed
}

// Aggregated risk data for a wallet
export interface WalletRiskSummary {
  address: string;
  chainId: number;

  // Overall metrics
  totalCollateralUsd: number;
  totalDebtUsd: number;
  netWorthUsd: number;
  overallHealthFactor: number;
  overallRiskLevel: RiskLevel;

  // Positions
  positions: LendingPosition[];

  // Alerts
  positionsAtRisk: number; // count of positions with healthFactor < 1.5
  mostAtRiskPosition: LendingPosition | null;
}

// Historical health factor for charts
export interface HealthFactorHistory {
  timestamp: number;
  healthFactor: number;
  collateralValueUsd: number;
  debtValueUsd: number;
}

// Alert configuration for notifications
export interface LiquidationAlert {
  id: string;
  walletAddress: string;
  chainId: number;
  protocol: string;

  // Trigger conditions
  healthFactorThreshold: number; // alert when HF drops below this
  priceDropThreshold?: number; // optional: alert on X% price drop

  // Alert state
  isEnabled: boolean;
  lastTriggeredAt?: number;
}

/**
 * Calculate risk level from health factor
 *
 * Health Factor thresholds:
 * - >= 2.0: Safe - Position is well-collateralized
 * - >= 1.5: Moderate - Healthy but should monitor
 * - >= 1.2: Warning - Consider adding collateral or repaying debt
 * - >= 1.0: Danger - At risk of liquidation, take action immediately
 * - < 1.0: Critical - Position is being liquidated or will be soon
 */
export function getRiskLevel(healthFactor: number): RiskLevel {
  if (healthFactor >= 2.0) return "safe";
  if (healthFactor >= 1.5) return "moderate";
  if (healthFactor >= 1.2) return "warning";
  if (healthFactor >= 1.0) return "danger";
  return "critical";
}
