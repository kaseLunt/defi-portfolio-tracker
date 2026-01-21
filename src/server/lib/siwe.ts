import { SiweMessage } from "siwe";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Session data structure
export interface SessionData {
  nonce?: string;
  userId?: string;
  walletAddress?: string;
  chainId?: number;
  isLoggedIn: boolean;
}

// Default session data
const defaultSession: SessionData = {
  isLoggedIn: false,
};

// Session configuration
const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_dev",
  cookieName: "onchain-wealth-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

/**
 * Get the current session
 */
export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
  }

  return session;
}

/**
 * Generate a new nonce for SIWE
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a SIWE message and signature
 */
export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<{ success: boolean; address?: string; chainId?: number; error?: string }> {
  try {
    const siweMessage = new SiweMessage(message);
    const session = await getSession();

    // Verify the message
    const result = await siweMessage.verify({
      signature,
      nonce: session.nonce,
    });

    if (!result.success) {
      return { success: false, error: "Invalid signature" };
    }

    return {
      success: true,
      address: siweMessage.address,
      chainId: siweMessage.chainId,
    };
  } catch (error) {
    console.error("SIWE verification error:", error);
    return { success: false, error: "Verification failed" };
  }
}

/**
 * Create or get user from database
 */
export async function getOrCreateUser(walletAddress: string) {
  const normalizedAddress = walletAddress.toLowerCase();

  let user = await prisma.user.findUnique({
    where: { walletAddress: normalizedAddress },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress: normalizedAddress,
      },
    });
  } else {
    // Update last login
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  }

  return user;
}

/**
 * Create the SIWE message for signing
 */
export function createSiweMessage(
  address: string,
  chainId: number,
  nonce: string,
  domain: string,
  uri: string
): string {
  const message = new SiweMessage({
    domain,
    address,
    statement: "Sign in to OnChain Wealth to manage your DeFi portfolio.",
    uri,
    version: "1",
    chainId,
    nonce,
    issuedAt: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
  });

  return message.prepareMessage();
}
