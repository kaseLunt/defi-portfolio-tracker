/**
 * Compound V3 Graph Adapter
 *
 * Queries Compound V3 (Comet) positions using The Graph.
 * Compound V3 uses individual markets (Comets) for each base asset.
 */

import { gql } from "graphql-request";
import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import {
  getGraphClient,
  executeGraphQuery,
  USE_GRAPH_ADAPTERS,
} from "../client";
import { BaseAdapter, type AdapterConfig, type Position } from "../../types";
import { compoundV3Adapter as rpcAdapter } from "../../compound-v3";

// GraphQL query for Compound V3 user positions
// Uses Paperclip Labs schema: Account -> Position -> PositionAccounting
// Source: https://github.com/papercliplabs/compound-v3-subgraph
const USER_POSITIONS_QUERY = gql`
  query GetUserPositions($user: String!) {
    account(id: $user) {
      id
      positions {
        id
        market {
          id
          cometProxy
          baseToken {
            id
            symbol
            decimals
          }
          supplyApr
          borrowApr
        }
        accounting {
          basePrincipal
          baseBalance
          baseBalanceUsd
          collateralBalanceUsd
        }
        collateralBalances {
          token {
            id
            symbol
            decimals
          }
          balance
          balanceUsd
        }
      }
    }
  }
`;

// Response types for Paperclip Labs Compound V3 subgraph
interface GraphToken {
  id: string;
  symbol: string;
  decimals: number;
}

interface GraphMarket {
  id: string;
  cometProxy: string;
  baseToken: GraphToken;
  supplyApr?: string;
  borrowApr?: string;
}

interface GraphPositionAccounting {
  basePrincipal: string;
  baseBalance: string;
  baseBalanceUsd: string;
  collateralBalanceUsd: string;
}

interface GraphCollateralBalance {
  token: GraphToken;
  balance: string;
  balanceUsd: string;
}

interface GraphPosition {
  id: string;
  market: GraphMarket;
  accounting: GraphPositionAccounting;
  collateralBalances: GraphCollateralBalance[];
}

interface GraphAccount {
  id: string;
  positions: GraphPosition[];
}

interface UserPositionsResponse {
  account: GraphAccount | null;
}

// Token symbol to CoinGecko ID mapping
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  USDC: "usd-coin",
  "USDC.e": "usd-coin",
  USDT: "tether",
  WETH: "weth",
  ETH: "ethereum",
  WBTC: "wrapped-bitcoin",
  DAI: "dai",
  cbETH: "coinbase-wrapped-staked-eth",
  wstETH: "wrapped-steth",
};

/**
 * Compound V3 Graph Adapter
 */
export class CompoundV3GraphAdapter extends BaseAdapter {
  readonly id = "compound-v3";
  readonly name = "Compound V3";
  readonly category = "lending" as const;
  readonly config: AdapterConfig = {
    supportedChains: [
      SUPPORTED_CHAINS.ETHEREUM,
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.BASE,
      SUPPORTED_CHAINS.POLYGON,
      SUPPORTED_CHAINS.OPTIMISM,
    ],
    contracts: {},
  };

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
        console.log(`[Graph:Compound] Chain ${chainId}: Found ${graphPositions.length} positions`);
        return graphPositions;
      }
      console.log(`[Graph:Compound] Chain ${chainId}: Falling back to RPC`);
    }

    // Fallback to RPC adapter
    return rpcAdapter.getPositions(walletAddress, chainId);
  }

  private async getPositionsFromGraph(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[] | null> {
    const client = getGraphClient("compound-v3", chainId);
    if (!client) {
      return null;
    }

    const response = await executeGraphQuery<UserPositionsResponse>(
      client,
      USER_POSITIONS_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (!response?.account) {
      // No account means no positions (not an error)
      return [];
    }

    return this.parsePositionsResponse(response.account, chainId);
  }

  private parsePositionsResponse(
    account: GraphAccount,
    chainId: SupportedChainId
  ): Position[] {
    const positions: Position[] = [];

    for (const pos of account.positions) {
      const { market, accounting, collateralBalances } = pos;
      const baseToken = market.baseToken;

      // Parse base balance (supply or borrow)
      const baseBalance = BigInt(accounting.baseBalance || "0");
      const basePrincipal = BigInt(accounting.basePrincipal || "0");

      // Positive baseBalance = supply, negative = borrow
      if (baseBalance > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "supply",
          tokenSymbol: baseToken.symbol,
          tokenAddress: baseToken.id as Address,
          tokenDecimals: baseToken.decimals,
          coingeckoId: SYMBOL_TO_COINGECKO[baseToken.symbol],
          balanceRaw: baseBalance.toString(),
          balance: this.formatBalance(baseBalance, baseToken.decimals),
          balanceUsd: parseFloat(accounting.baseBalanceUsd) || undefined,
          apy: this.parseApr(market.supplyApr),
          metadata: {
            market: market.id,
            cometProxy: market.cometProxy,
          },
        });
      } else if (baseBalance < 0n) {
        const absBalance = -baseBalance;
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "borrow",
          tokenSymbol: baseToken.symbol,
          tokenAddress: baseToken.id as Address,
          tokenDecimals: baseToken.decimals,
          coingeckoId: SYMBOL_TO_COINGECKO[baseToken.symbol],
          balanceRaw: absBalance.toString(),
          balance: this.formatBalance(absBalance, baseToken.decimals),
          balanceUsd: Math.abs(parseFloat(accounting.baseBalanceUsd)) || undefined,
          apy: this.parseApr(market.borrowApr),
          metadata: {
            market: market.id,
            cometProxy: market.cometProxy,
          },
        });
      }

      // Parse collateral balances
      for (const collateral of collateralBalances) {
        const balance = BigInt(collateral.balance || "0");
        if (balance <= 0n) continue;

        positions.push({
          protocol: this.id,
          chainId,
          positionType: "supply",
          tokenSymbol: collateral.token.symbol,
          tokenAddress: collateral.token.id as Address,
          tokenDecimals: collateral.token.decimals,
          coingeckoId: SYMBOL_TO_COINGECKO[collateral.token.symbol],
          balanceRaw: balance.toString(),
          balance: this.formatBalance(balance, collateral.token.decimals),
          balanceUsd: parseFloat(collateral.balanceUsd) || undefined,
          metadata: {
            market: market.id,
            isCollateral: true,
          },
        });
      }
    }

    return positions;
  }

  private parseApr(aprString?: string): number | undefined {
    if (!aprString) return undefined;
    // APR is stored as decimal (e.g., "0.05" for 5%)
    const apr = parseFloat(aprString);
    if (isNaN(apr)) return undefined;
    // Convert to percentage
    return apr * 100;
  }

  async getAllPositions(walletAddress: Address): Promise<Position[]> {
    const startTime = Date.now();

    const results = await Promise.allSettled(
      this.config.supportedChains.map((chainId) =>
        this.getPositions(walletAddress, chainId)
      )
    );

    const positions: Position[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        positions.push(...result.value);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[Graph:Compound] Total: ${positions.length} positions in ${elapsed}ms`
    );

    return positions;
  }
}

export const compoundV3GraphAdapter = new CompoundV3GraphAdapter();
