import { NextResponse } from "next/server";
import { getSession } from "@/server/lib/siwe";
import { prisma } from "@/server/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({
        isLoggedIn: false,
        user: null,
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        walletAddress: true,
        ensName: true,
        preferences: true,
        createdAt: true,
      },
    });

    if (!user) {
      // User was deleted, clear session
      session.isLoggedIn = false;
      session.userId = undefined;
      session.walletAddress = undefined;
      await session.save();

      return NextResponse.json({
        isLoggedIn: false,
        user: null,
      });
    }

    return NextResponse.json({
      isLoggedIn: true,
      user,
    });
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}
