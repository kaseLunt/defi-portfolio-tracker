import { Worker, Job } from "bullmq";
import { prisma } from "../lib/prisma";
import { adapterRegistry } from "../adapters/registry";
import { getPrices } from "../services/price";
import { broadcastPriceUpdate, sendNotificationEvent, sendTransactionDetected } from "../lib/events";
import { getActiveWallets, prewarmWalletCache } from "../services/portfolio-fast";
import { getPythPriceService } from "../services/pyth";
import { deserializeEnrichedEvent } from "../services/websocket/event-processor";
import { positionSyncQueue } from "./queues";
import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";
import { SUPPORTED_CHAINS } from "@/lib/constants";
import type { SerializedEnrichedEvent } from "../services/websocket/types";

// Get Redis URL from environment or use default for development
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Connection config for BullMQ workers
const connection = { url: REDIS_URL };

// Position sync worker - refreshes user positions from on-chain
export const positionSyncWorker = new Worker(
  "position-sync",
  async (job: Job) => {
    const { userId, walletAddress, chainIds } = job.data;

    console.log(`Syncing positions for ${walletAddress}`);

    try {
      // Get positions from all protocols
      const targetChains = chainIds || Object.values(SUPPORTED_CHAINS);
      const positions: Array<{
        protocol: string;
        chainId: number;
        positionType: string;
        tokenSymbol: string;
        tokenAddress: string;
        tokenDecimals: number;
        balanceRaw: string;
        balance: number;
        coingeckoId?: string;
        metadata?: object;
        apy?: number;
      }> = [];

      for (const chainId of targetChains) {
        const chainPositions = await adapterRegistry.getAllPositionsOnChain(
          walletAddress as Address,
          chainId as SupportedChainId
        );
        positions.push(...chainPositions);
      }

      // Get prices for all tokens
      const coingeckoIds = positions
        .map((p) => p.coingeckoId)
        .filter((id): id is string => !!id);
      const uniqueIds = [...new Set(coingeckoIds)];
      const prices = await getPrices(uniqueIds);

      // Update positions in database
      for (const position of positions) {
        // Find or create token
        let token = await prisma.token.findFirst({
          where: {
            chainId: position.chainId,
            address: position.tokenAddress.toLowerCase(),
          },
        });

        if (!token) {
          token = await prisma.token.create({
            data: {
              chainId: position.chainId,
              address: position.tokenAddress.toLowerCase(),
              symbol: position.tokenSymbol,
              decimals: position.tokenDecimals,
              coingeckoId: position.coingeckoId,
            },
          });
        }

        // Find protocol
        const protocol = await prisma.protocol.findUnique({
          where: { slug: position.protocol },
        });

        if (!protocol) continue;

        // Calculate USD value
        const priceEntry = position.coingeckoId
          ? prices.get(position.coingeckoId)
          : undefined;
        const price = priceEntry?.priceUsd ?? 0;
        const balanceUsd = position.balance * price;

        // Upsert position and create snapshot in a transaction
        await prisma.$transaction(async (tx) => {
          const upsertedPosition = await tx.position.upsert({
            where: {
              userId_protocolId_chainId_positionType_tokenId: {
                userId,
                protocolId: protocol.id,
                chainId: position.chainId,
                positionType: position.positionType,
                tokenId: token.id,
              },
            },
            create: {
              userId,
              protocolId: protocol.id,
              chainId: position.chainId,
              positionType: position.positionType,
              tokenId: token.id,
              balanceRaw: position.balanceRaw,
              balanceUsd,
              apyCurrent: position.apy,
              metadata: (position.metadata as object) || {},
            },
            update: {
              balanceRaw: position.balanceRaw,
              balanceUsd,
              apyCurrent: position.apy,
              metadata: (position.metadata as object) || {},
              lastUpdatedAt: new Date(),
            },
          });

          // Create position snapshot for historical tracking
          // Only create if balance is non-zero (skip dust positions)
          if (balanceUsd > 0.01) {
            await tx.positionSnapshot.create({
              data: {
                positionId: upsertedPosition.id,
                balanceRaw: position.balanceRaw,
                balanceUsd,
                apyAtSnapshot: position.apy,
              },
            });
          }
        });
      }

      console.log(`Synced ${positions.length} positions for ${walletAddress}`);
      return { positionCount: positions.length };
    } catch (error) {
      console.error(`Failed to sync positions for ${walletAddress}:`, error);
      throw error;
    }
  },
  { connection, concurrency: 5 }
);

