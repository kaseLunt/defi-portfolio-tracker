# OnChain Wealth - Project Context

## Overview

OnChain Wealth is a DeFi portfolio tracking and management application built for EtherFi. The project aims to provide institutional-grade portfolio visibility, risk analytics, and eventually direct DeFi action execution - positioning it as a differentiated alternative to existing tools like Zapper, DeBank, and Zerion.

**Primary Goal**: Impress technically as part of a job application for EtherFi by building a production-quality DeFi dashboard with advanced features that competitors lack.

**Key Differentiators**: Transaction Intelligence and Risk Analytics (not AI-driven strategy features).

---

## Current State (Phase 1 Complete + Phase 2 In Progress)

### What Works

The Phase 1 foundation is complete, with Phase 2 historical portfolio features now functional.

**Multi-Chain Portfolio Tracking**
- 5 supported chains: Ethereum (1), Arbitrum (42161), Optimism (10), Base (8453), Polygon (137)
- Real-time position fetching via protocol adapters
- **NEW**: Live token balance fetching via GoldRush `balances_v2` API
- Automatic USD value enrichment with price data
- Portfolio aggregation by protocol and by chain
- Total value uses `Math.max(tokenBalances, defiPositions)` for accuracy

**Token Balance Integration (New)**
- `src/server/services/balances.ts` fetches ALL token balances across chains
- GoldRush API provides real-time USD quotes, logos, and decimals
- Dust filtering: positions < $1 are hidden from display
- Parallel fetching across all 5 chains with 15s timeout per chain

**Protocol Adapters (8 implemented)**
- Lido (staking)
- EtherFi (staking)
- Aave V3 (lending)
- Compound V3 (lending)
- Spark (lending)
- Morpho (lending)
- EigenLayer (restaking)
- Pendle (yield)

**Historical Portfolio Chart (Phase 2 Feature - Working)**
- Shows portfolio value over 7d/30d/90d/1y timeframes
- Data interpolation for $0 gaps (anomaly detection: values < 30% of median)
- `currentValue` parameter anchors final data point to live portfolio value
- Progress indicator during data fetch (fetching balances -> fetching prices -> processing)
- Y-axis starts from $0 for accurate visual representation

**Technical Infrastructure**
- Adapter pattern for easy protocol additions
- Multicall batching enabled for RPC efficiency
- Fallback RPC configuration per chain
- Redis caching (30-second TTL for portfolio data)
- BullMQ background jobs for price updates, position sync, alert checking

**Authentication & Real-time**
- SIWE (Sign-In with Ethereum) authentication
- SSE (Server-Sent Events) for real-time updates via Redis pub/sub
- Note: SSE chosen over WebSockets for simplicity (sufficient for this use case)

**Data Persistence**
- PostgreSQL with Prisma ORM
- Position snapshots for historical tracking
- Price cache with 24h change percentage

**Alert System**
- Price alerts (token price above/below threshold)
- Position alerts (value change percentage)
- Cooldown support to prevent alert spam
- In-app notifications with real-time delivery

**Dashboard UI (Overhauled)**
- `TokenHoldings` component: displays all tokens with logos, chain badges, formatted balances
- Reorganized layout: Holdings (primary, 2-col) -> Chains (sidebar) -> DeFi Positions (secondary)
- Hydration mismatch fix: `mounted` state pattern for wallet connection state
- `ChainDot` component with configurable `size` prop (sm/md/lg)

---

## Architecture Summary

