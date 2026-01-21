import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  getPrice,
  getPrices,
  getPriceBySymbol,
  syncPricesToDatabase,
  COINGECKO_IDS,
} from "../services/price";

export const priceRouter = router({
  // Get price for a single token by CoinGecko ID
  getPrice: publicProcedure
    .input(z.object({ coingeckoId: z.string() }))
    .query(async ({ input }) => {
      const price = await getPrice(input.coingeckoId);
      if (!price) {
        return null;
      }
      return {
        priceUsd: price.priceUsd,
        priceEth: price.priceEth,
        change24hPct: price.change24hPct,
      };
    }),

  // Get price by token symbol (uses internal mapping)
  getPriceBySymbol: publicProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const price = await getPriceBySymbol(input.symbol);
      if (!price) {
        return null;
      }
      return {
        priceUsd: price.priceUsd,
        priceEth: price.priceEth,
        change24hPct: price.change24hPct,
      };
    }),

  // Get prices for multiple tokens
  getPrices: publicProcedure
    .input(z.object({ coingeckoIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      const prices = await getPrices(input.coingeckoIds);
      const result: Record<
        string,
        { priceUsd: number; priceEth: number | null; change24hPct: number | null }
      > = {};

      for (const [id, price] of prices) {
        result[id] = {
          priceUsd: price.priceUsd,
          priceEth: price.priceEth,
          change24hPct: price.change24hPct,
        };
      }

      return result;
    }),

  // Get all supported token symbols and their CoinGecko IDs
  getSupportedTokens: publicProcedure.query(() => {
    return COINGECKO_IDS;
  }),

  // Sync prices to database (admin/background job)
  syncPrices: protectedProcedure.mutation(async ({ ctx }) => {
    const updated = await syncPricesToDatabase(ctx.prisma);
    return {
      success: true,
      updatedCount: updated,
    };
  }),

  // Get cached prices from database for specific tokens
  getCachedPrices: publicProcedure
    .input(z.object({ tokenIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const prices = await ctx.prisma.priceCache.findMany({
        where: {
          tokenId: { in: input.tokenIds },
        },
        include: {
          token: {
            select: {
              symbol: true,
              coingeckoId: true,
            },
          },
        },
      });

      return prices.map((p) => ({
        tokenId: p.tokenId,
        symbol: p.token.symbol,
        priceUsd: p.priceUsd,
        priceEth: p.priceEth,
        change24hPct: p.change24hPct,
        updatedAt: p.updatedAt,
      }));
    }),
});
