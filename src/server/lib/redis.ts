import Redis from "ioredis";

// Get Redis URL from environment or use default for development
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Track if Redis is available
let redisAvailable = true;
let connectionAttempted = false;

// Create Redis client with error handling
function createClient(): Redis | null {
  if (!redisAvailable && connectionAttempted) {
    return null;
  }

  connectionAttempted = true;

  try {
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 3) {
          redisAvailable = false;
          console.warn("Redis unavailable - caching disabled");
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    // Handle connection errors silently
    client.on("error", (err) => {
      if (redisAvailable) {
        console.warn("Redis connection error - caching disabled:", err.message);
        redisAvailable = false;
      }
    });

    client.on("connect", () => {
      redisAvailable = true;
    });

    return client;
  } catch {
    redisAvailable = false;
    return null;
  }
}

// Lazy-initialized Redis client
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!_redis) {
    _redis = createClient();
  }
  return redisAvailable ? _redis : null;
}

// Export for backward compatibility (may be null)
export const redis = createClient();

// Create a separate connection for BullMQ (recommended practice)
export function createRedisConnection(): Redis | null {
  if (!redisAvailable) return null;
  return createClient();
}

// Simple cache helpers - fail silently when Redis unavailable
export async function getFromCache<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setInCache<T>(
  key: string,
  value: T,
  ttlSeconds = 60
): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Silently fail - caching is optional
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Silently fail
  }
}

// Check if Redis is currently available
export function isRedisAvailable(): boolean {
  return redisAvailable;
}
