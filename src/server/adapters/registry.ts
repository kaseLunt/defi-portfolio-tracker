import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";
import type { ProtocolAdapter, Position } from "./types";

// Graph-based adapters (fast, uses The Graph subgraphs)
import { aaveV3GraphAdapter } from "./graph/adapters/aave-v3";
import { compoundV3GraphAdapter } from "./graph/adapters/compound-v3";
import { lidoGraphAdapter } from "./graph/adapters/lido";
import { etherfiGraphAdapter } from "./graph/adapters/etherfi";
import { USE_GRAPH_ADAPTERS } from "./graph/client";

// RPC-based adapters (fallback when Graph not available)
import { lidoAdapter } from "./lido";
import { etherfiAdapter } from "./etherfi";
import { aaveV3Adapter } from "./aave-v3";
import { compoundV3Adapter } from "./compound-v3";
import { sparkAdapter } from "./spark";
import { eigenlayerAdapter } from "./eigenlayer";
import { morphoAdapter } from "./morpho";
import { pendleAdapter } from "./pendle";
import { getFromCache, setInCache } from "../lib/redis";

// Cache DeFi positions for 2 minutes (RPC calls are expensive)
const POSITIONS_CACHE_TTL = 120;

/**
 * Registry of all protocol adapters
 *
 * When USE_GRAPH_ADAPTERS is enabled, uses The Graph subgraphs for
 * fast, indexed queries (~100-500ms) instead of slow RPC calls (~3-8s).
 * Graph adapters automatically fall back to RPC on failure.
 */
class AdapterRegistry {
  private adapters: Map<string, ProtocolAdapter> = new Map();

  constructor() {
    // Log adapter mode
    if (USE_GRAPH_ADAPTERS) {
      console.log("[Adapters] Using Graph-based adapters (fast mode)");
    } else {
      console.log("[Adapters] Using RPC-based adapters (standard mode)");
    }

    // Register adapters based on mode
    // Graph adapters have internal RPC fallback, so they're always safe to use
    if (USE_GRAPH_ADAPTERS) {
      // Graph-accelerated adapters (verified working with correct subgraph IDs)
      this.register(aaveV3GraphAdapter);
      this.register(compoundV3GraphAdapter); // Using Paperclip Labs subgraphs

      // These protocols use RPC (Graph subgraphs don't track token balances)
      this.register(lidoAdapter);         // Lido subgraph in transfer, use RPC
      this.register(etherfiAdapter);      // EtherFi subgraph tracks validators not balances

      // Protocols without Graph subgraphs (use RPC)
      this.register(sparkAdapter);
      this.register(eigenlayerAdapter);
      this.register(morphoAdapter);
      this.register(pendleAdapter);
    } else {
      // All RPC-based adapters
      this.register(lidoAdapter);
      this.register(etherfiAdapter);
      this.register(aaveV3Adapter);
      this.register(compoundV3Adapter);
      this.register(sparkAdapter);
      this.register(eigenlayerAdapter);
      this.register(morphoAdapter);
      this.register(pendleAdapter);
    }
  }

  /**
   * Register a new adapter
   */
  register(adapter: ProtocolAdapter): void {
    if (this.adapters.has(adapter.id)) {
      console.warn(`Adapter ${adapter.id} is already registered, replacing...`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Get adapter by ID
   */
  get(id: string): ProtocolAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get all registered adapters
   */
  getAll(): ProtocolAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get adapters that support a specific chain
   */
  getByChain(chainId: SupportedChainId): ProtocolAdapter[] {
    return this.getAll().filter((adapter) => adapter.supportsChain(chainId));
  }

  /**
   * Get positions from a specific protocol
   */
  async getPositionsFromProtocol(
    protocolId: string,
    walletAddress: Address,
    chainId?: SupportedChainId
  ): Promise<Position[]> {
    const adapter = this.get(protocolId);
    if (!adapter) {
      console.warn(`No adapter found for protocol: ${protocolId}`);
      return [];
    }

    if (chainId) {
      return adapter.getPositions(walletAddress, chainId);
    }
    return adapter.getAllPositions(walletAddress);
  }

  /**
   * Get all positions from all protocols on a specific chain
   */
  async getAllPositionsOnChain(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]> {
    const adapters = this.getByChain(chainId);
    const results = await Promise.allSettled(
      adapters.map((adapter) => adapter.getPositions(walletAddress, chainId))
    );

    const positions: Position[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        positions.push(...result.value);
      }
    }

    return positions;
  }

  /**
   * Get all positions from all protocols across all chains
   * Results are cached for 2 minutes per wallet
   */
  async getAllPositions(walletAddress: Address): Promise<Position[]> {
    // Check cache first
    const cacheKey = `defi-positions:${walletAddress.toLowerCase()}`;
    const cached = await getFromCache<Position[]>(cacheKey);
    if (cached) {
      console.log(`[Adapters] Cache HIT for ${walletAddress.slice(0, 10)}...`);
      return cached;
    }

    console.log(`[Adapters] Cache MISS for ${walletAddress.slice(0, 10)}...`);
    const adapters = this.getAll();
    const results = await Promise.allSettled(
      adapters.map((adapter) => adapter.getAllPositions(walletAddress))
    );

    const positions: Position[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        positions.push(...result.value);
      }
    }

    // Cache the result
    await setInCache(cacheKey, positions, POSITIONS_CACHE_TTL);

    return positions;
  }

  /**
   * List all registered protocol IDs
   */
  listProtocols(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Export singleton instance
export const adapterRegistry = new AdapterRegistry();
