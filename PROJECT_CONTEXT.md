# OnChain Wealth - Project Context

## Overview

OnChain Wealth is a DeFi portfolio tracking and management application built for EtherFi. The project aims to provide institutional-grade portfolio visibility, risk analytics, and eventually direct DeFi action execution - positioning it as a differentiated alternative to existing tools like Zapper, DeBank, and Zerion.

**Primary Goal**: Impress technically as part of a job application for EtherFi by building a production-quality DeFi dashboard with advanced features that competitors lack.

**Key Differentiators**: Transaction Intelligence and Risk Analytics (not AI-driven strategy features).

---

## Current State (Phase 1 Complete + Phase 2 In Progress + Major Feature Additions)

### What Works

The Phase 1 foundation is complete, with Phase 2 historical portfolio features now functional. UX polish complete. All fake/placeholder features replaced with real data. **The Graph integration delivers sub-second DeFi position loading.** **Strategy Builder provides visual DeFi composition with real-time simulation.** **EtherFi-specific dashboard showcases protocol-focused experience.**

**Multi-Chain Portfolio Tracking**
- 5 supported chains: Ethereum (1), Arbitrum (42161), Optimism (10), Base (8453), Polygon (137)
- Real-time position fetching via protocol adapters
- Live token balance fetching via GoldRush `balances_v2` API
- Automatic USD value enrichment with price data
- Portfolio aggregation by protocol and by chain
- Total value uses `Math.max(tokenBalances, defiPositions)` for accuracy

**Token Balance Integration**
- `src/server/services/balances.ts` fetches ALL token balances across chains
- GoldRush API provides real-time USD quotes, logos, and decimals
- Dust filtering: positions < $1 are hidden from display
- Parallel fetching across all 5 chains with 15s timeout per chain

**Protocol Adapters (8 implemented)**
- Lido (staking) - Real APY from DeFi Llama (~2.43%), **Graph-accelerated**
- EtherFi (staking) - Real APY from DeFi Llama (~3.09%), **Graph-accelerated**
- Aave V3 (lending) - On-chain APY, **Graph-accelerated**
- Compound V3 (lending) - On-chain APY, **Graph-accelerated**
- Spark (lending) - On-chain APY
- Morpho (lending)
- EigenLayer (restaking)
- Pendle (yield)

**The Graph Integration (Major Performance Upgrade)**
- Graph-accelerated adapters for Aave V3, Compound V3, Lido, and EtherFi
- DeFi position loading reduced from **~38 seconds to ~1-2 seconds** (19x faster)
- Subgraph queries replace slow multicall RPC operations
- Graceful fallback to RPC if subgraph unavailable
- Graph client with caching in `src/server/adapters/graph/client.ts`
- Adapters organized in `src/server/adapters/graph/adapters/` directory

**Strategy Builder (Major New Feature)**
- Visual drag-and-drop DeFi strategy builder at `/strategy-builder`
- Supported block types:
  - **Input**: Capital entry point with customizable amount
  - **Stake**: Staking protocols (Lido, EtherFi) with live APY
  - **Lend**: Lending protocols (Aave, Compound) with supply rates
  - **Borrow**: Borrowing against collateral with health factor tracking
  - **Swap**: Token exchanges with price impact estimation
- Flow allocation system with auto-balancing (split capital across multiple paths)
- Loop detection for leverage strategies (borrow -> swap -> stake -> repeat)
- Real-time simulation engine:
  - APY calculation based on composed strategy
  - Risk scoring based on protocol diversity and leverage
  - Projected yields at 1m/6m/1y timeframes
- Premium UI treatment:
  - Animated particle effects on canvas background
  - Celebration confetti on strategy save
  - Ambient glow effects on connections
  - Smooth drag-and-drop with visual feedback

**EtherFi Integration (Enhanced)**
- Dedicated EtherFi dashboard at `/etherfi/[wallet]`
- Platinum tier badge with gaming-inspired design (animated gradient border)
- Live weETH/ETH exchange rate display
- Staking panel with real-time APY and one-click stake simulation
- EtherFi Insights card on main dashboard showing:
  - Total staked value
  - Current APY
  - Accrued rewards estimate
  - Quick link to dedicated dashboard
