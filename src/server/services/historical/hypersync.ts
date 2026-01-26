/**
 * Envio HyperSync integration for high-performance historical data
 *
 * HyperSync provides free, fast access to historical blockchain data.
 * This replaces GoldRush/Covalent for fetching token transfer history
 * and reconstructing balances at historical timestamps.
 */

import {
  HypersyncClient,
  type Query,
  type Log,
  type LogField,
  type BlockField,
} from "@envio-dev/hypersync-client";
import type { Address } from "viem";
import {
  HYPERSYNC_ENDPOINTS,
  ERC20_TRANSFER_TOPIC,
  type SupportedChainId,
} from "@/lib/constants";
import type { TokenBalance } from "./types";

// Cache HyperSync clients per chain
const clientCache = new Map<SupportedChainId, HypersyncClient>();

/**
 * Get or create HyperSync client for a chain
 */
function getClient(chainId: SupportedChainId): HypersyncClient {
  let client = clientCache.get(chainId);

  if (!client) {
    const endpoint = HYPERSYNC_ENDPOINTS[chainId];
    if (!endpoint) {
      throw new Error(`HyperSync not supported for chain ${chainId}`);
    }

    // HyperSync requires API token (free from https://envio.dev/app/api-tokens)
    client = new HypersyncClient({
      url: endpoint,
      apiToken: process.env.ENVIO_API_TOKEN || "",
    });
    clientCache.set(chainId, client);
  }

  return client;
}

/**
 * Represents a Transfer event
 */
interface TransferEvent {
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  tokenAddress: string;
  from: string;
  to: string;
  value: bigint;
}

// Log fields to select
const LOG_FIELDS: LogField[] = [
  "BlockNumber",
  "TransactionHash",
  "LogIndex",
  "Address",
  "Topic0",
  "Topic1",
  "Topic2",
  "Data",
];

// Block fields for timestamp lookup
const BLOCK_FIELDS: BlockField[] = ["Number", "Timestamp"];

/**
 * Fetch all Transfer events for a wallet (incoming and outgoing)
 * between two block numbers
 */
export async function fetchTransferEvents(
  walletAddress: Address,
  chainId: SupportedChainId,
  fromBlock: number,
  toBlock: number
): Promise<TransferEvent[]> {
  const client = getClient(chainId);
  const normalizedWallet = walletAddress.toLowerCase();

  // Pad address to 32 bytes for topic matching
  const paddedAddress = "0x" + normalizedWallet.slice(2).padStart(64, "0");

  const events: TransferEvent[] = [];

  try {
    // Query for incoming transfers (where wallet is "to")
    const incomingQuery: Query = {
      fromBlock,
      toBlock,
      logs: [
        {
          topics: [
            [ERC20_TRANSFER_TOPIC],
            [], // from - any address
            [paddedAddress], // to - our wallet
          ],
        },
      ],
      fieldSelection: {
        log: LOG_FIELDS,
      },
    };

    // Query for outgoing transfers (where wallet is "from")
    const outgoingQuery: Query = {
      fromBlock,
      toBlock,
      logs: [
        {
          topics: [
            [ERC20_TRANSFER_TOPIC],
            [paddedAddress], // from - our wallet
            [], // to - any address
          ],
        },
      ],
      fieldSelection: {
        log: LOG_FIELDS,
      },
    };

    // Fetch both in parallel
    const [incomingResult, outgoingResult] = await Promise.all([
      client.get(incomingQuery),
      client.get(outgoingQuery),
    ]);

    // Helper to parse log data to BigInt (handles empty "0x" case)
    const parseValue = (data: string | undefined): bigint => {
      if (!data || data === "0x" || data === "") return 0n;
      try {
        return BigInt(data);
      } catch {
        return 0n;
      }
    };

    // Parse incoming events
    for (const log of incomingResult.data?.logs || []) {
      if (!log.topics || log.topics.length < 3) continue;

      const value = parseValue(log.data);
      if (value === 0n) continue; // Skip zero-value transfers

      events.push({
        blockNumber: BigInt(log.blockNumber || 0),
        transactionHash: log.transactionHash || "",
        logIndex: log.logIndex || 0,
        tokenAddress: log.address?.toLowerCase() || "",
        from: "0x" + (log.topics[1]?.slice(26) || "").toLowerCase(),
        to: "0x" + (log.topics[2]?.slice(26) || "").toLowerCase(),
        value,
      });
    }

    // Parse outgoing events
    for (const log of outgoingResult.data?.logs || []) {
      if (!log.topics || log.topics.length < 3) continue;

      const value = parseValue(log.data);
      if (value === 0n) continue; // Skip zero-value transfers

      events.push({
        blockNumber: BigInt(log.blockNumber || 0),
        transactionHash: log.transactionHash || "",
        logIndex: log.logIndex || 0,
        tokenAddress: log.address?.toLowerCase() || "",
        from: "0x" + (log.topics[1]?.slice(26) || "").toLowerCase(),
        to: "0x" + (log.topics[2]?.slice(26) || "").toLowerCase(),
        value,
      });
    }

    // Sort by block number and log index
    events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber - b.blockNumber);
      }
      return a.logIndex - b.logIndex;
    });

    console.log(
      `[HyperSync] Chain ${chainId}: Found ${events.length} transfer events for ${walletAddress.slice(0, 10)}...`
    );

    return events;
  } catch (error) {
    console.error(`[HyperSync] Failed to fetch events for chain ${chainId}:`, error);
    throw error;
  }
}

