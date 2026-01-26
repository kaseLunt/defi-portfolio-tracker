"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Search, Wallet, ArrowRight, Sparkles } from "lucide-react";

// Demo wallet for testing - Ether.fi wallet with weETH
const DEMO_WALLET = "0x521c25254245bA6eE9F00825789687703E548774";

export default function DashboardPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const [customWallet, setCustomWallet] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect connected users to their wallet dashboard
  useEffect(() => {
    if (mounted && isConnected && address) {
      router.replace(`/dashboard/${address}`);
    }
  }, [mounted, isConnected, address, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customWallet && /^0x[a-fA-F0-9]{40}$/.test(customWallet)) {
      router.push(`/dashboard/${customWallet}`);
    } else if (customWallet) {
      toast.error("Invalid address", {
        description: "Please enter a valid Ethereum address (0x...)",
      });
    }
  };

  const viewDemo = () => {
    router.push(`/dashboard/${DEMO_WALLET}`);
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
          <p className="text-sm text-muted-foreground">Loading your portfolio...</p>
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
            <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute -bottom-1/2 -left-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl" />
          </div>

          <div className="relative space-y-4 animate-in" style={{ animationDelay: "0ms" }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 border border-border text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Multi-chain DeFi Portfolio Tracker</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-display">
              Track Any Wallet&apos;s
              <span className="text-gradient block">DeFi Portfolio</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              View token holdings, DeFi positions, yield earnings, and portfolio history
              across Ethereum, Arbitrum, Optimism, Base, and Polygon.
            </p>
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
                />
              </div>
              <Button type="submit" size="lg" className="gap-2 px-6">
                View Portfolio
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
              Or view a demo portfolio
            </button>
          </div>

          {/* Connect Wallet CTA */}
          <div className="pt-8 animate-in" style={{ animationDelay: "300ms" }}>
            <p className="text-sm text-muted-foreground mb-3">
              Connect your wallet for a personalized experience
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
              <Wallet className="w-4 h-4" />
              Use the Connect button in the header
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
