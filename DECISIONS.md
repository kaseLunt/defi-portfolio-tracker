# Decision Log

This document records significant architectural and technical decisions made during development of OnChain Wealth.

---

## January 21, 2025 - Client-Side Progress Simulation over Server Polling

**Context**: Historical data fetches can take 15-30 seconds. Users need feedback during this time. Initial implementation used Redis to store progress state that could be polled, but this had reliability issues.

**Options Considered**:
1. **Redis progress polling** - Backend stores progress in Redis, frontend polls via tRPC
2. **WebSocket streaming** - Real-time progress via persistent connection
3. **Server-Sent Events (SSE)** - Unidirectional stream from server
4. **Client-side simulation** - Estimate progress based on elapsed time and typical durations

**Decision**: Client-side progress simulation

**Rationale**:
- Redis polling had race conditions: progress key could be from wrong request or already cleaned up
- Cache hits caused inconsistent progress (immediate 100% vs slow build-up)
- WebSocket/SSE add infrastructure complexity for a non-critical feature
- Client-side simulation is smooth, predictable, and doesn't require backend coordination
- Users care about visual feedback, not precise accuracy
- Simulation stages match actual work being done (chains -> prices -> processing)

**Implementation**:
```typescript
// src/hooks/use-portfolio-history.ts
const PROGRESS_STAGES = [
  { status: "fetching_balances", stage: "Scanning Ethereum...", percent: 5, durationMs: 2000 },
  { status: "fetching_balances", stage: "Scanning Arbitrum...", percent: 10, durationMs: 2000 },
  // ... more stages
];

// Update every 200ms based on elapsed time
useEffect(() => {
  if (isFetching) {
    fetchStartTime.current = Date.now();
    progressInterval.current = setInterval(updateSimulatedProgress, 200);
  }
}, [isFetching]);
```

**Consequences**:
- Progress is smooth and predictable (no jumps or stalls)
- No additional API calls or Redis operations
- Progress may not match actual backend work exactly
- Caps at 95% until data actually arrives (prevents "stuck at 100%")
- Much simpler debugging (no distributed state)

---

## January 21, 2025 - Reduced Data Points for Faster Loading

**Context**: Historical portfolio charts were fetching many data points (28 for 7d, 52 for 1y), resulting in slow load times due to multiple DeFi Llama API calls per timestamp.

**Options Considered**:
1. **Keep current granularity** - Accept slower loads for more detailed charts
2. **Reduce data points** - Fewer points, faster loads, visually acceptable
3. **Lazy loading** - Load coarse data first, refine progressively
4. **Batch API improvements** - Better batching at the DeFi Llama layer

**Decision**: Reduce data points by ~50%

**Rationale**:
- User perception: 14 points on a 7-day chart still looks smooth
- Line charts interpolate between points; users don't perceive gaps
- Loading time matters more than having 28 vs 14 data points
- Longer timeframes need even fewer points (proportionally)
- Can always increase later if users complain

**Implementation**:
```typescript
// src/lib/constants.ts - TIMEFRAME_CONFIGS
"7d": { days: 7, dataPoints: 14, intervalHours: 12, ... },   // Was 28, every 6h
"30d": { days: 30, dataPoints: 15, intervalHours: 48, ... }, // Was 30
"90d": { days: 90, dataPoints: 18, intervalHours: 120, ... }, // Was 45
"1y": { days: 365, dataPoints: 24, intervalHours: 336, ... }, // Was 52
```

**Consequences**:
- ~54% reduction in API calls
- Noticeably faster chart loading (especially 7d timeframe)
- Slightly less granular price movements (acceptable trade-off)
- Less API rate limit pressure on DeFi Llama

---

## January 21, 2025 - Parallel Price Fetching with Controlled Concurrency

**Context**: Historical price fetching was sequential (one timestamp at a time), making it the bottleneck for chart loading. DeFi Llama doesn't have strict rate limits but shouldn't be hammered.

**Options Considered**:
1. **Sequential fetching** - Current approach, slowest but safest
2. **Full parallel** - All timestamps at once, fastest but may overwhelm API
3. **Controlled concurrency** - N parallel requests at a time
4. **Batch API** - Single request for multiple prices (DeFi Llama has limits here)

