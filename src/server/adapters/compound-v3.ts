import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { cometAbi } from "../lib/abis/compound-v3";
import { erc20Abi } from "../lib/abis/erc20";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";

// Compound V3 Comet markets
const COMPOUND_V3_MARKETS: Record<
  SupportedChainId,
  {
    address: Address;
    baseToken: { symbol: string; decimals: number; coingeckoId: string };
    name: string;
  }[]
> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    {
      address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
      baseToken: { symbol: "USDC", decimals: 6, coingeckoId: "usd-coin" },
      name: "USDC Market",
    },
    {
      address: "0xA17581A9E3356d9A858b789D68B4d866e593aE94",
      baseToken: { symbol: "WETH", decimals: 18, coingeckoId: "weth" },
      name: "ETH Market",
    },
    {
      address: "0x3Afdc9BCA9213A35503b077a6072F3D0d5AB0840",
      baseToken: { symbol: "USDT", decimals: 6, coingeckoId: "tether" },
      name: "USDT Market",
    },
  ],
  [SUPPORTED_CHAINS.ARBITRUM]: [
    {
      address: "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA",
      baseToken: { symbol: "USDC.e", decimals: 6, coingeckoId: "usd-coin" },
      name: "USDC.e Market",
    },
    {
      address: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
      baseToken: { symbol: "USDC", decimals: 6, coingeckoId: "usd-coin" },
      name: "USDC Market",
    },
  ],
  [SUPPORTED_CHAINS.BASE]: [
    {
      address: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
      baseToken: { symbol: "USDC", decimals: 6, coingeckoId: "usd-coin" },
      name: "USDC Market",
    },
    {
      address: "0x46e6b214b524310239732D51387075E0e70970bf",
      baseToken: { symbol: "WETH", decimals: 18, coingeckoId: "weth" },
      name: "ETH Market",
    },
  ],
  [SUPPORTED_CHAINS.POLYGON]: [
    {
      address: "0xF25212E676D1F7F89Cd72fFEe66158f541246445",
      baseToken: { symbol: "USDC", decimals: 6, coingeckoId: "usd-coin" },
      name: "USDC Market",
    },
  ],
  [SUPPORTED_CHAINS.OPTIMISM]: [
    {
      address: "0x2e44e174f7D53F0212823acC11C01A11d58c5bCB",
      baseToken: { symbol: "USDC", decimals: 6, coingeckoId: "usd-coin" },
      name: "USDC Market",
    },
  ],
};

// Seconds per year for APY calculation
const SECONDS_PER_YEAR = 31536000;

/**
 * Convert Compound V3 rate to APY percentage
 * Compound V3 rates are per-second rates scaled by 1e18
 */
function rateToApy(ratePerSecond: bigint): number {
  const rate = Number(ratePerSecond) / 1e18;
  // APY = (1 + rate)^secondsPerYear - 1
  // For small rates, this approximates to rate * secondsPerYear
  return rate * SECONDS_PER_YEAR * 100;
}

export class CompoundV3Adapter extends BaseAdapter {
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

    const client = getClient(chainId);
    const markets = COMPOUND_V3_MARKETS[chainId];

    if (!markets || markets.length === 0) {
      return [];
    }

    const positions: Position[] = [];

    for (const market of markets) {
      try {
        // Get supply balance (base token supplied)
        const supplyBalance = await client.readContract({
          address: market.address,
          abi: cometAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        // Get borrow balance
        const borrowBalance = await client.readContract({
          address: market.address,
          abi: cometAbi,
          functionName: "borrowBalanceOf",
          args: [walletAddress],
        });

        // Get supply rate
        let supplyApy = 0;
        let borrowApy = 0;
        try {
          const supplyRate = await client.readContract({
            address: market.address,
            abi: cometAbi,
            functionName: "getSupplyRate",
            args: [],
          });
          supplyApy = rateToApy(supplyRate);

          const borrowRate = await client.readContract({
            address: market.address,
            abi: cometAbi,
            functionName: "getBorrowRate",
            args: [],
          });
          borrowApy = rateToApy(borrowRate);
        } catch {
          // Rates are optional
        }

        // Add supply position if balance > 0
        if (supplyBalance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "supply",
            tokenSymbol: market.baseToken.symbol,
            tokenAddress: market.address, // Comet address acts as cToken
            tokenDecimals: market.baseToken.decimals,
            coingeckoId: market.baseToken.coingeckoId,
            balanceRaw: supplyBalance.toString(),
            balance: this.formatBalance(supplyBalance, market.baseToken.decimals),
            apy: supplyApy,
            metadata: {
              market: market.name,
            },
          });
        }

        // Add borrow position if balance > 0
        if (borrowBalance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "borrow",
            tokenSymbol: market.baseToken.symbol,
            tokenAddress: market.address,
            tokenDecimals: market.baseToken.decimals,
            coingeckoId: market.baseToken.coingeckoId,
            balanceRaw: borrowBalance.toString(),
            balance: this.formatBalance(borrowBalance, market.baseToken.decimals),
            apy: borrowApy,
            metadata: {
              market: market.name,
            },
          });
        }
      } catch (error) {
        console.error(
          `Failed to fetch Compound V3 position for market ${market.name} on chain ${chainId}:`,
          error
        );
      }
    }

    return positions;
  }
}

// Export singleton instance
export const compoundV3Adapter = new CompoundV3Adapter();
