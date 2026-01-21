import { NextResponse } from "next/server";
import { getSession, generateNonce } from "@/server/lib/siwe";

export async function GET() {
  try {
    const session = await getSession();
    const nonce = generateNonce();

    // Store nonce in session for verification
    session.nonce = nonce;
    await session.save();

    return NextResponse.json({ nonce });
  } catch (error) {
    console.error("Error generating nonce:", error);
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500 }
    );
  }
}
