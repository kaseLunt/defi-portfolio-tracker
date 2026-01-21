# Decision Log

This document records significant architectural and technical decisions made during development of OnChain Wealth.

---

## January 21, 2025 - Historical Data Interpolation Strategy

**Context**: Historical portfolio charts were showing $0 values at certain timestamps where DeFi Llama didn't have price data for tokens. This created misleading visualizations showing dramatic drops to zero.

**Options Considered**:
1. **Exact Zero Check** - Only interpolate when value is exactly $0
2. **Anomaly Detection** - Interpolate when value drops significantly below median
3. **Forward Fill Only** - Simply carry forward the last known good value
4. **Weighted Average** - Interpolate between surrounding good values

**Decision**: Anomaly detection using 30% of median as threshold

**Rationale**:
- Exact zero check missed cases where only some tokens had prices (partial data)
- A value < 30% of median indicates data quality issues, not real portfolio changes
- Forward fill is simple and maintains visual continuity without inventing data
- Backward fill handles leading edge cases (first few data points missing)
- Adding `currentValue` parameter ensures the final data point matches live portfolio

**Implementation**:
```typescript
const anomalyThreshold = medianValue * 0.3;
// Forward pass: replace anomalous values with last good value
// Backward pass: fill leading anomalies with first good value * 0.98
```

**Consequences**:
- Charts now show smooth, realistic portfolio progression
- Potential to mask real dramatic losses (acceptable trade-off for data quality issues)
- Users see accurate current value anchored at chart end

---

## January 21, 2025 - Token Balance Source Strategy

**Context**: Need to display accurate total portfolio value. DeFi adapters only capture protocol-specific positions, missing raw token holdings (e.g., ETH, USDC in wallet).

**Options Considered**:
1. **DeFi Positions Only** - Show only yield-bearing positions
2. **Token Balances Only** - Use GoldRush for everything
3. **Sum Both** - Add DeFi positions + token balances (risk: double counting)
4. **Max of Both** - Use whichever source reports higher value

**Decision**: Use `Math.max(tokenBalances, defiPositions)` for total value

**Rationale**:
- GoldRush's `balances_v2` includes most tokens (including yield tokens like weETH, aTokens)
- DeFi adapters may catch positions GoldRush misses (new protocols, complex positions)
- Taking max avoids double-counting while capturing the more complete picture
- In practice, GoldRush is usually more comprehensive for "total holdings"

**Implementation**:
```typescript
const totalValueUsd = Math.max(totalTokenValueUsd, totalDefiValueUsd);
```

**Consequences**:
- Total value is always at least as high as either source
- Chain breakdown uses token balances (to avoid double-counting)
- DeFi positions still shown separately for yield/APY visibility

---

## January 21, 2025 - Dashboard Layout Hierarchy

**Context**: Dashboard showed DeFi positions prominently, but most users care more about total holdings. Need clearer visual hierarchy.

**Options Considered**:
1. **Positions First** - DeFi positions as primary, tokens secondary
2. **Holdings First** - Token holdings primary, positions secondary
3. **Tabs** - Separate tabs for holdings vs. DeFi
4. **Combined View** - Single unified list

**Decision**: Holdings (primary) -> Chains (sidebar) -> DeFi Positions (secondary below)

**Rationale**:
- Token holdings represent "what you own" - most fundamental view
- Chain distribution gives quick allocation overview
- DeFi positions are specialized view for yield farmers
- Progressive disclosure: most common use case first

**Consequences**:
- First-time users see clear portfolio breakdown immediately
- DeFi-focused users need to scroll for detailed position info
- Layout is responsive: holdings span 2 cols on desktop, chains in sidebar

---

## January 21, 2025 - Hydration Mismatch Fix Pattern

**Context**: Dashboard showed hydration errors when wallet connection state differed between server and client render.

**Options Considered**:
1. **Dynamic Import** - Use next/dynamic with ssr: false
2. **Mounted State** - Track when client has mounted
3. **Suppress Warning** - Use suppressHydrationWarning
4. **Server Components** - Move wallet-dependent UI to client components

**Decision**: Mounted state pattern with deterministic server render

**Rationale**:
- Clean pattern that keeps component as single unit
- Server always renders with `DEMO_WALLET` (deterministic)
- Client switches to actual wallet after mount
- No flash of incorrect content

**Implementation**:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

const walletToView = mounted
  ? (searchWallet || (isConnected ? address : undefined) || DEMO_WALLET)
  : DEMO_WALLET;
```

**Consequences**:
- No hydration warnings in console
- Brief moment where demo wallet is shown before actual wallet
- Pattern is reusable for other wallet-dependent components

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

## January 21, 2025 - Date Serialization for Redis Cache

**Context**: `getProgress` endpoint was returning 500 errors. Dates stored in Redis were being retrieved as strings, not Date objects, causing `.toISOString()` calls to fail.

**Options Considered**:
1. **Parse on Read** - Convert strings to Dates when reading from cache
2. **Check Type** - Use instanceof check before calling date methods
3. **Store as ISO** - Store dates as ISO strings in Redis
4. **Custom Serializer** - Use reviver function in JSON.parse

**Decision**: Type check with instanceof before serialization

**Rationale**:
- Redis JSON serialization converts Dates to strings automatically
- Adding instanceof check handles both fresh (Date) and cached (string) values
- Minimal code change, maximum compatibility
- Same pattern needed in multiple router endpoints

**Implementation**:
```typescript
startedAt: progress.startedAt instanceof Date
  ? progress.startedAt.toISOString()
  : String(progress.startedAt),
```

**Consequences**:
- Progress endpoint works reliably
- Pattern applied consistently in history router
- Slightly verbose but explicit about type handling

---

*Document Last Updated: January 21, 2025*
