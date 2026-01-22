"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Hexagon, ChevronRight } from "lucide-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useWalletContext } from "@/app/providers";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/yield", label: "Yield" },
  { href: "/transactions", label: "Activity" },
  { href: "/alerts", label: "Alerts" },
];

export function Header() {
  const { address } = useWalletContext();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for header styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6 lg:gap-10">
          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-secondary/50 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all group-hover:scale-105">
                <Hexagon className="h-5 w-5 text-primary-foreground fill-primary-foreground/20" />
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="hidden sm:block">
              <span className="font-display font-semibold text-lg tracking-tight">
                OnChain
              </span>
              <span className="font-display font-semibold text-lg tracking-tight text-primary ml-1">
                Wealth
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-secondary" style={{ zIndex: -1 }} />
                  )}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[2px] rounded-full bg-primary"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationBell userId={address} />
          <ConnectButton />
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border animate-in">
          <nav className="container py-4 space-y-1">
            {NAV_ITEMS.map((item, index) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all animate-in",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {item.label}
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isActive && "text-primary"
                    )}
                  />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
