import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";
import type { ProtocolAdapter, Position } from "./types";
import { lidoAdapter } from "./lido";
import { etherfiAdapter } from "./etherfi";
import { aaveV3Adapter } from "./aave-v3";
import { compoundV3Adapter } from "./compound-v3";
import { sparkAdapter } from "./spark";
import { eigenlayerAdapter } from "./eigenlayer";
import { morphoAdapter } from "./morpho";
import { pendleAdapter } from "./pendle";

/**
 * Registry of all protocol adapters
 */
class AdapterRegistry {
  private adapters: Map<string, ProtocolAdapter> = new Map();

  constructor() {
    // Register all adapters
    this.register(lidoAdapter);
    this.register(etherfiAdapter);
    this.register(aaveV3Adapter);
    this.register(compoundV3Adapter);
    this.register(sparkAdapter);
    this.register(eigenlayerAdapter);
    this.register(morphoAdapter);
    this.register(pendleAdapter);
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
   */
  async getAllPositions(walletAddress: Address): Promise<Position[]> {
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
