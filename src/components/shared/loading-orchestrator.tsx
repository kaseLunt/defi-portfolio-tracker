"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Link2,
  Database,
  TrendingUp,
  CheckCircle2,
  Layers,
  BarChart3,
  Sparkles,
  Zap,
} from "lucide-react";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { PROTOCOL_METADATA } from "@/lib/protocol-metadata";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Loading stage definitions with timing estimates
const LOADING_STAGES = [
  {
    id: "connecting",
    label: "Connecting to networks",
    description: "Establishing secure connections to blockchain nodes",
    icon: Link2,
    durationMs: 2000,
  },
  {
    id: "scanning_tokens",
    label: "Scanning token balances",
    description: "Querying your holdings across all chains",
    icon: Wallet,
    durationMs: 3000,
  },
  {
    id: "discovering_defi",
    label: "Discovering DeFi positions",
    description: "Checking staking, lending, and LP positions",
    icon: Layers,
    durationMs: 8000,
  },
  {
    id: "fetching_prices",
    label: "Fetching historical prices",
    description: "Building your portfolio performance history",
    icon: TrendingUp,
    durationMs: 12000,
  },
  {
    id: "calculating",
    label: "Calculating performance",
    description: "Aggregating yields and portfolio metrics",
    icon: BarChart3,
    durationMs: 3000,
  },
  {
    id: "finalizing",
    label: "Preparing your dashboard",
    description: "Almost there...",
    icon: Sparkles,
    durationMs: 2000,
  },
] as const;

// Fun facts to show during loading
const LOADING_FACTS = [
  "We're scanning 5 chains simultaneously for maximum speed",
  "Your DeFi positions are tracked across 8 different protocols",
  "Historical data is fetched directly from on-chain records",
  "We check over 100+ token prices to value your portfolio",
  "First load is slower, but future visits use smart caching",
  "All data comes directly from the blockchain - no centralized databases",
];

// Tips for users
const LOADING_TIPS = [
  "💡 Tip: Click on any position to see detailed breakdown",
  "💡 Tip: Use the timeframe buttons to view different periods",
  "💡 Tip: Your portfolio refreshes automatically every 30 seconds",
  "💡 Tip: Try viewing different wallet addresses using the search bar",
];

// Default values as constants to avoid new references on each render
const DEFAULT_CHAINS: SupportedChainId[] = [1, 42161, 10, 8453, 137];
const DEFAULT_PROTOCOLS = ["lido", "etherfi", "aave-v3", "eigenlayer"];

interface LoadingOrchestratorProps {
  /** Current progress percentage (0-100) */
  progress?: number;
  /** Current stage from backend */
  stage?: string;
  /** Current status */
  status?: string;
  /** Number of chains processed */
  processedChains?: number;
  /** Total chains */
  totalChains?: number;
  /** Whether tokens have loaded */
  tokensLoaded?: boolean;
  /** Whether DeFi positions have loaded */
  defiLoaded?: boolean;
  /** Whether history has loaded */
  historyLoaded?: boolean;
  /** Error message if any */
  error?: string;
  /** Chains being scanned */
  chains?: SupportedChainId[];
  /** Protocols being scanned */
  protocols?: string[];
}

