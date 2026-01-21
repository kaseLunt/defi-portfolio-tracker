import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { metaMorphoAbi } from "../lib/abis/morpho";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";

// Popular MetaMorpho vaults
const METAMORPHO_VAULTS: Record<
  SupportedChainId,
  {
    address: Address;
    name: string;
    underlyingSymbol: string;
    underlyingDecimals: number;
    coingeckoId: string;
  }[]
> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    {
      address: "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
      name: "Steakhouse USDC",
      underlyingSymbol: "USDC",
      underlyingDecimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0x78Fc2c2eD1A4cDb5402365934aE5648aDAd094d0",
      name: "Gauntlet USDC Prime",
      underlyingSymbol: "USDC",
      underlyingDecimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0x4881Ef0BF6d2365D3dd6499ccd7532bcdBCE0658",
      name: "Gauntlet WETH Prime",
      underlyingSymbol: "WETH",
      underlyingDecimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0x2371e134e3455e0593363cBF89d3b6cf53740618",
      name: "Flagship USDT",
      underlyingSymbol: "USDT",
      underlyingDecimals: 6,
      coingeckoId: "tether",
    },
    {
      address: "0xd63070114470f685b75B74D60EEc7c1113d33a3D",
      name: "Gauntlet LRT Core",
      underlyingSymbol: "WETH",
      underlyingDecimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0xc582bc0317dbb0e0F950Df3E6E2C7B7002A9Ef78",
      name: "RE7 WETH",
      underlyingSymbol: "WETH",
      underlyingDecimals: 18,
      coingeckoId: "weth",
    },
    {
      address: "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458",
      name: "Usual Boosted USDC",
      underlyingSymbol: "USDC",
      underlyingDecimals: 6,
      coingeckoId: "usd-coin",
    },
  ],
  [SUPPORTED_CHAINS.BASE]: [
    {
      address: "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca",
      name: "Moonwell Flagship USDC",
      underlyingSymbol: "USDC",
      underlyingDecimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      address: "0xa0E430870c4604CcfC7B38Ca7845B1FF653D0ff1",
      name: "Moonwell Flagship ETH",
      underlyingSymbol: "WETH",
      underlyingDecimals: 18,
      coingeckoId: "weth",
    },
  ],
  [SUPPORTED_CHAINS.ARBITRUM]: [],
  [SUPPORTED_CHAINS.OPTIMISM]: [],
  [SUPPORTED_CHAINS.POLYGON]: [],
};

export class MorphoAdapter extends BaseAdapter {
  readonly id = "morpho";
  readonly name = "Morpho";
  readonly category = "yield" as const;
  readonly config: AdapterConfig = {
    supportedChains: [SUPPORTED_CHAINS.ETHEREUM, SUPPORTED_CHAINS.BASE],
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
    const vaults = METAMORPHO_VAULTS[chainId];

    if (!vaults || vaults.length === 0) {
      return [];
    }

    const positions: Position[] = [];

    for (const vault of vaults) {
      try {
        // Get user's vault shares
        const shares = await client.readContract({
          address: vault.address,
          abi: metaMorphoAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (shares > 0n) {
          // Convert shares to underlying assets
          let assets = shares;
          try {
            assets = await client.readContract({
              address: vault.address,
              abi: metaMorphoAbi,
              functionName: "convertToAssets",
              args: [shares],
            });
          } catch {
            // Use shares as fallback
          }

          positions.push({
            protocol: this.id,
            chainId,
            positionType: "vault",
            tokenSymbol: vault.underlyingSymbol,
            tokenAddress: vault.address,
            tokenDecimals: vault.underlyingDecimals,
            coingeckoId: vault.coingeckoId,
            balanceRaw: assets.toString(),
            balance: this.formatBalance(assets, vault.underlyingDecimals),
            metadata: {
              vaultName: vault.name,
              vaultAddress: vault.address,
              shares: shares.toString(),
            },
          });
        }
      } catch {
        // Vault might not exist or user has no position
      }
    }

    return positions;
  }
}

export const morphoAdapter = new MorphoAdapter();
