"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useEnsName } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { formatAddress } from "@/lib/utils";
import { LogOut, User, Shield, ChevronDown } from "lucide-react";

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { data: ensName } = useEnsName({ address });
  const { isLoggedIn, isLoading, user, signIn, fullDisconnect } = useAuth();

  // Prevent hydration mismatch - connectors differ between server and client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto sign-in when wallet connects and not logged in
  useEffect(() => {
    if (isConnected && address && !isLoggedIn && !isLoading) {
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(() => {
        signIn();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, isLoggedIn, isLoading, signIn]);

  // Show placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        Connect Wallet
      </Button>
    );
  }

  // Connected and logged in
  if (isConnected && address && isLoggedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="hidden sm:inline">
              {user?.ensName || ensName || formatAddress(address)}
            </span>
            <span className="sm:hidden">
              {formatAddress(address)}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4" />
            <span className="truncate">{formatAddress(address)}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-green-600">
            <Shield className="h-4 w-4" />
            <span>Signed In</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onClick={fullDisconnect}
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Connected but not signed in
  if (isConnected && address && !isLoggedIn) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>{ensName || formatAddress(address)}</span>
        </div>
        <Button
          variant="default"
          size="sm"
          disabled={isLoading}
          onClick={() => signIn()}
        >
          {isLoading ? "Signing..." : "Sign In"}
        </Button>
        <Button variant="outline" size="sm" onClick={fullDisconnect}>
          Cancel
        </Button>
      </div>
    );
  }

  // Not connected
  return (
    <div className="flex gap-2">
      {connectors.slice(0, 2).map((connector) => (
        <Button
          key={connector.uid}
          variant={connector.name === "Injected" ? "default" : "outline"}
          size="sm"
          disabled={isConnecting}
          onClick={() => connect({ connector })}
        >
          {isConnecting ? "Connecting..." : connector.name === "Injected" ? "Connect Wallet" : connector.name}
        </Button>
      ))}
    </div>
  );
}
