"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowRight, BarChart3, Bell, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectButton } from "@/components/wallet/connect-button";

const features = [
  {
    icon: Wallet,
    title: "Portfolio Tracking",
    description:
      "Connect your wallet and see all your DeFi positions across multiple chains and protocols in one place.",
  },
  {
    icon: BarChart3,
    title: "Yield Optimization",
    description:
      "Compare yields across protocols and simulate strategies to maximize your returns.",
  },
  {
    icon: Zap,
    title: "Transaction Builder",
    description:
      "Build, simulate, and execute complex DeFi transactions with confidence.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description:
      "Get notified about position changes, yield drops, and important on-chain events.",
  },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render connect button placeholder during SSR to prevent hydration mismatch
  const renderCTA = () => {
    if (!mounted) {
      return (
        <Button size="lg" disabled>
          Connect Wallet
        </Button>
      );
    }

    if (isConnected) {
      return (
        <Link href="/dashboard">
          <Button size="lg">
            Go to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      );
    }

    return <ConnectButton />;
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container py-24 sm:py-32">
        <div className="flex flex-col items-center text-center gap-8">
          <div className="flex flex-col gap-4 max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your DeFi Portfolio,{" "}
              <span className="text-primary">Simplified</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Monitor, optimize, and manage your on-chain positions with
              neobank-grade UX. Connect your wallet to get started.
            </p>
          </div>

          <div className="flex gap-4">
            {renderCTA()}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-8 border-t w-full max-w-2xl">
            <div className="flex flex-col">
              <span className="text-3xl font-bold">$2.5B+</span>
              <span className="text-sm text-muted-foreground">
                Assets Tracked
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold">15+</span>
              <span className="text-sm text-muted-foreground">
                Protocols Supported
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold">5</span>
              <span className="text-sm text-muted-foreground">
                Chains Integrated
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold">10K+</span>
              <span className="text-sm text-muted-foreground">Active Users</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 sm:py-24">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need for on-chain wealth management
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            From portfolio tracking to yield optimization, we provide the tools
            you need to manage your DeFi positions effectively.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-card/50">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-16 sm:py-24">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center text-center gap-6 py-12">
            <h2 className="text-3xl font-bold tracking-tight">
              Ready to take control of your DeFi portfolio?
            </h2>
            <p className="text-primary-foreground/80 max-w-xl">
              Connect your wallet now and start tracking your positions across
              all major protocols and chains.
            </p>
            {!mounted ? (
              <Button size="lg" variant="secondary" disabled>
                Connect Wallet
              </Button>
            ) : isConnected ? (
              <Link href="/dashboard">
                <Button size="lg" variant="secondary">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <ConnectButton />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">O</span>
            </div>
            <span className="text-sm text-muted-foreground">
              OnChain Wealth - DeFi Portfolio Management
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">
              Documentation
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
