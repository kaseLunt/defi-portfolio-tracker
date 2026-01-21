# Decision Log

This document records significant architectural and technical decisions made during development of OnChain Wealth.

---

## January 21, 2025 - Transaction Simulation Provider

**Context**: Phase 2 requires transaction simulation to show users exact outcomes before signing. Need to choose between self-hosted (Anvil forks), third-party API (Tenderly), or RPC-based (eth_call with state overrides).

**Options Considered**:
1. **Anvil Forks** - Free, powerful, full simulation, but requires running/managing Anvil infrastructure
2. **Tenderly API** - Paid (~$50/month), reliable, full trace with decoded errors, no infrastructure
3. **eth_call with State Overrides** - Free, works with any RPC, but only shows success/fail without balance diffs

**Decision**: Tenderly API as primary, eth_call as fallback

**Rationale**:
- Tenderly provides decoded balance changes and error messages out of the box
- No infrastructure to manage
- $50/month is acceptable for the value provided
- eth_call fallback ensures basic functionality if Tenderly is unavailable
- For a job application project, reliability and polish matter more than cost optimization

**Consequences**:
- Need Tenderly account and API keys
- Monthly cost commitment
- Dependent on third-party service availability

---

## January 21, 2025 - Automation Execution Model

**Context**: Automation rules feature needs to execute actions when conditions are met. Must balance user trust/security with convenience.

**Options Considered**:
1. **Session Keys** - User signs limited-permission key, enabling gasless auto-execution
2. **Gelato Automate** - Decentralized keeper network, reliable but costs per execution
3. **Backend Signing** - User deposits funds, we execute (custodial-ish)
4. **Notification Only** - Alert user, they execute manually

**Decision**: Notification + Optional Session Keys

**Rationale**:
- Notification-first is non-custodial and builds user trust
- Session keys can be added later for power users who want true automation
- Avoids custodial liability concerns
- Simpler MVP implementation
- Users can still react quickly to notifications

**Consequences**:
- Automation is semi-automatic initially (requires user action)
- May need to implement session keys in future for competitive parity
- Need robust notification delivery (email, push)

---

## January 21, 2025 - Historical Data Sources

**Context**: Historical portfolio reconstruction needs token balances and prices at past timestamps.

**Options Considered**:
1. **Covalent API** - Has historical balance endpoint, up to 100k credits/month free
2. **Alchemy/Moralis** - Similar capabilities but different pricing
3. **Archive Nodes + eth_call** - Most accurate but slow and expensive
4. **Subgraphs** - Good for DeFi positions, supports block parameter queries

**Decision**: Covalent for token balances + DeFi Llama for prices + Subgraphs for DeFi positions

**Rationale**:
- Covalent has purpose-built historical balance API
- DeFi Llama prices are free and reliable
- Subgraphs already exist for major protocols
- Combination gives comprehensive historical view
- Free tier should suffice for reasonable usage

**Consequences**:
- Multiple API integrations to maintain
- Historical accuracy limited by data source quality
- May need paid tier if usage grows

---

## January 21, 2025 - Bridge Aggregator Choice

**Context**: Cross-chain actions require bridge integration. Need to support multiple bridges for best rates.

**Options Considered**:
1. **Li.Fi** - Bridge aggregator, good coverage, free API
2. **Socket** - Similar aggregator, used by Bungee
3. **Direct Integration** - Integrate Stargate, Hop, Across individually

**Decision**: Li.Fi

**Rationale**:
- Single integration covers multiple bridges
- Handles route optimization
- Free to use
- Good documentation
- Reduces maintenance burden vs. multiple direct integrations

**Consequences**:
- Dependent on Li.Fi availability and accuracy
- May not support newest bridges immediately
- Less control over bridge selection logic

---

## January 20, 2025 - Real-time Updates: SSE vs WebSockets

**Context**: Need real-time updates for price changes, position updates, and notifications.

**Options Considered**:
1. **WebSockets (Socket.io)** - Bidirectional, industry standard for real-time
2. **Server-Sent Events (SSE)** - Unidirectional, simpler, HTTP-based
3. **Polling** - Simple but inefficient

**Decision**: SSE with Redis pub/sub

