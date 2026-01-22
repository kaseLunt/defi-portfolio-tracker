"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Animated skeleton with stagger animation
 */
function AnimatedSkeleton({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay * 0.1, duration: 0.3 }}
    >
      <Skeleton className={className} />
    </motion.div>
  );
}

/**
 * Hero section skeleton
 */
export function HeroSkeleton() {
  return (
    <div className="relative overflow-hidden">
      {/* Background effects (same as real hero) */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div className="relative container py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Eyebrow badges */}
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-40 rounded-full" />
          </div>

          {/* Main value area */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-baseline gap-4 flex-wrap">
              <Skeleton className="h-14 w-72 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Stats cards skeleton
 */
export function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
        >
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32 mb-2" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Chart skeleton with animated "building" effect
 */
export function ChartSkeleton({
  message = "Building your portfolio chart...",
}: {
  message?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="flex items-baseline gap-4">
                <Skeleton className="h-8 w-40 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-10 w-48 rounded-xl" />
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-4">
          <div className="h-[200px] sm:h-[260px] flex flex-col items-center justify-center gap-4">
            {/* Animated bars that grow to simulate chart loading */}
            <div className="flex items-end gap-1 h-24">
              {[40, 60, 35, 80, 55, 70, 45, 90, 60, 75, 50, 85].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-3 rounded-t-sm bg-primary/20"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                    repeatDelay: 1,
                  }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Token holdings table skeleton
 */
export function TokenHoldingsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className="flex items-center gap-3 p-3"
        >
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Chain distribution skeleton
 */
export function ChainDistributionSkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-24" />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * DeFi positions skeleton
 */
export function DefiPositionsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
        >
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="text-right space-y-2">
                <Skeleton className="h-5 w-20 ml-auto" />
                <Skeleton className="h-3 w-14 ml-auto" />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Full dashboard skeleton layout
 * Shows a preview of the dashboard structure while loading
 */
export function DashboardSkeleton({
  showStats = true,
  showChart = true,
  showHoldings = true,
  showChains = true,
  showDefi = true,
}: {
  showStats?: boolean;
  showChart?: boolean;
  showHoldings?: boolean;
  showChains?: boolean;
  showDefi?: boolean;
}) {
  return (
    <div className="space-y-8">
      {showStats && <StatCardsSkeleton />}

      {showChart && <ChartSkeleton />}

      {(showHoldings || showChains) && (
        <div className="grid gap-6 lg:grid-cols-3">
          {showHoldings && (
            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardHeader>
                <CardContent>
                  <TokenHoldingsSkeleton />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {showChains && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-4">
                  <Skeleton className="h-5 w-16" />
                </CardHeader>
                <CardContent>
                  <ChainDistributionSkeleton />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {showDefi && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-4 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <DefiPositionsSkeleton />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
