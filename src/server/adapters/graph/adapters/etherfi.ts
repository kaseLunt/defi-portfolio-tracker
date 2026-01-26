/**
 * EtherFi Graph Adapter
 *
 * Queries EtherFi staking positions using The Graph.
 * EtherFi is a liquid restaking protocol that provides eETH and weETH tokens.
 *
 * Features tracked:
 * - eETH: Rebasing liquid staking token (Ethereum mainnet only)
 * - weETH: Wrapped eETH (available on L2s via bridges)
 * - EigenLayer + EtherFi loyalty points eligibility
 */

import { gql } from "graphql-request";
import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import {
  getGraphClient,
  executeGraphQuery,
  USE_GRAPH_ADAPTERS,
  SUBGRAPH_IDS,
} from "../client";
import { BaseAdapter, type AdapterConfig, type Position } from "../../types";
import { etherfiAdapter as rpcAdapter } from "../../etherfi";
import { getEtherFiApy } from "@/server/services/yields";

// GraphQL query for EtherFi stakers/holders
// Note: Schema may vary based on the specific subgraph deployment
const ETHERFI_STAKER_QUERY = gql`
  query GetStaker($user: String!) {
    staker(id: $user) {
      id
      totalEethBalance
      totalWeethBalance
      shares
      deposits {
        id
        amount
        timestamp
      }
    }
  }
`;

// Alternative query for holder-based subgraphs
const ETHERFI_HOLDER_QUERY = gql`
  query GetHolder($user: String!) {
    holders(where: { address: $user }) {
      id
      address
      eethBalance
      weethBalance
      totalEthValue
    }
  }
`;

// Response types
interface GraphDeposit {
  id: string;
  amount: string;
  timestamp: string;
}

interface GraphStaker {
  id: string;
  totalEethBalance: string;
  totalWeethBalance: string;
  shares: string;
  deposits?: GraphDeposit[];
}

interface GraphHolder {
  id: string;
  address: string;
  eethBalance: string;
  weethBalance: string;
  totalEthValue?: string;
}

interface StakerResponse {
  staker: GraphStaker | null;
}

interface HolderResponse {
  holders: GraphHolder[];
}

// Contract addresses
const ETHERFI_CONTRACTS = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2" as Address,
    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee" as Address,
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    weETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe" as Address,
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    weETH: "0x346e03F8Cce9fE01dCB3d0Da3e9D00dC2c0E08f0" as Address,
  },
  [SUPPORTED_CHAINS.BASE]: {
    weETH: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A" as Address,
  },
} as const;

/**
 * EtherFi Graph Adapter
 * Optimized for fast position queries via The Graph
 */
export class EtherFiGraphAdapter extends BaseAdapter {
  readonly id = "etherfi";
  readonly name = "Ether.fi";
  readonly category = "staking" as const;
  readonly config: AdapterConfig = {
    supportedChains: [
      SUPPORTED_CHAINS.ETHEREUM,
      SUPPORTED_CHAINS.ARBITRUM,
      SUPPORTED_CHAINS.OPTIMISM,
      SUPPORTED_CHAINS.BASE,
    ],
    contracts: ETHERFI_CONTRACTS,
  };

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    // EtherFi Graph subgraph primarily exists for Ethereum mainnet
    // For L2s, we fall back to RPC as weETH is just an ERC20 balance check
    if (chainId !== SUPPORTED_CHAINS.ETHEREUM) {
      return rpcAdapter.getPositions(walletAddress, chainId);
    }

    // Try Graph first for Ethereum if enabled
    if (USE_GRAPH_ADAPTERS) {
      const graphPositions = await this.getPositionsFromGraph(walletAddress, chainId);
      if (graphPositions !== null) {
        console.log(`[Graph:EtherFi] Chain ${chainId}: Found ${graphPositions.length} positions`);
        return graphPositions;
      }
      console.log(`[Graph:EtherFi] Chain ${chainId}: Falling back to RPC`);
    }

