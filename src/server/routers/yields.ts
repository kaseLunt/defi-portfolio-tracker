/**
 * Yields Router
 *
 * Exposes DeFi yield data for the Strategy Builder
 */

import { router, publicProcedure } from "../trpc";
import { getStrategyApys, type StrategyApyData } from "../services/yields";

export const yieldsRouter = router({
  // Get all APYs for Strategy Builder (cached 24hr)
  getStrategyApys: publicProcedure.query(async (): Promise<StrategyApyData> => {
    return getStrategyApys();
  }),
});
