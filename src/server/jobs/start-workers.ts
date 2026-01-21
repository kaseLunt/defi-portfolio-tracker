/**
 * Background Worker Startup Script
 *
 * Run this script to start all background workers:
 * npx tsx src/server/jobs/start-workers.ts
 *
 * Or add to package.json scripts:
 * "workers": "tsx src/server/jobs/start-workers.ts"
 */

import "dotenv/config";
import { startWorkers, stopWorkers } from "./workers";
import { initScheduledJobs } from "./queues";

async function main() {
  console.log("Starting OnChain Wealth background workers...");
  console.log(`Redis URL: ${process.env.REDIS_URL || "redis://localhost:6379"}`);

  // Start workers
  startWorkers();

  // Initialize scheduled jobs
  await initScheduledJobs();

  console.log("All workers started successfully!");
  console.log("Press Ctrl+C to stop workers");

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    await stopWorkers();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep the process running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("Failed to start workers:", error);
  process.exit(1);
});