```
src/
  app/                    # Next.js App Router pages
    api/
      auth/               # SIWE auth endpoints (nonce, verify, logout, session)
      trpc/               # tRPC API routes
      events/             # SSE endpoint for real-time updates
    dashboard/            # Main dashboard page
    alerts/               # Alert management page

  server/
    adapters/             # Protocol adapters (one per DeFi protocol)
      types.ts            # Position, ProtocolAdapter interfaces
      registry.ts         # Adapter registry singleton
      aave-v3.ts, lido.ts, etc.

    services/
      portfolio.ts        # Portfolio aggregation, enrichment
      price.ts            # CoinGecko price fetching with caching
      notification.ts     # Notification delivery

    jobs/
      workers.ts          # BullMQ workers (position-sync, price-update, alert-check)
      queues.ts           # Queue definitions

    routers/
      _app.ts             # tRPC app router
      portfolio.ts        # Portfolio endpoints
      notification.ts     # Alert/notification endpoints
      user.ts             # User preferences

    lib/
      prisma.ts           # Prisma client
      redis.ts            # Redis client + cache helpers
      rpc.ts              # viem clients with fallback RPC
      siwe.ts             # SIWE session management
      events.ts           # SSE event broadcasting

  components/
    portfolio/            # Position cards, value charts
    notifications/        # Notification bell
    wallet/               # Connect button
    shared/               # Chain badge, token icon, error boundary

  hooks/
    use-auth.ts           # Authentication hook
    use-portfolio.ts      # Portfolio data hook
    use-realtime.tsx      # SSE subscription hook

  lib/
    constants.ts          # Chain IDs, protocol slugs, timing constants
    trpc.ts               # tRPC client setup
    wagmi.ts              # Wagmi configuration
```

---

## Phase 2 & 3 Planning (Just Completed)

A detailed implementation plan (`PHASE_2_3_PLAN.md`) has been created covering:

### Phase 2: Risk Intelligence (6 weeks)

1. **Historical Portfolio Reconstruction** (Weeks 1-2)
   - Show portfolio value over time for ANY wallet without prior snapshots
   - Covalent API for historical token balances
   - DeFi Llama for historical prices
   - Subgraph queries with block parameters for DeFi positions

2. **Liquidation Risk Engine** (Weeks 3-4)
   - Real-time health factor monitoring for lending positions
   - Liquidation price predictions per collateral
   - Price scenario simulations ("what if ETH drops 20%?")
   - New `getLiquidationData()` method for lending adapters
   - Liquidation alerts integration

3. **Transaction Simulation** (Weeks 5-6)
   - Preview exact transaction outcomes before signing
   - Token balance changes visualization
   - Position impact analysis (health factor before/after)
   - Gas estimation
   - Tenderly API integration (primary), eth_call fallback

### Phase 3: DeFi Actions (6 weeks)

1. **Unified DeFi Actions** (Weeks 7-10)
   - Deposit/withdraw/swap/bridge from one interface
   - Yield comparison across protocols
   - New adapter methods: `buildDepositTx()`, `buildWithdrawTx()`
   - 1inch Fusion for swaps (MEV protection)
   - Li.Fi for bridge aggregation

2. **Automation Rules** (Weeks 11-12)
   - User-defined triggers and actions
   - Liquidation protection rules
   - Auto-compound rewards
   - Take profit rules
   - Notification-first approach (optional session keys for auto-execution)

---

## Key Stakeholders & Requirements

**Target User**: DeFi power users managing positions across multiple protocols and chains.

**User Needs**:
- Unified view of all DeFi positions in one place
- Understanding of risk exposure (especially for leveraged positions)
- Ability to act quickly when needed (rebalance, add collateral, take profit)
- Historical performance tracking

**Technical Requirements**:
- Fast load times (< 3 seconds for portfolio)
- Accurate data (99%+ simulation accuracy)
- Multi-chain support
- Mobile responsive

---

## External Services

| Service | Purpose | Status |
|---------|---------|--------|
| CoinGecko | Price feeds | Implemented |
| Alchemy/Public RPCs | Blockchain data | Implemented |
| Redis | Caching, pub/sub, job queues | Implemented |
| PostgreSQL | Persistent storage | Implemented |
| GoldRush (Covalent) | Live token balances + Historical balances | **Implemented** |
| DeFi Llama | Historical prices | **Implemented** |
| Tenderly | TX simulation | Planned (Phase 2) |
| 1inch Fusion | Swaps | Planned (Phase 3) |
| Li.Fi | Bridging | Planned (Phase 3) |

---

## Recent Evolution

