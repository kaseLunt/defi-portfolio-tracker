# On-Chain Wealth Management Platform

## Technical Architecture Document

---

## 1. Executive Summary

A full-stack Web3 application enabling users to monitor, optimize, and manage their DeFi positions with neobank-grade UX. The platform aggregates on-chain data, provides yield optimization insights, and facilitates transaction execution—all with real-time notifications.

### Core Value Propositions
- **See**: Unified portfolio view across protocols and chains
- **Optimize**: Data-driven yield strategy recommendations
- **Act**: Streamlined transaction building and execution
- **Stay Informed**: Real-time alerts on position changes

---

## 2. Tech Stack

### Frontend
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Next.js 14** | Framework | App Router, RSC for performance, API routes for BFF pattern |
| **TypeScript** | Language | Type safety critical for financial data and Web3 |
| **TailwindCSS** | Styling | Rapid iteration, consistent design system |
| **shadcn/ui** | Components | Accessible, customizable, professional aesthetic |
| **wagmi v2** | Wallet connection | Industry standard, excellent DX |
| **viem** | Ethereum interactions | Type-safe, performant alternative to ethers.js |
| **TanStack Query** | Server state | Caching, real-time updates, optimistic UI |
| **Recharts** | Data visualization | Composable, performant charts |
| **Zustand** | Client state | Lightweight, minimal boilerplate |

### Backend
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Node.js** | Runtime | JavaScript ecosystem, async I/O for blockchain calls |
| **Fastify** | HTTP server | Faster than Express, schema validation built-in |
| **tRPC** | API layer | End-to-end type safety with frontend |
| **PostgreSQL** | Primary database | ACID compliance for financial data, JSONB for flexibility |
| **Redis** | Caching + Pub/Sub | Real-time updates, rate limiting, session storage |
| **Prisma** | ORM | Type-safe queries, migrations, excellent DX |
| **BullMQ** | Job queue | Reliable background job processing |
| **Socket.io** | WebSockets | Real-time client updates |

### Web3 Infrastructure
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Alchemy / Infura** | RPC providers | Reliable, enhanced APIs |
| **The Graph** | Indexed DeFi positions | ~25x faster queries vs RPC for Aave, Compound, Lido, EtherFi |
| **Envio HyperSync** | Historical token balances | Free, fast transfer event indexing for balance reconstruction |
| **Tenderly** | Simulation | Transaction preview before signing |
| **WalletConnect** | Multi-wallet | Support all major wallets |

### Infrastructure
| Technology | Purpose | Rationale |
|------------|---------|-----------|
| **Vercel** | Frontend hosting | Edge functions, excellent Next.js support |
| **Railway / Render** | Backend hosting | Easy PostgreSQL + Redis, auto-scaling |
| **Upstash** | Serverless Redis | If using Vercel edge functions |
| **Resend** | Email notifications | Developer-friendly, good deliverability |
| **Novu** | Multi-channel notifications | Email, push, in-app unified |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENTS                                     │
│                    (Web App / Mobile Web / Future Native)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EDGE LAYER                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Vercel Edge   │  │   Rate Limiter  │  │   Auth (SIWE)   │              │
│  │   (Next.js)     │  │   (Redis)       │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         tRPC Router                                  │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │ Portfolio│ │  Yield   │ │   Tx     │ │  Notif   │ │   User   │  │    │
│  │  │  Router  │ │  Router  │ │  Router  │ │  Router  │ │  Router  │  │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Portfolio     │  │     Yield       │  │   Transaction   │              │
│  │   Service       │  │   Service       │  │    Service      │              │
│  │                 │  │                 │  │                 │              │
│  │ - Aggregation   │  │ - APY Fetch     │  │ - Build         │              │
│  │ - Valuation     │  │ - Simulation    │  │ - Simulate      │              │
│  │ - History       │  │ - Comparison    │  │ - Execute       │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Notification   │  │    Protocol     │  │     Price       │              │
│  │   Service       │  │   Adapter       │  │    Service      │              │
│  │                 │  │   Registry      │  │                 │              │
│  │ - Rules Engine  │  │                 │  │ - Multi-source  │              │
│  │ - Delivery      │  │ - Aave          │  │ - Caching       │              │
│  │ - Preferences   │  │ - Lido          │  │ - Historical    │              │
│  └─────────────────┘  │ - Compound      │  └─────────────────┘              │
│                       │ - Uniswap       │                                    │
│                       │ - EtherFi       │                                    │
│                       └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   PostgreSQL    │  │     Redis       │  │   The Graph     │              │
│  │                 │  │                 │  │                 │              │
│  │ - Users         │  │ - Price Cache   │  │ - DeFi positions│              │
│  │ - Positions     │  │ - Session       │  │   (Aave, Lido,  │              │
│  │ - Transactions  │  │ - Pub/Sub       │  │   Compound,     │              │
│  │ - Alerts        │  │ - Rate Limits   │  │   EtherFi)      │              │
│  │ - Preferences   │  │ - Job Queue     │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Envio HyperSync                               │    │
│  │   - Historical token balances     - Transfer event indexing          │    │
│  │   - Backward balance reconstruction from current state               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BLOCKCHAIN LAYER                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │    Ethereum     │  │    Arbitrum     │  │     Base        │              │
│  │    Mainnet      │  │                 │  │                 │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    RPC Provider Pool (Alchemy/Infura)                │    │
│  │              - Load balancing  - Fallback  - Rate limit mgmt         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

