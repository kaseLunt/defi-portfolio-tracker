import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";

/**
 * Position type classification
 */
export type PositionType = "supply" | "borrow" | "stake" | "lp" | "vault";

/**
 * Represents a single DeFi position
 */
export interface Position {
  /** Protocol identifier (e.g., "lido", "aave-v3") */
  protocol: string;
  /** Chain ID where position exists */
  chainId: SupportedChainId;
  /** Type of position */
  positionType: PositionType;
  /** Token symbol (e.g., "stETH", "USDC") */
  tokenSymbol: string;
  /** Token address */
  tokenAddress: Address;
  /** Token decimals */
  tokenDecimals: number;
  /** CoinGecko ID for price lookup */
  coingeckoId?: string;
  /** Raw balance as bigint string */
  balanceRaw: string;
  /** Human-readable balance (after decimal conversion) */
  balance: number;
  /** USD value (requires price data) */
  balanceUsd?: number;
  /** Current APY if applicable */
  apy?: number;
  /** Any accrued rewards */
  rewards?: {
    tokenSymbol: string;
    tokenAddress: Address;
    amount: string;
    amountUsd?: number;
  }[];
  /** Protocol-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Supported chain IDs */
  supportedChains: SupportedChainId[];
  /** Contract addresses per chain (only for supported chains) */
  contracts: Partial<Record<SupportedChainId, Record<string, Address>>>;
}

/**
 * Protocol adapter interface
 * Each DeFi protocol implements this interface to fetch user positions
 */
export interface ProtocolAdapter {
  /** Protocol identifier (must match database slug) */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Protocol category */
  readonly category: "lending" | "staking" | "dex" | "yield";
  /** Adapter configuration */
  readonly config: AdapterConfig;

  /**
   * Check if this adapter supports a specific chain
   */
  supportsChain(chainId: SupportedChainId): boolean;

  /**
   * Get all positions for a wallet address on a specific chain
   * @param walletAddress User's wallet address
   * @param chainId Chain to query
   * @returns Array of positions
   */
  getPositions(walletAddress: Address, chainId: SupportedChainId): Promise<Position[]>;

  /**
   * Get positions across all supported chains
   * @param walletAddress User's wallet address
   * @returns Array of positions from all chains
   */
  getAllPositions(walletAddress: Address): Promise<Position[]>;
}

/**
 * Base adapter class with common functionality
 */
export abstract class BaseAdapter implements ProtocolAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly category: "lending" | "staking" | "dex" | "yield";
  abstract readonly config: AdapterConfig;

  supportsChain(chainId: SupportedChainId): boolean {
    return this.config.supportedChains.includes(chainId);
  }

  abstract getPositions(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<Position[]>;

  async getAllPositions(walletAddress: Address): Promise<Position[]> {
    const results = await Promise.allSettled(
      this.config.supportedChains.map((chainId) =>
        this.getPositions(walletAddress, chainId)
      )
    );

    const positions: Position[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        positions.push(...result.value);
      } else {
        console.error(`Failed to fetch positions:`, result.reason);
      }
    }

    return positions;
  }

  /**
   * Convert raw balance to human-readable format
   */
  protected formatBalance(rawBalance: bigint, decimals: number): number {
    return Number(rawBalance) / Math.pow(10, decimals);
  }
}