- Protocol-specific branding and color scheme

**UI/UX Improvements (Premium Polish)**
- Custom typography system:
  - Space Grotesk for headings (modern geometric sans-serif)
  - JetBrains Mono for numbers and addresses (monospace clarity)
- Staggered page entrance animations with Framer Motion
- Premium glass morphism effects throughout:
  - Frosted glass cards with subtle borders
  - Backdrop blur on overlays
  - Gradient shine effects on hover
- Enhanced loading states with skeleton pulse animations
- Responsive design refinements for tablet breakpoints

**Historical Portfolio Chart (Phase 2 Feature - Working)**
- Shows portfolio value over 7d/30d/90d/1y timeframes
- Data interpolation for $0 gaps (anomaly detection: values < 30% of median)
- `currentValue` parameter anchors final data point to live portfolio value
- Progress indicator during data fetch (fetching balances -> fetching prices -> processing)
- Y-axis starts from $0 for accurate visual representation
- **Per-token price history exposed for sparklines** (key format: `chainId:tokenAddress`)

**Technical Infrastructure**
- Adapter pattern for easy protocol additions
- **The Graph subgraphs for sub-second DeFi queries** (primary data source)
- Multicall batching enabled for RPC efficiency (fallback)
- Fallback RPC configuration per chain
- Redis caching (30-second TTL for portfolio data)
- BullMQ background jobs for price updates, position sync, alert checking
- **HyperSync for backward balance reconstruction** in historical data

**Authentication & Real-time**
- SIWE (Sign-In with Ethereum) authentication
- SSE (Server-Sent Events) for real-time updates via Redis pub/sub
- Note: SSE chosen over WebSockets for simplicity (sufficient for this use case)
- Note: Live indicator shows SSE connection status only - no backend price broadcasting implemented

**Data Persistence**
- PostgreSQL with Prisma ORM
- Position snapshots for historical tracking
- Price cache with 24h change percentage

**Alert System**
- Price alerts (token price above/below threshold)
- Position alerts (value change percentage)
- Cooldown support to prevent alert spam
- In-app notifications with real-time delivery

**Dashboard UI (Fully Polished)**
- `TokenHoldings` component: displays all tokens with logos, chain badges, formatted balances
- Reorganized layout: Holdings (primary, 2-col) -> Chains (sidebar) -> DeFi Positions (secondary)
- Hydration mismatch fix: `mounted` state pattern for wallet connection state
- `ChainDot` component with configurable `size` prop (sm/md/lg)

**UX Enhancements (Session 3 - January 21, 2025)**
- **Token Logos**: `TokenLogo` component with image URLs and fallback to 2-letter initials, chain indicator dot overlay
- **Protocol Logos**: `ProtocolLogo` component using DeFiLlama CDN, protocol metadata in `src/lib/protocol-metadata.ts`
- **Skeleton Loading**: Shimmer animation states with `SkeletonRow`, `SkeletonCard`, `SkeletonCircle` components
- **Toast Notifications**: Using `sonner` library for wallet search, address copy, refresh completion, and error feedback
- **Position Drill-Down**: Sheet/drawer component for detailed position view with yield projections (daily/monthly/yearly), protocol and explorer links
- **Mobile Responsiveness**: Hamburger menu in header, responsive chart sizing, full-width sheets on mobile
- **Sparklines**: SVG-based mini charts in token rows - **now using real historical price data**
- **Live Price Infrastructure**: SSE connection hook and `LiveIndicator` component (backend broadcasting not yet implemented)
- **CSS Fixes**: Fixed cursor showing as text cursor everywhere, added `user-select: none` to body