**Decision**: Controlled concurrency with 5 parallel requests

**Rationale**:
- 5 concurrent requests is aggressive but respectful
- Reduces wall-clock time by ~5x vs sequential
- Easy to tune up or down if needed
- DeFi Llama handles this load fine in practice
- Promise.allSettled handles partial failures gracefully

**Implementation**:
```typescript
// src/server/services/historical/index.ts
const CONCURRENT_REQUESTS = 5;

async function fetchPricesWithConcurrency(timestamps, tokens) {
  const results = [];
  for (let i = 0; i < timestamps.length; i += CONCURRENT_REQUESTS) {
    const batch = timestamps.slice(i, i + CONCURRENT_REQUESTS);
    const batchResults = await Promise.allSettled(
      batch.map(ts => fetchPriceForTimestamp(ts, tokens))
    );
    results.push(...batchResults);
  }
  return results;
}
```

**Consequences**:
- Much faster price fetching (main loading bottleneck)
- Combined with reduced data points: dramatic speed improvement
- Slight increase in API error rate (acceptable, handled gracefully)
- May need rate limiting if scaling to many concurrent users

---

## January 21, 2025 - Background Preloading of Timeframes

**Context**: After loading 7d data, users often switch to 30d, 90d, or 1y views. Each switch required a fresh fetch, causing delays.

**Options Considered**:
1. **No preloading** - Load on demand, user waits each time
2. **Preload all immediately** - Fetch all timeframes in parallel on page load
3. **Preload after initial load** - Fetch other timeframes in background after 7d completes
4. **Preload on hover** - Detect intent and preload

**Decision**: Preload after initial 7d load with staggered timing

**Rationale**:
- Initial 7d load is critical path - don't slow it down
- Once 7d is shown, user is engaged and other fetches can happen in background
- Staggering (2s, 5s, 8s delays) prevents overwhelming the API
- React Query caches results, so switches become instant
- Most users explore multiple timeframes

**Implementation**:
```typescript
// src/hooks/use-portfolio-history.ts
useEffect(() => {
  if (!data || timeframe !== "7d" || isLoading) return;

  // Staggered preloading
  setTimeout(() => utils.prefetch({ timeframe: "30d" }), 2000);
  setTimeout(() => utils.prefetch({ timeframe: "90d" }), 5000);
  setTimeout(() => utils.prefetch({ timeframe: "1y" }), 8000);
}, [data, timeframe, isLoading]);
```

**Consequences**:
- Timeframe switching is often instant (feels magical)
- More API calls total (but user will likely want this data anyway)
- Tracks which wallets have been preloaded to avoid duplicate fetches
- Background fetches don't block UI

---

## January 21, 2025 - Framer Motion for Loading Animations

**Context**: Premium loading experience requires smooth, interruptible animations that vanilla CSS struggles with.

**Options Considered**:
1. **CSS animations** - Simple, no dependencies, but limited control
2. **Framer Motion** - Popular React animation library, powerful but adds bundle size
3. **React Spring** - Physics-based animations, smaller than Framer
4. **GSAP** - Industry standard, powerful but not React-native

**Decision**: Framer Motion

**Rationale**:
- Best DX for React (declarative, hook-based)
- AnimatePresence handles mount/unmount animations elegantly
- Layout animations "just work"
- Well-maintained, large community
- Bundle size (~30KB) acceptable for premium UX
- Already familiar to many React developers

**Implementation**:
```typescript
// src/components/shared/loading-orchestrator.tsx
import { motion, AnimatePresence } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>
```

**Consequences**:
- Smooth, professional animations throughout loading experience
- Additional ~30KB dependency
- Consistent animation API across components
- Learning curve for team members unfamiliar with Framer

---

## January 21, 2025 - Real Sparkline Data via Token Price History

**Context**: Sparklines were using fake data generated from token address hashes. This was a temporary solution, but real historical price data was already being fetched for the portfolio chart. The data existed, it just wasn't being exposed.

**Options Considered**:
1. **Separate API call per token** - Fetch 7-day history for each token individually
2. **Batch API call** - Single call to get history for all tokens
3. **Piggyback on existing historical fetch** - Expose per-token data from the portfolio history service
4. **Keep mock data** - Accept the limitation for MVP

