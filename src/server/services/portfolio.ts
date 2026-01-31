import type { Address } from "viem";
import type { PrismaClient } from "@prisma/client";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { adapterRegistry } from "../adapters/registry";
import type { Position } from "../adapters/types";
import { getPrices } from "./price";
import { getFromCache, setInCache } from "../lib/redis";
import { getTokenBalances, type TokenBalance } from "./balances";
import {
  enrichPositionsWithPrices,
  calculateTotalValue,
  calculateYield24h,
  calculateWeightedApy,
  groupByProtocol,
  filterDustPositions,
  sortByValue,
  MIN_POSITION_VALUE_USD,
  type EnrichedPosition,
} from "./portfolio-utils";

// Cache TTL for portfolio data (5 minutes - fetching is expensive)
const PORTFOLIO_CACHE_TTL = 300;

// Re-export for backwards compatibility
export type { EnrichedPosition } from "./portfolio-utils";

/**
 * Aggregated portfolio data
 */
export interface PortfolioData {
  positions: EnrichedPosition[];
  tokenBalances: TokenBalance[]; // Raw token balances (not DeFi positions)
  totalValueUsd: number;
  totalTokenValueUsd: number; // Total from raw token balances
  totalDefiValueUsd: number; // Total from DeFi positions
  totalYield24h: number;
  avgApy: number;
  byProtocol: {
    protocol: string;
    name: string;
    category: string;
    positions: EnrichedPosition[];
    totalValueUsd: number;
  }[];
  byChain: {
    chainId: SupportedChainId;
    totalValueUsd: number;
    percentage: number;
  }[];
}

/**
 * Fetch all positions for a wallet and enrich with USD values
 * Results are cached in Redis for 30 seconds
 */
