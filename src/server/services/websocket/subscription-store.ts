/**
 * Redis-backed subscription store for WebSocket event monitoring
 *
 * Persists user subscriptions across server restarts and enables
 * multi-server deployments.
 */

import { redis, getFromCache, setInCache } from "@/server/lib/redis";
import type { Address } from "viem";
import type { SupportedChainId } from "@/lib/constants";
import type { UserSubscription, SerializedUserSubscription } from "./types";

const SUBSCRIPTION_PREFIX = "ws:sub:";
const ACTIVE_USERS_KEY = "ws:active_users";
const SUBSCRIPTION_TTL = 86400 * 7; // 7 days

export class SubscriptionStore {
  /**
   * Save user subscription to Redis
   */
  async saveSubscription(sub: UserSubscription): Promise<void> {
    const key = `${SUBSCRIPTION_PREFIX}${sub.walletAddress.toLowerCase()}`;

    // Convert Map/Set to serializable format
    const tokenAddresses: Record<number, string[]> = {};
    for (const [chainId, tokens] of sub.tokenAddresses.entries()) {
      tokenAddresses[chainId] = Array.from(tokens);
    }

    const serialized: SerializedUserSubscription = {
      walletAddress: sub.walletAddress,
      userId: sub.userId,
      tokenAddresses,
      subscribedAt: sub.subscribedAt.toISOString(),
      lastEventAt: sub.lastEventAt?.toISOString(),
    };

    await setInCache(key, serialized, SUBSCRIPTION_TTL);

    // Add to active users set
    if (redis) {
      await redis.sadd(ACTIVE_USERS_KEY, sub.walletAddress.toLowerCase());
    }
  }

  /**
   * Get user subscription from Redis
   */
  async getSubscription(walletAddress: Address): Promise<UserSubscription | null> {
    const key = `${SUBSCRIPTION_PREFIX}${walletAddress.toLowerCase()}`;
    const data = await getFromCache<SerializedUserSubscription>(key);

    if (!data) return null;

    // Reconstruct Map/Set from serialized format
    const tokenAddresses = new Map<SupportedChainId, Set<Address>>();
    for (const [chainIdStr, tokens] of Object.entries(data.tokenAddresses)) {
      const chainId = Number(chainIdStr) as SupportedChainId;
      tokenAddresses.set(chainId, new Set(tokens as Address[]));
    }

    return {
      walletAddress: data.walletAddress as Address,
      userId: data.userId,
      tokenAddresses,
      subscribedAt: new Date(data.subscribedAt),
      lastEventAt: data.lastEventAt ? new Date(data.lastEventAt) : undefined,
    };
  }

  /**
   * Update last event timestamp
   */
  async updateLastEventTime(walletAddress: Address): Promise<void> {
    const sub = await this.getSubscription(walletAddress);
    if (sub) {
      sub.lastEventAt = new Date();
      await this.saveSubscription(sub);
    }
  }

  /**
   * Add tokens to a user's subscription
   */
  async addTokens(
    walletAddress: Address,
    chainId: SupportedChainId,
    tokens: Address[]
  ): Promise<void> {
    const sub = await this.getSubscription(walletAddress);
    if (!sub) return;

    const chainTokens = sub.tokenAddresses.get(chainId) || new Set();
    for (const token of tokens) {
      chainTokens.add(token.toLowerCase() as Address);
    }
    sub.tokenAddresses.set(chainId, chainTokens);

    await this.saveSubscription(sub);
  }

  /**
   * Remove user subscription
   */
  async removeSubscription(walletAddress: Address): Promise<void> {
    const key = `${SUBSCRIPTION_PREFIX}${walletAddress.toLowerCase()}`;

    if (redis) {
      await redis.del(key);
      await redis.srem(ACTIVE_USERS_KEY, walletAddress.toLowerCase());
    }
  }

  /**
   * Get all active subscribed wallet addresses
   */
  async getActiveWallets(): Promise<Address[]> {
    if (!redis) return [];

    const wallets = await redis.smembers(ACTIVE_USERS_KEY);
    return wallets as Address[];
  }

  /**
   * Get all tokens subscribed across all users for a specific chain
   * Used for building the WebSocket filter
   */
  async getChainTokens(chainId: SupportedChainId): Promise<Set<Address>> {
    const wallets = await this.getActiveWallets();
    const tokens = new Set<Address>();

    for (const wallet of wallets) {
      const sub = await this.getSubscription(wallet);
      if (sub) {
        const chainTokens = sub.tokenAddresses.get(chainId);
        if (chainTokens) {
          chainTokens.forEach((t) => tokens.add(t));
        }
      }
    }

    return tokens;
  }

  /**
   * Get subscription count
   */
  async getSubscriptionCount(): Promise<number> {
    if (!redis) return 0;
    return redis.scard(ACTIVE_USERS_KEY);
  }

  /**
   * Find user by wallet address
   */
  async findUserByWallet(walletAddress: Address): Promise<string | null> {
    const sub = await this.getSubscription(walletAddress);
    return sub?.userId ?? null;
  }
}

// Singleton instance
export const subscriptionStore = new SubscriptionStore();
