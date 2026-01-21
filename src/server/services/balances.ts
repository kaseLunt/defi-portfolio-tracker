/**
 * Service to fetch raw token balances for a wallet
 * Uses GoldRush (Covalent) API to get current balances
 */

import type { Address } from "viem";
import { COVALENT_CHAIN_NAMES, type SupportedChainId, SUPPORTED_CHAINS } from "@/lib/constants";

const COVALENT_API_KEY = process.env.COVALENT_API_KEY;
const COVALENT_BASE_URL = "https://api.covalenthq.com/v1";
const REQUEST_TIMEOUT = 15000;

export interface TokenBalance {
  chainId: SupportedChainId;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  balance: number;
  balanceRaw: string;
  quoteUsd: number; // USD value from GoldRush
  logoUrl?: string;
}

interface GoldRushBalanceResponse {
  data: {
    items: Array<{
      contract_decimals: number;
      contract_name: string;
      contract_ticker_symbol: string;
      contract_address: string;
      logo_url?: string;
      balance: string;
      quote: number | null;
      quote_rate: number | null;
    }>;
  };
}

/**
 * Fetch current token balances for a wallet on a single chain
 */
async function fetchChainBalances(
  walletAddress: Address,
  chainId: SupportedChainId
): Promise<TokenBalance[]> {
  if (!COVALENT_API_KEY) {
    console.warn("[Balances] No COVALENT_API_KEY configured");
    return [];
  }

  const chainName = COVALENT_CHAIN_NAMES[chainId];
  if (!chainName) {
    return [];
  }

  const url = `${COVALENT_BASE_URL}/${chainName}/address/${walletAddress}/balances_v2/?quote-currency=USD&no-spam=true&no-nft-fetch=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COVALENT_API_KEY}`,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Balances] GoldRush API error for ${chainName}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as GoldRushBalanceResponse;

    if (!data.data?.items) {
      return [];
    }

    const balances: TokenBalance[] = [];

    for (const item of data.data.items) {
      // Skip zero balances and tokens without a quote
      if (!item.balance || item.balance === "0") continue;
      if (item.quote === null || item.quote === 0) continue;

      const decimals = item.contract_decimals || 18;
      const balance = parseFloat(item.balance) / Math.pow(10, decimals);

      if (balance <= 0) continue;

      balances.push({
        chainId,
        tokenAddress: item.contract_address,
        tokenSymbol: item.contract_ticker_symbol || "UNKNOWN",
        tokenName: item.contract_name || "Unknown Token",
        tokenDecimals: decimals,
        balance,
        balanceRaw: item.balance,
        quoteUsd: item.quote,
        logoUrl: item.logo_url,
      });
    }

    return balances;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[Balances] Request timed out for ${chainName}`);
    } else {
      console.warn(`[Balances] Request failed for ${chainName}:`, error);
    }
    return [];
  }
}

/**
 * Fetch current token balances for a wallet across multiple chains
 */
export async function getTokenBalances(
  walletAddress: Address,
  chains?: SupportedChainId[]
): Promise<TokenBalance[]> {
  const chainsToQuery = chains?.length
    ? chains
    : [
        SUPPORTED_CHAINS.ETHEREUM,
        SUPPORTED_CHAINS.ARBITRUM,
        SUPPORTED_CHAINS.OPTIMISM,
        SUPPORTED_CHAINS.BASE,
        SUPPORTED_CHAINS.POLYGON,
      ];

  const results = await Promise.allSettled(
    chainsToQuery.map((chainId) => fetchChainBalances(walletAddress, chainId))
  );

  const allBalances: TokenBalance[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allBalances.push(...result.value);
    }
  }

  // Sort by USD value descending
  allBalances.sort((a, b) => b.quoteUsd - a.quoteUsd);

  return allBalances;
}

/**
 * Get total USD value of all token balances
 */
export async function getTotalTokenValue(
  walletAddress: Address,
  chains?: SupportedChainId[]
): Promise<number> {
  const balances = await getTokenBalances(walletAddress, chains);
  return balances.reduce((sum, b) => sum + b.quoteUsd, 0);
}