/**
 * Reconstruct token balances at a specific block by replaying transfer events
 */
export async function reconstructBalancesAtBlock(
  walletAddress: Address,
  chainId: SupportedChainId,
  targetBlock: number,
  fromBlock: number = 0
): Promise<Map<string, bigint>> {
  const normalizedWallet = walletAddress.toLowerCase();
  const balances = new Map<string, bigint>();

  const events = await fetchTransferEvents(
    walletAddress,
    chainId,
    fromBlock,
    targetBlock
  );

  for (const event of events) {
    if (Number(event.blockNumber) > targetBlock) break;

    const currentBalance = balances.get(event.tokenAddress) || 0n;

    if (event.to.toLowerCase() === normalizedWallet) {
      // Incoming transfer - add to balance
      balances.set(event.tokenAddress, currentBalance + event.value);
    } else if (event.from.toLowerCase() === normalizedWallet) {
      // Outgoing transfer - subtract from balance
      balances.set(event.tokenAddress, currentBalance - event.value);
    }
  }

  // Remove zero or negative balances
  for (const [token, balance] of balances.entries()) {
    if (balance <= 0n) {
      balances.delete(token);
    }
  }

  return balances;
}

// Average block times in seconds for each chain
const BLOCK_TIMES: Record<SupportedChainId, number> = {
  1: 12,      // Ethereum
  42161: 0.25, // Arbitrum (250ms)
  10: 2,      // Optimism
  8453: 2,    // Base
  137: 2,     // Polygon
};

// Approximate genesis timestamps (Unix seconds)
const GENESIS_TIMESTAMPS: Record<SupportedChainId, number> = {
  1: 1438269973,      // Ethereum: July 30, 2015
  42161: 1622240000,  // Arbitrum: May 28, 2021
  10: 1636665600,     // Optimism: Nov 11, 2021
  8453: 1686789600,   // Base: June 15, 2023
  137: 1590824836,    // Polygon: May 30, 2020
};

/**
 * Estimate block number for a timestamp using average block time
 * This is faster than binary search and good enough for historical queries
 */
