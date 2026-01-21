import {
  createPublicClient,
  http,
  fallback,
  type PublicClient,
  type Chain,
  type HttpTransport,
  type FallbackTransport,
} from "viem";
import { mainnet, arbitrum, optimism, base, polygon } from "viem/chains";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";

// Chain definitions map
const CHAIN_DEFINITIONS: Record<SupportedChainId, Chain> = {
  [SUPPORTED_CHAINS.ETHEREUM]: mainnet,
  [SUPPORTED_CHAINS.ARBITRUM]: arbitrum,
  [SUPPORTED_CHAINS.OPTIMISM]: optimism,
  [SUPPORTED_CHAINS.BASE]: base,
  [SUPPORTED_CHAINS.POLYGON]: polygon,
};

// RPC endpoints with fallbacks per chain
// Priority: env var > official chain RPC > llamarpc > other free RPCs
const RPC_ENDPOINTS: Record<SupportedChainId, string[]> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    process.env.ALCHEMY_RPC_MAINNET || "",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
    "https://1rpc.io/eth",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.ARBITRUM]: [
    process.env.ALCHEMY_RPC_ARBITRUM || "",
    "https://arb1.arbitrum.io/rpc", // Official Arbitrum RPC
    "https://arbitrum.llamarpc.com",
    "https://1rpc.io/arb",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.OPTIMISM]: [
    process.env.ALCHEMY_RPC_OPTIMISM || "",
    "https://mainnet.optimism.io", // Official Optimism RPC
    "https://optimism.llamarpc.com",
    "https://1rpc.io/op",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.BASE]: [
    process.env.ALCHEMY_RPC_BASE || "",
    "https://mainnet.base.org", // Official Base RPC
    "https://base.llamarpc.com",
    "https://1rpc.io/base",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.POLYGON]: [
    process.env.ALCHEMY_RPC_POLYGON || "",
    "https://polygon-rpc.com", // Official Polygon RPC
    "https://polygon.llamarpc.com",
    "https://1rpc.io/matic",
  ].filter(Boolean),
};

// Client cache to avoid creating new clients on every request
const clientCache = new Map<SupportedChainId, PublicClient>();

/**
 * Get a viem public client for a specific chain with fallback RPC support
 */
export function getClient(
  chainId: SupportedChainId
): PublicClient<FallbackTransport<HttpTransport[]>, Chain> {
  const cached = clientCache.get(chainId);
  if (cached) {
    return cached as PublicClient<FallbackTransport<HttpTransport[]>, Chain>;
  }

  const chain = CHAIN_DEFINITIONS[chainId];
  const rpcUrls = RPC_ENDPOINTS[chainId];

  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  if (!rpcUrls.length) {
    throw new Error(`No RPC endpoints configured for chain ${chainId}`);
  }

  const client = createPublicClient({
    chain,
    transport: fallback(
      rpcUrls.map((url) =>
        http(url, {
          timeout: 10_000,
          retryCount: 2,
          retryDelay: 1000,
        })
      ),
      {
        rank: true,
        retryCount: 3,
      }
    ),
    batch: {
      multicall: true,
    },
  });

  clientCache.set(chainId, client as PublicClient);
  return client;
}

/**
 * Get clients for all supported chains
 */
export function getAllClients(): Map<
  SupportedChainId,
  PublicClient<FallbackTransport<HttpTransport[]>, Chain>
> {
  const clients = new Map<
    SupportedChainId,
    PublicClient<FallbackTransport<HttpTransport[]>, Chain>
  >();

  for (const chainId of Object.values(SUPPORTED_CHAINS)) {
    clients.set(chainId, getClient(chainId));
  }

  return clients;
}

/**
 * Clear the client cache (useful for testing or when RPC config changes)
 */
export function clearClientCache(): void {
  clientCache.clear();
}

/**
 * Check if a chain is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return Object.values(SUPPORTED_CHAINS).includes(chainId as SupportedChainId);
}

// Export chain definitions for external use
export { CHAIN_DEFINITIONS };
