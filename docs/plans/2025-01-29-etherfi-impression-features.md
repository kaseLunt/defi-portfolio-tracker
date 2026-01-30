# EtherFi Impression Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete three high-impact features to impress EtherFi: working strategy execution, liquidation risk dashboard, and weETH cross-chain analytics.

**Architecture:**
- Strategy execution completes the existing pipeline by wiring wagmi's `sendTransaction` to the transaction plan
- Liquidation dashboard uses Aave V3 subgraphs to monitor health factors for weETH collateral positions
- Cross-chain analytics queries weETH balances and DeFi positions across Arbitrum, Base, and Optimism

**Tech Stack:** Next.js 16, tRPC 11, wagmi v3, viem v2, The Graph, Recharts

---

## Phase 0: Cleanup (30 min)

### Task 0.1: Remove Dead Analysis Components

**Files:**
- Delete: `src/components/strategy-builder/analysis/cyber-sankey.tsx`
- Delete: `src/components/strategy-builder/analysis/sankey-flow-diagram.tsx`
- Delete: `src/components/strategy-builder/analysis/holo-metric-card.tsx`
- Delete: `src/components/strategy-builder/analysis/neon-health-gauge.tsx`
- Delete: `src/components/strategy-builder/analysis/particle-field.tsx`
- Delete: `src/components/strategy-builder/analysis/tilt-3d-card.tsx`
- Delete: `src/components/strategy-builder/analysis/radial-health-gauge.tsx`
- Delete: `src/components/strategy-builder/analysis/animated-counter.tsx`
- Delete: `src/components/strategy-builder/analysis/modern-analysis.tsx`
- Delete: `src/components/strategy-builder/analysis/strategy-insights.tsx`
- Modify: `src/components/strategy-builder/analysis/index.ts`

**Step 1: Delete unused files**

```bash
rm src/components/strategy-builder/analysis/cyber-sankey.tsx
rm src/components/strategy-builder/analysis/sankey-flow-diagram.tsx
rm src/components/strategy-builder/analysis/holo-metric-card.tsx
rm src/components/strategy-builder/analysis/neon-health-gauge.tsx
rm src/components/strategy-builder/analysis/particle-field.tsx
rm src/components/strategy-builder/analysis/tilt-3d-card.tsx
rm src/components/strategy-builder/analysis/radial-health-gauge.tsx
rm src/components/strategy-builder/analysis/animated-counter.tsx
rm src/components/strategy-builder/analysis/modern-analysis.tsx
rm src/components/strategy-builder/analysis/strategy-insights.tsx
```

**Step 2: Update index.ts to only export used components**

```typescript
// src/components/strategy-builder/analysis/index.ts
/**
 * Strategy Analysis Components
 */

export { AnalysisView } from "./analysis-view";
```

**Step 3: Verify build still works**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused analysis components (~2500 lines of dead code)"
```

---

## Phase 1: Strategy Execution (1-2 hours)

### Task 1.1: Add wagmi Transaction Hooks

**Files:**
- Modify: `src/hooks/use-transaction-execution.ts`

**Step 1: Add wagmi imports and transaction sending logic**

Replace the placeholder `execute` function (lines 293-313) with real implementation:

```typescript
// Add these imports at the top of the file
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  usePublicClient
} from "wagmi";
import type { Hash } from "viem";

// Add state for tracking execution progress
const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
const [txHashes, setTxHashes] = useState<Hash[]>([]);
const [executionError, setExecutionError] = useState<string | null>(null);

// Get the public client for waiting on transactions
const publicClient = usePublicClient();

