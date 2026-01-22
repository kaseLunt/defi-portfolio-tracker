import type { Address } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { getClient } from "../lib/rpc";
import { stETHAbi, wstETHAbi } from "../lib/abis/lido";
import { BaseAdapter, type AdapterConfig, type Position } from "./types";
import { getLidoApy } from "../services/yields";

// Lido contract addresses
const LIDO_CONTRACTS = {
  [SUPPORTED_CHAINS.ETHEREUM]: {
    stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address,
    wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address,
  },
  [SUPPORTED_CHAINS.ARBITRUM]: {
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529" as Address,
  },
  [SUPPORTED_CHAINS.OPTIMISM]: {
    wstETH: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb" as Address,
  },
  [SUPPORTED_CHAINS.BASE]: {
    wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address,
  },
  [SUPPORTED_CHAINS.POLYGON]: {
    wstETH: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD" as Address,
  },
} as const;

export class LidoAdapter extends BaseAdapter {
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
    contracts: LIDO_CONTRACTS,
  };

  async getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    if (!this.supportsChain(chainId)) {
      return [];
    }

    const client = getClient(chainId);
    const contracts = LIDO_CONTRACTS[chainId as keyof typeof LIDO_CONTRACTS];
    const positions: Position[] = [];

    // Fetch real APY from DeFi Llama
    const lidoApy = await getLidoApy();

    // Only Ethereum has native stETH
    if (chainId === SUPPORTED_CHAINS.ETHEREUM && "stETH" in contracts) {
      const stETHAddress = contracts.stETH as Address;
      try {
        const balance = await client.readContract({
          address: stETHAddress,
          abi: stETHAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (balance > 0n) {
          positions.push({
            protocol: this.id,
            chainId,
            positionType: "stake",
            tokenSymbol: "stETH",
            tokenAddress: stETHAddress,
            tokenDecimals: 18,
            coingeckoId: "staked-ether",
            balanceRaw: balance.toString(),
            balance: this.formatBalance(balance, 18),
            apy: lidoApy,
            metadata: {
              isRebasing: true,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to fetch stETH balance on chain ${chainId}:`, error);
      }
    }

    // All chains have wstETH (bridged)
    if (contracts.wstETH) {
      try {
        const balance = await client.readContract({
          address: contracts.wstETH,
          abi: wstETHAbi,
          functionName: "balanceOf",
          args: [walletAddress],
        });

        if (balance > 0n) {
          // Get stETH equivalent if on mainnet
          let stEthEquivalent: bigint | undefined;
          if (chainId === SUPPORTED_CHAINS.ETHEREUM) {
            try {
              stEthEquivalent = await client.readContract({
                address: contracts.wstETH,
                abi: wstETHAbi,
                functionName: "getStETHByWstETH",
                args: [balance],
              });
            } catch {
              // Ignore - stETH equivalent is optional
            }
          }

          positions.push({
            protocol: this.id,
            chainId,
            positionType: "stake",
            tokenSymbol: "wstETH",
            tokenAddress: contracts.wstETH,
            tokenDecimals: 18,
            coingeckoId: "wrapped-steth",
            balanceRaw: balance.toString(),
            balance: this.formatBalance(balance, 18),
            apy: lidoApy,
            metadata: {
              isRebasing: false,
              ...(stEthEquivalent && {
                stEthEquivalent: stEthEquivalent.toString(),
              }),
            },
          });
        }
      } catch (error) {
        console.error(`Failed to fetch wstETH balance on chain ${chainId}:`, error);
      }
    }

    return positions;
  }
}

// Export singleton instance
export const lidoAdapter = new LidoAdapter();
