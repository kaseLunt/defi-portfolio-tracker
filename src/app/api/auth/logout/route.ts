import { NextResponse } from "next/server";
import { getSession } from "@/server/lib/siwe";
import { getWebSocketService } from "@/server/services/websocket";
import type { Address } from "viem";

export async function POST() {
  try {
    const session = await getSession();

    // Unsubscribe from real-time events before clearing session (non-blocking)
    if (session.walletAddress) {
      try {
        const wsService = getWebSocketService();
        if (wsService.isActive()) {
          wsService.unsubscribeUser(session.walletAddress as Address)
            .catch(err => console.error("[Auth] Failed to unsubscribe wallet:", err));
        }
      } catch {
        // WebSocket service not initialized - skip
      }
    }

    // Clear session data
    session.userId = undefined;
    session.walletAddress = undefined;
    session.chainId = undefined;
    session.isLoggedIn = false;
    session.nonce = undefined;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging out:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