// Replace the execute function with this implementation:
const execute = useCallback(async () => {
  if (!plan || !simulationResult?.success || !publicClient) {
    setError("Cannot execute: simulation not successful or wallet not connected");
    return;
  }

  setPhase("executing");
  setExecutionError(null);
  const hashes: Hash[] = [];

  try {
    for (let i = 0; i < plan.steps.length; i++) {
      setCurrentStepIndex(i);
      const step = plan.steps[i];

      // Skip approval steps that are already approved
      if (step.action === "approve" && step.approvalStatus?.isApproved) {
        console.log(`[execute] Skipping already approved step ${i}`);
        continue;
      }

      console.log(`[execute] Executing step ${i + 1}/${plan.steps.length}: ${step.description}`);

      // Send the transaction
      const hash = await sendTransactionAsync({
        to: step.to as `0x${string}`,
        data: step.data as `0x${string}`,
        value: BigInt(step.value),
        chainId: step.chainId,
      });

      console.log(`[execute] Step ${i} tx hash: ${hash}`);
      hashes.push(hash);
      setTxHashes([...hashes]);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });

      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted at step ${i + 1}: ${step.description}`);
      }

      console.log(`[execute] Step ${i} confirmed in block ${receipt.blockNumber}`);
    }

    setPhase("complete");
  } catch (err) {
    console.error("[execute] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Transaction failed";
    setExecutionError(errorMessage);
    setError(errorMessage);
    setPhase("error");
  }
}, [plan, simulationResult, publicClient, sendTransactionAsync]);
```

**Step 2: Add sendTransaction hook setup**

Add after the existing tRPC mutations (around line 170):

```typescript
// wagmi transaction hook
const { sendTransactionAsync } = useSendTransaction();
```

**Step 3: Export new state in return object**

Add to the return object:

```typescript
return {
  // ... existing returns ...

  // Execution progress
  currentStepIndex,
  txHashes,
  executionError,
};
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/hooks/use-transaction-execution.ts
git commit -m "feat: implement real transaction execution with wagmi"
```

### Task 1.2: Update Execution Modal with Progress UI

**Files:**
- Modify: `src/components/strategy-builder/execution/execution-modal.tsx`

**Step 1: Add execution progress display**

Add after the existing "Executing State" section (around line 144):

```typescript
{/* Executing State - Enhanced with progress */}
{phase === "executing" && (
  <motion.div
    key="executing"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="space-y-6 py-6"
  >
    <div className="text-center">
      <Loader2 className="h-10 w-10 animate-spin text-purple-500 mx-auto mb-3" />
      <p className="text-lg font-medium">Executing Strategy</p>
      <p className="text-sm text-muted-foreground">
        Step {(execution.currentStepIndex ?? 0) + 1} of {plan?.steps.length ?? 0}
      </p>
    </div>

    {/* Step Progress */}
    <div className="space-y-2">
      {plan?.steps.map((step, i) => {
        const isComplete = i < (execution.currentStepIndex ?? 0);
        const isCurrent = i === execution.currentStepIndex;
        const txHash = execution.txHashes?.[i];

        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              isComplete && "bg-green-500/10 border-green-500/30",
              isCurrent && "bg-purple-500/10 border-purple-500/30",
              !isComplete && !isCurrent && "bg-muted/30 border-border"
            )}
          >
            <div className="flex-shrink-0">
              {isComplete ? (
                <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              ) : isCurrent ? (
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium truncate",
                isComplete && "text-green-400",
                isCurrent && "text-purple-400"
              )}>
                {step.description}
              </p>
              {txHash && (
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>

    <p className="text-xs text-center text-muted-foreground">
      Please confirm each transaction in your wallet
    </p>
  </motion.div>
)}
```

**Step 2: Add Check import if not present**

```typescript
import { X, Loader2, Check } from "lucide-react";
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/components/strategy-builder/execution/execution-modal.tsx
git commit -m "feat: add step-by-step execution progress UI"
```

---

## Phase 2: Liquidation Risk Dashboard (3-4 hours)

### Task 2.1: Create Liquidation Types

**Files:**
- Create: `src/lib/liquidation/types.ts`

**Step 1: Create types file**

```typescript
// src/lib/liquidation/types.ts
/**
 * Liquidation Risk Monitoring Types
 */

import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";

export interface LendingPosition {
  id: string;
  chainId: SupportedChainId;
  protocol: "aave-v3" | "morpho" | "compound-v3" | "spark";
  walletAddress: Address;

  // Collateral
  collateralToken: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  collateralAmountRaw: bigint;
  collateralAmountFormatted: number;
  collateralValueUsd: number;

  // Debt
  debtToken: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  debtAmountRaw: bigint;
  debtAmountFormatted: number;
  debtValueUsd: number;

  // Risk metrics
  healthFactor: number;
  liquidationThreshold: number; // e.g., 0.825 = 82.5%
  ltv: number; // Current loan-to-value
  maxLtv: number; // Maximum allowed LTV

  // Liquidation price (if applicable)
  liquidationPrice: number | null;
  currentPrice: number;
  priceDropToLiquidation: number; // Percentage drop needed

  // APY
  supplyApy: number;
  borrowApy: number;
  netApy: number;
}

export interface PositionRiskLevel {
  level: "safe" | "moderate" | "elevated" | "critical";
  color: string;
  description: string;
}

export function getPositionRiskLevel(healthFactor: number): PositionRiskLevel {
  if (healthFactor >= 2) {
    return { level: "safe", color: "emerald", description: "Position is well-collateralized" };
  }
  if (healthFactor >= 1.5) {
    return { level: "moderate", color: "yellow", description: "Monitor your position" };
  }
  if (healthFactor >= 1.25) {
    return { level: "elevated", color: "orange", description: "Consider adding collateral" };
  }
  return { level: "critical", color: "red", description: "High liquidation risk!" };
}

export interface LiquidationAlert {
  id: string;
  positionId: string;
  walletAddress: Address;
  type: "health_factor_low" | "health_factor_critical" | "price_drop_warning";
  message: string;
  healthFactor: number;
  threshold: number;
  createdAt: number;
  acknowledged: boolean;
}

export interface EcosystemHealthMetrics {
  totalWeethCollateralUsd: number;
  totalDebtAgainstWeethUsd: number;
  averageHealthFactor: number;
  positionsAtRisk: number; // HF < 1.5
  positionsCritical: number; // HF < 1.25
  totalPositions: number;
  chainBreakdown: Record<SupportedChainId, {
    collateralUsd: number;
    debtUsd: number;
    positions: number;
  }>;
}
```

**Step 2: Commit**

```bash
git add src/lib/liquidation/types.ts
git commit -m "feat: add liquidation monitoring types"
```

### Task 2.2: Create Liquidation Data Service

**Files:**
- Create: `src/server/services/liquidation.ts`

**Step 1: Create service file**

```typescript
// src/server/services/liquidation.ts
/**
 * Liquidation Risk Monitoring Service
 *
 * Queries lending protocol subgraphs to find positions using weETH/wstETH as collateral
 * and calculates liquidation risk metrics.
 */

import { gql } from "graphql-request";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { SUPPORTED_CHAINS, type SupportedChainId } from "@/lib/constants";
import { executeGraphQuery, SUBGRAPH_IDS } from "../adapters/graph/client";
import { getPriceBySymbol } from "./price";
import type { LendingPosition, EcosystemHealthMetrics } from "@/lib/liquidation/types";

// weETH addresses per chain
const WEETH_ADDRESSES: Record<number, Address> = {
  1: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",      // Mainnet
  42161: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",  // Arbitrum
  8453: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A",   // Base
  10: "0x5A7fACB970D094B6C7FF1df0eA68D99E6e73CBFF",     // Optimism
};

// Aave V3 subgraph query for user positions
const AAVE_USER_POSITIONS_QUERY = gql`
  query GetUserPositions($user: String!) {
    userReserves(where: { user: $user }) {
      id
      currentATokenBalance
      currentVariableDebt
      reserve {
        symbol
        decimals
        underlyingAsset
        liquidityRate
        variableBorrowRate
        baseLTVasCollateral
        reserveLiquidationThreshold
        usageAsCollateralEnabled
        price {
          priceInEth
        }
      }
    }
  }
`;

// Query for positions using specific collateral
const AAVE_COLLATERAL_POSITIONS_QUERY = gql`
  query GetWeethPositions($collateralAsset: String!, $first: Int!, $skip: Int!) {
    userReserves(
      where: {
        reserve_: { underlyingAsset: $collateralAsset }
        currentATokenBalance_gt: "0"
      }
      first: $first
      skip: $skip
      orderBy: currentATokenBalance
      orderDirection: desc
    ) {
      id
      user {
        id
      }
      currentATokenBalance
      reserve {
        symbol
        decimals
        underlyingAsset
        liquidityRate
        baseLTVasCollateral
        reserveLiquidationThreshold
        price {
          priceInEth
        }
      }
    }
  }
`;

interface AaveUserReserve {
  id: string;
  user?: { id: string };
  currentATokenBalance: string;
  currentVariableDebt?: string;
  reserve: {
    symbol: string;
    decimals: number;
    underlyingAsset: string;
    liquidityRate: string;
    variableBorrowRate?: string;
    baseLTVasCollateral: string;
    reserveLiquidationThreshold: string;
    usageAsCollateralEnabled?: boolean;
    price: {
      priceInEth: string;
    };
  };
}

/**
 * Get lending positions for a specific wallet
 */
export async function getWalletLendingPositions(
  walletAddress: Address,
  chainId: SupportedChainId = 1
): Promise<LendingPosition[]> {
  const positions: LendingPosition[] = [];

  try {
    const subgraphId = SUBGRAPH_IDS[chainId]?.["aave-v3"];
    if (!subgraphId) return [];

    const data = await executeGraphQuery<{ userReserves: AaveUserReserve[] }>(
      subgraphId,
      AAVE_USER_POSITIONS_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (!data?.userReserves) return [];

    // Get current ETH price for USD conversion
    const ethPrice = await getPriceBySymbol("ETH");

    // Find collateral and debt positions
    const collateralPositions = data.userReserves.filter(
      (r) => BigInt(r.currentATokenBalance) > 0n
    );
    const debtPositions = data.userReserves.filter(
      (r) => r.currentVariableDebt && BigInt(r.currentVariableDebt) > 0n
    );

    // Calculate health factor for each collateral position with debt
    for (const collateral of collateralPositions) {
      // Check if this is weETH or wstETH (assets we care about)
      const isWeeth = collateral.reserve.symbol.toLowerCase().includes("weeth");
      const isWsteth = collateral.reserve.symbol.toLowerCase().includes("wsteth");
      if (!isWeeth && !isWsteth) continue;

      const collateralAmount = BigInt(collateral.currentATokenBalance);
      const collateralFormatted = Number(formatUnits(collateralAmount, collateral.reserve.decimals));
      const priceInEth = Number(collateral.reserve.price.priceInEth) / 1e18;
      const collateralValueUsd = collateralFormatted * priceInEth * ethPrice;

      // Sum all debt
      let totalDebtUsd = 0;
      let totalDebtApy = 0;
      for (const debt of debtPositions) {
        const debtAmount = BigInt(debt.currentVariableDebt || "0");
        const debtFormatted = Number(formatUnits(debtAmount, debt.reserve.decimals));
        const debtPriceInEth = Number(debt.reserve.price.priceInEth) / 1e18;
        totalDebtUsd += debtFormatted * debtPriceInEth * ethPrice;
        totalDebtApy += Number(debt.reserve.variableBorrowRate || "0") / 1e25;
      }

      // Calculate health factor
      const liquidationThreshold = Number(collateral.reserve.reserveLiquidationThreshold) / 10000;
      const healthFactor = totalDebtUsd > 0
        ? (collateralValueUsd * liquidationThreshold) / totalDebtUsd
        : 999;

      // Calculate liquidation price
      const currentPrice = priceInEth * ethPrice;
      const liquidationPrice = totalDebtUsd > 0
        ? (totalDebtUsd / (collateralFormatted * liquidationThreshold))
        : null;
      const priceDropToLiquidation = liquidationPrice
        ? ((currentPrice - liquidationPrice) / currentPrice) * 100
        : 100;

      const supplyApy = Number(collateral.reserve.liquidityRate) / 1e25;

      positions.push({
        id: `${chainId}-${collateral.id}`,
        chainId,
        protocol: "aave-v3",
        walletAddress,
        collateralToken: {
          address: collateral.reserve.underlyingAsset as Address,
          symbol: collateral.reserve.symbol,
          decimals: collateral.reserve.decimals,
        },
        collateralAmountRaw: collateralAmount,
        collateralAmountFormatted: collateralFormatted,
        collateralValueUsd,
        debtToken: debtPositions[0] ? {
          address: debtPositions[0].reserve.underlyingAsset as Address,
          symbol: debtPositions[0].reserve.symbol,
          decimals: debtPositions[0].reserve.decimals,
        } : {
          address: "0x0000000000000000000000000000000000000000",
          symbol: "NONE",
          decimals: 18,
        },
        debtAmountRaw: 0n,
        debtAmountFormatted: 0,
        debtValueUsd: totalDebtUsd,
        healthFactor: Math.min(healthFactor, 999),
        liquidationThreshold,
        ltv: totalDebtUsd / collateralValueUsd,
        maxLtv: Number(collateral.reserve.baseLTVasCollateral) / 10000,
        liquidationPrice,
        currentPrice,
        priceDropToLiquidation,
        supplyApy,
        borrowApy: totalDebtApy,
        netApy: supplyApy - totalDebtApy,
      });
    }
  } catch (error) {
    console.error(`[liquidation] Error fetching positions for chain ${chainId}:`, error);
  }

  return positions;
}

/**
 * Get all positions across all chains for a wallet
 */
export async function getAllWalletPositions(
  walletAddress: Address
): Promise<LendingPosition[]> {
  const chainIds: SupportedChainId[] = [1, 42161, 8453, 10];

  const results = await Promise.allSettled(
    chainIds.map((chainId) => getWalletLendingPositions(walletAddress, chainId))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<LendingPosition[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
}

/**
 * Get ecosystem-wide health metrics for weETH positions
 */
export async function getEcosystemHealthMetrics(): Promise<EcosystemHealthMetrics> {
  const metrics: EcosystemHealthMetrics = {
    totalWeethCollateralUsd: 0,
    totalDebtAgainstWeethUsd: 0,
    averageHealthFactor: 0,
    positionsAtRisk: 0,
    positionsCritical: 0,
    totalPositions: 0,
    chainBreakdown: {} as Record<SupportedChainId, { collateralUsd: number; debtUsd: number; positions: number }>,
  };

  const chainIds: SupportedChainId[] = [1, 42161, 8453];
  let totalHealthFactorSum = 0;

  for (const chainId of chainIds) {
    try {
      const weethAddress = WEETH_ADDRESSES[chainId];
      if (!weethAddress) continue;

      const subgraphId = SUBGRAPH_IDS[chainId]?.["aave-v3"];
      if (!subgraphId) continue;

      // Query top positions using weETH as collateral
      const data = await executeGraphQuery<{ userReserves: AaveUserReserve[] }>(
        subgraphId,
        AAVE_COLLATERAL_POSITIONS_QUERY,
        { collateralAsset: weethAddress.toLowerCase(), first: 100, skip: 0 }
      );

      if (!data?.userReserves) continue;

      const ethPrice = await getPriceBySymbol("ETH");
      let chainCollateral = 0;
      let chainDebt = 0;
      let chainPositions = 0;

      for (const position of data.userReserves) {
        const collateralAmount = BigInt(position.currentATokenBalance);
        const collateralFormatted = Number(formatUnits(collateralAmount, position.reserve.decimals));
        const priceInEth = Number(position.reserve.price.priceInEth) / 1e18;
        const collateralValueUsd = collateralFormatted * priceInEth * ethPrice;

        chainCollateral += collateralValueUsd;
        chainPositions++;

        // Estimate health factor (would need to fetch debt separately for accuracy)
        // For ecosystem view, we estimate based on typical LTV
        const estimatedHf = 2.0; // Placeholder
        totalHealthFactorSum += estimatedHf;

        if (estimatedHf < 1.5) metrics.positionsAtRisk++;
        if (estimatedHf < 1.25) metrics.positionsCritical++;
      }

      metrics.chainBreakdown[chainId] = {
        collateralUsd: chainCollateral,
        debtUsd: chainDebt,
        positions: chainPositions,
      };

      metrics.totalWeethCollateralUsd += chainCollateral;
      metrics.totalPositions += chainPositions;
    } catch (error) {
      console.error(`[liquidation] Error fetching ecosystem metrics for chain ${chainId}:`, error);
    }
  }

  metrics.averageHealthFactor = metrics.totalPositions > 0
    ? totalHealthFactorSum / metrics.totalPositions
    : 0;

  return metrics;
}
```

**Step 2: Commit**

```bash
git add src/server/services/liquidation.ts
git commit -m "feat: add liquidation monitoring service"
```

### Task 2.3: Create Liquidation tRPC Router

**Files:**
- Create: `src/server/routers/liquidation.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create router**

```typescript
// src/server/routers/liquidation.ts
/**
 * Liquidation Risk tRPC Router
 */

import { z } from "zod";
import type { Address } from "viem";
import { router, publicProcedure } from "../trpc";
import {
  getWalletLendingPositions,
  getAllWalletPositions,
  getEcosystemHealthMetrics,
} from "../services/liquidation";
import { getPositionRiskLevel } from "@/lib/liquidation/types";

const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const liquidationRouter = router({
  /**
   * Get lending positions for a wallet on a specific chain
   */
  getPositions: publicProcedure
    .input(z.object({
      walletAddress: walletAddressSchema,
      chainId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const positions = input.chainId
        ? await getWalletLendingPositions(input.walletAddress as Address, input.chainId as 1 | 42161 | 8453 | 10 | 137)
        : await getAllWalletPositions(input.walletAddress as Address);

      return positions.map((p) => ({
        ...p,
        collateralAmountRaw: p.collateralAmountRaw.toString(),
        debtAmountRaw: p.debtAmountRaw.toString(),
        riskLevel: getPositionRiskLevel(p.healthFactor),
      }));
    }),

  /**
   * Get ecosystem-wide health metrics
   */
  getEcosystemHealth: publicProcedure.query(async () => {
    return getEcosystemHealthMetrics();
  }),

  /**
   * Simulate health factor after a price drop
   */
  simulatePriceDrop: publicProcedure
    .input(z.object({
      walletAddress: walletAddressSchema,
      priceDropPercent: z.number().min(0).max(100),
    }))
    .query(async ({ input }) => {
      const positions = await getAllWalletPositions(input.walletAddress as Address);

      return positions.map((p) => {
        const newPrice = p.currentPrice * (1 - input.priceDropPercent / 100);
        const newCollateralValue = p.collateralAmountFormatted * newPrice;
        const newHealthFactor = p.debtValueUsd > 0
          ? (newCollateralValue * p.liquidationThreshold) / p.debtValueUsd
          : 999;

        return {
          positionId: p.id,
          originalHealthFactor: p.healthFactor,
          newHealthFactor: Math.min(newHealthFactor, 999),
          wouldLiquidate: newHealthFactor < 1,
          riskLevel: getPositionRiskLevel(newHealthFactor),
        };
      });
    }),
});
```

**Step 2: Add to app router**

```typescript
// src/server/routers/_app.ts
import { router } from "../trpc";
import { userRouter } from "./user";
import { portfolioRouter } from "./portfolio";
import { notificationRouter } from "./notification";
import { priceRouter } from "./price";
import { historyRouter } from "./history";
import { etherfiRouter } from "./etherfi";
import { yieldsRouter } from "./yields";
import { transactionRouter } from "./transaction";
import { liquidationRouter } from "./liquidation";

export const appRouter = router({
  user: userRouter,
  portfolio: portfolioRouter,
  notification: notificationRouter,
  price: priceRouter,
  history: historyRouter,
  etherfi: etherfiRouter,
  yields: yieldsRouter,
  transaction: transactionRouter,
  liquidation: liquidationRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 3: Commit**

```bash
git add src/server/routers/liquidation.ts src/server/routers/_app.ts
git commit -m "feat: add liquidation risk tRPC router"
```

### Task 2.4: Create Liquidation Dashboard Page

**Files:**
- Create: `src/app/risk/page.tsx`
- Create: `src/components/risk/position-card.tsx`
- Create: `src/components/risk/ecosystem-health.tsx`
- Create: `src/components/risk/index.ts`

**Step 1: Create position card component**

```typescript
// src/components/risk/position-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import {
  AlertTriangle,
  TrendingDown,
  Shield,
  ExternalLink,
} from "lucide-react";
import type { PositionRiskLevel } from "@/lib/liquidation/types";

interface PositionCardProps {
  position: {
    id: string;
    chainId: SupportedChainId;
    protocol: string;
    collateralToken: { symbol: string };
    collateralAmountFormatted: number;
    collateralValueUsd: number;
    debtToken: { symbol: string };
    debtValueUsd: number;
    healthFactor: number;
    liquidationPrice: number | null;
    currentPrice: number;
    priceDropToLiquidation: number;
    netApy: number;
    riskLevel: PositionRiskLevel;
  };
}

export function PositionCard({ position }: PositionCardProps) {
  const chain = CHAIN_INFO[position.chainId];
  const riskColors = {
    safe: "border-emerald-500/30 bg-emerald-500/5",
    moderate: "border-yellow-500/30 bg-yellow-500/5",
    elevated: "border-orange-500/30 bg-orange-500/5",
    critical: "border-red-500/30 bg-red-500/5",
  };

  const riskTextColors = {
    safe: "text-emerald-400",
    moderate: "text-yellow-400",
    elevated: "text-orange-400",
    critical: "text-red-400",
  };

  return (
    <div className={cn(
      "rounded-xl border-2 p-5 transition-all hover:shadow-lg",
      riskColors[position.riskLevel.level]
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: chain.color }}
          />
          <span className="text-sm font-medium">{chain.name}</span>
          <span className="text-xs text-muted-foreground">
            {position.protocol.toUpperCase()}
          </span>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
          position.riskLevel.level === "critical" && "bg-red-500/20 text-red-400",
          position.riskLevel.level === "elevated" && "bg-orange-500/20 text-orange-400",
          position.riskLevel.level === "moderate" && "bg-yellow-500/20 text-yellow-400",
          position.riskLevel.level === "safe" && "bg-emerald-500/20 text-emerald-400"
        )}>
          {position.riskLevel.level === "critical" && <AlertTriangle className="w-3 h-3" />}
          {position.riskLevel.level === "safe" && <Shield className="w-3 h-3" />}
          {position.riskLevel.level.charAt(0).toUpperCase() + position.riskLevel.level.slice(1)}
        </div>
      </div>

      {/* Collateral & Debt */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Collateral</div>
          <div className="font-semibold">
            {position.collateralAmountFormatted.toFixed(4)} {position.collateralToken.symbol}
          </div>
          <div className="text-sm text-muted-foreground">
            ${position.collateralValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Debt</div>
          <div className="font-semibold">
            {position.debtToken.symbol}
          </div>
          <div className="text-sm text-muted-foreground">
            ${position.debtValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Health Factor */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Health Factor</span>
          <span className={cn("font-mono font-semibold", riskTextColors[position.riskLevel.level])}>
            {position.healthFactor >= 100 ? "∞" : position.healthFactor.toFixed(2)}
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              position.riskLevel.level === "safe" && "bg-emerald-500",
              position.riskLevel.level === "moderate" && "bg-yellow-500",
              position.riskLevel.level === "elevated" && "bg-orange-500",
              position.riskLevel.level === "critical" && "bg-red-500"
            )}
            style={{ width: `${Math.min((position.healthFactor / 3) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Liquidation Info */}
      {position.liquidationPrice && (
        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingDown className="w-4 h-4" />
            <span>Liquidation at</span>
          </div>
          <div className="text-right">
            <div className="font-mono font-semibold">
              ${position.liquidationPrice.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {position.priceDropToLiquidation.toFixed(1)}% drop
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create ecosystem health component**

```typescript
// src/components/risk/ecosystem-health.tsx
"use client";

import { cn } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { Activity, AlertTriangle, Shield, TrendingUp } from "lucide-react";

interface EcosystemHealthProps {
  metrics: {
    totalWeethCollateralUsd: number;
    totalDebtAgainstWeethUsd: number;
    averageHealthFactor: number;
    positionsAtRisk: number;
    positionsCritical: number;
    totalPositions: number;
    chainBreakdown: Record<SupportedChainId, {
      collateralUsd: number;
      debtUsd: number;
      positions: number;
    }>;
  };
}

export function EcosystemHealth({ metrics }: EcosystemHealthProps) {
  const utilizationRate = metrics.totalWeethCollateralUsd > 0
    ? (metrics.totalDebtAgainstWeethUsd / metrics.totalWeethCollateralUsd) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="weETH Collateral"
          value={`$${(metrics.totalWeethCollateralUsd / 1e6).toFixed(1)}M`}
          icon={<Shield className="w-4 h-4 text-purple-400" />}
        />
        <StatCard
          label="Total Positions"
          value={metrics.totalPositions.toLocaleString()}
          icon={<Activity className="w-4 h-4 text-blue-400" />}
        />
        <StatCard
          label="At Risk (HF < 1.5)"
          value={metrics.positionsAtRisk.toString()}
          icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
          highlight={metrics.positionsAtRisk > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Critical (HF < 1.25)"
          value={metrics.positionsCritical.toString()}
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          highlight={metrics.positionsCritical > 0 ? "danger" : undefined}
        />
      </div>

      {/* Chain Breakdown */}
      <div className="rounded-xl border border-zinc-800 p-5">
        <h3 className="text-sm font-medium mb-4">Chain Distribution</h3>
        <div className="space-y-3">
          {Object.entries(metrics.chainBreakdown).map(([chainIdStr, data]) => {
            const chainId = Number(chainIdStr) as SupportedChainId;
            const chain = CHAIN_INFO[chainId];
            if (!chain || data.collateralUsd === 0) return null;

            const share = (data.collateralUsd / metrics.totalWeethCollateralUsd) * 100;

            return (
              <div key={chainId} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: chain.color }}
                    />
                    <span>{chain.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {data.positions} positions
                    </span>
                    <span className="font-mono">
                      ${(data.collateralUsd / 1e6).toFixed(2)}M
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${share}%`,
                      backgroundColor: chain.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: "warning" | "danger";
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      highlight === "warning" && "border-yellow-500/30 bg-yellow-500/5",
      highlight === "danger" && "border-red-500/30 bg-red-500/5",
      !highlight && "border-zinc-800 bg-zinc-900/50"
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
```

**Step 3: Create index file**

```typescript
// src/components/risk/index.ts
export { PositionCard } from "./position-card";
export { EcosystemHealth } from "./ecosystem-health";
```

**Step 4: Create page**

```typescript
// src/app/risk/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { trpc } from "@/lib/trpc";
import { PositionCard, EcosystemHealth } from "@/components/risk";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, AlertTriangle, RefreshCw } from "lucide-react";

export default function RiskDashboardPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: positions, isLoading: positionsLoading, refetch: refetchPositions } =
    trpc.liquidation.getPositions.useQuery(
      { walletAddress: address ?? "" },
      { enabled: !!address }
    );

  const { data: ecosystemHealth, isLoading: ecosystemLoading } =
    trpc.liquidation.getEcosystemHealth.useQuery();

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-500" />
              Liquidation Risk Monitor
            </h1>
            <p className="text-muted-foreground mt-1">
              Track health factors and liquidation risk for weETH positions
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPositions()}
            disabled={positionsLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", positionsLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Ecosystem Health */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Ecosystem Overview</h2>
          {ecosystemLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : ecosystemHealth ? (
            <EcosystemHealth metrics={ecosystemHealth} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Failed to load ecosystem data
            </div>
          )}
        </div>

        {/* User Positions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">
            {isConnected ? "Your Positions" : "Connect Wallet to View Positions"}
          </h2>

          {!isConnected ? (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
              <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Connect your wallet to monitor your lending positions
              </p>
            </div>
          ) : positionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : positions && positions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map((position) => (
                <PositionCard key={position.id} position={position} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No lending positions found with weETH or wstETH collateral
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
```

**Step 5: Commit**

```bash
git add src/app/risk/page.tsx src/components/risk/
git commit -m "feat: add liquidation risk dashboard page"
```

---

## Phase 3: Cross-Chain Analytics (3-4 hours)

### Task 3.1: Create Cross-Chain Types

**Files:**
- Create: `src/lib/crosschain/types.ts`

**Step 1: Create types file**

```typescript
// src/lib/crosschain/types.ts
/**
 * Cross-Chain Analytics Types
 */

import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";

export interface ChainWeethData {
  chainId: SupportedChainId;
  chainName: string;

  // Balance data
  weethBalance: bigint;
  weethBalanceFormatted: number;
  weethValueUsd: number;

  // DeFi positions
  defiPositions: WeethDefiPosition[];
  totalDefiValueUsd: number;

  // Yield opportunities
  bestYieldProtocol: string | null;
  bestYieldApy: number;

  // Activity
  lastActivityTimestamp: number | null;
}

export interface WeethDefiPosition {
  protocol: string;
  protocolName: string;
  type: "supply" | "collateral" | "lp" | "staking";
  amount: number;
  valueUsd: number;
  apy: number;
  healthFactor?: number;
}

export interface CrossChainSummary {
  totalWeethBalance: number;
  totalWeethValueUsd: number;
  totalDefiValueUsd: number;
  chainCount: number;
  chains: ChainWeethData[];

  // Insights
  mostActiveChain: SupportedChainId | null;
  bestYieldChain: SupportedChainId | null;
  bestYieldApy: number;
  utilizationRate: number; // % of weETH in DeFi vs wallet
}

export interface YieldOpportunity {
  chainId: SupportedChainId;
  chainName: string;
  protocol: string;
  protocolName: string;
  type: "supply" | "collateral" | "lp";
  apy: number;
  tvl: number;
  riskLevel: "low" | "medium" | "high";
}
```

**Step 2: Commit**

```bash
git add src/lib/crosschain/types.ts
git commit -m "feat: add cross-chain analytics types"
```

### Task 3.2: Create Cross-Chain Service

**Files:**
- Create: `src/server/services/crosschain.ts`

**Step 1: Create service file**

```typescript
// src/server/services/crosschain.ts
/**
 * Cross-Chain weETH Analytics Service
 *
 * Tracks weETH holdings and DeFi positions across multiple chains.
 */

import { gql } from "graphql-request";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { createPublicClient, http } from "viem";
import { mainnet, arbitrum, optimism, base } from "viem/chains";
import { SUPPORTED_CHAINS, CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { executeGraphQuery, SUBGRAPH_IDS } from "../adapters/graph/client";
import { getPriceBySymbol } from "./price";
import { getYieldsByProtocol } from "./yields";
import type {
  ChainWeethData,
  CrossChainSummary,
  WeethDefiPosition,
  YieldOpportunity
} from "@/lib/crosschain/types";

// weETH addresses per chain
const WEETH_ADDRESSES: Record<number, Address> = {
  1: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
  42161: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
  8453: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A",
  10: "0x5A7fACB970D094B6C7FF1df0eA68D99E6e73CBFF",
};

// RPC clients per chain
const RPC_URLS: Record<number, string> = {
  1: process.env.NEXT_PUBLIC_ALCHEMY_RPC_MAINNET || `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  42161: process.env.NEXT_PUBLIC_ALCHEMY_RPC_ARBITRUM || `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  8453: process.env.NEXT_PUBLIC_ALCHEMY_RPC_BASE || `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  10: process.env.NEXT_PUBLIC_ALCHEMY_RPC_OPTIMISM || `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
};

const CHAINS_CONFIG = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
  10: optimism,
};

// ERC20 ABI for balance queries
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Aave query for weETH positions
const AAVE_WEETH_POSITIONS_QUERY = gql`
  query GetWeethPosition($user: String!, $asset: String!) {
    userReserves(where: { user: $user, reserve_: { underlyingAsset: $asset } }) {
      currentATokenBalance
      reserve {
        symbol
        decimals
        liquidityRate
      }
    }
  }
`;

/**
 * Get weETH balance on a specific chain
 */
async function getWeethBalance(
  walletAddress: Address,
  chainId: number
): Promise<bigint> {
  const weethAddress = WEETH_ADDRESSES[chainId];
  if (!weethAddress) return 0n;

  try {
    const chain = CHAINS_CONFIG[chainId as keyof typeof CHAINS_CONFIG];
    if (!chain) return 0n;

    const client = createPublicClient({
      chain,
      transport: http(RPC_URLS[chainId]),
    });

    const balance = await client.readContract({
      address: weethAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    return balance;
  } catch (error) {
    console.error(`[crosschain] Error fetching weETH balance on chain ${chainId}:`, error);
    return 0n;
  }
}

/**
 * Get weETH DeFi positions on a specific chain
 */
async function getWeethDefiPositions(
  walletAddress: Address,
  chainId: SupportedChainId
): Promise<WeethDefiPosition[]> {
  const positions: WeethDefiPosition[] = [];
  const weethAddress = WEETH_ADDRESSES[chainId];
  if (!weethAddress) return [];

  try {
    // Query Aave V3
    const subgraphId = SUBGRAPH_IDS[chainId]?.["aave-v3"];
    if (subgraphId) {
      const data = await executeGraphQuery<{
        userReserves: Array<{
          currentATokenBalance: string;
          reserve: { symbol: string; decimals: number; liquidityRate: string };
        }>;
      }>(subgraphId, AAVE_WEETH_POSITIONS_QUERY, {
        user: walletAddress.toLowerCase(),
        asset: weethAddress.toLowerCase(),
      });

      if (data?.userReserves?.[0]) {
        const reserve = data.userReserves[0];
        const amount = Number(formatUnits(BigInt(reserve.currentATokenBalance), reserve.reserve.decimals));
        const apy = Number(reserve.reserve.liquidityRate) / 1e25;
        const weethPrice = await getPriceBySymbol("WEETH");

        if (amount > 0) {
          positions.push({
            protocol: "aave-v3",
            protocolName: "Aave V3",
            type: "supply",
            amount,
            valueUsd: amount * weethPrice,
            apy,
          });
        }
      }
    }
  } catch (error) {
    console.error(`[crosschain] Error fetching DeFi positions on chain ${chainId}:`, error);
  }

  return positions;
}

/**
 * Get comprehensive weETH data for a wallet across all chains
 */
export async function getCrossChainWeethData(
  walletAddress: Address
): Promise<CrossChainSummary> {
  const chainIds: SupportedChainId[] = [1, 42161, 8453, 10];
  const weethPrice = await getPriceBySymbol("WEETH");

  const chainDataPromises = chainIds.map(async (chainId) => {
    const [balance, defiPositions] = await Promise.all([
      getWeethBalance(walletAddress, chainId),
      getWeethDefiPositions(walletAddress, chainId),
    ]);

    const balanceFormatted = Number(formatUnits(balance, 18));
    const totalDefiValue = defiPositions.reduce((sum, p) => sum + p.valueUsd, 0);
    const bestYield = defiPositions.reduce((best, p) =>
      p.apy > (best?.apy ?? 0) ? p : best, null as WeethDefiPosition | null);

    const chainData: ChainWeethData = {
      chainId,
      chainName: CHAIN_INFO[chainId].name,
      weethBalance: balance,
      weethBalanceFormatted: balanceFormatted,
      weethValueUsd: balanceFormatted * weethPrice,
      defiPositions,
      totalDefiValueUsd: totalDefiValue,
      bestYieldProtocol: bestYield?.protocol ?? null,
      bestYieldApy: bestYield?.apy ?? 0,
      lastActivityTimestamp: null,
    };

    return chainData;
  });

  const chains = await Promise.all(chainDataPromises);

  // Calculate summary
  const totalWeethBalance = chains.reduce((sum, c) => sum + c.weethBalanceFormatted, 0);
  const totalWeethValueUsd = chains.reduce((sum, c) => sum + c.weethValueUsd, 0);
  const totalDefiValueUsd = chains.reduce((sum, c) => sum + c.totalDefiValueUsd, 0);
  const activeChains = chains.filter(c => c.weethBalanceFormatted > 0 || c.totalDefiValueUsd > 0);

  const bestYieldChain = chains.reduce((best, c) =>
    c.bestYieldApy > (best?.bestYieldApy ?? 0) ? c : best, null as ChainWeethData | null);
  const mostActiveChain = chains.reduce((best, c) =>
    (c.weethValueUsd + c.totalDefiValueUsd) > ((best?.weethValueUsd ?? 0) + (best?.totalDefiValueUsd ?? 0)) ? c : best,
    null as ChainWeethData | null);

  return {
    totalWeethBalance,
    totalWeethValueUsd,
    totalDefiValueUsd,
    chainCount: activeChains.length,
    chains,
    mostActiveChain: mostActiveChain?.chainId ?? null,
    bestYieldChain: bestYieldChain?.chainId ?? null,
    bestYieldApy: bestYieldChain?.bestYieldApy ?? 0,
    utilizationRate: totalWeethValueUsd > 0
      ? (totalDefiValueUsd / totalWeethValueUsd) * 100
      : 0,
  };
}

/**
 * Get best yield opportunities for weETH across chains
 */
export async function getWeethYieldOpportunities(): Promise<YieldOpportunity[]> {
  const opportunities: YieldOpportunity[] = [];

  // Add known yield opportunities (in production, query from DeFi Llama or subgraphs)
  const knownOpportunities: Omit<YieldOpportunity, "apy" | "tvl">[] = [
    { chainId: 1, chainName: "Ethereum", protocol: "aave-v3", protocolName: "Aave V3", type: "supply", riskLevel: "low" },
    { chainId: 42161, chainName: "Arbitrum", protocol: "aave-v3", protocolName: "Aave V3", type: "supply", riskLevel: "low" },
    { chainId: 8453, chainName: "Base", protocol: "aave-v3", protocolName: "Aave V3", type: "supply", riskLevel: "low" },
    { chainId: 1, chainName: "Ethereum", protocol: "morpho", protocolName: "Morpho", type: "supply", riskLevel: "medium" },
    { chainId: 1, chainName: "Ethereum", protocol: "pendle", protocolName: "Pendle", type: "lp", riskLevel: "medium" },
  ];

  for (const opp of knownOpportunities) {
    try {
      // Fetch actual APY from yields service or use placeholder
      const yields = await getYieldsByProtocol(opp.protocol);
      const weethYield = yields.find(y => y.symbol?.toLowerCase().includes("weeth"));

      opportunities.push({
        ...opp,
        apy: weethYield?.apy ?? 0,
        tvl: weethYield?.tvlUsd ?? 0,
      });
    } catch {
      opportunities.push({ ...opp, apy: 0, tvl: 0 });
    }
  }

  return opportunities.sort((a, b) => b.apy - a.apy);
}
```

**Step 2: Commit**

```bash
git add src/server/services/crosschain.ts
git commit -m "feat: add cross-chain weETH analytics service"
```

### Task 3.3: Create Cross-Chain tRPC Router

**Files:**
- Create: `src/server/routers/crosschain.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create router**

```typescript
// src/server/routers/crosschain.ts
/**
 * Cross-Chain Analytics tRPC Router
 */

import { z } from "zod";
import type { Address } from "viem";
import { router, publicProcedure } from "../trpc";
import {
  getCrossChainWeethData,
  getWeethYieldOpportunities,
} from "../services/crosschain";

const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const crosschainRouter = router({
  /**
   * Get weETH data across all chains for a wallet
   */
  getWeethSummary: publicProcedure
    .input(z.object({ walletAddress: walletAddressSchema }))
    .query(async ({ input }) => {
      const data = await getCrossChainWeethData(input.walletAddress as Address);

      // Serialize BigInt values
      return {
        ...data,
        chains: data.chains.map(c => ({
          ...c,
          weethBalance: c.weethBalance.toString(),
        })),
      };
    }),

  /**
   * Get best yield opportunities for weETH
   */
  getYieldOpportunities: publicProcedure.query(async () => {
    return getWeethYieldOpportunities();
  }),
});
```

**Step 2: Update app router**

```typescript
// src/server/routers/_app.ts - add import and router
import { crosschainRouter } from "./crosschain";

// In the router object, add:
crosschain: crosschainRouter,
```

**Step 3: Commit**

```bash
git add src/server/routers/crosschain.ts src/server/routers/_app.ts
git commit -m "feat: add cross-chain analytics tRPC router"
```

### Task 3.4: Create Cross-Chain Analytics Page

**Files:**
- Create: `src/app/analytics/page.tsx`
- Create: `src/components/analytics/chain-card.tsx`
- Create: `src/components/analytics/yield-table.tsx`
- Create: `src/components/analytics/index.ts`

**Step 1: Create chain card component**

```typescript
// src/components/analytics/chain-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { TrendingUp, Wallet, PiggyBank } from "lucide-react";

interface ChainCardProps {
  chain: {
    chainId: SupportedChainId;
    chainName: string;
    weethBalanceFormatted: number;
    weethValueUsd: number;
    totalDefiValueUsd: number;
    bestYieldProtocol: string | null;
    bestYieldApy: number;
    defiPositions: Array<{
      protocolName: string;
      type: string;
      amount: number;
      valueUsd: number;
      apy: number;
    }>;
  };
}

export function ChainCard({ chain }: ChainCardProps) {
  const chainInfo = CHAIN_INFO[chain.chainId];
  const totalValue = chain.weethValueUsd + chain.totalDefiValueUsd;
  const hasActivity = totalValue > 0;

  if (!hasActivity) {
    return (
      <div className="rounded-xl border border-zinc-800/50 p-5 bg-zinc-900/30 opacity-60">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${chainInfo.color}20` }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: chainInfo.color }}
            />
          </div>
          <div>
            <div className="font-semibold">{chainInfo.name}</div>
            <div className="text-sm text-muted-foreground">No weETH found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 p-5 bg-zinc-900/50 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${chainInfo.color}20` }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: chainInfo.color }}
            />
          </div>
          <div>
            <div className="font-semibold">{chainInfo.name}</div>
            <div className="text-sm text-muted-foreground">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
            </div>
          </div>
        </div>
        {chain.bestYieldApy > 0 && (
          <div className="flex items-center gap-1 text-emerald-400 text-sm">
            <TrendingUp className="w-4 h-4" />
            {chain.bestYieldApy.toFixed(2)}% APY
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Wallet className="w-3 h-3" />
            Wallet
          </div>
          <div className="font-semibold">
            {chain.weethBalanceFormatted.toFixed(4)} weETH
          </div>
          <div className="text-xs text-muted-foreground">
            ${chain.weethValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <PiggyBank className="w-3 h-3" />
            In DeFi
          </div>
          <div className="font-semibold">
            ${chain.totalDefiValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-muted-foreground">
            {chain.defiPositions.length} position{chain.defiPositions.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* DeFi Positions */}
      {chain.defiPositions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Active Positions
          </div>
          {chain.defiPositions.map((pos, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30 text-sm"
            >
              <div>
                <span className="font-medium">{pos.protocolName}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {pos.type}
                </span>
              </div>
              <div className="text-right">
                <div className="font-mono">
                  ${pos.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-emerald-400">
                  {pos.apy.toFixed(2)}% APY
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create yield table component**

```typescript
// src/components/analytics/yield-table.tsx
"use client";

import { cn } from "@/lib/utils";
import { CHAIN_INFO, type SupportedChainId } from "@/lib/constants";
import { TrendingUp, ExternalLink, Shield, AlertTriangle } from "lucide-react";

interface YieldOpportunity {
  chainId: SupportedChainId;
  chainName: string;
  protocol: string;
  protocolName: string;
  type: string;
  apy: number;
  tvl: number;
  riskLevel: "low" | "medium" | "high";
}

interface YieldTableProps {
  opportunities: YieldOpportunity[];
}

export function YieldTable({ opportunities }: YieldTableProps) {
  const riskConfig = {
    low: { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    medium: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    high: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  };

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Protocol
            </th>
            <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Chain
            </th>
            <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Type
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              APY
            </th>
            <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              TVL
            </th>
            <th className="text-center p-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Risk
            </th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp, i) => {
            const chain = CHAIN_INFO[opp.chainId];
            const risk = riskConfig[opp.riskLevel];
            const RiskIcon = risk.icon;

            return (
              <tr
                key={`${opp.chainId}-${opp.protocol}-${i}`}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="p-4">
                  <div className="font-medium">{opp.protocolName}</div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: chain.color }}
                    />
                    <span className="text-sm">{chain.name}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm text-muted-foreground capitalize">
                    {opp.type}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="font-mono font-semibold text-emerald-400">
                    {opp.apy.toFixed(2)}%
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="font-mono text-muted-foreground">
                    ${(opp.tvl / 1e6).toFixed(1)}M
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-center">
                    <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs", risk.bg, risk.color)}>
                      <RiskIcon className="w-3 h-3" />
                      {opp.riskLevel}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 3: Create index file**

```typescript
// src/components/analytics/index.ts
export { ChainCard } from "./chain-card";
export { YieldTable } from "./yield-table";
```

**Step 4: Create page**

```typescript
// src/app/analytics/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { trpc } from "@/lib/trpc";
import { ChainCard, YieldTable } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Globe,
  TrendingUp,
  Wallet,
  PiggyBank,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: summary, isLoading: summaryLoading, refetch } =
    trpc.crosschain.getWeethSummary.useQuery(
      { walletAddress: address ?? "" },
      { enabled: !!address }
    );

  const { data: opportunities, isLoading: opportunitiesLoading } =
    trpc.crosschain.getYieldOpportunities.useQuery();

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Globe className="w-8 h-8 text-purple-500" />
              Cross-Chain Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your weETH across Ethereum, Arbitrum, Base & Optimism
            </p>
          </div>
          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={summaryLoading}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", summaryLoading && "animate-spin")} />
              Refresh
            </Button>
          )}
        </div>

        {/* Summary Stats */}
        {isConnected && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              label="Total weETH"
              value={`${summary.totalWeethBalance.toFixed(4)}`}
              subValue={`$${summary.totalWeethValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              icon={<Wallet className="w-4 h-4 text-purple-400" />}
            />
            <SummaryCard
              label="In DeFi"
              value={`$${summary.totalDefiValueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              subValue={`${summary.utilizationRate.toFixed(1)}% utilized`}
              icon={<PiggyBank className="w-4 h-4 text-blue-400" />}
            />
            <SummaryCard
              label="Active Chains"
              value={summary.chainCount.toString()}
              subValue="of 4 supported"
              icon={<Globe className="w-4 h-4 text-emerald-400" />}
            />
            <SummaryCard
              label="Best APY"
              value={`${summary.bestYieldApy.toFixed(2)}%`}
              subValue={summary.bestYieldChain ? `on ${summary.chains.find(c => c.chainId === summary.bestYieldChain)?.chainName}` : ""}
              icon={<TrendingUp className="w-4 h-4 text-yellow-400" />}
            />
          </div>
        )}

        {/* Chain Breakdown */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">
            {isConnected ? "Your weETH by Chain" : "Connect Wallet to View Holdings"}
          </h2>

          {!isConnected ? (
            <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
              <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Connect your wallet to see your cross-chain weETH holdings
              </p>
            </div>
          ) : summaryLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.chains.map((chain) => (
                <ChainCard key={chain.chainId} chain={chain} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Yield Opportunities */}
        <div>
          <h2 className="text-lg font-semibold mb-4">weETH Yield Opportunities</h2>

          {opportunitiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : opportunities && opportunities.length > 0 ? (
            <YieldTable opportunities={opportunities} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No yield opportunities found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subValue,
  icon,
}: {
  label: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 p-4 bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{subValue}</div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/app/analytics/ src/components/analytics/
git commit -m "feat: add cross-chain weETH analytics page"
```

---

## Phase 4: Integration & Polish

### Task 4.1: Add Navigation Links

**Files:**
- Modify: `src/components/layout/header.tsx`

**Step 1: Add Risk and Analytics links to navigation**

Find the navigation section and add:

```typescript
{ name: "Risk", href: "/risk" },
{ name: "Analytics", href: "/analytics" },
```

**Step 2: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add Risk and Analytics to navigation"
```

### Task 4.2: Final Build Verification

**Step 1: Run full build**

```bash
npm run build
```

**Step 2: Fix any TypeScript errors**

**Step 3: Run linting**

```bash
npm run lint
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix build issues and linting"
```

---

## Gamechangers to Consider (Future)

Track these for potential future implementation:

1. **EtherFi Points Calculator** - Show how strategies affect loyalty point accumulation
2. **Liquidation Cascade Simulator** - "If ETH drops X%, how much weETH gets liquidated ecosystem-wide?"
3. **Strategy Sharing** - Let users share winning strategies with shareable links
4. **Historical Backtest** - "What would this strategy have earned over the past 6 months?"
5. **Push Notifications** - Telegram/email alerts when health factor drops
6. **Gas Optimization Advisor** - Suggest best times to execute based on gas prices
7. **Protocol Health Monitor** - Track TVL changes, utilization rates across protocols
8. **Competitive Analysis** - weETH vs stETH vs rETH yield comparison dashboard

---

## Estimated Total Time

| Phase | Time |
|-------|------|
| Phase 0: Cleanup | 30 min |
| Phase 1: Strategy Execution | 1-2 hours |
| Phase 2: Liquidation Dashboard | 3-4 hours |
| Phase 3: Cross-Chain Analytics | 3-4 hours |
| Phase 4: Integration | 1 hour |
| **Total** | **8-12 hours** |

---

## Success Criteria

- [ ] Dead code removed, build passes
- [ ] Strategy execution works with Tenderly simulation
- [ ] Liquidation dashboard shows real positions with health factors
- [ ] Cross-chain page shows weETH across 4 chains
- [ ] All pages accessible from navigation
- [ ] No TypeScript errors, lint passes
- [ ] Deployed to Vercel and accessible