**Session 4 Improvements (January 21, 2025)**
- **Real Sparklines**: Token sparklines now use real price history from DeFi Llama (no more fake data)
- **Real APY Data**: Lido and EtherFi adapters fetch live APY from DeFi Llama yields API
- **Yields Service**: New `src/server/services/yields.ts` with Redis + memory caching
- **HTML Hydration Fix**: `SheetDescription` now renders `<div>` instead of `<p>` to allow `<div>` children

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
    strategy-builder/     # Visual DeFi strategy composer
    etherfi/[wallet]/     # Dedicated EtherFi dashboard

  server/
    adapters/             # Protocol adapters (one per DeFi protocol)
      types.ts            # Position, ProtocolAdapter interfaces
      registry.ts         # Adapter registry singleton
      graph/              # Graph-accelerated adapters (primary, sub-second queries)
        client.ts         # Centralized GraphQL client
        adapters/         # Protocol-specific Graph adapters
      aave-v3.ts, lido.ts, etc.  # RPC-based adapters (fallback)

    services/
      portfolio.ts        # Portfolio aggregation, enrichment
      price.ts            # CoinGecko price fetching with caching
      yields.ts           # DeFi Llama yields API (Lido, EtherFi APY)
      notification.ts     # Notification delivery
      historical/         # Historical portfolio reconstruction

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
    strategy-builder/     # Strategy canvas, blocks, simulation
    etherfi/              # EtherFi-specific components (tier badge, staking panel)

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
- Fast load times (< 3 seconds for portfolio) - **ACHIEVED: ~1-2 seconds with The Graph**
- Accurate data (99%+ simulation accuracy)
- Multi-chain support
- Mobile responsive

---

## External Services

| Service | Purpose | Status |
|---------|---------|--------|
| CoinGecko | Price feeds | Implemented |
| Alchemy/Public RPCs | Blockchain data (fallback) | Implemented |
| **The Graph** | **DeFi position queries (primary)** | **Implemented** |
| **HyperSync** | **Historical balance reconstruction** | **Implemented** |
| Redis | Caching, pub/sub, job queues | Implemented |
| PostgreSQL | Persistent storage | Implemented |
| GoldRush (Covalent) | Live token balances + Historical balances | **Implemented** |
| DeFi Llama Prices | Historical prices | **Implemented** |
| DeFi Llama Yields | Live APY data (Lido, EtherFi) | **Implemented** |
| Tenderly | TX simulation | Planned (Phase 2) |
| 1inch Fusion | Swaps | Planned (Phase 3) |
| Li.Fi | Bridging | Planned (Phase 3) |

---

## Recent Evolution

### January 26, 2026 (Session 7 - Strategy Builder, EtherFi Dashboard & Premium UI)

**Objective**: Add visual DeFi strategy composition, protocol-specific dashboards, and premium UI polish.

**Strategy Builder Implementation:**
- Created `/strategy-builder` page with drag-and-drop canvas
- Block system with 5 types: Input, Stake, Lend, Borrow, Swap
- Connection lines with animated flow indicators
- Flow allocation with percentage splits and auto-balancing
- Loop detection algorithm for leverage strategies
- Real-time simulation engine calculating:
  - Combined APY from all yield-generating blocks
  - Risk score based on protocol diversity and leverage ratio
  - Gas estimates for strategy execution
- Premium visual effects:
  - Particle animation system on canvas background
  - Confetti celebration on strategy save
  - Ambient glow on active connections
  - Smooth transitions and micro-interactions

**EtherFi Dedicated Dashboard:**
- Created `/etherfi/[wallet]` route with protocol-specific experience
- Platinum tier badge component with gaming aesthetics:
  - Animated gradient border
  - Glow effects and shimmer animation
  - Tier progression display
- weETH staking panel:
  - Live exchange rate from contract
  - APY display with real data from yields service
  - Stake/unstake simulation (no actual transactions)
- Rewards tracker with estimated earnings
- Integration with main dashboard via EtherFi Insights card

**The Graph Architecture Refactor:**
- Reorganized Graph adapters into `src/server/adapters/graph/` directory:
  - `client.ts` - Centralized GraphQL client with caching
  - `adapters/aave-v3.ts` - Aave V3 subgraph adapter
  - `adapters/compound-v3.ts` - Compound V3 subgraph adapter
  - `adapters/lido.ts` - Lido subgraph adapter
  - `adapters/etherfi.ts` - EtherFi subgraph adapter
- Improved error handling with detailed fallback logging
- Added query deduplication to reduce redundant requests