// Price update worker - updates token prices
// When Pyth is active, this only updates database cache (Pyth handles SSE broadcasts)
// When Pyth is down, this does full CoinGecko fetch + broadcast
export const priceUpdateWorker = new Worker(
  "price-update",
  async (job: Job) => {
    const pythService = getPythPriceService();
    const pythActive = pythService.isUsingPyth();

    if (pythActive) {
      console.log("Price update: Pyth active, updating database cache only");
    } else {
      console.log("Price update: Using CoinGecko fallback");
    }

    try {
      // Get all active tokens with coingecko IDs
      const tokens = await prisma.token.findMany({
        where: {
          isActive: true,
          coingeckoId: { not: null },
        },
        select: { id: true, coingeckoId: true },
      });

      const coingeckoIds = tokens
        .map((t) => t.coingeckoId)
        .filter((id): id is string => !!id);
      const uniqueIds = [...new Set(coingeckoIds)];

      if (uniqueIds.length === 0) {
        console.log("No tokens to update prices for");
        return { updated: 0, source: pythActive ? "pyth" : "coingecko" };
      }

      // Fetch prices from CoinGecko (for database persistence)
      const prices = await getPrices(uniqueIds);

      // Update price cache in database
      for (const token of tokens) {
        if (!token.coingeckoId) continue;
        const priceEntry = prices.get(token.coingeckoId);
        if (!priceEntry) continue;

        await prisma.priceCache.upsert({
          where: { tokenId: token.id },
          create: {
            tokenId: token.id,
            priceUsd: priceEntry.priceUsd,
            priceEth: priceEntry.priceEth,
            change24hPct: priceEntry.change24hPct,
            updatedAt: new Date(),
          },
          update: {
            priceUsd: priceEntry.priceUsd,
            priceEth: priceEntry.priceEth,
            change24hPct: priceEntry.change24hPct,
            updatedAt: new Date(),
          },
        });
      }

      // Only broadcast via SSE if Pyth is NOT active
      // (When Pyth is active, it handles real-time broadcasts)
      if (!pythActive) {
        const priceUpdates: Record<string, { usd: number; change24h: number | null }> = {};
        for (const [coingeckoId, priceEntry] of prices) {
          priceUpdates[coingeckoId] = {
            usd: priceEntry.priceUsd,
            change24h: priceEntry.change24hPct,
          };
        }

        if (Object.keys(priceUpdates).length > 0) {
          await broadcastPriceUpdate(priceUpdates);
        }
      }

      console.log(`Updated prices for ${prices.size} tokens (source: ${pythActive ? "pyth+db" : "coingecko"})`);
      return { updated: prices.size, source: pythActive ? "pyth" : "coingecko" };
    } catch (error) {
      console.error("Failed to update prices:", error);
      throw error;
    }
  },
  { connection, concurrency: 1 }
);

