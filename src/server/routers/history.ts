import { z } from "zod";
import type { Address } from "viem";
import { router, publicProcedure } from "../trpc";
import { getHistoricalPortfolio, getProgress } from "../services/historical";
import { isSupportedChain } from "../lib/rpc";
import type { SupportedChainId } from "@/lib/constants";

const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

const historicalTimeframeSchema = z.enum(["7d", "30d", "90d", "1y"]);

export const historyRouter = router({
  /**
   * Get historical portfolio value over time for any wallet
   * No authentication required - works for any wallet address
   */
  getPortfolioHistory: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        timeframe: historicalTimeframeSchema,
        chains: z.array(z.number()).optional(),
        requestId: z.string().optional(), // Client-provided for progress tracking
        currentValue: z.number().optional(), // Live portfolio value for accurate final data point
      })
    )
    .query(async ({ input }) => {
      const chains = input.chains?.filter(isSupportedChain) as
        | SupportedChainId[]
        | undefined;

      const result = await getHistoricalPortfolio(
        input.walletAddress as Address,
        input.timeframe,
        {
          chains,
          requestId: input.requestId, // Use client-provided requestId
          currentValue: input.currentValue, // Pass live portfolio value
        }
      );

      return {
        ...result,
        // Serialize dates for JSON transport (handle both Date objects and strings from cache)
        dataPoints: result.dataPoints.map((dp) => ({
          ...dp,
          timestamp: dp.timestamp instanceof Date
            ? dp.timestamp.toISOString()
            : String(dp.timestamp),
        })),
        fetchedAt: result.fetchedAt instanceof Date
          ? result.fetchedAt.toISOString()
          : String(result.fetchedAt),
      };
    }),

  /**
   * Poll progress of a historical portfolio fetch
   */
  getProgress: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      const progress = await getProgress(input.requestId);
      if (!progress) {
        return null;
      }

      return {
        ...progress,
        startedAt: progress.startedAt instanceof Date
          ? progress.startedAt.toISOString()
          : String(progress.startedAt),
        updatedAt: progress.updatedAt instanceof Date
          ? progress.updatedAt.toISOString()
          : String(progress.updatedAt),
      };
    }),
});