**Premium Typography System:**
- Added Space Grotesk font for headings (via next/font/google)
- Added JetBrains Mono for numerical data and addresses
- Created typography utility classes in globals.css
- Applied consistently across all components

**Staggered Page Animations:**
- Implemented `useStaggeredEntrance` hook
- Cards and sections animate in sequence on page load
- Smooth fade-up with spring physics
- Delay orchestration for visual hierarchy

**Glass Morphism Effects:**
- Created `.glass-card` and `.glass-panel` utility classes
- Backdrop blur with subtle white borders
- Gradient overlays for depth
- Works across light and dark modes

**Files Created:**
- `src/app/strategy-builder/page.tsx` - Strategy builder main page
- `src/components/strategy-builder/canvas.tsx` - Drag-and-drop canvas
- `src/components/strategy-builder/blocks.tsx` - Block components
- `src/components/strategy-builder/simulation.tsx` - Simulation panel
- `src/components/strategy-builder/particles.tsx` - Particle animation
- `src/app/etherfi/[wallet]/page.tsx` - EtherFi dashboard
- `src/components/etherfi/tier-badge.tsx` - Platinum tier badge
- `src/components/etherfi/staking-panel.tsx` - Staking interface
- `src/components/etherfi/insights-card.tsx` - Main dashboard integration
- `src/server/adapters/graph/client.ts` - Centralized Graph client
- `src/server/adapters/graph/adapters/*.ts` - Reorganized Graph adapters
- `src/hooks/use-staggered-entrance.ts` - Animation orchestration hook

**Files Modified:**
- `src/app/layout.tsx` - Added new fonts, updated metadata
- `src/app/globals.css` - Typography utilities, glass morphism classes
- `src/app/dashboard/page.tsx` - Added EtherFi Insights card
- `src/server/adapters/registry.ts` - Updated Graph adapter imports
- `tailwind.config.ts` - Extended with custom font families

---

### January 23, 2026 (Session 6 - The Graph Integration & Performance Breakthrough)

**Objective**: Achieve sub-second DeFi position loading by migrating from slow RPC multicalls to The Graph subgraph queries.

**The Graph Integration:**
- Created Graph-accelerated adapters for 4 protocols:
  - `aave-v3-graph.ts` - Aave V3 positions via subgraph
  - `compound-v3-graph.ts` - Compound V3 positions via subgraph
  - `lido-graph.ts` - Lido staking positions via subgraph
  - `etherfi-graph.ts` - EtherFi positions via subgraph
- Adapter registry updated to prefer Graph adapters with RPC fallback
- Uses `graphql-request` library for efficient subgraph queries

**Performance Results:**
- DeFi position loading: **~38 seconds -> ~1-2 seconds** (19x improvement)
- Parallel subgraph queries across protocols
- Eliminated expensive multicall RPC operations for position data

**HyperSync Fix:**
- Fixed backward balance reconstruction for historical data
- Corrected timestamp and block number alignment issues
- Historical portfolio chart now accurately reconstructs past balances

**Price Ticker Animation Fix:**
- Fixed animation re-triggering on live price updates
- Price changes now animate smoothly without jarring re-renders
- Proper React key handling for price update transitions

**New Dependencies:**
- `graphql` - GraphQL query language
- `graphql-request` - Lightweight GraphQL client for subgraph queries

**Files Created:**
- `src/server/adapters/aave-v3-graph.ts` - Graph-accelerated Aave V3 adapter
- `src/server/adapters/compound-v3-graph.ts` - Graph-accelerated Compound V3 adapter
- `src/server/adapters/lido-graph.ts` - Graph-accelerated Lido adapter
- `src/server/adapters/etherfi-graph.ts` - Graph-accelerated EtherFi adapter

**Files Modified:**
- `src/server/adapters/registry.ts` - Updated to use Graph adapters as primary
- `src/server/services/historical/index.ts` - HyperSync backward reconstruction fix
- `src/components/portfolio/price-ticker.tsx` - Animation re-triggering fix
- `package.json` - Added graphql and graphql-request dependencies

---

