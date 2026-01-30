import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  getWalletRiskSummary,
  getWalletRiskSummaryAllChains,
} from "../services/liquidation";
import type { SupportedChainId } from "@/lib/constants";

const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

export const liquidationRouter = router({
  /**
   * Get liquidation risk summary for a specific chain
   *
   * Returns portfolio-level health factor, per-collateral liquidation prices,
   * and risk contribution for each position.
   */
  getRiskSummary: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        chainId: z.number().optional().default(1),
      })
    )
    .query(async ({ input }) => {
      return getWalletRiskSummary(
        input.walletAddress,
        input.chainId as SupportedChainId
      );
    }),

  /**
   * Get liquidation risk summary across all supported chains
   *
   * Queries Aave V3 positions on all chains where subgraphs are available
   * and returns summaries for chains where the wallet has positions.
   */
  getRiskSummaryAllChains: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
      })
    )
    .query(async ({ input }) => {
      return getWalletRiskSummaryAllChains(input.walletAddress);
    }),
});
