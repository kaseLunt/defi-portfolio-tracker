/**
 * Server-Sent Events (SSE) infrastructure for real-time updates
 *
 * Events:
 * - price:update - Token price changes
 * - notification:new - New notification created
 * - position:update - Position value changed
 * - alert:triggered - Alert rule triggered
 */

import { redis } from "./redis";

// Event types
export interface PriceUpdateEvent {
  type: "price:update";
  data: {
    prices: Record<string, { usd: number; change24h: number | null }>;
    timestamp: number;
  };
}

export interface NotificationEvent {
  type: "notification:new";
  data: {
    id: string;
    userId: string;
    title: string;
    body: string;
    category: string;
    priority: string;
    createdAt: string;
  };
}

export interface PositionUpdateEvent {
  type: "position:update";
  data: {
    userId: string;
    positionId: string;
    balanceUsd: number;
    changePercent: number;
  };
}

export interface AlertTriggeredEvent {
  type: "alert:triggered";
  data: {
    userId: string;
    ruleId: string;
    ruleName: string;
    message: string;
  };
}

export type SSEEvent =
  | PriceUpdateEvent
  | NotificationEvent
  | PositionUpdateEvent
  | AlertTriggeredEvent;

// Redis pub/sub channel
const EVENTS_CHANNEL = "onchain-wealth:events";

// Connected SSE clients (in-memory for single server, use Redis for multi-server)
const connectedClients = new Map<string, Set<(event: SSEEvent) => void>>();

/**
 * Subscribe a client to events
 */
export function subscribeClient(
  userId: string,
  callback: (event: SSEEvent) => void
): () => void {
  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set());
  }
  connectedClients.get(userId)!.add(callback);

  // Return unsubscribe function
  return () => {
    const clients = connectedClients.get(userId);
    if (clients) {
      clients.delete(callback);
      if (clients.size === 0) {
        connectedClients.delete(userId);
      }
    }
  };
}

/**
 * Publish event to specific user
 */
export async function publishToUser(userId: string, event: SSEEvent) {
  // Send to local clients
  const clients = connectedClients.get(userId);
  if (clients) {
    clients.forEach((callback) => callback(event));
  }

  // Also publish to Redis for multi-server support
  try {
    if (redis) {
      await redis.publish(
        EVENTS_CHANNEL,
        JSON.stringify({ userId, event })
      );
    }
  } catch (error) {
    console.error("Failed to publish event to Redis:", error);
  }
}

/**
 * Publish event to all connected clients (e.g., price updates)
 */
export async function publishToAll(event: SSEEvent) {
  // Send to all local clients
  connectedClients.forEach((clients) => {
    clients.forEach((callback) => callback(event));
  });

  // Also publish to Redis
  try {
    if (redis) {
      await redis.publish(
        EVENTS_CHANNEL,
        JSON.stringify({ userId: "*", event })
      );
    }
  } catch (error) {
    console.error("Failed to publish event to Redis:", error);
  }
}

/**
 * Broadcast price update to all clients
 */
export async function broadcastPriceUpdate(
  prices: Record<string, { usd: number; change24h: number | null }>
) {
  const event: PriceUpdateEvent = {
    type: "price:update",
    data: {
      prices,
      timestamp: Date.now(),
    },
  };
  await publishToAll(event);
}

/**
 * Send notification event to specific user
 */
export async function sendNotificationEvent(
  userId: string,
  notification: {
    id: string;
    title: string;
    body: string;
    category: string;
    priority: string;
    createdAt: Date;
  }
) {
  const event: NotificationEvent = {
    type: "notification:new",
    data: {
      id: notification.id,
      userId,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      priority: notification.priority,
      createdAt: notification.createdAt.toISOString(),
    },
  };
  await publishToUser(userId, event);
}

/**
 * Send position update event
 */
export async function sendPositionUpdate(
  userId: string,
  positionId: string,
  balanceUsd: number,
  previousBalanceUsd: number
) {
  const changePercent =
    previousBalanceUsd > 0
      ? ((balanceUsd - previousBalanceUsd) / previousBalanceUsd) * 100
      : 0;

  const event: PositionUpdateEvent = {
    type: "position:update",
    data: {
      userId,
      positionId,
      balanceUsd,
      changePercent,
    },
  };
  await publishToUser(userId, event);
}

/**
 * Initialize Redis subscriber for multi-server support
 */
export async function initEventSubscriber() {
  if (!redis) {
    console.warn("Redis not available - event subscriber not initialized");
    return;
  }
  const subscriber = redis.duplicate();

  subscriber.subscribe(EVENTS_CHANNEL, (err) => {
    if (err) {
      console.error("Failed to subscribe to events channel:", err);
    } else {
      console.log("Subscribed to events channel");
    }
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const { userId, event } = JSON.parse(message) as {
        userId: string;
        event: SSEEvent;
      };

      if (userId === "*") {
        // Broadcast to all
        connectedClients.forEach((clients) => {
          clients.forEach((callback) => callback(event));
        });
      } else {
        // Send to specific user
        const clients = connectedClients.get(userId);
        if (clients) {
          clients.forEach((callback) => callback(event));
        }
      }
    } catch (error) {
      console.error("Failed to process event message:", error);
    }
  });
}