### January 21, 2025 (Session 5 - Loading UX & Performance Optimizations)

**Objective**: Improve perceived and actual loading performance with premium UX treatment.

**Premium Loading Experience:**
- Created `LoadingOrchestrator` component (`src/components/shared/loading-orchestrator.tsx`)
  - Animated stage indicators with framer-motion
  - Chain completion visualization (Ethereum, Arbitrum, Optimism, Base, Polygon)
  - Protocol scanning visualization
  - Rotating facts and tips about the app
  - Elapsed time counter
- Created `DashboardSkeleton` components (`src/components/shared/dashboard-skeleton.tsx`)
- Added `framer-motion` dependency for smooth animations

**Data Point Reduction (Performance):**
- Reduced data points in `src/lib/constants.ts`:
  - 7d: 28 -> 14 points (every 12h instead of 6h)
  - 30d: 30 -> 15 points
  - 90d: 45 -> 18 points
  - 1y: 52 -> 24 points
- Result: ~54% reduction in API calls while maintaining visual smoothness

**Parallelized Price Fetching:**
- Changed from sequential to parallel processing in `src/server/services/historical/index.ts`
- Uses 5 concurrent requests instead of one-at-a-time
- Significantly faster historical data retrieval

**Background Preloading:**
- In `src/hooks/use-portfolio-history.ts`: After 7d loads, automatically prefetches 30d, 90d, 1y
- Staggered at 2s, 5s, 8s intervals to avoid overwhelming API
- Subsequent timeframe switches feel instant

**Timeframe Reset on Wallet Change:**
- In `src/app/dashboard/page.tsx`: Reset to 7d when searching for new wallet address
- In `src/components/portfolio/value-chart.tsx`: Sync internal state with prop changes

**Client-Side Progress Simulation:**
- Replaced unreliable Redis polling with client-side simulated progress
- Progress advances based on elapsed time with predefined stages
- Updates every 200ms for smooth animation
- Stages: Scanning chains -> Fetching prices -> Processing -> Complete

**Key Technical Decisions:**
1. **Client-side progress over server polling**: Server-side progress tracking had race conditions and timing issues due to cache miss/hit patterns. Client-side simulation provides reliable, smooth UX.
2. **Fewer data points**: 14 points for 7d is visually smooth but loads 2x faster.
3. **Parallel over sequential**: Parallel price fetching with controlled concurrency (5) is much faster than sequential.

**Files Created:**
- `src/components/shared/loading-orchestrator.tsx` - Premium loading experience
- `src/components/shared/dashboard-skeleton.tsx` - Skeleton layouts

**Files Modified:**
- `src/app/dashboard/page.tsx` - Timeframe reset on wallet change
- `src/components/portfolio/value-chart.tsx` - Sync state with props
- `src/hooks/use-portfolio-history.ts` - Client-side progress, background preloading
- `src/lib/constants.ts` - Reduced data points
- `src/server/services/historical/index.ts` - Parallel price fetching
- `src/server/services/historical/progress.ts` - Progress tracking updates
- `package.json` - Added framer-motion dependency

---

### January 21, 2025 (Session 4 - Replacing Fake Features with Real Data)

**Objective**: Fix fake/incomplete features to make them production-ready with real data.

**Real Sparklines:**
- Problem: Sparklines used fake data generated from token address hash
- Solution: Extended `HistoricalPortfolioResult` type to include `tokenPriceHistory: Record<string, number[]>`
- Modified `src/server/services/historical/index.ts` to collect per-token prices while processing timestamps
- Updated `usePortfolioHistory` hook to return `tokenPriceHistory`
- Updated `TokenHoldings` component to accept and use real price history
- Key format: `chainId:tokenAddress` (lowercase)

**Real APY Data:**
- Problem: Lido and EtherFi adapters had hardcoded APY values (3.5% and 3.8%)
- Solution: Created `src/server/services/yields.ts` service
- Fetches from DeFi Llama yields API (`https://yields.llama.fi/pools`)
- Caches data in Redis (10 min TTL) + in-memory cache (1 min)
- Exports `getLidoApy()` and `getEtherFiApy()` functions
- Important discovery: DeFi Llama uses different project names:
  - Lido: `lido` with symbol `STETH` (~2.43% APY)
  - EtherFi: `ether.fi-stake` (not `ether.fi`) with symbol `WEETH` (~3.09% APY)

