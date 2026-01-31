/**
 * Shared Portfolio Utilities
 *
 * Common functions for enriching and aggregating portfolio positions.
 * Used by both portfolio.ts and portfolio-fast.ts to ensure consistent behavior.
 */

import type { Position } from "../adapters/types";
import { adapterRegistry } from "../adapters/registry";

// Minimum USD value to display a position (filter out dust)
export const MIN_POSITION_VALUE_USD = 1;

/**
 * Position enriched with USD values
 */
export interface EnrichedPosition extends Position {
  priceUsd: number;
  balanceUsd: number;
  value24hChange?: number;
}

/**
 * Price data structure from price service
 */
export interface PriceData {
  priceUsd: number;
  change24hPct: number | null;
}

/**
 * Protocol grouping for portfolio display
 */
export interface ProtocolGroup {
  protocol: string;
  name: string;
  category: string;
  positions: EnrichedPosition[];
  totalValueUsd: number;
}

/**
 * Enrich positions with USD values from price data
 */
export function enrichPositionsWithPrices(
  positions: Position[],
  prices: Map<string, PriceData>
): EnrichedPosition[] {
  return positions.map((position) => {
    const priceData = position.coingeckoId
      ? prices.get(position.coingeckoId)
      : undefined;
    const priceUsd = priceData?.priceUsd ?? 0;
    const balanceUsd = position.balance * priceUsd;

    return {
      ...position,
      priceUsd,
      balanceUsd,
      value24hChange: priceData?.change24hPct ?? undefined,
    };
  });
}

/**
 * Calculate total portfolio value from positions
 * Subtracts borrow positions as they represent debt
 */
export function calculateTotalValue(positions: EnrichedPosition[]): number {
  return positions.reduce((sum, p) => {
    if (p.positionType === "borrow") {
      return sum - p.balanceUsd; // Debt reduces total value
    }
    return sum + p.balanceUsd;
  }, 0);
}

/**
 * Calculate 24h yield from positions
 * Based on APY / 365, subtracting cost of borrows
 */
export function calculateYield24h(positions: EnrichedPosition[]): number {
  return positions.reduce((sum, p) => {
    if (p.apy && p.balanceUsd > 0) {
      const dailyYield = (p.balanceUsd * (p.apy / 100)) / 365;
      if (p.positionType === "borrow") {
        return sum - dailyYield; // Borrowing costs money
      }
      return sum + dailyYield;
    }
    return sum;
  }, 0);
}

/**
 * Calculate weighted average APY across supply positions
 * Excludes borrow positions from the calculation
 */
export function calculateWeightedApy(positions: EnrichedPosition[]): number {
  const supplyPositions = positions.filter((p) => p.positionType !== "borrow");
  const totalSupplyValue = supplyPositions.reduce(
    (sum, p) => sum + p.balanceUsd,
    0
  );

  if (totalSupplyValue === 0) return 0;

  const weightedApySum = supplyPositions.reduce((sum, p) => {
    if (p.apy && p.balanceUsd > 0) {
      return sum + p.apy * p.balanceUsd;
    }
    return sum;
  }, 0);

  return weightedApySum / totalSupplyValue;
}

/**
 * Group positions by protocol with metadata
 */
export function groupByProtocol(
  positions: EnrichedPosition[]
): ProtocolGroup[] {
  const protocolMap = new Map<string, ProtocolGroup>();

  for (const position of positions) {
    const adapter = adapterRegistry.get(position.protocol);
    const existing = protocolMap.get(position.protocol);

    // Debt reduces protocol total value
    const valueContribution =
      position.positionType === "borrow"
        ? -position.balanceUsd
        : position.balanceUsd;

    if (existing) {
      existing.positions.push(position);
      existing.totalValueUsd += valueContribution;
    } else {
      protocolMap.set(position.protocol, {
        protocol: position.protocol,
        name: adapter?.name ?? position.protocol,
        category: adapter?.category ?? "unknown",
        positions: [position],
        totalValueUsd: valueContribution,
      });
    }
  }

  return Array.from(protocolMap.values()).sort(
    (a, b) => b.totalValueUsd - a.totalValueUsd
  );
}

/**
 * Filter out dust positions (worth less than MIN_POSITION_VALUE_USD)
 */
export function filterDustPositions(
  positions: EnrichedPosition[]
): EnrichedPosition[] {
  return positions.filter(
    (p) => Math.abs(p.balanceUsd) >= MIN_POSITION_VALUE_USD
  );
}

/**
 * Sort positions by USD value descending
 */
export function sortByValue(
  positions: EnrichedPosition[]
): EnrichedPosition[] {
  return [...positions].sort((a, b) => b.balanceUsd - a.balanceUsd);
}