**Decision**: Piggyback on existing historical fetch

**Rationale**:
- Historical service already fetches price data for every token at every timestamp
- Data was being aggregated into total portfolio value but individual token data was discarded
- Simple extension: collect per-token prices into `Record<string, number[]>` during processing
- No additional API calls needed
- Sparklines automatically get data once portfolio history loads

**Implementation**:
```typescript
// src/server/services/historical/types.ts
interface HistoricalPortfolioResult {
  // ... existing fields
  tokenPriceHistory?: Record<string, number[]>;  // "chainId:tokenAddress" -> prices[]
}

// src/server/services/historical/index.ts
// Build per-token price history while processing timestamps
const tokenPrices: Record<string, number[]> = {};
for (const token of tokens) {
  const key = `${chainId}:${token.address.toLowerCase()}`;
  tokenPrices[key] = tokenPrices[key] || [];
  tokenPrices[key].push(tokenUsdValue);
}
```

**Consequences**:
- Sparklines show real price trends
- Data only available after historical fetch completes (acceptable)
- Minimal code change, no new API calls
- Users see consistent data between sparkline and detailed price view

---

## January 21, 2025 - DeFi Llama Yields API for Real APY

**Context**: Lido and EtherFi adapters had hardcoded APY values (3.5% and 3.8%). These were reasonable estimates but not accurate. Real APY data should be fetched from a reliable source.

**Options Considered**:
1. **On-chain calculation** - Compute APY from contract state
2. **Protocol APIs** - Each protocol has its own API
3. **DeFi Llama yields API** - Aggregated APY data for all protocols
4. **Keep hardcoded** - Update occasionally

**Decision**: DeFi Llama yields API with fallback to hardcoded defaults

**Rationale**:
- DeFi Llama aggregates APY data for 4000+ pools across protocols
- Single API call gets data for all protocols
- Free, no API key required
- Well-maintained, reliable source used by many DeFi aggregators
- Fallback ensures app works even if API is down

**Implementation**:
```typescript
// src/server/services/yields.ts
const DEFILLAMA_YIELDS_URL = "https://yields.llama.fi/pools";

// Two-tier caching:
// 1. Redis cache: 10 minutes TTL
// 2. In-memory cache: 1 minute (reduce Redis hits)

export async function getLidoApy(): Promise<number> {
  const yields = await fetchYields();
  return yields.get("lido:steth") ?? 3.5;  // Fallback
}
```

**Important Discovery**: DeFi Llama uses specific project names:
- Lido: `lido` (symbol: `STETH`)
- Ether.fi: `ether.fi-stake` (not `ether.fi`, symbol: `WEETH`)

**Consequences**:
- APY values are accurate and update automatically
- Small latency on first load (~100ms) due to API call
- Caching prevents excessive API calls
- Need to verify DeFi Llama project names for new protocols

---

## January 21, 2025 - SheetDescription Hydration Fix

**Context**: React hydration error occurred because `SheetDescription` rendered as `<p>` but contained `ChainBadge` which rendered `<div>`. HTML spec doesn't allow `<div>` inside `<p>`.

**Options Considered**:
1. **Change SheetDescription to render div** - Simple fix
2. **Change ChainBadge to render span** - Would affect other usages
3. **Wrap ChainBadge in Fragment** - Wouldn't fix the HTML validity issue
4. **Remove ChainBadge from SheetDescription** - Would reduce information displayed

**Decision**: Change `SheetDescription` to render `<div>` instead of `<p>`

**Rationale**:
- `SheetDescription` is semantically "descriptive content" not specifically "paragraph"
- `<div>` can contain any flow content including other `<div>`s
- Maintains same styling (just change element type)
- No impact on other components

**Implementation**:
```typescript
// src/components/ui/sheet.tsx
const SheetDescription = React.forwardRef<
  HTMLDivElement,  // Changed from HTMLParagraphElement
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div  // Changed from <p>
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
```

**Consequences**:
- Hydration error resolved
- Can now put any component inside SheetDescription
- Semantic meaning unchanged (still styled as descriptive text)

---

## January 21, 2025 - Historical Data Caching Strategy (Deferred)