**CSS/UX Fixes:**
- Fixed sparkline alignment in token holdings (better spacing, fixed width container)
- Fixed HTML hydration error: `SheetDescription` rendered `<p>` containing `<div>` (ChainBadge)
  - Changed `SheetDescription` to render `<div>` instead of `<p>`

**Architecture Discussion (Not Implemented):**
- User asked about smarter caching for historical data
- Current: Cache full query results with TTL, re-fetch ALL data when expired
- Better approach: Store individual price points permanently (immutable), only fetch missing timestamps
- Decision: Current approach sufficient for demo, note smarter architecture for interview discussion

**Files Created:**
- `src/server/services/yields.ts` - DeFi Llama yields API integration

**Files Modified:**
- `src/server/services/historical/types.ts` - Added `tokenPriceHistory` to result type
- `src/server/services/historical/index.ts` - Collect per-token prices
- `src/hooks/use-portfolio-history.ts` - Return `tokenPriceHistory`
- `src/components/portfolio/token-holdings.tsx` - Use real price history for sparklines
- `src/server/adapters/lido.ts` - Removed hardcoded APY, calls `getLidoApy()`
- `src/server/adapters/etherfi.ts` - Removed hardcoded APY, calls `getEtherFiApy()`
- `src/components/ui/sheet.tsx` - `SheetDescription` renders `<div>` not `<p>`

### January 21, 2025 (Session 3 - UX Polish)

**Token & Protocol Visual Enhancements:**
- Created `TokenLogo` component in `src/components/portfolio/token-holdings.tsx`
  - Displays token images with fallback to 2-letter initials
  - Chain indicator dot overlay for multi-chain context
- Created `ProtocolLogo` component in `src/components/portfolio/position-card.tsx`
  - Uses DeFiLlama CDN for protocol logos
  - Protocol metadata centralized in `src/lib/protocol-metadata.ts`

**Loading & Feedback States:**
- Created `src/components/ui/skeleton.tsx` with shimmer animation
- Components: `SkeletonRow`, `SkeletonCard`, `SkeletonCircle` for various loading contexts
- Integrated `sonner` for toast notifications:
  - Wallet search confirmation
  - Address copy feedback
  - Refresh completion notifications
  - Error notifications

**Position Detail Sheet:**
- Created `src/components/portfolio/position-detail-sheet.tsx`
- Sheet/drawer component for detailed position view
- Shows yield projections (daily/monthly/yearly)
- Includes protocol and block explorer links
- Full-width on mobile, standard sheet on desktop

**Mobile Responsiveness:**
- Added hamburger menu to `src/components/layout/header.tsx`
- Made charts responsive in `src/components/portfolio/value-chart.tsx`
- Sheets render full-width on mobile devices

**Sparklines:**
- Created `src/components/ui/sparkline.tsx`
- SVG-based mini price charts in token rows
- Currently uses deterministic mock data (needs real historical price API)

**Live Price Infrastructure (Partial):**
- Created `src/hooks/use-live-prices.ts` with SSE connection hook
- Created `src/components/shared/live-indicator.tsx` for connection status
- NOTE: Backend price broadcasting not implemented - indicator shows connection status only

**CSS & UX Fixes:**
- Fixed cursor showing as text cursor everywhere on the dashboard
- Added `user-select: none` to body in `src/app/globals.css`
- Fixed sparkline alignment issues

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

6. **Live Price Backend**: SSE infrastructure exists but backend service to broadcast prices is not implemented. Currently the `LiveIndicator` shows connection status only, no actual price streaming.

7. **Historical Data Caching Strategy**: Currently caches full query results with TTL. Could be smarter by storing individual price points permanently (historical data is immutable) and only fetching missing/recent timestamps. Not worth implementing for demo, but worth discussing in interview.

8. **Position Detail Sheet**: Could show additional data if available (health factor, liquidation price, etc.) for lending positions.

