/**
 * Alchemy SDK configuration for WebSocket subscriptions
 */

import { Alchemy, Network } from "alchemy-sdk";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";

// Map chain IDs to Alchemy network enum
const ALCHEMY_NETWORKS: Record<SupportedChainId, Network> = {
  [SUPPORTED_CHAINS.ETHEREUM]: Network.ETH_MAINNET,
  [SUPPORTED_CHAINS.ARBITRUM]: Network.ARB_MAINNET,
  [SUPPORTED_CHAINS.OPTIMISM]: Network.OPT_MAINNET,
  [SUPPORTED_CHAINS.BASE]: Network.BASE_MAINNET,
  [SUPPORTED_CHAINS.POLYGON]: Network.MATIC_MAINNET,
};

// Chain names for logging
export const CHAIN_NAMES: Record<SupportedChainId, string> = {
  [SUPPORTED_CHAINS.ETHEREUM]: "Ethereum",
  [SUPPORTED_CHAINS.ARBITRUM]: "Arbitrum",
  [SUPPORTED_CHAINS.OPTIMISM]: "Optimism",
  [SUPPORTED_CHAINS.BASE]: "Base",
  [SUPPORTED_CHAINS.POLYGON]: "Polygon",
};

// Alchemy instance cache
const alchemyInstances = new Map<SupportedChainId, Alchemy>();

/**
 * Get or create Alchemy instance for a chain
 */
export function getAlchemyInstance(chainId: SupportedChainId): Alchemy {
  let instance = alchemyInstances.get(chainId);

  if (!instance) {
    const apiKey = process.env.ALCHEMY_API_KEY;

    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY environment variable is required");
    }

    instance = new Alchemy({
      apiKey,
      network: ALCHEMY_NETWORKS[chainId],
      // Disable referrer header which causes issues in Node.js
      requestTimeout: 10000,
    });

    alchemyInstances.set(chainId, instance);
  }

  return instance;
}

/**
 * Check if Alchemy is configured
 */
export function isAlchemyConfigured(): boolean {
  return !!process.env.ALCHEMY_API_KEY;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): SupportedChainId[] {
  return Object.values(SUPPORTED_CHAINS) as SupportedChainId[];
}

export { ALCHEMY_NETWORKS };

/**
 * Token balance from Alchemy
 */
export interface AlchemyTokenBalance {
  tokenAddress: string;
  balance: bigint;
  balanceRaw: string;
}

/**
 * Get current ERC20 token balances for a wallet via Alchemy
 * Returns only non-zero balances
 */
export async function getTokenBalancesViaAlchemy(
  walletAddress: string,
  chainId: SupportedChainId
): Promise<AlchemyTokenBalance[]> {
  try {
    const alchemy = getAlchemyInstance(chainId);
    const response = await alchemy.core.getTokenBalances(walletAddress);

    const balances: AlchemyTokenBalance[] = [];

    for (const token of response.tokenBalances) {
      // Skip zero balances
      if (!token.tokenBalance || token.tokenBalance === "0x0" || token.tokenBalance === "0x") {
        continue;
      }

      const balanceRaw = BigInt(token.tokenBalance).toString();
      if (balanceRaw === "0") continue;

      balances.push({
        tokenAddress: token.contractAddress.toLowerCase(),
        balance: BigInt(token.tokenBalance),
        balanceRaw,
      });
    }

    console.log(`[Alchemy] Chain ${chainId}: Found ${balances.length} tokens with non-zero balance`);
    return balances;
  } catch (error) {
    console.error(`[Alchemy] Failed to get token balances for chain ${chainId}:`, error);
    return [];
  }
}