### January 21, 2025 (Session 2 - Major Feature Updates)

**Historical Portfolio Chart Fixes:**
- Fixed data interpolation for $0 gaps in chart data
- Changed from exact zero check to anomaly detection (values < 30% of median)
- Interpolation now applied to both cached and freshly-fetched data
- Added `currentValue` parameter to anchor final data point to live portfolio value
- Fixed Y-axis to start from $0 (was auto-scaling, hiding context)

**Live Token Balance Integration:**
- Created `src/server/services/balances.ts` for raw token balance fetching
- Uses GoldRush (Covalent) `balances_v2` endpoint for comprehensive token coverage
- Integrated into portfolio service: fetches both DeFi positions AND raw token balances in parallel
- Total value calculation: `Math.max(tokenBalances, defiPositions)` ensures accuracy when one source is incomplete

**Dashboard UI Overhaul:**
- Created `TokenHoldings` component (`src/components/portfolio/token-holdings.tsx`)
  - Token logos with fallback to initials
  - Chain badge overlay on each token
  - Smart balance formatting (M/K suffixes, scientific notation for tiny amounts)
- Reorganized dashboard layout for clarity:
  - Holdings section (primary, 2-column span)
  - Chains distribution (sidebar)
  - DeFi Positions (secondary, collapsed by default if empty)
- Fixed hydration mismatch: added `mounted` state pattern for wallet connection UI

**Bug Fixes:**
- Fixed `getProgress` endpoint 500 errors (date serialization from Redis cache)
- Added dust filtering: positions < $1 hidden from UI
- Added `size` prop to `ChainDot` component for flexible sizing

**Git Repository:**
- Initialized git repo with comprehensive initial commit

### January 21, 2025 (Session 1)
- Completed Phase 2 & 3 planning document
- Detailed implementation roadmap for Risk Intelligence and DeFi Actions
- Architecture decisions documented for transaction simulation (Tenderly) and automation

### January 20, 2025
- Completed Phase 1 implementation
- 8 protocol adapters working
- Background jobs running (price updates, position sync, alerts)
- SSE real-time updates functional
- N+1 query optimizations applied

### January 19, 2025
- Project initialized
- Core architecture established
- Database schema designed
- SIWE authentication implemented

---

## Open Questions

1. **Tenderly Pricing**: Need to verify $50/month starter tier is sufficient for expected simulation volume.

2. **Automation Execution**: Current plan is notification-first. Should we invest in session keys or Gelato for true auto-execution?

3. **Historical Data Depth**: How far back should historical reconstruction go? Covalent has limits.

4. **Mobile App**: Current plan is mobile-responsive web. Native app could be Phase 4.

5. **Protocol Priority for Phase 2**: Which lending protocols should get `getLiquidationData()` first? (Aave V3 likely most used)

---

## Technical Debt & Known Issues

1. **Transaction Monitoring Worker**: Placeholder implementation - needs proper receipt polling.

2. **Yield Alerts**: Marked as TODO in alert evaluation logic.

3. **EigenLayer Adapter**: May need updates for new restaking mechanics.

4. **Error Boundaries**: Basic implementation - could use more granular error handling per component.

5. **Token Logo Fallback**: When GoldRush logo URL fails, falls back to 2-letter initials - could use a token logo aggregator.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/server/services/balances.ts` | GoldRush token balance fetching |
| `src/server/services/portfolio.ts` | Portfolio aggregation (DeFi + tokens) |
| `src/server/services/historical/index.ts` | Historical portfolio data with interpolation |
| `src/server/routers/history.ts` | History API endpoints with date serialization |
| `src/components/portfolio/token-holdings.tsx` | Token list UI component |
| `src/components/portfolio/value-chart.tsx` | Portfolio chart with progress indicator |
| `src/components/shared/chain-badge.tsx` | ChainBadge and ChainDot components |
| `src/app/dashboard/page.tsx` | Main dashboard with hydration fix |

---

*Document Version: 1.1*
*Last Updated: January 21, 2025*
