import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Address } from "viem";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { getPortfolio, syncPositionsToDatabase } from "../services/portfolio";
import { isSupportedChain } from "../lib/rpc";
import type { SupportedChainId } from "@/lib/constants";

const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

export const portfolioRouter = router({
  // Get live portfolio for any wallet address (read-only, no auth required)
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
      // Calculate start date based on timeframe
      const startDate = new Date();

      switch (input.timeframe) {
        case "24h":
          startDate.setHours(startDate.getHours() - 24);
          break;
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(startDate.getDate() - 90);
          break;
        case "1y":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case "all":
          startDate.setFullYear(2020);
          break;
      }

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
