import { router } from "../trpc";
import { userRouter } from "./user";
import { portfolioRouter } from "./portfolio";
import { notificationRouter } from "./notification";
import { priceRouter } from "./price";
import { historyRouter } from "./history";

export const appRouter = router({
  user: userRouter,
  portfolio: portfolioRouter,
  notification: notificationRouter,
  price: priceRouter,
  history: historyRouter,
});

export type AppRouter = typeof appRouter;
