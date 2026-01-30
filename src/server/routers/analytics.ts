import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  getWeETHAnalytics,
  getMultiWalletWeETHAnalytics,
  getAggregatedWeETHAnalytics,
} from "../services/analytics";

// Reuse wallet validation pattern from other routers
const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

export const analyticsRouter = router({
  /**
   * Get weETH analytics for a single wallet
   * Returns cross-chain weETH holdings, values, and APY data
   */
  getWeETHAnalytics: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
      })
    )
    .query(async ({ input }) => {
      return getWeETHAnalytics(input.walletAddress);
    }),

  /**
   * Get weETH analytics for multiple wallets
   * Returns individual analytics for each wallet
   */
  getMultiWalletAnalytics: publicProcedure
    .input(
      z.object({
        walletAddresses: z.array(walletAddressSchema).max(10),
      })
    )
    .query(async ({ input }) => {
      return getMultiWalletWeETHAnalytics(input.walletAddresses);
    }),

  /**
   * Get aggregated analytics across multiple wallets
   * Combines holdings from all wallets into a single view
   */
  getAggregatedAnalytics: publicProcedure
    .input(
      z.object({
        walletAddresses: z.array(walletAddressSchema).max(10),
      })
    )
    .query(async ({ input }) => {
      return getAggregatedWeETHAnalytics(input.walletAddresses);
    }),
});
