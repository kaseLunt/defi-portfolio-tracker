import { NextResponse } from "next/server";
import { getSession } from "@/server/lib/siwe";

export async function POST() {
  try {
    const session = await getSession();

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
