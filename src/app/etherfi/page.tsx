"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Wallet, ArrowRight, Sparkles, Shield, Zap, TrendingUp } from "lucide-react";
import { ETHERFI_BRAND } from "@/lib/etherfi-constants";

// Demo wallet for testing - Ether.fi wallet with weETH
const DEMO_WALLET = "0x521c25254245bA6eE9F00825789687703E548774";

export default function EtherFiPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const [customWallet, setCustomWallet] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect connected users to their wallet's EtherFi page
  useEffect(() => {
    if (mounted && isConnected && address) {
      router.replace(`/etherfi/${address}`);
    }
  }, [mounted, isConnected, address, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWallet && /^0x[a-fA-F0-9]{40}$/.test(customWallet)) {
      router.push(`/etherfi/${customWallet}`);
    } else if (customWallet) {
      toast.error("Invalid address", {
        description: "Please enter a valid Ethereum address (0x...)",
      });
    }
  };

  const viewDemo = () => {
    router.push(`/etherfi/${DEMO_WALLET}`);
  };

  // Show loading while checking connection status
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  // If connected, show loading while redirecting
  if (isConnected && address) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading EtherFi data...</p>
        </div>
      </div>
    );
  }

  // Landing page for non-connected users
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full blur-3xl opacity-20"
              style={{ background: ETHERFI_BRAND.gradient }}
            />
            <div
              className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full blur-3xl opacity-10"
              style={{ background: ETHERFI_BRAND.gradient }}
            />
          </div>

          <div className="relative space-y-4 animate-in" style={{ animationDelay: "0ms" }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm"
                 style={{ backgroundColor: `${ETHERFI_BRAND.primary}15` }}>
              <EtherFiLogo className="w-4 h-4" />
              <span style={{ color: ETHERFI_BRAND.primary }}>Ether.Fi Insights</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-display">
              Explore EtherFi
              <span className="block" style={{ color: ETHERFI_BRAND.primary }}>Staking & Loyalty</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              View any wallet&apos;s EtherFi loyalty tier, staking positions, validator status,
              and restaking rewards.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto animate-in" style={{ animationDelay: "50ms" }}>
            <div className="text-center p-4 rounded-xl bg-secondary/50 border border-border">
              <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: ETHERFI_BRAND.primary }} />
              <p className="text-xs text-muted-foreground">Loyalty Tiers</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-secondary/50 border border-border">
              <Zap className="w-6 h-6 mx-auto mb-2" style={{ color: ETHERFI_BRAND.primary }} />
              <p className="text-xs text-muted-foreground">Validator Status</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-secondary/50 border border-border">
              <TrendingUp className="w-6 h-6 mx-auto mb-2" style={{ color: ETHERFI_BRAND.primary }} />
              <p className="text-xs text-muted-foreground">Restaking APY</p>
            </div>
          </div>

          {/* Search Form */}
          <div className="relative animate-in" style={{ animationDelay: "100ms" }}>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Enter any wallet address (0x...)"
                  value={customWallet}
                  onChange={(e) => setCustomWallet(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-border bg-card/50 text-base focus:outline-none focus:border-primary focus:bg-card transition-all font-mono"
                  style={{ "--tw-ring-color": ETHERFI_BRAND.primary } as React.CSSProperties}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="gap-2 px-6"
                style={{ backgroundColor: ETHERFI_BRAND.primary }}
              >
                View EtherFi
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </div>

          {/* Demo Button */}
          <div className="animate-in" style={{ animationDelay: "200ms" }}>
            <button
              onClick={viewDemo}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Or view a demo wallet
            </button>
          </div>

          {/* Connect Wallet CTA */}
          <div className="pt-8 animate-in" style={{ animationDelay: "300ms" }}>
            <p className="text-sm text-muted-foreground mb-3">
              Connect your wallet to see your own EtherFi data
            </p>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: `${ETHERFI_BRAND.primary}15`, color: ETHERFI_BRAND.primary }}
            >
              <Wallet className="w-4 h-4" />
              Use the Connect button in the header
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EtherFiLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ color: ETHERFI_BRAND.primary }}
    >
      <path
        d="M12 2L3 9.5L12 13L21 9.5L12 2Z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M3 14.5L12 22L21 14.5L12 17L3 14.5Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
      <path d="M3 9.5V14.5L12 17V13L3 9.5Z" fill="currentColor" />
      <path
        d="M21 9.5V14.5L12 17V13L21 9.5Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
    </svg>
  );
}