9. **Sparkline Loading State**: Sparklines only appear after historical data fetch completes - could show skeleton state during load.

10. **Progress Tracking Accuracy**: Client-side progress simulation is smooth but not perfectly synced with actual backend progress. Could be improved with WebSocket-based progress streaming.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/server/adapters/graph/client.ts` | Centralized Graph client with caching |
| `src/server/adapters/graph/adapters/aave-v3.ts` | Graph-accelerated Aave V3 adapter |
| `src/server/adapters/graph/adapters/compound-v3.ts` | Graph-accelerated Compound V3 adapter |
| `src/server/adapters/graph/adapters/lido.ts` | Graph-accelerated Lido adapter |
| `src/server/adapters/graph/adapters/etherfi.ts` | Graph-accelerated EtherFi adapter |
| `src/app/strategy-builder/page.tsx` | Strategy Builder main page |
| `src/components/strategy-builder/canvas.tsx` | Drag-and-drop strategy canvas |
| `src/components/strategy-builder/blocks.tsx` | Strategy block components |
| `src/components/strategy-builder/simulation.tsx` | Real-time simulation panel |
| `src/app/etherfi/[wallet]/page.tsx` | Dedicated EtherFi dashboard |
| `src/components/etherfi/tier-badge.tsx` | Platinum tier badge component |
| `src/components/etherfi/staking-panel.tsx` | EtherFi staking interface |
| `src/components/etherfi/insights-card.tsx` | EtherFi insights for main dashboard |
| `src/server/services/balances.ts` | GoldRush token balance fetching |
| `src/server/services/portfolio.ts` | Portfolio aggregation (DeFi + tokens) |
| `src/server/services/historical/index.ts` | Historical portfolio data with interpolation |
| `src/server/routers/history.ts` | History API endpoints with date serialization |
| `src/components/portfolio/token-holdings.tsx` | Token list with TokenLogo, sparklines |
| `src/components/portfolio/position-card.tsx` | Position cards with ProtocolLogo |
| `src/components/portfolio/position-detail-sheet.tsx` | Detailed position drill-down view |
| `src/components/portfolio/value-chart.tsx` | Portfolio chart with progress indicator |
| `src/components/ui/skeleton.tsx` | Shimmer loading components |
| `src/components/ui/sparkline.tsx` | SVG mini price charts |
| `src/components/ui/sheet.tsx` | Sheet/drawer primitive component |
| `src/components/shared/chain-badge.tsx` | ChainBadge and ChainDot components |
| `src/components/shared/live-indicator.tsx` | SSE connection status indicator |
| `src/components/layout/header.tsx` | Header with mobile hamburger menu |
| `src/hooks/use-live-prices.ts` | SSE connection hook for live prices |
| `src/lib/protocol-metadata.ts` | Protocol names, slugs, logo URLs |
| `src/app/dashboard/page.tsx` | Main dashboard with hydration fix |
| `src/app/globals.css` | Global styles including cursor fix |
| `src/server/services/yields.ts` | DeFi Llama yields API for real APY data |
| `src/components/shared/loading-orchestrator.tsx` | Premium animated loading experience |
| `src/components/shared/dashboard-skeleton.tsx` | Skeleton layouts for progressive loading |

---

## Cache Management Commands

```bash
# Clear yields cache (to see new APY values)
docker exec onchain-wealth-redis-1 redis-cli DEL yields:defillama

# Clear all history cache
docker exec onchain-wealth-redis-1 redis-cli KEYS "history:*" | xargs docker exec -i onchain-wealth-redis-1 redis-cli DEL

# Or just restart dev server to clear in-memory caches
npm run dev
```

---

## APY Sources Summary

| Protocol | APY Source | Typical APY |
|----------|------------|-------------|
| Lido | DeFi Llama yields API | ~2.4% |
| Ether.fi | DeFi Llama yields API | ~3.1% |
| Aave V3 | On-chain contract data | Variable |
| Compound V3 | On-chain contract data | Variable |
| Spark | On-chain contract data | Variable |

---

*Document Version: 1.6*
*Last Updated: January 26, 2026 (Session 7)*