**Context**: User asked about smarter caching for historical data. Current approach caches full query results with TTL; when expired, re-fetches ALL historical data even though most of it is immutable.

**Options Considered**:
1. **Current approach** - Cache full results, TTL expiration, re-fetch everything
2. **Incremental fetch** - Store individual price points permanently, only fetch missing timestamps
3. **Hybrid** - Cache older data longer, recent data shorter
4. **Time-based partitioning** - Separate caches for different time ranges

**Decision**: Keep current approach (option 1), document smarter approach for future/interview

**Rationale**:
- Current approach works correctly and is simple
- Incremental fetch requires schema change (move from Redis TTL cache to persistent storage)
- Historical price data is immutable, so smarter approach would be more efficient
- For a demo/interview project, correctness matters more than optimization
- Can discuss the smarter architecture in interview to show understanding

**Smarter Approach (Not Implemented)**:
```typescript
// Conceptual - store immutable data points
interface PricePoint {
  timestamp: Date;
  tokenAddress: string;
  chainId: number;
  priceUsd: number;
}

// Only fetch timestamps we don't have
const existingTimestamps = await getPricePointTimestamps(token, chain);
const missingTimestamps = requestedTimestamps.filter(t => !existingTimestamps.includes(t));
const newPrices = await fetchFromDefiLlama(missingTimestamps);
await storePricePoints(newPrices);  // Permanent storage
```

**Consequences**:
- Current implementation unchanged
- Good topic for technical interview discussion
- Can be implemented later if needed for production

---

## January 21, 2025 - Sparkline Mock Data Strategy (SUPERSEDED)

> **Note**: This decision was superseded on January 21, 2025 (Session 4). Sparklines now use real historical price data piggybacked on the portfolio history service. See "Real Sparkline Data via Token Price History" above.

**Context**: Sparklines need historical price data to show 7-day price trends for each token. Fetching real historical data for every token on every page load would be expensive and slow.

**Original Decision**: Deterministic mock data based on token address hash (temporary solution)

**Why Superseded**: The historical portfolio service was already fetching per-token prices but discarding them after aggregation. Simple extension exposed this data for sparklines with no additional API calls.

---

## January 21, 2025 - Live Price Infrastructure (SSE without Backend Broadcasting)

**Context**: Want to show a "live" indicator and eventually stream price updates to the frontend. Need to decide whether to implement full backend price broadcasting now or just the frontend infrastructure.

**Options Considered**:
1. **Full implementation** - Backend cron/worker broadcasts prices via SSE, frontend consumes
2. **Frontend infrastructure only** - Build hooks and UI, backend broadcasting added later
3. **WebSocket instead of SSE** - More complex but bidirectional
4. **Polling** - Simpler but less real-time feel

**Decision**: Build frontend SSE infrastructure without backend broadcasting

**Rationale**:
- SSE connection hook (`use-live-prices.ts`) and `LiveIndicator` component can be built now
- Backend price broadcasting requires more work (cron job, price provider integration)
- Frontend infrastructure demonstrates the architectural pattern for interviews
- Indicator can show "connected" status even without price streaming
- Incremental approach allows prioritizing other features

**Implementation**:
- `src/hooks/use-live-prices.ts` - SSE connection management
- `src/components/shared/live-indicator.tsx` - Visual connection status
- Backend endpoint exists but doesn't actively broadcast prices

**Consequences**:
- Live indicator is somewhat misleading (shows "connected" but no actual streaming)
- Need future work to implement price broadcasting service
- Frontend is ready to consume prices once backend is implemented

---

## January 21, 2025 - User-Select Disabled Globally

**Context**: Users were seeing text cursor (I-beam) when hovering over UI elements, and could accidentally select text on cards and buttons, creating a non-app-like experience.

**Options Considered**:
1. **Per-component user-select** - Add `select-none` to specific interactive elements
2. **Global user-select: none** - Disable text selection app-wide
3. **Cursor fixes only** - Just fix the cursor, allow selection
4. **CSS reset** - Use a comprehensive reset that handles this

**Decision**: Global `user-select: none` on body, with `cursor: default` on body