export async function getPortfolio(
  walletAddress: Address,
  options?: {
    chains?: SupportedChainId[];
    protocols?: string[];
    skipCache?: boolean;
  }
): Promise<PortfolioData> {
  // Generate cache key
  const cacheKey = `portfolio:${walletAddress.toLowerCase()}:${options?.chains?.join(",") || "all"}:${options?.protocols?.join(",") || "all"}`;

  // Check cache first (unless skipCache is true)
  if (!options?.skipCache) {
    const cached = await getFromCache<PortfolioData>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Fetch DeFi positions and token balances in parallel
  const fetchStart = Date.now();
  const [positionsResult, tokenBalances] = await Promise.all([
    // Get all positions from adapters
    (async () => {
      const adapterStart = Date.now();
      let positions: Position[];

      if (options?.protocols?.length) {
        // Fetch from specific protocols
        const results = await Promise.allSettled(
          options.protocols.map((protocolId) =>
            adapterRegistry.getPositionsFromProtocol(protocolId, walletAddress)
          )
        );
        positions = results
          .filter(
            (r): r is PromiseFulfilledResult<Position[]> => r.status === "fulfilled"
          )
          .flatMap((r) => r.value);
      } else {
        // Fetch from all protocols
        positions = await adapterRegistry.getAllPositions(walletAddress);
      }

      // Filter by chain if specified
      if (options?.chains?.length) {
        positions = positions.filter((p) => options.chains!.includes(p.chainId));
      }

      console.log(`[Portfolio] Adapters took ${Date.now() - adapterStart}ms`);
      return positions;
    })(),
    // Fetch raw token balances from GoldRush
    (async () => {
      const goldrushStart = Date.now();
      const balances = await getTokenBalances(walletAddress, options?.chains);
      console.log(`[Portfolio] GoldRush took ${Date.now() - goldrushStart}ms`);
      return balances;
    })(),
  ]);
  console.log(`[Portfolio] Total fetch took ${Date.now() - fetchStart}ms`);

  let positions = positionsResult;

  // Collect unique coingecko IDs for price fetching
  const coingeckoIds = new Set<string>();
  for (const position of positions) {
    if (position.coingeckoId) {
      coingeckoIds.add(position.coingeckoId);
    }
  }

  // Fetch prices
  const priceStart = Date.now();
  const prices = await getPrices(Array.from(coingeckoIds));
  console.log(`[Portfolio] Prices took ${Date.now() - priceStart}ms for ${coingeckoIds.size} tokens`);

  // Enrich, sort, and filter positions using shared utilities
  const enrichedPositions = enrichPositionsWithPrices(positions, prices);
  const sortedPositions = sortByValue(enrichedPositions);
  const filteredPositions = filterDustPositions(sortedPositions);

  // Filter out dust token balances
  const filteredTokenBalances = tokenBalances.filter(
    (b) => b.quoteUsd >= MIN_POSITION_VALUE_USD
  );

  // Calculate DeFi position totals using shared utility
  const totalDefiValueUsd = calculateTotalValue(enrichedPositions);

  // Calculate token balance total (from GoldRush - this is the primary source of truth for raw token holdings)
  const totalTokenValueUsd = tokenBalances.reduce((sum, b) => sum + b.quoteUsd, 0);

  // Use the higher of the two totals as the primary value
  // Token balances include everything GoldRush tracks (including Spectra, etc.)
  // DeFi positions may have additional yield-bearing positions not in GoldRush
  const totalValueUsd = Math.max(totalTokenValueUsd, totalDefiValueUsd);

  // Calculate yield and APY using shared utilities
  const totalYield24h = calculateYield24h(enrichedPositions);
  const avgApy = calculateWeightedApy(enrichedPositions);

  // Group by protocol using shared utility
  const byProtocol = groupByProtocol(filteredPositions);

  // Group by chain - combine DeFi positions and token balances
  const chainMap = new Map<SupportedChainId, number>();

  // Add token balance values per chain (primary source) - use filtered list
  for (const balance of filteredTokenBalances) {
    const current = chainMap.get(balance.chainId) ?? 0;
    chainMap.set(balance.chainId, current + balance.quoteUsd);
  }

  // Note: We don't add DeFi positions here because they would double-count
  // (the underlying tokens are already in tokenBalances)

  const byChain = Array.from(chainMap.entries())
    .map(([chainId, value]) => ({
      chainId,
      totalValueUsd: value,
      percentage: totalValueUsd > 0 ? (value / totalValueUsd) * 100 : 0,
    }))
    .sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  const result: PortfolioData = {
    positions: filteredPositions,
    tokenBalances: filteredTokenBalances,
    totalValueUsd,
    totalTokenValueUsd,
    totalDefiValueUsd,
    totalYield24h,
    avgApy,
    byProtocol,
    byChain,
  };

  // Log for debugging
  console.log(`[Portfolio] ${walletAddress.slice(0, 10)}...: tokens=$${totalTokenValueUsd.toFixed(2)}, defi=$${totalDefiValueUsd.toFixed(2)}, total=$${totalValueUsd.toFixed(2)}`);

  // Cache the result
  await setInCache(cacheKey, result, PORTFOLIO_CACHE_TTL);

  return result;
}

/**
 * Sync portfolio positions to database for historical tracking
 * Optimized with batch queries to avoid N+1 problem
 */
export async function syncPositionsToDatabase(
  prisma: PrismaClient,
  userId: string,
  walletAddress: Address
): Promise<void> {
  const portfolio = await getPortfolio(walletAddress, { skipCache: true });

  if (portfolio.positions.length === 0) return;

  // Batch fetch all protocols
  const protocolSlugs = [...new Set(portfolio.positions.map((p) => p.protocol))];
  const protocols = await prisma.protocol.findMany({
    where: { slug: { in: protocolSlugs } },
  });
  const protocolMap = new Map(protocols.map((p) => [p.slug, p]));

  // Batch fetch existing tokens
  const tokenKeys = portfolio.positions.map((p) => ({
    chainId: p.chainId,
    address: p.tokenAddress.toLowerCase(),
  }));

  const existingTokens = await prisma.token.findMany({
    where: {
      OR: tokenKeys.map((k) => ({
        chainId: k.chainId,
        address: k.address,
      })),
    },
  });

  // Create token lookup map
  const tokenMap = new Map(
    existingTokens.map((t) => [`${t.chainId}:${t.address.toLowerCase()}`, t])
  );

  // Process positions with batched lookups
  for (const position of portfolio.positions) {
    const tokenKey = `${position.chainId}:${position.tokenAddress.toLowerCase()}`;
    let token = tokenMap.get(tokenKey);

    // Create token if it doesn't exist
    if (!token) {
      token = await prisma.token.create({
        data: {
          chainId: position.chainId,
          address: position.tokenAddress.toLowerCase(),
          symbol: position.tokenSymbol,
          decimals: position.tokenDecimals,
          coingeckoId: position.coingeckoId,
        },
      });
      tokenMap.set(tokenKey, token);
    }

    // Get protocol from cache
    const protocol = protocolMap.get(position.protocol);
    if (!protocol) {
      console.warn(`Protocol not found in database: ${position.protocol}`);
      continue;
    }

    // Upsert position and create snapshot in transaction
    await prisma.$transaction(async (tx) => {
      const upsertedPosition = await tx.position.upsert({
        where: {
          userId_protocolId_chainId_positionType_tokenId: {
            userId,
            protocolId: protocol.id,
            chainId: position.chainId,
            positionType: position.positionType,
            tokenId: token.id,
          },
        },
        create: {
          userId,
          protocolId: protocol.id,
          chainId: position.chainId,
          positionType: position.positionType,
          tokenId: token.id,
          balanceRaw: position.balanceRaw,
          balanceUsd: position.balanceUsd,
          apyCurrent: position.apy,
          metadata: (position.metadata ?? {}) as object,
        },
        update: {
          balanceRaw: position.balanceRaw,
          balanceUsd: position.balanceUsd,
          apyCurrent: position.apy,
          metadata: (position.metadata ?? {}) as object,
          lastUpdatedAt: new Date(),
        },
      });

      // Create snapshot for historical tracking (skip dust)
      if (position.balanceUsd > 0.01) {
        await tx.positionSnapshot.create({
          data: {
            positionId: upsertedPosition.id,
            balanceRaw: position.balanceRaw,
            balanceUsd: position.balanceUsd,
            apyAtSnapshot: position.apy,
          },
        });
      }
    });
  }
}
