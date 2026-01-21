import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { aaveV3PoolDataProviderAbi } from "../lib/abis/aave-v3";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";

// Spark is a fork of Aave V3 by MakerDAO
const SPARK_CONTRACTS = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    poolDataProvider: "0xFc21d6d146E6086B8359705C8b28512a983db0cb" as Address,
  },
} as const;

// Spark supported assets on Ethereum
const SPARK_ASSETS = [
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
    symbol: "WETH",
    decimals: 18,
    coingeckoId: "weth",
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address,
    symbol: "DAI",
    decimals: 18,
    coingeckoId: "dai",
  },
  {
    address: "0x83F20F44975D03b1b09e64809B757c47f942BEeA" as Address,
    symbol: "sDAI",
    decimals: 18,
    coingeckoId: "savings-dai",
  },
  {
    address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address,
    symbol: "wstETH",
    decimals: 18,
    coingeckoId: "wrapped-steth",
  },
  {
    address: "0xae78736Cd615f374D3085123A210448E74Fc6393" as Address,
    symbol: "rETH",
    decimals: 18,
    coingeckoId: "rocket-pool-eth",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address,
    symbol: "WBTC",
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    symbol: "USDC",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
    symbol: "USDT",
    decimals: 6,
    coingeckoId: "tether",
  },
];

// RAY = 10^27 (same as Aave)
const RAY = 10n ** 27n;

function rayToApy(rayRate: bigint): number {
  return (Number(rayRate) / Number(RAY)) * 100;
}

export class SparkAdapter extends BaseAdapter {
  readonly id = "spark";
  readonly name = "Spark";
  readonly category = "lending" as const;
  readonly config: AdapterConfig = {
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM],
    contracts: SPARK_CONTRACTS,
  };

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    const client = getClient(chainId);
    const contracts = SPARK_CONTRACTS[chainId as keyof typeof SPARK_CONTRACTS];

    if (!contracts) {
      return [];
    }

    const positions: Position[] = [];

    for (const asset of SPARK_ASSETS) {
      try {
        const userData = await client.readContract({
          address: contracts.poolDataProvider,
          abi: aaveV3PoolDataProviderAbi,
          functionName: "getUserReserveData",
          args: [asset.address, walletAddress],
        });

        const [
          currentATokenBalance,
          _currentStableDebt,
          currentVariableDebt,
          _principalStableDebt,
          _scaledVariableDebt,
          _stableBorrowRate,
          liquidityRate,
        ] = userData;

        if (currentATokenBalance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "supply",
            tokenSymbol: asset.symbol,
            tokenAddress: asset.address,
            tokenDecimals: asset.decimals,
            coingeckoId: asset.coingeckoId,
            balanceRaw: currentATokenBalance.toString(),
            balance: this.formatBalance(currentATokenBalance, asset.decimals),
            apy: rayToApy(liquidityRate),
            metadata: {},
          });
        }

        if (currentVariableDebt > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "borrow",
            tokenSymbol: asset.symbol,
            tokenAddress: asset.address,
            tokenDecimals: asset.decimals,
            coingeckoId: asset.coingeckoId,
            balanceRaw: currentVariableDebt.toString(),
            balance: this.formatBalance(currentVariableDebt, asset.decimals),
            metadata: {
              borrowType: "variable",
            },
          });
        }
      } catch {
        // Asset might not exist in Spark
      }
    }

    return positions;
  }
}

export const sparkAdapter = new SparkAdapter();