**Rationale**:
- This is a dashboard application, not a content site - text selection rarely needed
- Consistent with native app feel
- Simpler than adding classes to every component
- Can be overridden with `select-text` class where needed (e.g., addresses to copy)

**Implementation**:
```css
body {
  cursor: default;
  user-select: none;
}

/* Override for specific elements */
.select-text {
  user-select: text;
}
```

**Consequences**:
- Users can't select text to copy (addresses, values) unless explicitly enabled
- More app-like feel overall
- May need to add `select-text` class to wallet addresses and other copyable content

---

## January 21, 2025 - Protocol Logos via DeFi Llama CDN

**Context**: Need to display protocol logos (Aave, Lido, Compound, etc.) in position cards. Need a reliable source for protocol icons.

**Options Considered**:
1. **Self-hosted icons** - Download and serve from own assets
2. **DeFi Llama CDN** - Use `icons.llama.fi/{protocol}` URLs
3. **Protocol official sources** - Link to each protocol's GitHub/website
4. **Token Icons libraries** - Use existing npm packages

**Decision**: DeFi Llama CDN with protocol metadata mapping

**Rationale**:
- DeFi Llama maintains comprehensive, up-to-date protocol icons
- CDN is fast and reliable
- Standardized naming convention (`icons.llama.fi/{slug}`)
- No need to manage icon assets locally
- Protocol metadata file maps internal slugs to DeFi Llama slugs

**Implementation**:
```typescript
// src/lib/protocol-metadata.ts
export const PROTOCOL_METADATA = {
  'aave-v3': { name: 'Aave V3', slug: 'aave', logo: 'https://icons.llama.fi/aave.png' },
  'lido': { name: 'Lido', slug: 'lido', logo: 'https://icons.llama.fi/lido.png' },
  // ...
};
```

**Consequences**:
- Dependent on DeFi Llama CDN availability
- Need fallback if CDN is down or icon doesn't exist
- Must keep metadata in sync with supported protocols

---

## January 21, 2025 - Toast Notifications with Sonner

**Context**: Need user feedback for actions like wallet search, address copy, refresh completion, and errors. Need to choose a toast/notification library.

**Options Considered**:
1. **Sonner** - Modern, minimal, good defaults
2. **React-Hot-Toast** - Popular, lightweight
3. **React-Toastify** - Feature-rich, customizable
4. **Custom implementation** - Build own toast system
5. **shadcn/ui Toast** - Part of component library

**Decision**: Sonner library

**Rationale**:
- Minimal bundle size
- Beautiful default styling that matches our dark theme
- Simple API: `toast.success()`, `toast.error()`
- Auto-dismiss with sensible defaults
- Stacks nicely for multiple notifications
- Good accessibility out of the box

**Implementation**:
```typescript
import { toast } from 'sonner';

// In component
toast.success('Address copied to clipboard');
toast.error('Failed to fetch portfolio');
```

**Consequences**:
- Additional dependency (small)
- Styling may need minor adjustments for perfect theme match
- Need to add `<Toaster />` component to layout

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

## January 21, 2025 - Position Detail Sheet Component

**Context**: Users need to drill down into individual positions to see detailed information like yield projections, protocol links, and explorer links.

**Options Considered**:
1. **Modal dialog** - Standard overlay modal
2. **Sheet/Drawer** - Slides in from side or bottom
3. **New page** - Navigate to `/positions/[id]`
4. **Expandable card** - Inline expansion within the list

**Decision**: Sheet component that slides from right (bottom on mobile)

**Rationale**:
- Keeps user in context of the dashboard
- Natural gesture on mobile (swipe to dismiss)
- Can show substantial detail without full page navigation
- Consistent with modern app patterns (Stripe, Linear, etc.)
- Full-width on mobile provides maximum space for data

**Implementation**:
- `src/components/ui/sheet.tsx` - Radix UI based sheet primitive
- `src/components/portfolio/position-detail-sheet.tsx` - Position-specific content
- Opens on position card click, closes on backdrop click or swipe

**Consequences**:
- Requires sheet primitive component (added from shadcn/ui)
- Need responsive handling for mobile vs desktop
- Position data must be passed to sheet (no additional fetch)

---

*Document Last Updated: January 21, 2025 (Session 5)*
