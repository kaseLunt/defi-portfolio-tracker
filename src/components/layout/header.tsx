"use client";

import Link from "next/link";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useWalletContext } from "@/app/providers";

export function Header() {
  const { address } = useWalletContext();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">O</span>
            </div>
            <span className="font-semibold text-lg hidden sm:inline">OnChain Wealth</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/portfolio"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Portfolio
            </Link>
            <Link
              href="/yield"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Yield
            </Link>
            <Link
              href="/transactions"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Transactions
            </Link>
            <Link
              href="/alerts"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Alerts
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell userId={address} />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