```sql
-- ============================================
-- CORE ENTITIES
-- ============================================

-- Users (wallet-based authentication)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  VARCHAR(42) UNIQUE NOT NULL,
    ens_name        VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,

    -- Preferences stored as JSONB for flexibility
    preferences     JSONB DEFAULT '{
        "currency": "USD",
        "theme": "dark",
        "notifications": {
            "email": true,
            "push": true,
            "inApp": true
        }
    }'::jsonb
);

CREATE INDEX idx_users_wallet ON users(wallet_address);

-- User notification channels
CREATE TABLE notification_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    channel_type    VARCHAR(20) NOT NULL, -- 'email', 'telegram', 'push', 'webhook'
    channel_value   VARCHAR(255) NOT NULL, -- email address, telegram chat id, etc.
    is_verified     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, channel_type, channel_value)
);

-- ============================================
-- PORTFOLIO DATA
-- ============================================

-- Supported chains
CREATE TABLE chains (
    id              SERIAL PRIMARY KEY,
    chain_id        INTEGER UNIQUE NOT NULL,
    name            VARCHAR(50) NOT NULL,
    rpc_url         VARCHAR(255),
    explorer_url    VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE
);

-- Supported protocols
CREATE TABLE protocols (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(50) UNIQUE NOT NULL, -- 'aave-v3', 'lido', 'compound-v3'
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(50) NOT NULL, -- 'lending', 'staking', 'dex', 'yield'
    website_url     VARCHAR(255),
    logo_url        VARCHAR(255),

    -- Protocol-specific configuration
    config          JSONB DEFAULT '{}'::jsonb,

    -- Supported chains for this protocol
    supported_chains INTEGER[] DEFAULT '{}',

    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tokens registry
CREATE TABLE tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id        INTEGER REFERENCES chains(chain_id),
    address         VARCHAR(42) NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    name            VARCHAR(100),
    decimals        INTEGER NOT NULL DEFAULT 18,
    logo_url        VARCHAR(255),
    coingecko_id    VARCHAR(100), -- For price feeds

    is_active       BOOLEAN DEFAULT TRUE,

    UNIQUE(chain_id, address)
);

CREATE INDEX idx_tokens_chain_address ON tokens(chain_id, address);
CREATE INDEX idx_tokens_symbol ON tokens(symbol);

-- User positions (snapshot-based with history)
CREATE TABLE positions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    protocol_id     UUID REFERENCES protocols(id),
    chain_id        INTEGER REFERENCES chains(chain_id),

    -- Position details
    position_type   VARCHAR(50) NOT NULL, -- 'supply', 'borrow', 'stake', 'lp', 'vault'
    token_id        UUID REFERENCES tokens(id),

    -- Current state
    balance_raw     NUMERIC(78, 0) NOT NULL, -- Raw token amount (no decimals)
    balance_usd     NUMERIC(20, 2), -- USD value at last update

    -- Yield tracking
    apy_current     NUMERIC(10, 4), -- Current APY as decimal (0.05 = 5%)
    rewards_accrued JSONB DEFAULT '[]'::jsonb, -- Array of {token, amount, usd}

    -- Protocol-specific data
    metadata        JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    opened_at       TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, protocol_id, chain_id, position_type, token_id)
);

CREATE INDEX idx_positions_user ON positions(user_id);
CREATE INDEX idx_positions_protocol ON positions(protocol_id);
CREATE INDEX idx_positions_updated ON positions(last_updated_at);

-- Position history (for charts and P&L)
CREATE TABLE position_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id     UUID REFERENCES positions(id) ON DELETE CASCADE,

    balance_raw     NUMERIC(78, 0) NOT NULL,
    balance_usd     NUMERIC(20, 2),
    apy_at_snapshot NUMERIC(10, 4),

    snapshot_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_position_time ON position_snapshots(position_id, snapshot_at DESC);

-- Partition by time for performance (monthly partitions)
-- CREATE TABLE position_snapshots_y2024m01 PARTITION OF position_snapshots
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================
-- YIELD DATA
-- ============================================

-- Historical APY data for protocols
CREATE TABLE yield_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id     UUID REFERENCES protocols(id),
    chain_id        INTEGER REFERENCES chains(chain_id),
    token_id        UUID REFERENCES tokens(id),
    pool_id         VARCHAR(100), -- Protocol-specific pool identifier

    apy_base        NUMERIC(10, 4), -- Base APY
    apy_reward      NUMERIC(10, 4), -- Reward APY (if any)
    apy_total       NUMERIC(10, 4), -- Total APY

    tvl_usd         NUMERIC(20, 2),

    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_yield_history_lookup ON yield_history(protocol_id, chain_id, token_id, recorded_at DESC);

-- ============================================
-- TRANSACTIONS
-- ============================================

-- Transaction templates (for builder)
CREATE TABLE tx_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    category        VARCHAR(50), -- 'swap', 'deposit', 'withdraw', 'stake', 'claim'

    -- Template definition
    protocol_id     UUID REFERENCES protocols(id),
    steps           JSONB NOT NULL, -- Array of transaction steps

    -- Metadata
    is_public       BOOLEAN DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    use_count       INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- User transaction history
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Chain details
    chain_id        INTEGER REFERENCES chains(chain_id),
    tx_hash         VARCHAR(66) NOT NULL,
    block_number    BIGINT,

    -- Transaction metadata
    tx_type         VARCHAR(50), -- 'swap', 'deposit', 'withdraw', etc.
    protocol_id     UUID REFERENCES protocols(id),

    -- Status
    status          VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'

    -- Value tracking
    value_usd       NUMERIC(20, 2),
    gas_used        BIGINT,
    gas_price_gwei  NUMERIC(20, 9),
    gas_usd         NUMERIC(20, 4),

    -- Full transaction data for reference
    tx_data         JSONB,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at    TIMESTAMPTZ,

    UNIQUE(chain_id, tx_hash)
);

CREATE INDEX idx_transactions_user ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_hash ON transactions(tx_hash);

-- ============================================
-- NOTIFICATIONS & ALERTS
-- ============================================

-- Alert rules configured by users
CREATE TABLE alert_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,

    name            VARCHAR(100) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,

    -- Rule type and conditions
    rule_type       VARCHAR(50) NOT NULL, -- 'price', 'position', 'yield', 'gas', 'whale'
    conditions      JSONB NOT NULL,
    /*
    Example conditions:
    Price alert: {"token": "ETH", "operator": "lt", "value": 2000}
    Position: {"position_id": "...", "metric": "value_usd", "change_pct": 10}
    Yield: {"protocol": "aave", "token": "USDC", "operator": "lt", "value": 0.03}
    Gas: {"chain": 1, "operator": "lt", "value": 20}
    Whale: {"token": "ETH", "min_value_usd": 1000000}
    */

    -- Delivery preferences
    channels        VARCHAR(20)[] DEFAULT '{inApp}',
    cooldown_minutes INTEGER DEFAULT 60, -- Don't re-trigger within this period

    -- State
    last_triggered_at TIMESTAMPTZ,
    trigger_count   INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_user ON alert_rules(user_id, is_active);
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type) WHERE is_active = TRUE;

-- Notification log
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_rule_id   UUID REFERENCES alert_rules(id) ON DELETE SET NULL,

    -- Content
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    category        VARCHAR(50), -- 'alert', 'system', 'transaction', 'security'
    priority        VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

    -- Delivery tracking
    channels_sent   VARCHAR(20)[] DEFAULT '{}',

    -- Read status
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,

    -- Context data
    metadata        JSONB DEFAULT '{}'::jsonb,
    action_url      VARCHAR(500),

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_all ON notifications(user_id, created_at DESC);

-- ============================================
-- PRICE CACHE (PostgreSQL backup for Redis)
-- ============================================

CREATE TABLE price_cache (
    token_id        UUID REFERENCES tokens(id) PRIMARY KEY,
    price_usd       NUMERIC(20, 8) NOT NULL,
    price_eth       NUMERIC(20, 18),
    change_24h_pct  NUMERIC(10, 4),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. API Design (tRPC Routers)

### 5.1 Router Structure

```typescript
// src/server/routers/_app.ts
import { router } from '../trpc';
import { portfolioRouter } from './portfolio';
import { yieldRouter } from './yield';
import { transactionRouter } from './transaction';
import { notificationRouter } from './notification';
import { userRouter } from './user';

