import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { pendlePTAbi, pendleYTAbi } from "../lib/abis/pendle";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";

// Popular Pendle PT/YT tokens to track
const PENDLE_TOKENS: Record<
  SupportedChainId,
  {
    pt: Address;
    yt: Address;
    symbol: string;
    underlying: string;
    decimals: number;
    coingeckoId: string;
    expiry: string;
  }[]
> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    {
      pt: "0xc69Ad9baB1dEE23F4605a82b3354F8E40d1E5966",
      yt: "0xfb35Fd0095dD1096b1Ca49AD44d8C5812A201677",
      symbol: "weETH",
      underlying: "weETH",
      decimals: 18,
      coingeckoId: "wrapped-eeth",
      expiry: "26DEC2024",
    },
    {
      pt: "0x6ee2b5E19ECBa773a352E5B21415Dc419A700d1d",
      yt: "0x129e6B5DBC0Ecc12F9e486C5BC9cDF1a6A80bc6A",
      symbol: "eETH",
      underlying: "eETH",
      decimals: 18,
      coingeckoId: "ether-fi-staked-eth",
      expiry: "26DEC2024",
    },
    {
      pt: "0x7758896b6AC966BbABcf143eFA963030f17D3EdF",
      yt: "0x3568f1d2e8058E3dA730C1e5a72b715aE9A7D4cB",
      symbol: "sUSDe",
      underlying: "sUSDe",
      decimals: 18,
      coingeckoId: "ethena-staked-usde",
      expiry: "27MAR2025",
    },
  ],
  [SUPPORTED_CHAINS.ARBITRUM]: [
    {
      pt: "0x1c27Ad8a19Ba026ADaBD615F6Bc77158130cfBE4",
      yt: "0x30aE5a92bbDE5252bA49C58cd05d047dfa87dAFE",
      symbol: "weETH",
      underlying: "weETH",
      decimals: 18,
      coingeckoId: "wrapped-eeth",
      expiry: "26DEC2024",
    },
    {
      pt: "0x8EA5040d423410f1fdc363379Af88e1DB5eA1C34",
      yt: "0x1E3d13932C31d7355fCb3FEc680b0cD159dC28e7",
      symbol: "rsETH",
      underlying: "rsETH",
      decimals: 18,
      coingeckoId: "kelp-dao-restaked-eth",
      expiry: "26DEC2024",
    },
  ],
  [SUPPORTED_CHAINS.OPTIMISM]: [],
  [SUPPORTED_CHAINS.BASE]: [],
  [SUPPORTED_CHAINS.POLYGON]: [],
};

export class PendleAdapter extends BaseAdapter {
  readonly id = "pendle";
  readonly name = "Pendle";
  readonly category = "yield" as const;
  readonly config: AdapterConfig = {
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM, SUPPORTED_CHAINS.ARBITRUM],
    contracts: {},
  };

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    const client = getClient(chainId);
    const tokens = PENDLE_TOKENS[chainId];

    if (!tokens || tokens.length === 0) {
      return [];
    }

    const positions: Position[] = [];

    for (const token of tokens) {
      // Check PT balance
      try {
        const ptBalance = await client.readContract({
          address: token.pt,
          abi: pendlePTAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (ptBalance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "vault",
            tokenSymbol: `PT-${token.symbol}`,
            tokenAddress: token.pt,
            tokenDecimals: token.decimals,
            coingeckoId: token.coingeckoId,
            balanceRaw: ptBalance.toString(),
            balance: this.formatBalance(ptBalance, token.decimals),
            metadata: {
              tokenType: "PT",
              underlying: token.underlying,
              expiry: token.expiry,
            },
          });
        }
      } catch {
        // PT might not exist
      }

      // Check YT balance
      try {
        const ytBalance = await client.readContract({
          address: token.yt,
          abi: pendleYTAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (ytBalance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "vault",
            tokenSymbol: `YT-${token.symbol}`,
            tokenAddress: token.yt,
            tokenDecimals: token.decimals,
            coingeckoId: token.coingeckoId,
            balanceRaw: ytBalance.toString(),
            balance: this.formatBalance(ytBalance, token.decimals),
            metadata: {
              tokenType: "YT",
              underlying: token.underlying,
              expiry: token.expiry,
            },
          });
        }
      } catch {
        // YT might not exist
      }
    }

    return positions;
  }
}

export const pendleAdapter = new PendleAdapter();
