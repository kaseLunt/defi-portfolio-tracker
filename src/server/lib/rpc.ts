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

// Build Alchemy URL from API key
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "";
const buildAlchemyUrl = (network: string) =>
  ALCHEMY_API_KEY ? `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : "";

// Chain definitions map
const CHAIN_DEFINITIONS: Record<SupportedChainId, Chain> = {
  [SUPPORTED_CHAINS.ETHEREUM]: mainnet,
  [SUPPORTED_CHAINS.ARBITRUM]: arbitrum,
  [SUPPORTED_CHAINS.OPTIMISM]: optimism,
  [SUPPORTED_CHAINS.BASE]: base,
  [SUPPORTED_CHAINS.POLYGON]: polygon,
};

// RPC endpoints with fallbacks per chain
// Priority: Alchemy (from API key) > env var > official chain RPC > llamarpc
const RPC_ENDPOINTS: Record<SupportedChainId, string[]> = {
  [SUPPORTED_CHAINS.ETHEREUM]: [
    buildAlchemyUrl("eth-mainnet"),
    process.env.ALCHEMY_RPC_MAINNET || "",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.ARBITRUM]: [
    buildAlchemyUrl("arb-mainnet"),
    process.env.ALCHEMY_RPC_ARBITRUM || "",
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.llamarpc.com",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.OPTIMISM]: [
    buildAlchemyUrl("opt-mainnet"),
    process.env.ALCHEMY_RPC_OPTIMISM || "",
    "https://mainnet.optimism.io",
    "https://optimism.llamarpc.com",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.BASE]: [
    buildAlchemyUrl("base-mainnet"),
    process.env.ALCHEMY_RPC_BASE || "",
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
  ].filter(Boolean),
  [SUPPORTED_CHAINS.POLYGON]: [
    buildAlchemyUrl("polygon-mainnet"),
    process.env.ALCHEMY_RPC_POLYGON || "",
    "https://polygon-rpc.com",
    "https://polygon.llamarpc.com",
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
