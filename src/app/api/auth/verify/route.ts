import { NextRequest, NextResponse } from "next/server";
import { getSession, verifySiweMessage, getOrCreateUser } from "@/server/lib/siwe";
import { getWebSocketService } from "@/server/services/websocket";
import type { Address } from "viem";

export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    if (!message || !signature) {
      return NextResponse.json(
        { error: "Message and signature are required" },
        { status: 400 }
      );
    }

    // Verify the SIWE message
    const result = await verifySiweMessage(message, signature);

    if (!result.success || !result.address) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 401 }
      );
    }

    // Get or create user in database
    const user = await getOrCreateUser(result.address);

    // Update session
    const session = await getSession();
    session.userId = user.id;
    session.walletAddress = user.walletAddress;
    session.chainId = result.chainId;
    session.isLoggedIn = true;
    session.nonce = undefined; // Clear nonce after use
    await session.save();

    // Subscribe to real-time events for this wallet (non-blocking)
    try {
      const wsService = getWebSocketService();
      if (wsService.isActive()) {
        wsService.subscribeUser(user.id, user.walletAddress as Address)
          .catch(err => console.error("[Auth] Failed to subscribe wallet:", err));
      }
    } catch {
      // WebSocket service not initialized - skip subscription
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        ensName: user.ensName,
      },
    });
  } catch (error) {
    console.error("Error verifying signature:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
