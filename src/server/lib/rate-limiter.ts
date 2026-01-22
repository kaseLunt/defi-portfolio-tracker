/**
 * Simple rate limiter for API calls
 * Uses a token bucket algorithm with configurable rate and burst
 */

interface RateLimiterConfig {
  /** Max requests per second */
  ratePerSecond: number;
  /** Max burst (concurrent requests allowed) */
  maxBurst?: number;
}

interface RateLimiter {
  /** Acquire a token, waiting if necessary */
  acquire: () => Promise<void>;
  /** Try to acquire without waiting, returns false if rate limited */
  tryAcquire: () => boolean;
}

const rateLimiters = new Map<string, RateLimiter>();

/**
 * Creates or gets a rate limiter for a given key
 */
export function getRateLimiter(
  key: string,
  config: RateLimiterConfig
): RateLimiter {
  const existing = rateLimiters.get(key);
  if (existing) return existing;

  const { ratePerSecond, maxBurst = ratePerSecond } = config;
  const minInterval = 1000 / ratePerSecond;

  let tokens = maxBurst;
  let lastRefill = Date.now();
  const queue: Array<() => void> = [];

  function refillTokens() {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const newTokens = (elapsed / 1000) * ratePerSecond;
    tokens = Math.min(maxBurst, tokens + newTokens);
    lastRefill = now;
  }

  function processQueue() {
    refillTokens();

    while (queue.length > 0 && tokens >= 1) {
      tokens -= 1;
      const resolve = queue.shift();
      resolve?.();
    }

    if (queue.length > 0) {
      // Schedule next check
      setTimeout(processQueue, minInterval);
    }
  }

  const limiter: RateLimiter = {
    acquire: () => {
      return new Promise((resolve) => {
        refillTokens();

        if (tokens >= 1) {
          tokens -= 1;
          resolve();
        } else {
          queue.push(resolve);
          if (queue.length === 1) {
            setTimeout(processQueue, minInterval);
          }
        }
      });
    },

    tryAcquire: () => {
      refillTokens();
      if (tokens >= 1) {
        tokens -= 1;
        return true;
      }
      return false;
    },
  };

  rateLimiters.set(key, limiter);
  return limiter;
}

/**
 * Exponential backoff with jitter for retrying failed requests
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** HTTP status codes that should trigger a retry */
  retryStatusCodes?: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Wraps a fetch call with exponential backoff retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeout?: number } = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const { maxRetries, baseDelayMs, maxDelayMs, retryStatusCodes } = config;
  const { timeout = 15000, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if we should retry based on status code
      if (!response.ok && retryStatusCodes?.includes(response.status)) {
        if (attempt < maxRetries) {
          const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
          console.log(
            `[RateLimiter] ${response.status} from ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort (timeout)
      if (lastError.name === "AbortError") {
        if (attempt < maxRetries) {
          const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
          console.log(
            `[RateLimiter] Timeout for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }
        throw new Error(`Request timed out after ${maxRetries + 1} attempts`);
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
        console.log(
          `[RateLimiter] Network error for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await sleep(delay);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}

/**
 * Calculates exponential backoff delay with jitter
 */
function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  // Cap at max delay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run promises with concurrency limit
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(async () => {
      const result = await task();
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const isDone = await Promise.race([
          executing[i].then(() => true),
          Promise.resolve(false),
        ]);
        if (isDone) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Run promises sequentially with delay between each
 */
export async function runSequentially<T>(
  tasks: Array<() => Promise<T>>,
  delayMs: number = 0
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < tasks.length; i++) {
    if (i > 0 && delayMs > 0) {
      await sleep(delayMs);
    }
    results.push(await tasks[i]());
  }

  return results;
}