    // Fallback to RPC adapter
    return rpcAdapter.getPositions(walletAddress, chainId);
  }

  private async getPositionsFromGraph(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[] | null> {
    // Try EtherFi-specific subgraph first
    let client = getGraphClient("etherfi", chainId);

    // If no EtherFi-specific subgraph, try the Aave EtherFi market
    if (!client) {
      client = getGraphClient("etherfi-market", chainId);
    }

    if (!client) {
      return null;
    }

    // Get APY from DeFi Llama
    const etherfiApy = await getEtherFiApy();

    // Try staker query first
    const stakerResponse = await executeGraphQuery<StakerResponse>(
      client,
      ETHERFI_STAKER_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (stakerResponse?.staker) {
      return this.parseStakerResponse(stakerResponse.staker, chainId, etherfiApy);
    }

    // Try holder query as fallback
    const holderResponse = await executeGraphQuery<HolderResponse>(
      client,
      ETHERFI_HOLDER_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (holderResponse?.holders && holderResponse.holders.length > 0) {
      return this.parseHolderResponse(holderResponse.holders[0], chainId, etherfiApy);
    }

    // No positions found in subgraph - try RPC as final fallback
    // This handles cases where the subgraph schema doesn't match expectations
    return null;
  }

  private parseStakerResponse(
    staker: GraphStaker,
    chainId: SupportedChainId,
    apy: number | undefined
  ): Position[] {
    const positions: Position[] = [];
    const contracts = ETHERFI_CONTRACTS[chainId as keyof typeof ETHERFI_CONTRACTS];

    // Parse eETH balance
    const eethBalance = BigInt(staker.totalEethBalance || "0");
    if (eethBalance > 0n && "eETH" in contracts) {
      positions.push({
        protocol: this.id,
        chainId,
        positionType: "stake",
        tokenSymbol: "eETH",
        tokenAddress: contracts.eETH,
        tokenDecimals: 18,
        coingeckoId: "ether-fi-staked-eth",
        balanceRaw: eethBalance.toString(),
        balance: this.formatBalance(eethBalance, 18),
        apy,
        metadata: {
          isRebasing: true,
          earnEigenLayerPoints: true,
          earnEtherFiPoints: true,
          shares: staker.shares,
        },
      });
    }

    // Parse weETH balance
    const weethBalance = BigInt(staker.totalWeethBalance || "0");
    if (weethBalance > 0n && contracts.weETH) {
      positions.push({
        protocol: this.id,
        chainId,
        positionType: "stake",
        tokenSymbol: "weETH",
        tokenAddress: contracts.weETH,
        tokenDecimals: 18,
        coingeckoId: "wrapped-eeth",
        balanceRaw: weethBalance.toString(),
        balance: this.formatBalance(weethBalance, 18),
        apy,
        metadata: {
          isRebasing: false,
          earnEigenLayerPoints: true,
          earnEtherFiPoints: true,
        },
      });
    }

    return positions;
  }

  private parseHolderResponse(
    holder: GraphHolder,
    chainId: SupportedChainId,
    apy: number | undefined
  ): Position[] {
    const positions: Position[] = [];
    const contracts = ETHERFI_CONTRACTS[chainId as keyof typeof ETHERFI_CONTRACTS];

    // Parse eETH balance
    const eethBalance = BigInt(holder.eethBalance || "0");
    if (eethBalance > 0n && "eETH" in contracts) {
      positions.push({
        protocol: this.id,
        chainId,
        positionType: "stake",
        tokenSymbol: "eETH",
        tokenAddress: contracts.eETH,
        tokenDecimals: 18,
        coingeckoId: "ether-fi-staked-eth",
        balanceRaw: eethBalance.toString(),
        balance: this.formatBalance(eethBalance, 18),
        apy,
        metadata: {
          isRebasing: true,
          earnEigenLayerPoints: true,
          earnEtherFiPoints: true,
        },
      });
    }

    // Parse weETH balance
    const weethBalance = BigInt(holder.weethBalance || "0");
    if (weethBalance > 0n && contracts.weETH) {
      positions.push({
        protocol: this.id,
        chainId,
        positionType: "stake",
        tokenSymbol: "weETH",
        tokenAddress: contracts.weETH,
        tokenDecimals: 18,
        coingeckoId: "wrapped-eeth",
        balanceRaw: weethBalance.toString(),
        balance: this.formatBalance(weethBalance, 18),
        apy,
        metadata: {
          isRebasing: false,
          earnEigenLayerPoints: true,
          earnEtherFiPoints: true,
          totalEthValue: holder.totalEthValue,
        },
      });
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
    console.log(`[Graph:EtherFi] Total: ${positions.length} positions in ${elapsed}ms`);

    return positions;
  }
}

export const etherfiGraphAdapter = new EtherFiGraphAdapter();
