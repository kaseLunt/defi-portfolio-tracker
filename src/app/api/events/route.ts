import { NextRequest } from "next/server";
import { getSession } from "@/server/lib/siwe";
import { subscribeClient, type SSEEvent } from "@/server/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events endpoint for real-time updates
 *
 * Usage:
 * const eventSource = new EventSource('/api/events');
 * eventSource.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log(data);
 * };
 */
export async function GET(request: NextRequest) {
  // Get user from session
  let userId: string | null = null;

  try {
    const session = await getSession();
    if (session.isLoggedIn && session.userId) {
      userId = session.userId;
    }
  } catch {
    // Not logged in - allow anonymous connection for price updates
  }

  // If no user, check for wallet address header (development fallback)
  if (!userId) {
    const walletAddress = request.headers.get("x-wallet-address");
    if (walletAddress) {
      // Use wallet address as pseudo-userId for anonymous users
      userId = `anon:${walletAddress.toLowerCase()}`;
    }
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `event: connected\ndata: ${JSON.stringify({
        userId: userId ?? "anonymous",
        timestamp: Date.now(),
      })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Set up heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const ping = `: heartbeat ${Date.now()}\n\n`;
          controller.enqueue(encoder.encode(ping));
        } catch {
          // Stream closed
          clearInterval(heartbeat);
        }
      }, 30000);

      // Subscribe to events
      const handleEvent = (event: SSEEvent) => {
        try {
          const sseMessage = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        } catch {
          // Stream closed
        }
      };

      // Subscribe for user-specific events
      if (userId) {
        unsubscribe = subscribeClient(userId, handleEvent);
      }

      // Also subscribe to broadcast events (like price updates)
      const unsubscribeBroadcast = subscribeClient("*", handleEvent);

      // Store cleanup function
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe?.();
        unsubscribeBroadcast();
      };

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
