import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { eETHAbi, weETHAbi } from "../lib/abis/etherfi";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";

// Ether.fi contract addresses
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

// Approximate Ether.fi staking APY (base staking + EigenLayer points)
const ETHERFI_APY = 3.8;

export class EtherFiAdapter extends BaseAdapter {
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

    const client = getClient(chainId);
    const contracts = ETHERFI_CONTRACTS[chainId as keyof typeof ETHERFI_CONTRACTS];

    if (!contracts) {
      return [];
    }

    const positions: Position[] = [];

    // Only Ethereum mainnet has native eETH
    if (chainId === SUPPORTED_CHAINS.ETHEREUM && "eETH" in contracts) {
      try {
        const balance = await client.readContract({
          address: contracts.eETH,
          abi: eETHAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (balance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "stake",
            tokenSymbol: "eETH",
            tokenAddress: contracts.eETH,
            tokenDecimals: 18,
            coingeckoId: "ether-fi-staked-eth",
            balanceRaw: balance.toString(),
            balance: this.formatBalance(balance, 18),
            apy: ETHERFI_APY,
            metadata: {
              isRebasing: true,
              earnEigenLayerPoints: true,
              earnEtherFiPoints: true,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to fetch eETH balance on chain ${chainId}:`, error);
      }
    }

    // All supported chains have weETH (native or bridged)
    if (contracts.weETH) {
      try {
        const balance = await client.readContract({
          address: contracts.weETH,
          abi: weETHAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (balance > 0n) {
          // Get eETH equivalent if on mainnet
          let eEthEquivalent: bigint | undefined;
          let exchangeRate: bigint | undefined;

          if (chainId === SUPPORTED_CHAINS.ETHEREUM) {
            try {
              [eEthEquivalent, exchangeRate] = await Promise.all([
                client.readContract({
                  address: contracts.weETH,
                  abi: weETHAbi,
                  functionName: "getEETHByWeETH",
                  args: [balance],
                }),
                client.readContract({
                  address: contracts.weETH,
                  abi: weETHAbi,
                  functionName: "getRate",
                }),
              ]);
            } catch {
              // Ignore - equivalent values are optional
            }
          }

          positions.push({
            protocol: this.id,
            chainId,
            positionType: "stake",
            tokenSymbol: "weETH",
            tokenAddress: contracts.weETH,
            tokenDecimals: 18,
            coingeckoId: "wrapped-eeth",
            balanceRaw: balance.toString(),
            balance: this.formatBalance(balance, 18),
            apy: ETHERFI_APY,
            metadata: {
              isRebasing: false,
              earnEigenLayerPoints: true,
              earnEtherFiPoints: true,
              ...(eEthEquivalent && {
                eEthEquivalent: eEthEquivalent.toString(),
              }),
              ...(exchangeRate && {
                exchangeRate: this.formatBalance(exchangeRate, 18),
              }),
            },
          });
        }
      } catch (error) {
        console.error(`Failed to fetch weETH balance on chain ${chainId}:`, error);
      }
    }

    return positions;
  }
}

// Export singleton instance
export const etherfiAdapter = new EtherFiAdapter();
