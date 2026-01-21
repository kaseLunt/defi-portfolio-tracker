import { prisma } from "../lib/prisma";

export interface CreateNotificationParams {
  userId: string;
  title: string;
  body: string;
  category?: "alert" | "system" | "transaction" | "security";
  priority?: "low" | "normal" | "high" | "urgent";
  alertRuleId?: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  expiresAt?: Date;
}

class NotificationService {
  /**
   * Create a notification for a user
   */
  async create(params: CreateNotificationParams) {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        category: params.category ?? "system",
        priority: params.priority ?? "normal",
        alertRuleId: params.alertRuleId,
        metadata: (params.metadata as object) ?? {},
        actionUrl: params.actionUrl,
        expiresAt: params.expiresAt,
        channelsSent: ["inApp"],
      },
    });

    // TODO: Emit WebSocket event for real-time updates
    // await this.emitToUser(params.userId, notification);

    return notification;
  }

  /**
   * Create notifications for multiple users
   */
  async createForUsers(
    userIds: string[],
    params: Omit<CreateNotificationParams, "userId">
  ) {
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title: params.title,
        body: params.body,
        category: params.category ?? "system",
        priority: params.priority ?? "normal",
        alertRuleId: params.alertRuleId,
        metadata: (params.metadata as object) ?? {},
        actionUrl: params.actionUrl,
        expiresAt: params.expiresAt,
        channelsSent: ["inApp"],
      })),
    });

    return notifications;
  }

  /**
   * Create a system-wide notification for all users
   */
  async createSystemNotification(params: Omit<CreateNotificationParams, "userId">) {
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    return this.createForUsers(
      users.map((u) => u.id),
      {
        ...params,
        category: "system",
      }
    );
  }

  /**
   * Create a transaction notification
   */
  async createTransactionNotification(
    userId: string,
    txHash: string,
    status: "pending" | "confirmed" | "failed",
    chainId: number
  ) {
    const statusMessages = {
      pending: "Transaction submitted",
      confirmed: "Transaction confirmed",
      failed: "Transaction failed",
    };

    const statusBodies = {
      pending: `Your transaction has been submitted and is waiting for confirmation.`,
      confirmed: `Your transaction has been successfully confirmed on-chain.`,
      failed: `Your transaction failed. Please check the details and try again.`,
    };

    return this.create({
      userId,
      title: statusMessages[status],
      body: statusBodies[status],
      category: "transaction",
      priority: status === "failed" ? "high" : "normal",
      metadata: { txHash, chainId },
      actionUrl: `/transactions/${txHash}`,
    });
  }

  /**
   * Create a price alert notification
   */
  async createPriceAlert(
    userId: string,
    token: string,
    currentPrice: number,
    targetPrice: number,
    direction: "above" | "below"
  ) {
    return this.create({
      userId,
      title: `Price Alert: ${token}`,
      body: `${token} is now $${currentPrice.toFixed(2)}, ${direction} your target of $${targetPrice.toFixed(2)}`,
      category: "alert",
      priority: "high",
      metadata: { token, currentPrice, targetPrice, direction },
    });
  }

  /**
   * Create a position change notification
   */
  async createPositionChangeAlert(
    userId: string,
    positionId: string,
    protocol: string,
    token: string,
    changePercent: number,
    currentValue: number
  ) {
    const direction = changePercent > 0 ? "increased" : "decreased";

    return this.create({
      userId,
      title: `Position Alert: ${protocol}`,
      body: `Your ${token} position on ${protocol} has ${direction} by ${Math.abs(changePercent).toFixed(1)}% (now $${currentValue.toFixed(2)})`,
      category: "alert",
      priority: Math.abs(changePercent) > 10 ? "high" : "normal",
      metadata: { positionId, protocol, token, changePercent, currentValue },
      actionUrl: `/portfolio/${positionId}`,
    });
  }

  /**
   * Create a security notification
   */
  async createSecurityNotification(
    userId: string,
    title: string,
    body: string,
    metadata?: Record<string, unknown>
  ) {
    return this.create({
      userId,
      title,
      body,
      category: "security",
      priority: "urgent",
      metadata,
    });
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds: string[], userId: string) {
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async cleanupOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        OR: [
          { createdAt: { lt: cutoffDate }, isRead: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    console.log(`Cleaned up ${result.count} old notifications`);
    return result.count;
  }
}

export const notificationService = new NotificationService();