export function LoadingOrchestrator({
  progress = 0,
  stage,
  status,
  processedChains: processedChainsProp,
  totalChains: totalChainsProp,
  tokensLoaded = false,
  defiLoaded = false,
  historyLoaded = false,
  chains = DEFAULT_CHAINS,
  protocols = DEFAULT_PROTOCOLS,
}: LoadingOrchestratorProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentFact, setCurrentFact] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const [completedChains, setCompletedChains] = useState<Set<SupportedChainId>>(new Set());
  const [completedProtocols, setCompletedProtocols] = useState<Set<string>>(new Set());

  // Determine stage based on progress or backend stage
  const inferredStage = useMemo(() => {
    if (stage === "fetching_prices" || historyLoaded === false && defiLoaded && tokensLoaded) {
      return 3; // fetching_prices
    }
    if (stage === "processing" || (defiLoaded && tokensLoaded)) {
      return 4; // calculating
    }
    if (defiLoaded || stage === "fetching_balances") {
      return 2; // discovering_defi
    }
    if (tokensLoaded) {
      return 2; // discovering_defi
    }
    if (progress > 5) {
      return 1; // scanning_tokens
    }
    return 0; // connecting
  }, [stage, progress, tokensLoaded, defiLoaded, historyLoaded]);

  // Update current stage based on progress
  useEffect(() => {
    setCurrentStageIndex(inferredStage);
  }, [inferredStage]);

  // Animate elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs((prev) => prev + 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Cycle through facts
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFact((prev) => (prev + 1) % LOADING_FACTS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Show tip after a delay
  useEffect(() => {
    const timeout = setTimeout(() => setShowTip(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

  // Cycle tips
  useEffect(() => {
    if (!showTip) return;
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [showTip]);

  // Update chain completion based on backend progress or simulate if no data
  useEffect(() => {
    if (processedChainsProp !== undefined && processedChainsProp > 0) {
      // Use actual backend data - mark chains as complete up to processedChains count
      const chainsToComplete = chains.slice(0, processedChainsProp);
      setCompletedChains(new Set(chainsToComplete));
    } else if (currentStageIndex >= 1) {
      // Fallback: simulate chain completion based on elapsed time
      const chainDelay = 600;
      chains.forEach((chainId, idx) => {
        setTimeout(() => {
          setCompletedChains((prev) => new Set([...prev, chainId]));
        }, idx * chainDelay);
      });
    }
  }, [currentStageIndex, chains, processedChainsProp]);

  // Simulate protocol completion
  useEffect(() => {
    if (currentStageIndex >= 2) {
      const protocolDelay = 800;
      protocols.forEach((protocol, idx) => {
        setTimeout(() => {
          setCompletedProtocols((prev) => new Set([...prev, protocol]));
        }, idx * protocolDelay);
      });
    }
  }, [currentStageIndex, protocols]);

  const currentStage = LOADING_STAGES[currentStageIndex];
  const StageIcon = currentStage.icon;

  // Calculate smooth progress
  const smoothProgress = Math.max(
    progress,
    Math.min(95, (currentStageIndex / LOADING_STAGES.length) * 100 + 5)
  );

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Main Loading Card */}
      <Card className="w-full max-w-lg overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6">
          {/* Animated Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Outer glow ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary/20"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {/* Spinning border */}
              <motion.div
                className="h-20 w-20 rounded-2xl border-2 border-primary/20 border-t-primary flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <motion.div
                  key={currentStage.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <StageIcon className="h-8 w-8 text-primary" />
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Stage Label */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center mb-4"
            >
              <h3 className="text-lg font-semibold mb-1">{currentStage.label}</h3>
              <p className="text-sm text-muted-foreground">{currentStage.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Progress</span>
              <span className="tabular-nums">{Math.round(smoothProgress)}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary via-primary to-primary/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${smoothProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                  boxShadow: "0 0 20px hsl(var(--primary) / 0.5)",
                }}
              />
            </div>
          </div>

          {/* Stage Progress Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {LOADING_STAGES.map((s, idx) => (
              <motion.div
                key={s.id}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  idx === currentStageIndex
                    ? "w-6 bg-primary"
                    : idx < currentStageIndex
                      ? "w-2 bg-primary/60"
                      : "w-2 bg-secondary"
                )}
                animate={idx === currentStageIndex ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
            ))}
          </div>

          {/* Chain Status Grid */}
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
              Scanning networks
            </p>
            <div className="flex justify-center flex-wrap gap-2">
              {chains.map((chainId) => {
                const chain = CHAIN_INFO[chainId];
                const isCompleted = completedChains.has(chainId);
                return (
                  <motion.div
                    key={chainId}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-300",
                      isCompleted
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-secondary text-muted-foreground"
                    )}
                    animate={isCompleted ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: isCompleted ? "#34d399" : chain?.color || "#888",
                        boxShadow: isCompleted
                          ? "0 0 8px rgba(52, 211, 153, 0.5)"
                          : "none",
                      }}
                    />
                    <span>{chain?.name || `Chain ${chainId}`}</span>
                    {isCompleted && <CheckCircle2 className="h-3 w-3 ml-0.5" />}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Protocol Status (shows after chains) */}
          <AnimatePresence>
            {currentStageIndex >= 2 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <p className="text-xs font-medium text-muted-foreground mb-3 text-center">
                  Scanning protocols
                </p>
                <div className="flex justify-center flex-wrap gap-2">
                  {protocols.map((protocolId) => {
                    const protocol = PROTOCOL_METADATA[protocolId];
                    const isCompleted = completedProtocols.has(protocolId);
                    return (
                      <motion.div
                        key={protocolId}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                          isCompleted
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-secondary text-muted-foreground"
                        )}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: protocols.indexOf(protocolId) * 0.1 }}
                      >
                        {protocol?.logo && (
                          <img
                            src={protocol.logo}
                            alt={protocol.name}
                            className="h-4 w-4 rounded-full"
                          />
                        )}
                        <span>{protocol?.name || protocolId}</span>
                        {isCompleted && <CheckCircle2 className="h-3 w-3 ml-0.5" />}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated Fact */}
          <div className="border-t border-border pt-4">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentFact}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                className="text-xs text-center text-muted-foreground"
              >
                <Zap className="inline h-3 w-3 mr-1 text-amber-400" />
                {LOADING_FACTS[currentFact]}
              </motion.p>
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Tip (appears after delay) */}
      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 text-center"
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTip}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-muted-foreground"
              >
                {LOADING_TIPS[currentTip]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elapsed Time (subtle) */}
      <div className="mt-4 text-xs text-muted-foreground/60 tabular-nums">
        {Math.floor(elapsedMs / 1000)}s elapsed
      </div>
    </div>
  );
}

/**
 * Compact loading indicator for inline use
 */
export function LoadingStageIndicator({
  stage,
  className,
}: {
  stage: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <motion.div
        className="h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <span className="text-sm text-muted-foreground">{stage}</span>
    </div>
  );
}
