import { router } from "../trpc";
import { userRouter } from "./user";
import { portfolioRouter } from "./portfolio";
import { notificationRouter } from "./notification";
import { priceRouter } from "./price";
import { historyRouter } from "./history";
import { etherfiRouter } from "./etherfi";
import { yieldsRouter } from "./yields";
import { transactionRouter } from "./transaction";
import { liquidationRouter } from "./liquidation";
import { analyticsRouter } from "./analytics";

export const appRouter = router({
  user: userRouter,
  portfolio: portfolioRouter,
  notification: notificationRouter,
  price: priceRouter,
  history: historyRouter,
  etherfi: etherfiRouter,
  yields: yieldsRouter,
  transaction: transactionRouter,
  liquidation: liquidationRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
