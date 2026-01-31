import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Address } from "viem";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { getPortfolio, syncPositionsToDatabase } from "../services/portfolio";
import { getTokenBalancesFast, getDefiPositionsFast } from "../services/portfolio-fast";
import { isSupportedChain } from "../lib/rpc";
import type { SupportedChainId } from "@/lib/constants";

const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

export const portfolioRouter = router({
  /**
   * FAST: Get token balances only (~600ms)
   * Returns immediately from cache, refreshes in background if stale
   */
  getTokenBalances: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        chains: z.array(z.number()).optional(),
      })
    )
    .query(async ({ input }) => {
      console.log(`[API] getTokenBalances called for ${input.walletAddress.slice(0, 10)}...`);

      const chains = input.chains?.filter(isSupportedChain) as
        | SupportedChainId[]
        | undefined;

      try {
        const result = await getTokenBalancesFast(input.walletAddress as Address, chains);

        console.log(`[API] getTokenBalances result: ${result.balances.length} tokens, $${result.totalValueUsd.toFixed(2)} total`);

        return {
          ...result,
          walletAddress: input.walletAddress,
        };
      } catch (error) {
        console.error(`[API] getTokenBalances FAILED:`, error);
        throw error;
      }
    }),

  /**
   * SMART: Get DeFi positions with smart adapter selection
   * Only queries protocols where user likely has positions
   * Requires token balances to determine relevant protocols
   */
  getDefiPositions: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        chains: z.array(z.number()).optional(),
        // Token symbols from getTokenBalances (for smart protocol selection)
        tokenSymbols: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      console.log(`[API] getDefiPositions called for ${input.walletAddress.slice(0, 10)}... with ${input.tokenSymbols?.length ?? 0} token symbols`);

      const chains = input.chains?.filter(isSupportedChain) as
        | SupportedChainId[]
        | undefined;

      // Convert token symbols to minimal TokenBalance format for protocol detection
      const tokenBalances = (input.tokenSymbols || []).map(symbol => ({
        chainId: 1 as SupportedChainId, // Chain doesn't matter for protocol detection
        tokenAddress: "",
        tokenSymbol: symbol,
        tokenName: "",
        tokenDecimals: 18,
        balance: 0,
        balanceRaw: "0",
        quoteUsd: 1, // Non-zero to pass dust filter
      }));

      try {
        const result = await getDefiPositionsFast(
          input.walletAddress as Address,
          tokenBalances,
          chains
        );

        console.log(`[API] getDefiPositions result: ${result.positions.length} positions, $${result.totalValueUsd.toFixed(2)} total, protocols: ${result.protocolsQueried.join(", ") || "none"}`);

        return {
          ...result,
          walletAddress: input.walletAddress,
        };
      } catch (error) {
        console.error(`[API] getDefiPositions FAILED:`, error);
        throw error;
      }
    }),

  // Get live portfolio for any wallet address (read-only, no auth required)
  // LEGACY: Use getTokenBalances + getDefiPositions for better UX
  getLivePortfolio: publicProcedure
    .input(
      z.object({
        walletAddress: walletAddressSchema,
        chains: z.array(z.number()).optional(),
        protocols: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const chains = input.chains?.filter(isSupportedChain) as
        | SupportedChainId[]
        | undefined;

      const portfolio = await getPortfolio(input.walletAddress as Address, {
        chains,
        protocols: input.protocols,
      });

      return {
        ...portfolio,
        walletAddress: input.walletAddress,
        fetchedAt: new Date().toISOString(),
      };
    }),

  // Get aggregated portfolio for connected wallet (from database)
  getPortfolio: protectedProcedure
    .input(
      z
        .object({
          chains: z.array(z.number()).optional(),
          protocols: z.array(z.string()).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.user.id,
      };

      if (input?.chains?.length) {
        where.chainId = { in: input.chains };
      }

      if (input?.protocols?.length) {
        where.protocol = { slug: { in: input.protocols } };
      }

      const positions = await ctx.prisma.position.findMany({
        where,
        include: {
          protocol: true,
          chain: true,
          token: true,
        },
        orderBy: { balanceUsd: "desc" },
      });

      // Calculate totals
      const totalValueUsd = positions.reduce(
        (sum, p) => sum + (p.balanceUsd || 0),
        0
      );

      // Group by protocol
      const byProtocol = positions.reduce(
        (acc, position) => {
          const slug = position.protocol.slug;
          if (!acc[slug]) {
            acc[slug] = {
              protocol: position.protocol,
              positions: [],
              totalValueUsd: 0,
            };
          }
          acc[slug].positions.push(position);
          acc[slug].totalValueUsd += position.balanceUsd || 0;
          return acc;
        },
        {} as Record<
          string,
          {
            protocol: (typeof positions)[0]["protocol"];
            positions: typeof positions;
            totalValueUsd: number;
          }
        >
      );

      // Group by chain
      const byChain = positions.reduce(
        (acc, position) => {
          const chainId = position.chainId;
          if (!acc[chainId]) {
            acc[chainId] = {
              chain: position.chain,
              totalValueUsd: 0,
            };
          }
          acc[chainId].totalValueUsd += position.balanceUsd || 0;
          return acc;
        },
        {} as Record<
          number,
          { chain: (typeof positions)[0]["chain"]; totalValueUsd: number }
        >
      );

      return {
        positions,
        totalValueUsd,
        byProtocol: Object.values(byProtocol),
        byChain: Object.values(byChain),
        positionCount: positions.length,
      };
    }),

  // Get single position details
  getPosition: protectedProcedure
    .input(z.object({ positionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const position = await ctx.prisma.position.findFirst({
        where: {
          id: input.positionId,
          userId: ctx.user.id,
        },
        include: {
          protocol: true,
          chain: true,
          token: true,
          snapshots: {
            orderBy: { snapshotAt: "desc" },
            take: 100,
          },
        },
      });

      return position;
    }),

  // Get portfolio value history for charts
  getValueHistory: protectedProcedure
    .input(
      z.object({
        timeframe: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]),
        chains: z.array(z.number()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Timeframe to milliseconds offset
      const TIMEFRAME_MS: Record<string, number> = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
        "all": Date.now() - new Date(2020, 0, 1).getTime(),
      };

      const startDate = new Date(Date.now() - TIMEFRAME_MS[input.timeframe]);

      // Get positions for this user
      const positions = await ctx.prisma.position.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.chains?.length ? { chainId: { in: input.chains } } : {}),
        },
      });

      // Get snapshots for these positions
      const snapshots = await ctx.prisma.positionSnapshot.findMany({
        where: {
          positionId: { in: positions.map((p) => p.id) },
          snapshotAt: { gte: startDate },
        },
        orderBy: { snapshotAt: "asc" },
      });

      // Aggregate by timestamp
      const aggregated = snapshots.reduce(
        (acc, snapshot) => {
          const timestamp = snapshot.snapshotAt.toISOString();
          if (!acc[timestamp]) {
            acc[timestamp] = { timestamp: snapshot.snapshotAt, totalUsd: 0 };
          }
          acc[timestamp].totalUsd += snapshot.balanceUsd || 0;
          return acc;
        },
        {} as Record<string, { timestamp: Date; totalUsd: number }>
      );

      return Object.values(aggregated).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
    }),

  // Refresh positions from on-chain
  refreshPositions: protectedProcedure
    .input(z.object({ chains: z.array(z.number()).optional() }))
    .mutation(async ({ ctx }) => {
      // Sync positions to database
      await syncPositionsToDatabase(
        ctx.prisma,
        ctx.user.id,
        ctx.user.walletAddress as Address
      );

      return {
        success: true,
        message: "Positions refreshed successfully",
      };
    }),

  // Get supported protocols
  getProtocols: publicProcedure
    .input(
      z
        .object({
          chainId: z.number().optional(),
          category: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        isActive: true,
      };

      if (input?.category) {
        where.category = input.category;
      }

      const protocols = await ctx.prisma.protocol.findMany({
        where,
        orderBy: { name: "asc" },
      });

      // Filter by chain if specified
      if (input?.chainId) {
        return protocols.filter((p) =>
          p.supportedChains.includes(input.chainId!)
        );
      }

      return protocols;
    }),
});