// Alert check worker - evaluates alert rules
export const alertCheckWorker = new Worker(
  "alert-check",
  async (job: Job) => {
    const { ruleId } = job.data;

    // If specific rule ID, check that rule
    if (ruleId) {
      return checkSingleRule(ruleId);
    }

    // Otherwise, check all active rules
    console.log("Checking all alert rules...");

    try {
      const activeRules = await prisma.alertRule.findMany({
        where: { isActive: true },
        include: { user: true },
      });

      let triggeredCount = 0;

      for (const rule of activeRules) {
        // Skip if in cooldown
        if (rule.lastTriggeredAt) {
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          const timeSinceLastTrigger =
            Date.now() - rule.lastTriggeredAt.getTime();
          if (timeSinceLastTrigger < cooldownMs) {
            continue;
          }
        }

        const shouldTrigger = await evaluateRule(rule);

        if (shouldTrigger) {
          await triggerAlert(rule);
          triggeredCount++;
        }
      }

      console.log(
        `Checked ${activeRules.length} rules, triggered ${triggeredCount}`
      );
      return { checked: activeRules.length, triggered: triggeredCount };
    } catch (error) {
      console.error("Failed to check alerts:", error);
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

// Helper: Check a single rule
async function checkSingleRule(ruleId: string) {
  const rule = await prisma.alertRule.findUnique({
    where: { id: ruleId },
    include: { user: true },
  });

  if (!rule || !rule.isActive) {
    return { triggered: false };
  }

  const shouldTrigger = await evaluateRule(rule);

  if (shouldTrigger) {
    await triggerAlert(rule);
    return { triggered: true };
  }

  return { triggered: false };
}

// Helper: Evaluate if a rule should trigger
async function evaluateRule(
  rule: Awaited<ReturnType<typeof prisma.alertRule.findFirst>>
): Promise<boolean> {
  if (!rule) return false;

  const conditions = rule.conditions as Record<string, unknown>;

  switch (rule.ruleType) {
    case "price": {
      // Price alert: check if token price meets condition
      const { token, operator, value } = conditions as {
        token: string;
        operator: string;
        value: number;
      };

      const prices = await getPrices([token.toLowerCase()]);
      const priceEntry = prices.get(token.toLowerCase());

      if (!priceEntry) return false;
      const currentPrice = priceEntry.priceUsd;

      switch (operator) {
        case "lt":
          return currentPrice < value;
        case "gt":
          return currentPrice > value;
        case "lte":
          return currentPrice <= value;
        case "gte":
          return currentPrice >= value;
        default:
          return false;
      }
    }

    case "yield": {
      // Yield alert: check if APY meets condition
      // This would need protocol-specific APY data
      return false; // TODO: Implement
    }

    case "position": {
      // Position alert: check if position value changed significantly
      const { positionId, changePct } = conditions as {
        positionId?: string;
        changePct: number;
      };

      if (!positionId) return false;

      const position = await prisma.position.findUnique({
        where: { id: positionId },
      });

      if (!position || !position.balanceUsd) return false;

      // Get last snapshot to compare
      const lastSnapshot = await prisma.positionSnapshot.findFirst({
        where: { positionId },
        orderBy: { snapshotAt: "desc" },
      });

      if (!lastSnapshot || !lastSnapshot.balanceUsd) return false;

      const percentChange =
        ((position.balanceUsd - lastSnapshot.balanceUsd) /
          lastSnapshot.balanceUsd) *
        100;

      return Math.abs(percentChange) >= changePct;
    }

    default:
      return false;
  }
}

// Helper: Trigger an alert and create notification
async function triggerAlert(
  rule: Awaited<ReturnType<typeof prisma.alertRule.findFirst>>
) {
  if (!rule) return;

  const conditions = rule.conditions as Record<string, unknown>;

  // Generate notification content based on rule type
  let title = "Alert Triggered";
  let body = `Your alert "${rule.name}" has been triggered.`;

  switch (rule.ruleType) {
    case "price": {
      const { token, operator, value } = conditions as {
        token: string;
        operator: string;
        value: number;
      };
      const prices = await getPrices([token.toLowerCase()]);
      const priceEntry = prices.get(token.toLowerCase());
      const currentPrice = priceEntry?.priceUsd ?? 0;

      title = `Price Alert: ${token}`;
      const operatorText = operator === "lt" || operator === "lte" ? "below" : "above";
      body = `${token} is now $${currentPrice.toFixed(2)}, ${operatorText} your target of $${value}`;
      break;
    }
    case "position": {
      title = "Position Alert";
      body = `Your position value has changed significantly.`;
      break;
    }
  }

  // Create notification
  const notification = await prisma.notification.create({
    data: {
      userId: rule.userId,
      alertRuleId: rule.id,
      title,
      body,
      category: "alert",
      priority: "high",
      channelsSent: ["inApp"],
    },
  });

  // Send real-time notification event
  await sendNotificationEvent(rule.userId, {
    id: notification.id,
    title,
    body,
    category: "alert",
    priority: "high",
    createdAt: notification.createdAt,
  });

  // Update rule
  await prisma.alertRule.update({
    where: { id: rule.id },
    data: {
      lastTriggeredAt: new Date(),
      triggerCount: { increment: 1 },
    },
  });

  console.log(`Triggered alert: ${rule.name}`);
}

// Cache pre-warm worker - refreshes cache for active wallets
export const cachePrewarmWorker = new Worker(
  "cache-prewarm",
  async (job: Job) => {
    const { walletAddress } = job.data;

    // If specific wallet, prewarm that one
    if (walletAddress) {
      console.log(`[Prewarm] Warming cache for ${walletAddress}`);
      await prewarmWalletCache(walletAddress as Address);
      return { warmed: 1 };
    }

    // Otherwise, prewarm all active wallets
    console.log("[Prewarm] Starting cache prewarm for active wallets...");

    try {
      const activeWallets = await getActiveWallets();
      console.log(`[Prewarm] Found ${activeWallets.length} active wallets`);

      if (activeWallets.length === 0) {
        return { warmed: 0 };
      }

      // Process wallets with concurrency limit
      const CONCURRENCY = 3;
      let warmed = 0;

      for (let i = 0; i < activeWallets.length; i += CONCURRENCY) {
        const batch = activeWallets.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(wallet => prewarmWalletCache(wallet as Address))
        );
        warmed += batch.length;
      }

      console.log(`[Prewarm] Completed warming ${warmed} wallets`);
      return { warmed };
    } catch (error) {
      console.error("[Prewarm] Failed to prewarm caches:", error);
      throw error;
    }
  },
  { connection, concurrency: 1 }
);

// Transaction monitor worker
export const txMonitorWorker = new Worker(
  "tx-monitor",
  async (job: Job) => {
    const { chainId, txHash, userId } = job.data;

    console.log(`Monitoring transaction ${txHash} on chain ${chainId}`);

    // TODO: Implement transaction monitoring
    // This would watch for transaction confirmation and update status

    return { status: "pending" };
  },
  { connection, concurrency: 10 }
);

// WebSocket event worker - processes real-time Transfer events from Alchemy
export const websocketEventWorker = new Worker(
  "websocket-event",
  async (job: Job<SerializedEnrichedEvent>) => {
    const serializedEvent = job.data;
    const event = deserializeEnrichedEvent(serializedEvent);

    console.log(
      `[WS Worker] Processing ${event.type} event for user ${event.userId}`
    );

    try {
      // Get token info for enrichment
      const token = await prisma.token.findFirst({
        where: {
          chainId: event.event.chainId,
          address: event.event.tokenAddress.toLowerCase(),
        },
        include: {
          priceCache: true,
        },
      });

      const tokenSymbol = token?.symbol || "Unknown";
      const tokenDecimals = token?.decimals || 18;
      const priceUsd = token?.priceCache?.priceUsd || 0;

      // Format the value
      const valueNum = Number(event.event.value) / Math.pow(10, tokenDecimals);
      const valueUsd = valueNum * priceUsd;

      // Determine direction
      const direction = event.type === "transfer_in" ? "in" : "out";

      // Send real-time notification via SSE
      await sendTransactionDetected(event.userId, {
        walletAddress: event.walletAddress,
        direction,
        chainId: event.event.chainId,
        tokenAddress: event.event.tokenAddress,
        tokenSymbol,
        value: event.event.value.toString(),
        valueFormatted: valueNum,
        valueUsd,
        transactionHash: event.event.transactionHash,
      });

      // For significant transfers (>$100), create a notification
      if (valueUsd > 100) {
        const title = direction === "in"
          ? `Received ${valueNum.toFixed(4)} ${tokenSymbol}`
          : `Sent ${valueNum.toFixed(4)} ${tokenSymbol}`;

        const body = `${direction === "in" ? "Received" : "Sent"} $${valueUsd.toFixed(2)} worth of ${tokenSymbol}`;

        await prisma.notification.create({
          data: {
            userId: event.userId,
            title,
            body,
            category: "transaction",
            priority: valueUsd > 1000 ? "high" : "normal",
            channelsSent: ["inApp"],
            metadata: {
              chainId: event.event.chainId,
              tokenAddress: event.event.tokenAddress,
              transactionHash: event.event.transactionHash,
              valueUsd,
            },
          },
        });

        console.log(`[WS Worker] Created notification for $${valueUsd.toFixed(2)} ${tokenSymbol} transfer`);
      }

      // Queue position sync for the affected wallet
      await positionSyncQueue.add(
        "sync-from-event",
        {
          userId: event.userId,
          walletAddress: event.walletAddress,
          chainIds: [event.event.chainId],
        },
        {
          delay: 5000, // Wait 5s for blockchain confirmation
          jobId: `sync-${event.userId}-${event.event.transactionHash}`,
        }
      );

      return {
        processed: true,
        tokenSymbol,
        valueUsd,
        direction,
      };
    } catch (error) {
      console.error("[WS Worker] Failed to process event:", error);
      throw error;
    }
  },
  { connection, concurrency: 10 }
);

// Start all workers
export function startWorkers() {
  console.log("Starting background workers...");

  // Workers are already started by being created
  // This function is for any additional initialization

  positionSyncWorker.on("completed", (job) => {
    console.log(`Position sync job ${job.id} completed`);
  });

  positionSyncWorker.on("failed", (job, error) => {
    console.error(`Position sync job ${job?.id} failed:`, error);
  });

  priceUpdateWorker.on("completed", (job) => {
    console.log(`Price update job ${job.id} completed`);
  });

  priceUpdateWorker.on("failed", (job, error) => {
    console.error(`Price update job ${job?.id} failed:`, error);
  });

  alertCheckWorker.on("completed", (job) => {
    console.log(`Alert check job ${job.id} completed`);
  });

  alertCheckWorker.on("failed", (job, error) => {
    console.error(`Alert check job ${job?.id} failed:`, error);
  });

  cachePrewarmWorker.on("completed", (job) => {
    console.log(`Cache prewarm job ${job.id} completed`);
  });

  cachePrewarmWorker.on("failed", (job, error) => {
    console.error(`Cache prewarm job ${job?.id} failed:`, error);
  });

  websocketEventWorker.on("completed", (job) => {
    console.log(`WebSocket event job ${job.id} completed`);
  });

  websocketEventWorker.on("failed", (job, error) => {
    console.error(`WebSocket event job ${job?.id} failed:`, error);
  });

  console.log("Background workers started");
}

// Graceful shutdown
export async function stopWorkers() {
  console.log("Stopping background workers...");
  await Promise.all([
    positionSyncWorker.close(),
    priceUpdateWorker.close(),
    alertCheckWorker.close(),
    txMonitorWorker.close(),
    cachePrewarmWorker.close(),
    websocketEventWorker.close(),
  ]);
  console.log("Background workers stopped");
}
