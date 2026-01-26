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
import { initializePythPrices, shutdownPythPrices } from "../services/pyth";
import { initializeWebSocketService, shutdownWebSocketService } from "../services/websocket";

async function main() {
  console.log("Starting OnChain Wealth background workers...");
  console.log(`Redis URL: ${process.env.REDIS_URL || "redis://localhost:6379"}`);

  // Initialize Pyth price streaming (real-time prices via WebSocket)
  console.log("Initializing Pyth Network price streaming...");
  try {
    await initializePythPrices();
    console.log("Pyth price streaming initialized");
  } catch (error) {
    console.error("Failed to initialize Pyth (will use CoinGecko fallback):", error);
  }

  // Initialize Alchemy WebSocket service (real-time on-chain events)
  console.log("Initializing Alchemy WebSocket service...");
  try {
    await initializeWebSocketService();
    console.log("Alchemy WebSocket service initialized");
  } catch (error) {
    console.error("Failed to initialize Alchemy WebSocket:", error);
  }

  // Start workers
  startWorkers();

  // Initialize scheduled jobs
  await initScheduledJobs();

  console.log("All workers started successfully!");
  console.log("Press Ctrl+C to stop workers");

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    await shutdownWebSocketService();
    await shutdownPythPrices();
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
