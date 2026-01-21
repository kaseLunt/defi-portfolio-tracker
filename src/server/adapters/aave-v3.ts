import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { aaveV3PoolDataProviderAbi } from "../lib/abis/aave-v3";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";
import { COINGECKO_IDS } from "../services/price";

// Aave V3 contract addresses per chain
const AAVE_V3_CONTRACTS = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    poolDataProvider: "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3" as Address,
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    poolDataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654" as Address,
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    poolDataProvider: "0xd9Ca4878dd38B021583c1B669905592EAe76E044" as Address,
  },
  [SUPPORTED_CHAINS.BASE]: {
    poolDataProvider: "0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac" as Address,
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    poolDataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654" as Address,
  },
} as const;

// Common tokens to check for Aave positions
// These are the most liquid assets on Aave V3
const COMMON_AAVE_ASSETS: Record<
  SupportedChainId,
  { address: Address; symbol: string; decimals: number; coingeckoId?: string }[]
> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      symbol: "DAI",
      decimals: 18,
      coingeckoId: "dai",
    },
    {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      symbol: "WBTC",
      decimals: 8,
      coingeckoId: "wrapped-bitcoin",
    },
    {
      address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      symbol: "wstETH",
      decimals: 18,
      coingeckoId: "wrapped-steth",
    },
    {
      address: "0xae78736Cd615f374D3085123A210448E74Fc6393",
      symbol: "rETH",
      decimals: 18,
      coingeckoId: "rocket-pool-eth",
    },
    {
      address: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3",
      symbol: "USDe",
      decimals: 18,
      coingeckoId: "ethena-usde",
    },
    {
      address: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
      symbol: "sUSDe",
      decimals: 18,
      coingeckoId: "ethena-staked-usde",
    },
    {
      address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
      symbol: "cbETH",
      decimals: 18,
      coingeckoId: "coinbase-wrapped-staked-eth",
    },
  ],
  [SUPPORTED_CHAINS.ARBITRUM]: [
    {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
      symbol: "WBTC",
      decimals: 8,
      coingeckoId: "wrapped-bitcoin",
    },
    {
      address: "0x5979D7b546E38E414F7E9822514be443A4800529",
      symbol: "wstETH",
      decimals: 18,
      coingeckoId: "wrapped-steth",
    },
  ],
  [SUPPORTED_CHAINS.OPTIMISM]: [
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    {
      address: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
      symbol: "wstETH",
      decimals: 18,
      coingeckoId: "wrapped-steth",
    },
  ],
  [SUPPORTED_CHAINS.BASE]: [
    {
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
      symbol: "wstETH",
      decimals: 18,
      coingeckoId: "wrapped-steth",
    },
    {
      address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
      symbol: "cbETH",
      decimals: 18,
      coingeckoId: "coinbase-wrapped-staked-eth",
    },
  ],
  [SUPPORTED_CHAINS.POLYGON]: [
    {
      address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      symbol: "WETH",
      decimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      symbol: "USDC",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      symbol: "USDT",
      decimals: 6,
      coingeckoId: "tether",
    },
    {
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      symbol: "WMATIC",
      decimals: 18,
      coingeckoId: "wmatic",
    },
    {
      address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      symbol: "WBTC",
      decimals: 8,
      coingeckoId: "wrapped-bitcoin",
    },
    {
      address: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD",
      symbol: "wstETH",
      decimals: 18,
      coingeckoId: "wrapped-steth",
    },
  ],
};

// RAY = 10^27 (Aave's precision for rates)
const RAY = 10n ** 27n;

/**
 * Convert Aave's ray rate to APY percentage
 * Aave rates are already annualized, stored in RAY (10^27) precision
 */
function rayToApy(rayRate: bigint): number {
  // Convert ray to percentage (rate is already annualized)
  return (Number(rayRate) / Number(RAY)) * 100;
}

export class AaveV3Adapter extends BaseAdapter {
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
    contracts: AAVE_V3_CONTRACTS,
  };

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    const client = getClient(chainId);
    const contracts = AAVE_V3_CONTRACTS[chainId as keyof typeof AAVE_V3_CONTRACTS];
    const assets = COMMON_AAVE_ASSETS[chainId];

    if (!contracts || !assets) {
      return [];
    }

    // Use multicall to batch all getUserReserveData calls into a single RPC request
    const multicallContracts = assets.map((asset) => ({
      address: contracts.poolDataProvider,
      abi: aaveV3PoolDataProviderAbi,
      functionName: "getUserReserveData" as const,
      args: [asset.address, walletAddress] as const,
    }));

    // Execute all calls in a single multicall
    let results: Awaited<ReturnType<typeof client.multicall<typeof multicallContracts>>>;

    try {
      results = await client.multicall({
        contracts: multicallContracts,
        allowFailure: true,
      });
    } catch (error) {
      console.error(`Aave V3 multicall failed on chain ${chainId}:`, error);
      return [];
    }

    const positions: Position[] = [];

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const asset = assets[i];

      if (result.status !== "success" || !result.result) {
        continue;
      }

      const [
        currentATokenBalance,
        _currentStableDebt,
        currentVariableDebt,
        _principalStableDebt,
        _scaledVariableDebt,
        _stableBorrowRate,
        liquidityRate,
      ] = result.result;

      // Supply position (aToken balance)
      if (currentATokenBalance > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "supply",
          tokenSymbol: asset.symbol,
          tokenAddress: asset.address,
          tokenDecimals: asset.decimals,
          coingeckoId: asset.coingeckoId || COINGECKO_IDS[asset.symbol],
          balanceRaw: currentATokenBalance.toString(),
          balance: this.formatBalance(currentATokenBalance, asset.decimals),
          apy: rayToApy(liquidityRate),
          metadata: {
            isCollateral: true,
          },
        });
      }

      // Variable borrow position
      if (currentVariableDebt > 0n) {
        positions.push({
          protocol: this.id,
          chainId,
          positionType: "borrow",
          tokenSymbol: asset.symbol,
          tokenAddress: asset.address,
          tokenDecimals: asset.decimals,
          coingeckoId: asset.coingeckoId || COINGECKO_IDS[asset.symbol],
          balanceRaw: currentVariableDebt.toString(),
          balance: this.formatBalance(currentVariableDebt, asset.decimals),
          metadata: {
            borrowType: "variable",
          },
        });
      }
    }

    return positions;
  }
}

// Export singleton instance
export const aaveV3Adapter = new AaveV3Adapter();
