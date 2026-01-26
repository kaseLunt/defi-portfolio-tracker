/**
 * Lido Graph Adapter
 *
 * Queries Lido staking positions using The Graph.
 * Note: Lido's RPC calls are already fast (just ERC20 balance checks),
 * but Graph provides additional staking statistics and historical data.
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
import { lidoAdapter as rpcAdapter } from "../../lido";
import { getLidoApy } from "@/server/services/yields";

// GraphQL query for Lido stETH holders
const LIDO_HOLDER_QUERY = gql`
  query GetHolder($user: String!) {
    steth: holders(where: { address: $user }) {
      id
      address
      shares
      balance
    }
  }
`;

// Response types
interface GraphHolder {
  id: string;
  address: string;
  shares: string;
  balance: string;
}

interface LidoHolderResponse {
  steth: GraphHolder[];
}

// wstETH contract addresses for L2s (for direct balance queries)
const WSTETH_ADDRESSES: Partial<Record<SupportedChainId, Address>> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  [SUPPORTED_CHAINS.ARBITRUM]: "0x5979D7b546E38E414F7E9822514be443A4800529",
  [SUPPORTED_CHAINS.OPTIMISM]: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
  [SUPPORTED_CHAINS.BASE]: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
  [SUPPORTED_CHAINS.POLYGON]: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD",
};

/**
 * Lido Graph Adapter
 * Uses The Graph for stETH data, falls back to RPC for wstETH on L2s
 */
export class LidoGraphAdapter extends BaseAdapter {
  readonly id = "lido";
  readonly name = "Lido";
  readonly category = "staking" as const;
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

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    // Lido subgraph only exists for Ethereum mainnet
    // For L2s, we use the RPC adapter (fast ERC20 balance checks)
    if (chainId !== SUPPORTED_CHAINS.ETHEREUM) {
      return rpcAdapter.getPositions(walletAddress, chainId);
    }

    // Try Graph first for Ethereum if enabled
    if (USE_GRAPH_ADAPTERS) {
      const graphPositions = await this.getPositionsFromGraph(walletAddress, chainId);
      if (graphPositions !== null) {
        console.log(`[Graph:Lido] Chain ${chainId}: Found ${graphPositions.length} positions`);
        return graphPositions;
      }
      console.log(`[Graph:Lido] Chain ${chainId}: Falling back to RPC`);
    }

    // Fallback to RPC adapter
    return rpcAdapter.getPositions(walletAddress, chainId);
  }

  private async getPositionsFromGraph(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[] | null> {
    const client = getGraphClient("lido", chainId);
    if (!client) {
      return null;
    }

    const response = await executeGraphQuery<LidoHolderResponse>(
      client,
      LIDO_HOLDER_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (!response) {
      return null;
    }

    const positions: Position[] = [];

    // Get APY from DeFi Llama
    const lidoApy = await getLidoApy();

    // Parse stETH holder data
    if (response.steth && response.steth.length > 0) {
      const holder = response.steth[0];
      const balance = BigInt(holder.balance);

      if (balance > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "stake",
          tokenSymbol: "stETH",
          tokenAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
          tokenDecimals: 18,
          coingeckoId: "staked-ether",
          balanceRaw: balance.toString(),
          balance: this.formatBalance(balance, 18),
          apy: lidoApy,
          metadata: {
            isRebasing: true,
            shares: holder.shares,
          },
        });
      }
    }

    // Also fetch wstETH via RPC (Graph doesn't track wstETH separately)
    const wstethAddress = WSTETH_ADDRESSES[chainId];
    if (wstethAddress) {
      try {
        // Import RPC-based balance check for wstETH
        const { getClient } = await import("@/server/lib/rpc");
        const client = getClient(chainId);
        const { wstETHAbi } = await import("@/server/lib/abis/lido");

        const wstethBalance = await client.readContract({
          address: wstethAddress,
          abi: wstETHAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (wstethBalance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "stake",
            tokenSymbol: "wstETH",
            tokenAddress: wstethAddress,
            tokenDecimals: 18,
            coingeckoId: "wrapped-steth",
            balanceRaw: wstethBalance.toString(),
            balance: this.formatBalance(wstethBalance, 18),
            apy: lidoApy,
            metadata: {
              isRebasing: false,
            },
          });
        }
      } catch (error) {
        console.warn(`[Graph:Lido] Failed to fetch wstETH balance:`, error);
      }
    }

    return positions;
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
    console.log(`[Graph:Lido] Total: ${positions.length} positions in ${elapsed}ms`);

    return positions;
  }
}

export const lidoGraphAdapter = new LidoGraphAdapter();
