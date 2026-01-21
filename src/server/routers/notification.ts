import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const notificationRouter = router({
  // Get user notifications
  getNotifications: protectedProcedure
    .input(
      z
        .object({
          unreadOnly: z.boolean().default(false),
          category: z.string().optional(),
          limit: z.number().default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.user.id,
      };

      if (input?.unreadOnly) {
        where.isRead = false;
      }

      if (input?.category) {
        where.category = input.category;
      }

      const notifications = await ctx.prisma.notification.findMany({
        where,
        take: (input?.limit || 20) + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          alertRule: {
            select: { id: true, name: true, ruleType: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (notifications.length > (input?.limit || 20)) {
        const nextItem = notifications.pop();
        nextCursor = nextItem?.id;
      }

      return {
        notifications,
        nextCursor,
      };
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: {
        userId: ctx.user.id,
        isRead: false,
      },
    });

    return { count };
  }),

  // Mark notifications as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.updateMany({
        where: {
          id: { in: input.notificationIds },
          userId: ctx.user.id,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: {
        userId: ctx.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true };
  }),

  // Get alert rules
  getAlertRules: protectedProcedure.query(async ({ ctx }) => {
    const rules = await ctx.prisma.alertRule.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    });

    return rules;
  }),

  // Create alert rule
  createAlertRule: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        ruleType: z.enum(["price", "position", "yield", "gas", "whale"]),
        conditions: z.record(z.string(), z.unknown()),
        channels: z.array(z.enum(["inApp", "email", "telegram", "push"])),
        cooldownMinutes: z.number().min(1).max(1440).default(60),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.alertRule.create({
        data: {
          userId: ctx.user.id,
          name: input.name,
          ruleType: input.ruleType,
          conditions: input.conditions as object,
          channels: input.channels,
          cooldownMinutes: input.cooldownMinutes,
        },
      });

      return rule;
    }),

  // Update alert rule
  updateAlertRule: protectedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        updates: z.object({
          name: z.string().min(1).max(100).optional(),
          isActive: z.boolean().optional(),
          conditions: z.record(z.string(), z.unknown()).optional(),
          channels: z.array(z.string()).optional(),
          cooldownMinutes: z.number().min(1).max(1440).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { conditions, ...rest } = input.updates;
      const rule = await ctx.prisma.alertRule.update({
        where: {
          id: input.ruleId,
          userId: ctx.user.id,
        },
        data: {
          ...rest,
          ...(conditions !== undefined && { conditions: conditions as object }),
        },
      });

      return rule;
    }),

  // Delete alert rule
  deleteAlertRule: protectedProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.alertRule.delete({
        where: {
          id: input.ruleId,
          userId: ctx.user.id,
        },
      });

      return { success: true };
    }),
});
