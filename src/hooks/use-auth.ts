"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";

interface User {
  id: string;
  walletAddress: string;
  ensName?: string | null;
}

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

export function useAuth() {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    isLoading: true,
    user: null,
    error: null,
  });

  // Check session on mount and when wallet changes
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();

      if (data.isLoggedIn && data.user) {
        // Verify the session matches the connected wallet
        if (address && data.user.walletAddress.toLowerCase() !== address.toLowerCase()) {
          // Wallet changed, need to re-authenticate
          await logout();
          return;
        }

        setAuthState({
          isLoggedIn: true,
          isLoading: false,
          user: data.user,
          error: null,
        });
      } else {
        setAuthState({
          isLoggedIn: false,
          isLoading: false,
          user: null,
          error: null,
        });
      }
    } catch {
      setAuthState({
        isLoggedIn: false,
        isLoading: false,
        user: null,
        error: null,
      });
    }
  }, [address]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Sign in with Ethereum
  const signIn = useCallback(async () => {
    if (!address || !chainId) {
      setAuthState((prev) => ({
        ...prev,
        error: "Wallet not connected",
      }));
      return false;
    }

    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get nonce from server
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      if (!nonce) {
        throw new Error("Failed to get nonce");
      }

      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to OnChain Wealth to manage your DeFi portfolio.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      const messageToSign = message.prepareMessage();

      // Sign message
      const signature = await signMessageAsync({ message: messageToSign });

      // Verify signature on server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSign, signature }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.error || "Verification failed");
      }

      setAuthState({
        isLoggedIn: true,
        isLoading: false,
        user: verifyData.user,
        error: null,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign in failed";
      setAuthState({
        isLoggedIn: false,
        isLoading: false,
        user: null,
        error: errorMessage,
      });
      return false;
    }
  }, [address, chainId, signMessageAsync]);

  // Logout
  const logout = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors on logout
    }

    setAuthState({
      isLoggedIn: false,
      isLoading: false,
      user: null,
      error: null,
    });
  }, []);

  // Full disconnect (logout + disconnect wallet)
  const fullDisconnect = useCallback(async () => {
    await logout();
    disconnect();
  }, [logout, disconnect]);

  return {
    ...authState,
    isConnected,
    address,
    chainId,
    signIn,
    logout,
    fullDisconnect,
    checkSession,
  };
}
