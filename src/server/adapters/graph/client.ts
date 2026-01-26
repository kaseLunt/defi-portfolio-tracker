/**
 * The Graph Client for DeFi Protocol Queries
 *
 * This module provides a centralized GraphQL client for querying protocol subgraphs.
 * Using The Graph's decentralized indexing infrastructure for sub-second query times
 * instead of slow RPC calls.
 */

import { GraphQLClient } from "graphql-request";
import type { SupportedChainId } from "@/lib/constants";
import { SUPPORTED_CHAINS } from "@/lib/constants";

// Feature flag for Graph adapters
export const USE_GRAPH_ADAPTERS = process.env.USE_GRAPH_ADAPTERS === "true";

// The Graph Gateway endpoint
const GRAPH_GATEWAY = "https://gateway.thegraph.com/api";

/**
 * Subgraph deployment IDs per protocol per chain
 * These are the official, verified subgraph deployments from The Graph Explorer
 *
 * Sources:
 * - Aave: https://github.com/aave/protocol-subgraphs
 * - Compound: https://github.com/papercliplabs/compound-v3-subgraph
 * - EtherFi: https://thegraph.com/explorer/subgraphs/4xkDLEfEpWo5XJ9x8mYjBwKDKHMAPbRdqm1j2fXYhF2A
 */
export const SUBGRAPH_IDS: Record<string, Partial<Record<SupportedChainId, string>>> = {
  // Aave V3 - Official Aave subgraphs (VERIFIED WORKING)
  // Source: https://github.com/aave/protocol-subgraphs
  "aave-v3": {
    [SUPPORTED_CHAINS.ETHEREUM]: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
    [SUPPORTED_CHAINS.ARBITRUM]: "DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B",
    [SUPPORTED_CHAINS.OPTIMISM]: "DSfLz8oQBUeU5atALgUFQKMTSYV9mZAVYp4noLSXAfvb",
    [SUPPORTED_CHAINS.BASE]: "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF",
    [SUPPORTED_CHAINS.POLYGON]: "Co2URyXjnxaw8WqxKyVHdirq9Ahhm5vcTs4dMedAq211",
  },

  // Compound V3 - Paperclip Labs Community Subgraphs (VERIFIED)
  // Source: https://github.com/papercliplabs/compound-v3-subgraph
  "compound-v3": {
    [SUPPORTED_CHAINS.ETHEREUM]: "5nwMCSHaTqG3Kd2gHznbTXEnZ9QNWsssQfbHhDqQSQFp",
    [SUPPORTED_CHAINS.ARBITRUM]: "Ff7ha9ELmpmg81D6nYxy4t8aGP26dPztqD1LDJNPqjLS",
    [SUPPORTED_CHAINS.OPTIMISM]: "FhHNkfh5z6Z2WCEBxB6V3s8RPxnJfWZ9zAfM5bVvbvbb",
    [SUPPORTED_CHAINS.BASE]: "2hcXhs36pTBDVUmk5K2Zkr6N4UYGwaHuco2a6jyTsijo",
    [SUPPORTED_CHAINS.POLYGON]: "AaFtUWKfFdj2x8nnE3RxTSJkHwGHvawH3VWFBykCGzLs",
  },

  // EtherFi - Official EtherFi subgraph (VERIFIED)
  // Source: https://thegraph.com/explorer/subgraphs/4xkDLEfEpWo5XJ9x8mYjBwKDKHMAPbRdqm1j2fXYhF2A
  etherfi: {
    [SUPPORTED_CHAINS.ETHEREUM]: "4xkDLEfEpWo5XJ9x8mYjBwKDKHMAPbRdqm1j2fXYhF2A",
  },

  // Lido - Official Lido subgraph (being transferred to Arbitrum)
  // Source: https://thegraph.com/explorer/subgraphs/HXfMc1jPHfFQoccWd7VMv66km75FoxVHDMvsJj5vG5vf
  // Note: This subgraph is in transfer - using RPC fallback for now
  // lido: {
  //   [SUPPORTED_CHAINS.ETHEREUM]: "HXfMc1jPHfFQoccWd7VMv66km75FoxVHDMvsJj5vG5vf",
  // },
};

// Cache for GraphQL clients
const clientCache = new Map<string, GraphQLClient>();

/**
 * Get or create a GraphQL client for a specific protocol on a chain
 */
export function getGraphClient(
  protocol: string,
  chainId: SupportedChainId
): GraphQLClient | null {
  const apiKey = process.env.GRAPH_API_KEY;
  if (!apiKey) {
    console.warn("[Graph] GRAPH_API_KEY not configured, falling back to RPC");
    return null;
  }

  const subgraphId = SUBGRAPH_IDS[protocol]?.[chainId];
  if (!subgraphId) {
    return null;
  }

  const cacheKey = `${protocol}:${chainId}`;
  let client = clientCache.get(cacheKey);

  if (!client) {
    const url = `${GRAPH_GATEWAY}/${apiKey}/subgraphs/id/${subgraphId}`;
    client = new GraphQLClient(url, {
      headers: {
        "Content-Type": "application/json",
      },
      // Note: timeout is handled via AbortController in newer versions
      // Using default request timeout
    });
    clientCache.set(cacheKey, client);
  }

  return client;
}

/**
 * Check if a Graph subgraph is available for a protocol on a chain
 */
export function hasGraphSubgraph(
  protocol: string,
  chainId: SupportedChainId
): boolean {
  return !!SUBGRAPH_IDS[protocol]?.[chainId];
}

/**
 * Get all chains supported by a protocol's subgraphs
 */
export function getGraphSupportedChains(
  protocol: string
): SupportedChainId[] {
  const protocolSubgraphs = SUBGRAPH_IDS[protocol];
  if (!protocolSubgraphs) return [];

  return Object.keys(protocolSubgraphs).map(Number) as SupportedChainId[];
}

/**
 * Execute a GraphQL query with error handling
 */
export async function executeGraphQuery<T>(
  client: GraphQLClient,
  query: string,
  variables?: Record<string, unknown>
): Promise<T | null> {
  try {
    const result = await client.request<T>(query, variables);
    return result;
  } catch (error) {
    // Log but don't throw - allows graceful fallback to RPC
    console.warn("[Graph] Query failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Convert RAY units (10^27) to APY percentage
 * Aave uses RAY for liquidity rates
 */
export function rayToApy(rayRate: string | bigint): number {
  const ray = typeof rayRate === "string" ? BigInt(rayRate) : rayRate;
  const RAY = 10n ** 27n;
  return (Number(ray) / Number(RAY)) * 100;
}
