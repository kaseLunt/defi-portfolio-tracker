import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { strategyManagerAbi, strategyAbi } from "../lib/abis/eigenlayer";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";

// EigenLayer contracts
const EIGENLAYER_CONTRACTS = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    strategyManager: "0x858646372CC42E1A627fcE94aa7A7033e7CF075A" as Address,
  },
} as const;

// EigenLayer strategies and their underlying tokens
const EIGENLAYER_STRATEGIES: {
  address: Address;
  symbol: string;
  underlyingSymbol: string;
  decimals: number;
  coingeckoId: string;
}[] = [
  {
    address: "0x93c4b944D05dfe6df7645A86cd2206016c51564D",
    symbol: "EL-stETH",
    underlyingSymbol: "stETH",
    decimals: 18,
    coingeckoId: "staked-ether",
  },
  {
    address: "0x54945180dB7943c0ed0FEE7EdaB2Bd24620256bc",
    symbol: "EL-cbETH",
    underlyingSymbol: "cbETH",
    decimals: 18,
    coingeckoId: "coinbase-wrapped-staked-eth",
  },
  {
    address: "0x1BeE69b7dFFfA4E2d53C2a2Df135C388AD25dCD2",
    symbol: "EL-rETH",
    underlyingSymbol: "rETH",
    decimals: 18,
    coingeckoId: "rocket-pool-eth",
  },
  {
    address: "0x9d7eD45EE2E8FC5482fa2428f15C971e6369011d",
    symbol: "EL-ETHx",
    underlyingSymbol: "ETHx",
    decimals: 18,
    coingeckoId: "stader-ethx",
  },
  {
    address: "0x13760F50a9d7377e4F20CB8CF9e4c26586c658ff",
    symbol: "EL-ankrETH",
    underlyingSymbol: "ankrETH",
    decimals: 18,
    coingeckoId: "ankreth",
  },
  {
    address: "0xa4C637e0F704745D182e4D38cAb7E7485321d059",
    symbol: "EL-OETH",
    underlyingSymbol: "OETH",
    decimals: 18,
    coingeckoId: "origin-ether",
  },
  {
    address: "0x57ba429517c3473B6d34CA9aCd56c0e735b94c02",
    symbol: "EL-osETH",
    underlyingSymbol: "osETH",
    decimals: 18,
    coingeckoId: "stakewise-staked-eth",
  },
  {
    address: "0x0Fe4F44beE93503346A3Ac9EE5A26b130a5796d6",
    symbol: "EL-swETH",
    underlyingSymbol: "swETH",
    decimals: 18,
    coingeckoId: "sweth",
  },
  {
    address: "0x7CA911E83dabf90C90dD3De5411a10F1A6112184",
    symbol: "EL-wBETH",
    underlyingSymbol: "wBETH",
    decimals: 18,
    coingeckoId: "wrapped-beacon-eth",
  },
  {
    address: "0x8CA7A5d6f3acd3A7A8bC468a8CD0FB14B6BD28b6",
    symbol: "EL-sfrxETH",
    underlyingSymbol: "sfrxETH",
    decimals: 18,
    coingeckoId: "staked-frax-ether",
  },
  {
    address: "0xAe60d8180437b5C34bB956822ac2710972584473",
    symbol: "EL-lsETH",
    underlyingSymbol: "lsETH",
    decimals: 18,
    coingeckoId: "liquid-staked-eth",
  },
  {
    address: "0x298aFB19A105D59E74658C4C334Ff360BadE6dd2",
    symbol: "EL-mETH",
    underlyingSymbol: "mETH",
    decimals: 18,
    coingeckoId: "mantle-staked-ether",
  },
];

export class EigenlayerAdapter extends BaseAdapter {
  readonly id = "eigenlayer";
  readonly name = "EigenLayer";
  readonly category = "staking" as const;
  readonly config: AdapterConfig = {
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM],
    contracts: EIGENLAYER_CONTRACTS,
  };

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    const client = getClient(chainId);
    const positions: Position[] = [];

    // Check each strategy for user deposits
    for (const strategy of EIGENLAYER_STRATEGIES) {
      try {
        // Get user's shares in this strategy
        const shares = await client.readContract({
          address: strategy.address,
          abi: strategyAbi,
          functionName: "shares",
          args: [walletAddress],
        });

        if (shares > 0n) {
          // Convert shares to underlying token amount
          let underlyingAmount = shares;
          try {
            underlyingAmount = await client.readContract({
              address: strategy.address,
              abi: strategyAbi,
              functionName: "sharesToUnderlyingView",
              args: [shares],
            });
          } catch {
            // Use shares as fallback (1:1 ratio)
          }

          positions.push({
            protocol: this.id,
            chainId,
            positionType: "stake",
            tokenSymbol: strategy.underlyingSymbol,
            tokenAddress: strategy.address,
            tokenDecimals: strategy.decimals,
            coingeckoId: strategy.coingeckoId,
            balanceRaw: underlyingAmount.toString(),
            balance: this.formatBalance(underlyingAmount, strategy.decimals),
            metadata: {
              strategyAddress: strategy.address,
              shares: shares.toString(),
              isRestaked: true,
            },
          });
        }
      } catch {
        // Strategy might not exist or user has no position
      }
    }

    return positions;
  }
}

export const eigenlayerAdapter = new EigenlayerAdapter();