export function estimateBlockForTimestamp(
  chainId: SupportedChainId,
  timestamp: Date,
  currentBlock: number
): number {
  const targetTime = Math.floor(timestamp.getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const blockTime = BLOCK_TIMES[chainId] || 12;
  const genesisTime = GENESIS_TIMESTAMPS[chainId] || 0;

  // If target is before chain genesis, return 0
  if (targetTime < genesisTime) {
    return 0;
  }

  // Estimate blocks from now to target
  const secondsAgo = now - targetTime;
  const blocksAgo = Math.floor(secondsAgo / blockTime);

  // Calculate estimated block, ensuring it's not negative
  const estimatedBlock = Math.max(0, currentBlock - blocksAgo);

  return estimatedBlock;
}

/**
 * Get block number closest to a timestamp using HyperSync binary search
 * NOTE: This is slow due to multiple API calls. Prefer estimateBlockForTimestamp.
 */
export async function getBlockByTimestamp(
  chainId: SupportedChainId,
  timestamp: Date
): Promise<number> {
  const client = getClient(chainId);
  const targetTime = Math.floor(timestamp.getTime() / 1000);

  try {
    // Binary search for the block closest to the target timestamp
    const height = await client.getHeight();

    let low = 0;
    let high = height;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);

      const result = await client.get({
        fromBlock: mid,
        toBlock: mid + 1,
        fieldSelection: {
          block: BLOCK_FIELDS,
        },
      });

      const block = result.data?.blocks?.[0];
      if (!block) {
        // No block found, narrow search
        high = mid;
        continue;
      }

      const blockTime = Number(block.timestamp);

      if (blockTime < targetTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  } catch (error) {
    console.error(`[HyperSync] Failed to get block by timestamp:`, error);
    throw error;
  }
}

// Token metadata cache
const tokenMetadataCache = new Map<string, { symbol: string; decimals: number }>();

/**
 * Get token metadata (symbol, decimals) - cached
 */
async function getTokenMetadata(
  tokenAddress: string,
  _chainId: SupportedChainId
): Promise<{ symbol: string; decimals: number }> {
  const cacheKey = `${_chainId}:${tokenAddress.toLowerCase()}`;

  if (tokenMetadataCache.has(cacheKey)) {
    return tokenMetadataCache.get(cacheKey)!;
  }

  // Default values (we'll try to get real values from RPC or database)
  const defaultMetadata = { symbol: "UNKNOWN", decimals: 18 };

  // For now, return defaults - can be enhanced with RPC calls later
  tokenMetadataCache.set(cacheKey, defaultMetadata);
  return defaultMetadata;
}

/**
 * Get historical balances using HyperSync (drop-in replacement for Covalent)
 */
export async function getHistoricalBalancesViaHyperSync(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamp: Date
): Promise<TokenBalance[]> {
  try {
    // Get the block number for the timestamp
    const targetBlock = await getBlockByTimestamp(chainId, timestamp);

    // Reconstruct balances at that block
    const rawBalances = await reconstructBalancesAtBlock(
      walletAddress,
      chainId,
      targetBlock
    );

    // Convert to TokenBalance format
    const balances: TokenBalance[] = [];

    for (const [tokenAddress, rawBalance] of rawBalances.entries()) {
      const metadata = await getTokenMetadata(tokenAddress, chainId);

      const balance = Number(rawBalance) / Math.pow(10, metadata.decimals);

      if (balance > 0) {
        balances.push({
          tokenAddress,
          tokenSymbol: metadata.symbol,
          tokenDecimals: metadata.decimals,
          balance,
          balanceRaw: rawBalance.toString(),
          chainId,
        });
      }
    }

    return balances;
  } catch (error) {
    console.error(
      `[HyperSync] Failed to get historical balances for chain ${chainId}:`,
      error
    );
    return [];
  }
}

/**
 * Get bulk historical balances for multiple timestamps
 * Uses current balance as anchor and works BACKWARDS through transfer events
 * This properly handles wallets with pre-existing balances
 */
export async function getBulkHistoricalBalancesViaHyperSync(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamps: Date[],
  currentBalances?: TokenBalance[] // Optional: pass current balances to avoid RPC call
): Promise<Map<number, TokenBalance[]>> {
  const results = new Map<number, TokenBalance[]>();

  if (timestamps.length === 0) {
    return results;
  }

  try {
    // Sort timestamps chronologically (oldest first)
    const sortedTimestamps = [...timestamps].sort(
      (a, b) => a.getTime() - b.getTime()
    );

    // Get current chain height first
    const client = getClient(chainId);
    const currentBlock = await client.getHeight();

    // Estimate block numbers for all timestamps (fast, no API calls)
    const blocks = sortedTimestamps.map((ts) =>
      estimateBlockForTimestamp(chainId, ts, currentBlock)
    );

    // Fetch events from earliest timestamp to current block
    // Use earliest block minus a small buffer for safety
    const fromBlock = Math.max(0, blocks[0] - 1000);
    const toBlock = currentBlock;

    console.log(
      `[HyperSync] Chain ${chainId}: Fetching events from block ${fromBlock.toLocaleString()} to ${toBlock.toLocaleString()} (~${((toBlock - fromBlock) / 1000000).toFixed(1)}M blocks)`
    );

    const events = await fetchTransferEvents(
      walletAddress,
      chainId,
      fromBlock,
      toBlock
    );

    // Build current balances map from provided data or empty
    // The caller should provide current balances from Covalent/RPC
    const currentBalanceMap = new Map<string, bigint>();
    if (currentBalances) {
      for (const bal of currentBalances) {
        const rawBalance = BigInt(bal.balanceRaw || "0");
        if (rawBalance > 0n) {
          currentBalanceMap.set(bal.tokenAddress.toLowerCase(), rawBalance);
        }
      }
    }

    // Also track any tokens seen in events (even if not in current balance)
    const allTokens = new Set<string>();
    for (const event of events) {
      allTokens.add(event.tokenAddress.toLowerCase());
    }
    for (const token of currentBalanceMap.keys()) {
      allTokens.add(token);
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // Process timestamps from NEWEST to OLDEST (work backwards from current)
    // Sort blocks descending
    const timestampBlockPairs = sortedTimestamps.map((ts, i) => ({
      timestamp: ts,
      block: blocks[i],
    }));
    timestampBlockPairs.sort((a, b) => b.block - a.block);

    // Start with current balances
    const runningBalances = new Map<string, bigint>(currentBalanceMap);

    // Sort events by block number descending for backward processing
    const sortedEvents = [...events].sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) {
        return Number(b.blockNumber - a.blockNumber);
      }
      return b.logIndex - a.logIndex;
    });

    let eventIndex = 0;

    for (const { timestamp, block } of timestampBlockPairs) {
      // Reverse events from currentBlock down to this block
      while (
        eventIndex < sortedEvents.length &&
        Number(sortedEvents[eventIndex].blockNumber) > block
      ) {
        const event = sortedEvents[eventIndex];
        const tokenAddr = event.tokenAddress.toLowerCase();
        const currentBalance = runningBalances.get(tokenAddr) || 0n;

        // REVERSE the transfer effect (we're going backwards in time)
        if (event.to.toLowerCase() === normalizedWallet) {
          // This was an incoming transfer - SUBTRACT it to get earlier balance
          runningBalances.set(tokenAddr, currentBalance - event.value);
        } else if (event.from.toLowerCase() === normalizedWallet) {
          // This was an outgoing transfer - ADD it back to get earlier balance
          runningBalances.set(tokenAddr, currentBalance + event.value);
        }

        eventIndex++;
      }

      // Convert current running balances to TokenBalance format
      const tokenBalances: TokenBalance[] = [];

      for (const [tokenAddress, rawBalance] of runningBalances.entries()) {
        if (rawBalance <= 0n) continue;

        const metadata = await getTokenMetadata(tokenAddress, chainId);
        const balance = Number(rawBalance) / Math.pow(10, metadata.decimals);

        if (balance > 0) {
          tokenBalances.push({
            tokenAddress,
            tokenSymbol: metadata.symbol,
            tokenDecimals: metadata.decimals,
            balance,
            balanceRaw: rawBalance.toString(),
            chainId,
          });
        }
      }

      results.set(timestamp.getTime(), tokenBalances);
    }

    console.log(
      `[HyperSync] Chain ${chainId}: Reconstructed balances for ${timestamps.length} timestamps using ${events.length} events`
    );

    return results;
  } catch (error) {
    console.error(
      `[HyperSync] Failed to get bulk historical balances for chain ${chainId}:`,
      error
    );

    // Return empty results for all timestamps
    for (const timestamp of timestamps) {
      results.set(timestamp.getTime(), []);
    }

    return results;
  }
}

/**
 * Check if HyperSync is available for a chain
 */
export function isHyperSyncAvailable(chainId: SupportedChainId): boolean {
  return chainId in HYPERSYNC_ENDPOINTS;
}
