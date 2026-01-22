"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useEnsName } from "wagmi";
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
import {
  LogOut,
  User,
  Shield,
  ChevronDown,
  Wallet,
  Loader2,
} from "lucide-react";

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address });
  const { isLoggedIn, isLoading, user, signIn, fullDisconnect } = useAuth();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto sign-in when wallet connects
  useEffect(() => {
    if (isConnected && address && !isLoggedIn && !isLoading) {
      const timer = setTimeout(() => {
        signIn();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, isLoggedIn, isLoading, signIn]);

  // Get the injected connector (MetaMask, etc.)
  const injectedConnector = connectors.find(
    (c) => c.type === "injected" || c.id === "injected"
  );

  // Show placeholder during SSR
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Connect</span>
      </Button>
    );
  }

  // Connected and logged in
  if (isConnected && address && isLoggedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-glow" />
            <span className="hidden sm:inline font-mono">
              {user?.ensName || ensName || formatAddress(address)}
            </span>
            <span className="sm:hidden font-mono">{formatAddress(address)}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem className="gap-2 font-mono text-xs">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{formatAddress(address)}</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-emerald-500">
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
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border text-sm">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-mono text-xs">
            {ensName || formatAddress(address)}
          </span>
        </div>
        <Button
          variant="default"
          size="sm"
          disabled={isLoading}
          onClick={() => signIn()}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Signing...</span>
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              <span>Sign In</span>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={fullDisconnect}
          className="text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    );
  }

  // Not connected - single connect button
  const handleConnect = () => {
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      disabled={isConnecting || isPending}
      onClick={handleConnect}
      className="gap-2"
    >
      {isConnecting || isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Connecting...</span>
        </>
      ) : (
        <>
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Connect</span>
        </>
      )}
    </Button>
  );
}
