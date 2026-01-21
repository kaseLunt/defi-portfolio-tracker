import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma } from "./lib/prisma";
import { getSession } from "./lib/siwe";

// Context for each request
export interface Context {
  prisma: typeof prisma;
  user: {
    id: string;
    walletAddress: string;
  } | null;
}

export const createContext = async (opts: {
  headers: Headers;
}): Promise<Context> => {
  let user = null;

  try {
    // Try to get user from session first (SIWE auth)
    const session = await getSession();

    if (session.isLoggedIn && session.userId && session.walletAddress) {
      user = {
        id: session.userId,
        walletAddress: session.walletAddress,
      };
    } else {
      // Fallback to header-based auth for development/testing
      const walletAddress = opts.headers.get("x-wallet-address");
      if (walletAddress) {
        const dbUser = await prisma.user.findUnique({
          where: { walletAddress: walletAddress.toLowerCase() },
        });
        if (dbUser) {
          user = {
            id: dbUser.id,
            walletAddress: dbUser.walletAddress,
          };
        }
      }
    }
  } catch {
    // Session retrieval failed, try header fallback
    const walletAddress = opts.headers.get("x-wallet-address");
    if (walletAddress) {
      const dbUser = await prisma.user.findUnique({
        where: { walletAddress: walletAddress.toLowerCase() },
      });
      if (dbUser) {
        user = {
          id: dbUser.id,
          walletAddress: dbUser.walletAddress,
        };
      }
    }
  }

  return {
    prisma,
    user,
  };
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
