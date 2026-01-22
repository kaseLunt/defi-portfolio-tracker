import { Queue } from "bullmq";

// Get Redis URL from environment or use default for development
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Connection config for BullMQ - use URL string
const connection = { url: REDIS_URL };

// Queue for syncing user positions from on-chain
export const positionSyncQueue = new Queue("position-sync", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

// Queue for updating token prices
export const priceUpdateQueue = new Queue("price-update", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 100,
    },
  },
});

// Queue for checking alert rules
export const alertCheckQueue = new Queue("alert-check", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 200,
    },
  },
});

// Queue for monitoring pending transactions
export const txMonitorQueue = new Queue("tx-monitor", {
  connection,
  defaultJobOptions: {
    attempts: 10,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 200,
    },
  },
});

// Queue for pre-warming portfolio cache for active wallets
export const cachePrewarmQueue = new Queue("cache-prewarm", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 5000,
    },
    removeOnComplete: {
      count: 50,
    },
    removeOnFail: {
      count: 100,
    },
  },
});

// Initialize scheduled jobs
export async function initScheduledJobs() {
  // Price updates every 30 seconds
  await priceUpdateQueue.add(
    "update-all",
    {},
    {
      repeat: {
        every: 30000, // 30 seconds
      },
      jobId: "scheduled-price-update",
    }
  );

  // Alert checks every minute
  await alertCheckQueue.add(
    "check-all",
    {},
    {
      repeat: {
        every: 60000, // 1 minute
      },
      jobId: "scheduled-alert-check",
    }
  );

  // Cache pre-warming every 2 minutes for active wallets
  await cachePrewarmQueue.add(
    "prewarm-active",
    {},
    {
      repeat: {
        every: 120000, // 2 minutes
      },
      jobId: "scheduled-cache-prewarm",
    }
  );

  console.log("Scheduled jobs initialized");
}

// Export all queues for use in other modules
export const queues = {
  positionSync: positionSyncQueue,
  priceUpdate: priceUpdateQueue,
  alertCheck: alertCheckQueue,
  txMonitor: txMonitorQueue,
  cachePrewarm: cachePrewarmQueue,
};