**Rationale**:
- Our use case is primarily server-to-client (prices, notifications)
- SSE is simpler to implement and debug
- Works naturally with HTTP infrastructure
- Redis pub/sub handles multi-instance broadcasting
- Socket.io adds complexity we don't need

**Consequences**:
- Cannot easily support client-to-server real-time messages
- Limited browser connection pool (6 per domain in some browsers)
- May need to switch to WebSockets if bidirectional needs emerge

---

## January 20, 2025 - Protocol Adapter Pattern

**Context**: Need to integrate with many DeFi protocols, each with different contracts and data structures.

**Options Considered**:
1. **Monolithic Service** - One service with protocol-specific logic inline
2. **Adapter Pattern** - Each protocol has its own adapter implementing common interface
3. **Plugin System** - Dynamically loaded adapters

**Decision**: Adapter Pattern with central registry

**Rationale**:
- Clean separation of concerns
- Easy to add new protocols without touching existing code
- Common interface ensures consistent data structure
- Registry provides single access point
- No dynamic loading complexity

**Consequences**:
- Need to update registry when adding adapters
- Some code duplication across adapters (acceptable)
- Must maintain type compatibility across adapters

---

## January 20, 2025 - Price Data Source

**Context**: Need reliable, real-time price data for USD valuations.

**Options Considered**:
1. **CoinGecko** - Free tier available, comprehensive coverage
2. **CoinMarketCap** - Similar but different rate limits
3. **Chainlink** - On-chain oracles, most accurate but limited tokens
4. **Multiple Sources** - Aggregate from multiple providers

**Decision**: CoinGecko with Redis caching

**Rationale**:
- Free tier sufficient for current scale
- Comprehensive token coverage
- Well-documented API
- Redis caching reduces API calls significantly
- Can add additional sources later if needed

**Consequences**:
- Rate limited on free tier (may need pro for production)
- Single point of failure for price data
- Price staleness possible (mitigated by caching strategy)

---

## January 19, 2025 - Authentication Method

**Context**: Need to authenticate users in a Web3 application.

**Options Considered**:
1. **SIWE (Sign-In with Ethereum)** - Wallet signature based, no passwords
2. **Traditional Auth + Wallet Linking** - Email/password with optional wallet
3. **OAuth + Wallet** - Social login with wallet connection

**Decision**: SIWE only

**Rationale**:
- Native Web3 experience
- No password management
- User's wallet address is their identity
- Aligns with DeFi user expectations
- Simpler implementation

**Consequences**:
- Users must have a wallet to use the app
- No account recovery (wallet recovery is user's responsibility)
- Session management tied to wallet address

---

## January 19, 2025 - Database Choice

**Context**: Need persistent storage for users, positions, alerts, transactions.

**Options Considered**:
1. **PostgreSQL** - Relational, ACID, mature
2. **MongoDB** - Document store, flexible schema
3. **Supabase** - Postgres with real-time features built-in

**Decision**: PostgreSQL with Prisma

**Rationale**:
- Financial data benefits from ACID compliance
- Relational model fits our data (users, positions, alerts)
- Prisma provides excellent TypeScript integration
- Can use JSONB for flexible metadata fields
- Wide hosting options (Railway, Render, etc.)

**Consequences**:
- Schema migrations required for changes
- Must model data upfront
- Prisma adds some abstraction overhead (acceptable for DX benefits)

---

## January 19, 2025 - Background Job Processing

**Context**: Need scheduled jobs for price updates, position syncing, alert checking.

**Options Considered**:
1. **BullMQ** - Redis-based, reliable, good ecosystem
2. **Agenda** - MongoDB-based job scheduler
3. **Cron Jobs** - Simple scheduled scripts
4. **Vercel Cron** - Serverless cron triggers

**Decision**: BullMQ with Redis

**Rationale**:
- Already using Redis for caching
- Supports job scheduling, retries, concurrency control
- Dashboard available for monitoring
- Can scale workers independently
- Battle-tested in production

**Consequences**:
- Requires separate worker process
- Redis becomes critical infrastructure
- Need to handle job failures gracefully

---

*Document Last Updated: January 21, 2025*