export const appRouter = router({
  portfolio: portfolioRouter,
  yield: yieldRouter,
  transaction: transactionRouter,
  notification: notificationRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
```

### 5.2 Portfolio Router

```typescript
// src/server/routers/portfolio.ts
import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';

export const portfolioRouter = router({
  // Get aggregated portfolio for connected wallet
  getPortfolio: protectedProcedure
    .input(z.object({
      chains: z.array(z.number()).optional(), // Filter by chains
      protocols: z.array(z.string()).optional(), // Filter by protocol slugs
    }))
    .query(async ({ ctx, input }) => {
      // Returns full portfolio with positions grouped by protocol
    }),

  // Get single position details
  getPosition: protectedProcedure
    .input(z.object({
      positionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      // Returns detailed position with history
    }),

  // Get portfolio value history for charts
  getValueHistory: protectedProcedure
    .input(z.object({
      timeframe: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']),
      chains: z.array(z.number()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Returns time series data for portfolio value
    }),

  // Refresh positions from on-chain (trigger re-fetch)
  refreshPositions: protectedProcedure
    .input(z.object({
      chains: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Queues background job to refresh all positions
    }),

  // Get supported protocols
  getProtocols: publicProcedure
    .input(z.object({
      chainId: z.number().optional(),
      category: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Returns list of supported protocols
    }),
});
```

### 5.3 Yield Router

```typescript
// src/server/routers/yield.ts
export const yieldRouter = router({
  // Get current yields across protocols
  getCurrentYields: publicProcedure
    .input(z.object({
      tokens: z.array(z.string()).optional(), // Token symbols
      chains: z.array(z.number()).optional(),
      minTvl: z.number().optional(),
      category: z.enum(['lending', 'staking', 'lp', 'vault']).optional(),
    }))
    .query(async ({ input }) => {
      // Returns current APY data sorted by yield
    }),

  // Get yield history for a specific opportunity
  getYieldHistory: publicProcedure
    .input(z.object({
      protocolSlug: z.string(),
      chainId: z.number(),
      tokenAddress: z.string(),
      timeframe: z.enum(['7d', '30d', '90d', '1y']),
    }))
    .query(async ({ input }) => {
      // Returns historical APY data
    }),

  // Simulate yield strategy
  simulateStrategy: protectedProcedure
    .input(z.object({
      principal: z.number(), // USD value
      strategies: z.array(z.object({
        protocolSlug: z.string(),
        chainId: z.number(),
        tokenSymbol: z.string(),
        allocationPct: z.number(), // 0-100
      })),
      durationDays: z.number().min(1).max(365),
      compoundFrequency: z.enum(['daily', 'weekly', 'monthly', 'none']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns projected returns with confidence intervals
    }),

  // Compare current position to alternatives
  compareAlternatives: protectedProcedure
    .input(z.object({
      positionId: z.string().uuid(),
      limit: z.number().default(5),
    }))
    .query(async ({ ctx, input }) => {
      // Returns similar opportunities with better yields
    }),
});
```

### 5.4 Transaction Router

```typescript
// src/server/routers/transaction.ts
export const transactionRouter = router({
  // Build transaction for a specific action
  buildTransaction: protectedProcedure
    .input(z.object({
      action: z.enum(['deposit', 'withdraw', 'swap', 'stake', 'unstake', 'claim']),
      protocolSlug: z.string(),
      chainId: z.number(),
      params: z.record(z.any()), // Action-specific parameters
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns unsigned transaction(s) ready for signing
    }),

  // Build multi-step transaction bundle
  buildBundle: protectedProcedure
    .input(z.object({
      steps: z.array(z.object({
        action: z.string(),
        protocolSlug: z.string(),
        chainId: z.number(),
        params: z.record(z.any()),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns array of transactions in execution order
    }),

  // Simulate transaction(s) using Tenderly
  simulate: protectedProcedure
    .input(z.object({
      transactions: z.array(z.object({
        to: z.string(),
        data: z.string(),
        value: z.string().optional(),
        chainId: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Returns simulation results with gas estimates and state changes
    }),

  // Record executed transaction
  recordTransaction: protectedProcedure
    .input(z.object({
      chainId: z.number(),
      txHash: z.string(),
      txType: z.string(),
      protocolSlug: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Records transaction and starts monitoring for confirmation
    }),

  // Get transaction history
  getHistory: protectedProcedure
    .input(z.object({
      chainId: z.number().optional(),
      status: z.enum(['pending', 'confirmed', 'failed']).optional(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Returns paginated transaction history
    }),

  // Get transaction templates
  getTemplates: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      protocolSlug: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Returns available transaction templates
    }),
});
```

### 5.5 Notification Router

```typescript
// src/server/routers/notification.ts
export const notificationRouter = router({
  // Get user notifications
  getNotifications: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(false),
      category: z.string().optional(),
      limit: z.number().default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Returns paginated notifications
    }),

  // Mark notifications as read
  markAsRead: protectedProcedure
    .input(z.object({
      notificationIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      // Marks specified notifications as read
    }),

  // Get alert rules
  getAlertRules: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns user's configured alert rules
    }),

  // Create alert rule
  createAlertRule: protectedProcedure
    .input(z.object({
      name: z.string(),
      ruleType: z.enum(['price', 'position', 'yield', 'gas', 'whale']),
      conditions: z.record(z.any()),
      channels: z.array(z.enum(['inApp', 'email', 'telegram', 'push'])),
      cooldownMinutes: z.number().default(60),
    }))
    .mutation(async ({ ctx, input }) => {
      // Creates new alert rule
    }),

  // Update alert rule
  updateAlertRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      updates: z.object({
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        conditions: z.record(z.any()).optional(),
        channels: z.array(z.string()).optional(),
        cooldownMinutes: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Updates existing alert rule
    }),

  // Delete alert rule
  deleteAlertRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Deletes alert rule
    }),

  // Subscribe to real-time notifications (returns subscription info)
  getSubscriptionInfo: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns WebSocket endpoint and auth token for real-time updates
    }),
});
```

### 5.6 WebSocket Events

```typescript
// Real-time event types
interface WebSocketEvents {
  // Server -> Client
  'notification:new': {
    notification: Notification;
  };

  'position:update': {
    positionId: string;
    changes: {
      balance?: string;
      balanceUsd?: number;
      apy?: number;
    };
  };

  'transaction:status': {
    txHash: string;
    chainId: number;
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
  };

  'price:update': {
    prices: Record<string, { usd: number; change24h: number }>;
  };

  // Client -> Server
  'subscribe:positions': {
    positionIds: string[];
  };

  'subscribe:transactions': {
    txHashes: string[];
  };

  'unsubscribe:all': {};
}
```

---

## 6. Frontend Architecture

### 6.1 Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth-required routes
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── portfolio/
│   │   │   ├── page.tsx
│   │   │   └── [positionId]/
│   │   │       └── page.tsx
│   │   ├── yield/
│   │   │   ├── page.tsx          # Yield explorer
│   │   │   └── simulate/
│   │   │       └── page.tsx      # Strategy simulator
│   │   ├── transactions/
│   │   │   ├── page.tsx          # Transaction history
│   │   │   └── build/
│   │   │       └── page.tsx      # Transaction builder
│   │   ├── alerts/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── (public)/                 # Public routes
│   │   ├── page.tsx              # Landing page
│   │   └── explore/
│   │       └── page.tsx          # Public yield explorer
│   ├── api/
│   │   └── trpc/
│   │       └── [trpc]/
│   │           └── route.ts
│   ├── layout.tsx
│   └── providers.tsx
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── layout/                   # Layout components
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── mobile-nav.tsx
│   │   └── footer.tsx
│   │
│   ├── portfolio/                # Portfolio feature components
│   │   ├── portfolio-summary.tsx
│   │   ├── position-card.tsx
│   │   ├── position-list.tsx
│   │   ├── position-detail.tsx
│   │   ├── value-chart.tsx
│   │   └── protocol-breakdown.tsx
│   │
│   ├── yield/                    # Yield feature components
│   │   ├── yield-table.tsx
│   │   ├── yield-card.tsx
│   │   ├── yield-chart.tsx
│   │   ├── strategy-builder.tsx
│   │   ├── simulation-results.tsx
│   │   └── comparison-view.tsx
│   │
│   ├── transactions/             # Transaction feature components
│   │   ├── tx-builder/
│   │   │   ├── step-selector.tsx
│   │   │   ├── step-config.tsx
│   │   │   ├── step-list.tsx
│   │   │   └── simulation-preview.tsx
│   │   ├── tx-history.tsx
│   │   ├── tx-status.tsx
│   │   └── tx-detail.tsx
│   │
│   ├── notifications/            # Notification components
│   │   ├── notification-bell.tsx
│   │   ├── notification-list.tsx
│   │   ├── notification-item.tsx
│   │   ├── alert-rule-form.tsx
│   │   └── alert-rule-list.tsx
│   │
│   ├── wallet/                   # Wallet connection components
│   │   ├── connect-button.tsx
│   │   ├── wallet-modal.tsx
│   │   ├── chain-selector.tsx
│   │   └── account-menu.tsx
│   │
│   └── shared/                   # Shared components
│       ├── token-icon.tsx
│       ├── protocol-icon.tsx
│       ├── chain-badge.tsx
│       ├── amount-input.tsx
│       ├── percentage-change.tsx
│       ├── loading-skeleton.tsx
│       └── error-boundary.tsx
│
├── hooks/                        # Custom React hooks
│   ├── use-portfolio.ts
│   ├── use-positions.ts
│   ├── use-yields.ts
│   ├── use-simulation.ts
│   ├── use-transactions.ts
│   ├── use-notifications.ts
│   ├── use-websocket.ts
│   └── use-prices.ts
│
├── lib/                          # Utilities and configurations
│   ├── trpc.ts                   # tRPC client setup
│   ├── wagmi.ts                  # Wagmi configuration
│   ├── utils.ts                  # General utilities
│   ├── format.ts                 # Formatting utilities
│   ├── constants.ts              # App constants
│   └── validations.ts            # Zod schemas for forms
│
├── stores/                       # Zustand stores
│   ├── app-store.ts              # Global app state
│   ├── notification-store.ts     # Notification state
│   └── transaction-store.ts      # Pending transaction state
│
└── types/                        # TypeScript types
    ├── portfolio.ts
    ├── yield.ts
    ├── transaction.ts
    └── notification.ts
```

### 6.2 Key Component Designs

```tsx
// components/portfolio/portfolio-summary.tsx
interface PortfolioSummaryProps {
  totalValue: number;
  totalYield24h: number;
  change24h: number;
  change24hPct: number;
  positionCount: number;
}

// Visual layout:
// ┌─────────────────────────────────────────────────────────────┐
// │  Total Portfolio Value                                      │
// │  $125,432.56                              ▲ +$1,234 (2.3%)  │
// │  ───────────────────────────────────────────────────────    │
// │  Yield (24h): $12.34    │    Positions: 8    │    APY: 5.2% │
// └─────────────────────────────────────────────────────────────┘

// components/portfolio/position-card.tsx
interface PositionCardProps {
  position: Position;
  onSelect: (id: string) => void;
}

// Visual layout:
// ┌─────────────────────────────────────────────────────────────┐
// │ [Protocol Logo]  Aave V3                        [Chain Badge]│
// │                                                              │
// │  Supplied USDC                                              │
// │  $10,000.00                                    APY: 3.45%   │
// │                                                              │
// │  Yield (24h): +$0.94                          [→ Details]   │
// └─────────────────────────────────────────────────────────────┘

// components/yield/strategy-builder.tsx
interface StrategyBuilderProps {
  onSimulate: (strategy: Strategy) => void;
}

// Visual layout:
// ┌─────────────────────────────────────────────────────────────┐
// │  Build Your Strategy                                        │
// │  ───────────────────────────────────────────────────────    │
// │  Principal: [$________] USD                                 │
// │  Duration:  [30 days ▼]                                     │
// │                                                              │
// │  Allocations:                                               │
// │  ┌─────────────────────────────────────────────────────┐   │
// │  │ [+] Aave USDC    │ 50%  │ [===========    ] │ [×]  │   │
// │  │ [+] Lido stETH   │ 30%  │ [=======        ] │ [×]  │   │
// │  │ [+] Compound ETH │ 20%  │ [====           ] │ [×]  │   │
// │  └─────────────────────────────────────────────────────┘   │
// │                                                              │
// │  [+ Add Protocol]                    [Simulate Strategy →]  │
// └─────────────────────────────────────────────────────────────┘

// components/transactions/tx-builder/step-list.tsx
interface TxBuilderProps {
  steps: TransactionStep[];
  onAddStep: () => void;
  onRemoveStep: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onSimulate: () => void;
  onExecute: () => void;
}

// Visual layout:
// ┌─────────────────────────────────────────────────────────────┐
// │  Transaction Builder                          [Templates ▼] │
// │  ───────────────────────────────────────────────────────    │
// │                                                              │
// │  ① Swap 1 ETH → USDC on Uniswap                    [≡] [×] │
// │     └─ Est. output: ~2,500 USDC                             │
// │           │                                                  │
// │           ▼                                                  │
// │  ② Deposit USDC to Aave V3                         [≡] [×] │
// │     └─ Current APY: 3.45%                                   │
// │           │                                                  │
// │           ▼                                                  │
// │  ③ Stake aUSDC in Yearn Vault                     [≡] [×] │
// │     └─ Boosted APY: 5.12%                                   │
// │                                                              │
// │  [+ Add Step]                                               │
// │                                                              │
// │  ───────────────────────────────────────────────────────    │
// │  Total Gas Est: ~$12.50                                     │
// │  [Simulate]                              [Execute All →]    │
// └─────────────────────────────────────────────────────────────┘
```

---

## 7. Web3 Integration Layer

### 7.1 Protocol Adapter Pattern

The adapter system supports two modes: **Graph-accelerated** (fast, ~100-500ms) and **RPC-based** (fallback, ~3-8s).

```typescript
// src/server/adapters/types.ts
export interface ProtocolAdapter {
  id: string;
  name: string;
  category: 'lending' | 'staking' | 'restaking' | 'yield';

  // Read operations
  getPositions(address: Address, chainId: SupportedChainId): Promise<Position[]>;
  getAllPositions(address: Address): Promise<Position[]>;
  supportsChain(chainId: SupportedChainId): boolean;
}

// Base adapter class with common functionality
export abstract class BaseAdapter implements ProtocolAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly category: ProtocolCategory;
  abstract readonly config: AdapterConfig;

  supportsChain(chainId: SupportedChainId): boolean {
    return this.config.supportedChains.includes(chainId);
  }

  formatBalance(rawBalance: bigint, decimals: number): number {
    return Number(rawBalance) / Math.pow(10, decimals);
  }
}

### 7.1.1 Graph-Accelerated Adapters

When `USE_GRAPH_ADAPTERS=true`, the system uses The Graph subgraphs for ~25x faster DeFi position queries.

**Graph Adapter Structure** (`src/server/adapters/graph/`):
```
graph/
├── client.ts           # Centralized GraphQL client with subgraph IDs
├── index.ts            # Exports all Graph adapters
└── adapters/
    ├── aave-v3.ts      # Aave V3 positions via Graph
    ├── compound-v3.ts  # Compound V3 positions via Graph
    ├── lido.ts         # Lido staking via Graph
    └── etherfi.ts      # EtherFi positions via Graph
```

**Graph Client** (`src/server/adapters/graph/client.ts`):
```typescript
// Subgraph deployment IDs per protocol per chain
export const SUBGRAPH_IDS: Record<string, Partial<Record<SupportedChainId, string>>> = {
  "aave-v3": {
    [SUPPORTED_CHAINS.ETHEREUM]: "Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g",
    [SUPPORTED_CHAINS.ARBITRUM]: "DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B",
    // ... more chains
  },
  "lido": { [SUPPORTED_CHAINS.ETHEREUM]: "HXfMc1jPHfFQoccWd7VMv66km75FoxVHDMvsJj5vG5vf" },
  "compound-v3": { /* ... */ },
  "morpho": { /* ... */ },
  "pendle": { /* ... */ },
  "etherfi-market": { /* ... */ },
};

// Get or create GraphQL client for a protocol on a chain
export function getGraphClient(protocol: string, chainId: SupportedChainId): GraphQLClient | null;

// Execute query with error handling (returns null on failure for graceful fallback)
export async function executeGraphQuery<T>(client: GraphQLClient, query: string, variables?: Record<string, unknown>): Promise<T | null>;
```

**Graph Adapter Example** (Aave V3):
```typescript
// src/server/adapters/graph/adapters/aave-v3.ts
export class AaveV3GraphAdapter extends BaseAdapter {
  readonly id = "aave-v3";

  async getPositions(walletAddress: Address, chainId: SupportedChainId): Promise<Position[]> {
    // Try Graph first if enabled
    if (USE_GRAPH_ADAPTERS) {
      const graphPositions = await this.getPositionsFromGraph(walletAddress, chainId);
      if (graphPositions !== null) {
        return graphPositions; // ~100-500ms
      }
      console.log(`[Graph:Aave] Chain ${chainId}: Falling back to RPC`);
    }
    // Fallback to RPC adapter (~3-8s)
    return rpcAdapter.getPositions(walletAddress, chainId);
  }

  private async getPositionsFromGraph(walletAddress: Address, chainId: SupportedChainId): Promise<Position[] | null> {
    const client = getGraphClient("aave-v3", chainId);
    if (!client) return null;

    const response = await executeGraphQuery<UserReservesResponse>(
      client,
      USER_RESERVES_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    if (!response) return null;
    // Parse response into Position[] ...
  }
}
```

### 7.1.2 Adapter Registry

The registry conditionally uses Graph or RPC adapters based on `USE_GRAPH_ADAPTERS`:

```typescript
// src/server/adapters/registry.ts
class AdapterRegistry {
  constructor() {
    if (USE_GRAPH_ADAPTERS) {
      // Graph-accelerated adapters (with internal RPC fallback)
      this.register(aaveV3GraphAdapter);
      this.register(compoundV3GraphAdapter);
      this.register(lidoGraphAdapter);
      this.register(etherfiGraphAdapter);

      // Protocols without Graph subgraphs (RPC only)
      this.register(sparkAdapter);
      this.register(eigenlayerAdapter);
      this.register(morphoAdapter);
      this.register(pendleAdapter);
    } else {
      // All RPC-based adapters
      this.register(lidoAdapter);
      this.register(etherfiAdapter);
      // ... more RPC adapters
    }
  }

  // Get all positions with caching (2 min TTL)
  async getAllPositions(walletAddress: Address): Promise<Position[]> {
    const cacheKey = `defi-positions:${walletAddress.toLowerCase()}`;
    const cached = await getFromCache<Position[]>(cacheKey);
    if (cached) return cached;

    // Fetch from all adapters in parallel with graceful degradation
    const results = await Promise.allSettled(
      this.getAll().map(adapter => adapter.getAllPositions(walletAddress))
    );

    const positions = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => r.value);

    await setInCache(cacheKey, positions, 120);
    return positions;
  }
}
```

### 7.1.3 Envio HyperSync for Historical Data

HyperSync (`src/server/services/historical/hypersync.ts`) provides fast, free access to historical token transfer events for balance reconstruction.

**Key Features:**
- **Backward Balance Reconstruction**: Uses current balances as anchor and works backwards through transfer events
- **Fast Block Estimation**: Estimates block numbers from timestamps using average block times (no API calls)
- **Parallel Queries**: Fetches incoming and outgoing transfers simultaneously

```typescript
// src/server/services/historical/hypersync.ts

// HyperSync endpoints per chain
const HYPERSYNC_ENDPOINTS: Record<SupportedChainId, string> = {
  1: "https://eth.hypersync.xyz",
  42161: "https://arbitrum.hypersync.xyz",
  10: "https://optimism.hypersync.xyz",
  8453: "https://base.hypersync.xyz",
  137: "https://polygon.hypersync.xyz",
};

// Average block times for fast estimation
const BLOCK_TIMES: Record<SupportedChainId, number> = {
  1: 12,       // Ethereum: 12s
  42161: 0.25, // Arbitrum: 250ms
  10: 2,       // Optimism: 2s
  8453: 2,     // Base: 2s
  137: 2,      // Polygon: 2s
};

// Fast block estimation (no API calls)
export function estimateBlockForTimestamp(
  chainId: SupportedChainId,
  timestamp: Date,
  currentBlock: number
): number {
  const secondsAgo = Math.floor((Date.now() - timestamp.getTime()) / 1000);
  const blocksAgo = Math.floor(secondsAgo / BLOCK_TIMES[chainId]);
  return Math.max(0, currentBlock - blocksAgo);
}

// Bulk historical balances using backward reconstruction
export async function getBulkHistoricalBalancesViaHyperSync(
  walletAddress: Address,
  chainId: SupportedChainId,
  timestamps: Date[],
  currentBalances?: TokenBalance[] // Anchor point
): Promise<Map<number, TokenBalance[]>> {
  // 1. Fetch all transfer events from earliest timestamp to now
  // 2. Start with current balances
  // 3. Process timestamps NEWEST to OLDEST
  // 4. Reverse transfer effects to get historical balances
}
```

**Performance Comparison:**
| Method | Query Time | API Cost |
|--------|------------|----------|
| GoldRush/Covalent | ~2-5s per timestamp | Credits consumed |
| HyperSync | ~500ms for all timestamps | Free |

### 7.2 RPC Provider Management

```typescript
// src/server/lib/rpc.ts
import { createPublicClient, http, fallback } from 'viem';
import { mainnet, arbitrum, optimism, base, polygon } from 'viem/chains';

const RPC_URLS: Record<number, string[]> = {
  1: [
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
    `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
    'https://eth.llamarpc.com',
  ],
  42161: [
    `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
    `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
  ],
  // ... other chains
};

const clients = new Map<number, ReturnType<typeof createPublicClient>>();

export function getClient(chainId: number) {
  if (!clients.has(chainId)) {
    const urls = RPC_URLS[chainId];
    if (!urls) throw new Error(`Unsupported chain: ${chainId}`);

    const chain = getChainById(chainId);

    const client = createPublicClient({
      chain,
      transport: fallback(
        urls.map(url => http(url, {
          timeout: 10_000,
          retryCount: 2,
        })),
        { rank: true }
      ),
      batch: {
        multicall: {
          batchSize: 1024,
          wait: 50,
        },
      },
    });

    clients.set(chainId, client);
  }

  return clients.get(chainId)!;
}
```

### 7.3 Transaction Simulation

```typescript
// src/server/services/simulation.ts
import { Tenderly } from '@tenderly/sdk';

const tenderly = new Tenderly({
  accessKey: process.env.TENDERLY_ACCESS_KEY!,
  accountName: process.env.TENDERLY_ACCOUNT!,
  projectName: process.env.TENDERLY_PROJECT!,
});

export interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  gasPrice: bigint;
  logs: DecodedLog[];
  balanceChanges: BalanceChange[];
  error?: string;
}

export async function simulateTransactions(
  transactions: TransactionRequest[],
  fromAddress: string,
  chainId: number
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];

  // Simulate sequentially to get accurate state
  let stateOverrides = {};

  for (const tx of transactions) {
    const simulation = await tenderly.simulator.simulateTransaction({
      networkId: chainId.toString(),
      from: fromAddress,
      to: tx.to,
      input: tx.data,
      value: tx.value || '0',
      gas: 8_000_000,
      stateObjects: stateOverrides,
      save: false,
    });

    const result: SimulationResult = {
      success: simulation.status,
      gasUsed: BigInt(simulation.gasUsed),
      gasPrice: BigInt(simulation.gasPrice),
      logs: decodeSimulationLogs(simulation.logs),
      balanceChanges: extractBalanceChanges(simulation),
    };

    if (!simulation.status) {
      result.error = simulation.errorMessage;
    }

    results.push(result);

    // Update state for next simulation
    if (simulation.status) {
      stateOverrides = {
        ...stateOverrides,
        ...simulation.stateChanges,
      };
    }
  }

  return results;
}
```

---

## 8. Background Jobs

### 8.1 Job Definitions

```typescript
// src/server/jobs/index.ts
import { Queue, Worker } from 'bullmq';
import { redis } from '../lib/redis';

// Queue definitions
export const positionSyncQueue = new Queue('position-sync', { connection: redis });
export const priceUpdateQueue = new Queue('price-update', { connection: redis });
export const alertCheckQueue = new Queue('alert-check', { connection: redis });
export const yieldSnapshotQueue = new Queue('yield-snapshot', { connection: redis });
export const txMonitorQueue = new Queue('tx-monitor', { connection: redis });

// Position sync worker - refreshes user positions
new Worker('position-sync', async (job) => {
  const { userId, walletAddress, chainIds } = job.data;

  const positions = await protocolRegistry.getAllPositions(walletAddress, chainIds);
  await savePositions(userId, positions);

  // Broadcast updates via WebSocket
  await broadcastPositionUpdate(userId, positions);
}, { connection: redis });

// Price update worker - runs every minute
new Worker('price-update', async (job) => {
  const tokens = await getActiveTokens();
  const prices = await fetchPrices(tokens);

  // Update Redis cache
  await cachePrices(prices);

  // Update PostgreSQL backup
  await savePricesToDb(prices);

  // Broadcast to connected clients
  await broadcastPriceUpdate(prices);
}, { connection: redis });

// Alert check worker - evaluates alert rules
new Worker('alert-check', async (job) => {
  const { ruleId } = job.data;

  const rule = await getAlertRule(ruleId);
  if (!rule || !rule.isActive) return;

  const shouldTrigger = await evaluateRule(rule);

  if (shouldTrigger) {
    await triggerAlert(rule);
  }
}, { connection: redis });

// Transaction monitor worker
new Worker('tx-monitor', async (job) => {
  const { chainId, txHash, userId } = job.data;

  const receipt = await waitForTransaction(chainId, txHash);

  await updateTransactionStatus(txHash, {
    status: receipt.status === 'success' ? 'confirmed' : 'failed',
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
  });

  // Notify user
  await sendTransactionNotification(userId, txHash, receipt);

  // Refresh affected positions
  await positionSyncQueue.add('sync', { userId, chainIds: [chainId] });
}, { connection: redis });

// Scheduled jobs
export function initScheduledJobs() {
  // Price updates every 30 seconds
  priceUpdateQueue.add('update', {}, {
    repeat: { every: 30_000 },
  });

  // Yield snapshots every hour
  yieldSnapshotQueue.add('snapshot', {}, {
    repeat: { pattern: '0 * * * *' },
  });

  // Alert checks every minute
  alertCheckQueue.add('check-all', {}, {
    repeat: { every: 60_000 },
  });
}
```

---

## 9. Infrastructure & Deployment

### 9.1 Environment Configuration

```bash
# .env.example

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/onchain_wealth"
REDIS_URL="redis://localhost:6379"

# Auth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# RPC Providers
ALCHEMY_KEY="your-alchemy-key"
INFURA_KEY="your-infura-key"

# External Services
TENDERLY_ACCESS_KEY="your-tenderly-key"
TENDERLY_ACCOUNT="your-account"
TENDERLY_PROJECT="your-project"
COINGECKO_API_KEY="your-coingecko-key"

# The Graph (for fast DeFi position queries)
GRAPH_API_KEY="your-graph-api-key"       # From https://thegraph.com/studio/
USE_GRAPH_ADAPTERS=true                  # Enable Graph-accelerated adapters

# Envio HyperSync (for historical balance reconstruction)
ENVIO_API_TOKEN="your-envio-token"       # Free from https://envio.dev/app/api-tokens

# Notifications
RESEND_API_KEY="your-resend-key"
TELEGRAM_BOT_TOKEN="your-telegram-bot"

# Feature Flags
ENABLE_TRANSACTION_BUILDER=true
ENABLE_YIELD_SIMULATOR=true
```

### 9.2 Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: onchain_wealth
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://dev:dev@db:5432/onchain_wealth
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
  redis_data:
```

### 9.3 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Vercel (Frontend)                            │    │
│  │  - Next.js App (Edge + Serverless)                                  │    │
│  │  - API Routes (tRPC)                                                │    │
│  │  - Edge caching for static assets                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Railway (Backend Services)                      │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │  API Server  │  │ Job Workers  │  │  WebSocket   │              │    │
│  │  │  (Fastify)   │  │  (BullMQ)    │  │   Server     │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  │                                                                      │    │
│  │  ┌──────────────────────────┐  ┌──────────────────────────┐        │    │
│  │  │      PostgreSQL          │  │         Redis            │        │    │
│  │  │   (Managed Instance)     │  │   (Managed Instance)     │        │    │
│  │  └──────────────────────────┘  └──────────────────────────┘        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      External Services                               │    │
│  │  - Alchemy/Infura (RPC)                                             │    │
│  │  - The Graph (Indexed data)                                         │    │
│  │  - Tenderly (Simulation)                                            │    │
│  │  - Resend (Email)                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Development Phases

### Phase 1: Portfolio Dashboard + Notifications (MVP)
**Target: 2-3 weeks**

**Backend:**
- [ ] Database setup with Prisma migrations
- [ ] tRPC setup with auth (SIWE)
- [ ] Portfolio service with 3-4 protocol adapters (Aave, Lido, Compound, Uniswap)
- [ ] Price service with caching
- [ ] Basic notification system (in-app only)
- [ ] Position sync job

**Frontend:**
- [ ] Next.js app setup with TailwindCSS + shadcn/ui
- [ ] Wallet connection (wagmi)
- [ ] Dashboard page with portfolio summary
- [ ] Position list and detail views
- [ ] Portfolio value chart
- [ ] Notification bell + list

**Deliverable:** Working app where users can connect wallet, see positions, and receive basic alerts.

---

### Phase 2: Yield Strategy Simulator
**Target: 1-2 weeks**

**Backend:**
- [ ] Yield history data collection job
- [ ] Simulation engine (Monte Carlo projections)
- [ ] Yield comparison service

**Frontend:**
- [ ] Yield explorer page
- [ ] Strategy builder component
- [ ] Simulation results visualization
- [ ] "Compare to alternatives" feature

**Deliverable:** Users can explore yields and simulate "what if" strategies.

---

### Phase 3: Transaction Builder
**Target: 2 weeks**

**Backend:**
- [ ] Transaction building service
- [ ] Tenderly simulation integration
- [ ] Transaction monitoring job
- [ ] Transaction templates system

**Frontend:**
- [ ] Transaction builder page
- [ ] Step-by-step transaction construction
- [ ] Simulation preview with balance changes
- [ ] Transaction status tracking

**Deliverable:** Users can build, simulate, and execute multi-step DeFi transactions.

---

### Phase 4: Polish & Advanced Features
**Target: 1-2 weeks**

- [ ] Multi-channel notifications (email, Telegram)
- [ ] Advanced alert rules (whale watching, gas alerts)
- [ ] Performance optimization
- [ ] Mobile responsive refinements
- [ ] Error handling and edge cases
- [ ] Analytics and monitoring

---

## 11. Security Considerations

### Authentication
- **SIWE (Sign-In with Ethereum)**: Wallet-based auth, no passwords
- **Session management**: Secure, httpOnly cookies
- **Rate limiting**: Per-IP and per-wallet limits

### Data Security
- **No private keys**: Never store or handle user private keys
- **Transaction signing**: All signing happens client-side in user's wallet
- **Input validation**: Zod schemas on all API inputs
- **SQL injection**: Prevented via Prisma parameterized queries

### Smart Contract Interaction
- **Simulation first**: Always simulate before execution
- **Slippage protection**: Configurable slippage tolerance
- **Approval limits**: Option for exact approvals vs unlimited
- **Known contract addresses**: Whitelist of verified contracts

### Infrastructure
- **HTTPS everywhere**: TLS for all connections
- **Environment variables**: Secrets never in code
- **Dependency scanning**: Automated CVE detection
- **Audit logging**: Track sensitive operations

---

## 12. Testing Strategy

```typescript
// Unit tests: Business logic
describe('YieldSimulator', () => {
  it('calculates compound interest correctly', () => {
    const result = simulateYield({
      principal: 10000,
      apy: 0.05,
      durationDays: 365,
      compoundFrequency: 'daily',
    });
    expect(result.finalValue).toBeCloseTo(10512.67, 2);
  });
});

// Integration tests: API endpoints
describe('Portfolio Router', () => {
  it('returns positions for authenticated user', async () => {
    const caller = createAuthenticatedCaller(mockUser);
    const result = await caller.portfolio.getPortfolio({});
    expect(result.positions).toHaveLength(3);
  });
});

// E2E tests: Critical user flows
describe('Portfolio Flow', () => {
  it('connects wallet and displays positions', async () => {
    await page.click('[data-testid="connect-wallet"]');
    await page.click('[data-testid="metamask-option"]');
    // Mock wallet connection
    await expect(page.locator('[data-testid="portfolio-value"]')).toBeVisible();
  });
});
```

---

## Appendix A: Protocol Adapter Checklist

When adding a new protocol adapter:

**RPC Adapter (required):**
- [ ] Implement `ProtocolAdapter` interface in `src/server/adapters/`
- [ ] Add contract ABIs to `/src/server/abis/`
- [ ] Add contract addresses per chain to `src/lib/constants.ts`
- [ ] Implement `getPositions()` method
- [ ] Implement `supportsChain()` method
- [ ] Add protocol to database seed
- [ ] Register in `src/server/adapters/registry.ts` (RPC mode section)
- [ ] Write unit tests for adapter
- [ ] Test on testnet before mainnet

**Graph Adapter (optional, for faster queries):**
- [ ] Check if protocol has a subgraph on The Graph Explorer
- [ ] Add subgraph ID to `SUBGRAPH_IDS` in `src/server/adapters/graph/client.ts`
- [ ] Create Graph adapter in `src/server/adapters/graph/adapters/`
- [ ] Implement GraphQL query for user positions
- [ ] Add RPC fallback (import existing RPC adapter)
- [ ] Export from `src/server/adapters/graph/index.ts`
- [ ] Register in `src/server/adapters/registry.ts` (Graph mode section)

---

## Appendix B: Adding New Chains

When adding support for a new chain:

1. Add chain to `viem/chains` import or define custom chain
2. Add RPC URLs to provider configuration
3. Add chain to database `chains` table
4. Update protocol adapters with chain-specific addresses
5. Add chain icon/badge to frontend
6. Test all protocol adapters on new chain

---

*Document Version: 1.1*
*Last Updated: January 2025*

---

## Changelog

### v1.1 (January 2025)
- Added Graph-accelerated adapters section (7.1.1) for Aave V3, Compound V3, Lido, EtherFi
- Added Envio HyperSync integration section (7.1.3) for historical balance reconstruction
- Updated adapter registry section (7.1.2) with conditional Graph/RPC mode
- Added new environment variables: `USE_GRAPH_ADAPTERS`, `GRAPH_API_KEY`, `ENVIO_API_TOKEN`
- Updated system architecture diagram with HyperSync data layer
