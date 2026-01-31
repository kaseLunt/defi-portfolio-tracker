/**
 * Aave V3 Graph Adapter
 *
 * Queries Aave V3 positions using The Graph instead of RPC calls.
 * Single GraphQL query fetches all user positions across a chain in ~100-500ms
 * vs multiple RPC calls taking 3-8 seconds.
 */

import { gql } from "graphql-request";
import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import {
  getGraphClient,
  executeGraphQuery,
  rayToApy,
  getGraphSupportedChains,
  USE_GRAPH_ADAPTERS,
} from "../client";
import { BaseAdapter, type AdapterConfig, type Position } from "../../types";
import { aaveV3Adapter as rpcAdapter } from "../../aave-v3";
import { COINGECKO_IDS } from "@/server/services/price";

// GraphQL query for Aave V3 user reserves
const USER_RESERVES_QUERY = gql`
  query GetUserReserves($user: String!) {
    userReserves(where: { user: $user }) {
      id
      currentATokenBalance
      currentVariableDebt
      currentStableDebt
      scaledATokenBalance
      scaledVariableDebt
      reserve {
        id
        symbol
        name
        decimals
        underlyingAsset
        liquidityRate
        variableBorrowRate
        stableBorrowRate
        usageAsCollateralEnabled
        aToken {
          id
        }
        vToken {
          id
        }
      }
    }
  }
`;

// Response types from The Graph
interface GraphReserve {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  underlyingAsset: string;
  liquidityRate: string;
  variableBorrowRate: string;
  stableBorrowRate: string;
  usageAsCollateralEnabled: boolean;
  aToken: { id: string };
  vToken: { id: string };
}

interface GraphUserReserve {
  id: string;
  currentATokenBalance: string;
  currentVariableDebt: string;
  currentStableDebt: string;
  scaledATokenBalance: string;
  scaledVariableDebt: string;
  reserve: GraphReserve;
}

interface UserReservesResponse {
  userReserves: GraphUserReserve[];
}

/**
 * Aave V3 Graph Adapter
 * Uses The Graph for fast position queries with RPC fallback
 */
export class AaveV3GraphAdapter extends BaseAdapter {
  readonly id = "aave-v3";
  readonly name = "Aave V3";
  readonly category = "lending" as const;
  readonly config: AdapterConfig = {
    supportedChains: [
      SUPPORTED_CHAINS.ETHEREUM,
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.OPTIMISM,
      SUPPORTED_CHAINS.BASE,
      SUPPORTED_CHAINS.POLYGON,
    ],
    contracts: {},
  };

  /**
   * Get positions from The Graph
   * Falls back to RPC adapter if Graph query fails
   */
  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    // Try Graph first if enabled
    if (USE_GRAPH_ADAPTERS) {
      const graphPositions = await this.getPositionsFromGraph(walletAddress, chainId);
      if (graphPositions !== null) {
        console.log(`[Graph:Aave] Chain ${chainId}: Found ${graphPositions.length} positions`);
        return graphPositions;
      }
      console.log(`[Graph:Aave] Chain ${chainId}: Falling back to RPC`);
    }

    // Fallback to RPC adapter
    return rpcAdapter.getPositions(walletAddress, chainId);
  }

  /**
   * Query positions from The Graph subgraph
   */
  private async getPositionsFromGraph(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[] | null> {
    const client = getGraphClient("aave-v3", chainId);
    if (!client) {
      return null;
    }

    const response = await executeGraphQuery<UserReservesResponse>(
      client,
      USER_RESERVES_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (!response) {
      return null;
    }

    const positions: Position[] = [];

    for (const userReserve of response.userReserves) {
      const { reserve } = userReserve;
      const decimals = reserve.decimals;
      const symbol = reserve.symbol;
      const underlyingAsset = reserve.underlyingAsset as Address;

      // Get CoinGecko ID for price lookup
      const coingeckoId = COINGECKO_IDS[symbol];

      // Supply position (aToken balance)
      const aTokenBalance = BigInt(userReserve.currentATokenBalance);
      if (aTokenBalance > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "supply",
          tokenSymbol: symbol,
          tokenAddress: underlyingAsset,
          tokenDecimals: decimals,
          coingeckoId,
          balanceRaw: aTokenBalance.toString(),
          balance: this.formatBalance(aTokenBalance, decimals),
          apy: rayToApy(reserve.liquidityRate),
          metadata: {
            isCollateral: reserve.usageAsCollateralEnabled,
            aTokenAddress: reserve.aToken.id,
          },
        });
      }

      // Variable borrow position
      const variableDebt = BigInt(userReserve.currentVariableDebt);
      if (variableDebt > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "borrow",
          tokenSymbol: symbol,
          tokenAddress: underlyingAsset,
          tokenDecimals: decimals,
          coingeckoId,
          balanceRaw: variableDebt.toString(),
          balance: this.formatBalance(variableDebt, decimals),
          apy: rayToApy(reserve.variableBorrowRate),
          metadata: {
            borrowType: "variable",
            vTokenAddress: reserve.vToken.id,
          },
        });
      }

      // Stable borrow position (rare but supported)
      const stableDebt = BigInt(userReserve.currentStableDebt);
      if (stableDebt > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "borrow",
          tokenSymbol: symbol,
          tokenAddress: underlyingAsset,
          tokenDecimals: decimals,
          coingeckoId,
          balanceRaw: stableDebt.toString(),
          balance: this.formatBalance(stableDebt, decimals),
          apy: rayToApy(reserve.stableBorrowRate),
          metadata: {
            borrowType: "stable",
          },
        });
      }
    }

    return positions;
  }

  /**
   * Override to use parallel Graph queries across chains
   */
  async getAllPositions(walletAddress: Address): Promise<Position[]> {
    const startTime = Date.now();

    // Query all chains in parallel
    const results = await Promise.allSettled(
      this.config.supportedChains.map((chainId) =>
        this.getPositions(walletAddress, chainId)
      )
    );

    const positions: Position[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        positions.push(...result.value);
      } else {
        console.error(`[Graph:Aave] Failed to fetch positions:`, result.reason);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[Graph:Aave] Total: ${positions.length} positions across ${this.config.supportedChains.length} chains in ${elapsed}ms`
    );

    return positions;
  }
}

// Export singleton instance
export const aaveV3GraphAdapter = new AaveV3GraphAdapter();
