import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";

export const userRouter = router({
  // Get or create user by wallet address
  getOrCreate: publicProcedure
    .input(
      z.object({
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        ensName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedAddress = input.walletAddress.toLowerCase();

      const user = await ctx.prisma.user.upsert({
        where: { walletAddress: normalizedAddress },
        update: {
          lastLoginAt: new Date(),
          ensName: input.ensName || undefined,
        },
        create: {
          walletAddress: normalizedAddress,
          ensName: input.ensName,
        },
      });

      return user;
    }),

  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: {
        notificationChannels: true,
      },
    });

    return user;
  }),

  // Update user preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        currency: z.enum(["USD", "EUR", "GBP", "ETH"]).optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
        notifications: z
          .object({
            email: z.boolean().optional(),
            push: z.boolean().optional(),
            inApp: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
      });

      const currentPrefs =
        (currentUser?.preferences as Record<string, unknown>) || {};
      const newPrefs = {
        ...currentPrefs,
        ...input,
        notifications: {
          ...((currentPrefs.notifications as Record<string, unknown>) || {}),
          ...(input.notifications || {}),
        },
      };

      const user = await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: { preferences: newPrefs },
      });

      return user;
    }),

  // Add notification channel
  addNotificationChannel: protectedProcedure
    .input(
      z.object({
        channelType: z.enum(["email", "telegram", "push", "webhook"]),
        channelValue: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.prisma.notificationChannel.create({
        data: {
          userId: ctx.user.id,
          channelType: input.channelType,
          channelValue: input.channelValue,
        },
      });

      return channel;
    }),

  // Remove notification channel
  removeNotificationChannel: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notificationChannel.delete({
        where: {
          id: input.channelId,
          userId: ctx.user.id,
        },
      });

      return { success: true };
    }),
});
