# Technical Insights & Lessons Learned

This document captures technical discoveries, gotchas, and patterns learned during development.

---

## GoldRush (Covalent) API

### balances_v2 Endpoint

**Endpoint**: `GET /v1/{chainName}/address/{wallet}/balances_v2/`

**Key Parameters**:
- `quote-currency=USD` - Returns USD values directly
- `no-spam=true` - Filters out spam tokens
- `no-nft-fetch=true` - Improves response time

**Response Includes**:
- `contract_address` - Token address
- `balance` - Raw balance (needs decimals division)
- `quote` - USD value (can be null)
- `quote_rate` - Price per token
- `logo_url` - Token logo URL (sometimes null or broken)

**Gotchas**:
- `quote` can be `null` for tokens without price data
- Some logo URLs 404, need fallback handling
- Chain names differ from chain IDs: `eth-mainnet`, `arbitrum-mainnet`, etc.

### Historical Balance Endpoint

**Endpoint**: Uses portfolio/history endpoint for time-series data

**Key Insight**: GoldRush provides portfolio snapshots, but not per-token historical balances. For per-token history, need to use Alchemy with block numbers.

---

## DeFi Llama Historical Prices

**Endpoint**: `GET /prices/historical/{timestamp}/{chain}:{address}`

**Key Insights**:
- Uses Unix timestamp (seconds, not milliseconds)
- Chain names: `ethereum`, `arbitrum`, `optimism`, `base`, `polygon`
- Some tokens don't have historical data at all timestamps
- Batch endpoint exists but has rate limits

**Gotcha**: Price data gaps cause $0 values in portfolio calculations - must use interpolation.

---

## Next.js Hydration

### The Problem
Components that render differently on server vs client cause hydration mismatches:
```
Warning: Text content did not match. Server: "..." Client: "..."
```

### Common Causes in Web3 Apps
1. **Wallet connection state** - `isConnected` is always `false` on server
2. **Current time** - `new Date()` differs between server and client
3. **Window/localStorage access** - Not available during SSR

### The Solution Pattern
```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

// Use deterministic value on server, actual value on client
const value = mounted ? actualValue : defaultValue;
```

### Alternative: Suppress Warning
```tsx
<div suppressHydrationWarning>{clientOnlyValue}</div>
```
Use sparingly - hides real issues.

---

## Recharts Configuration

### Y-Axis Starting from Zero
By default, Recharts auto-scales Y-axis to fit data. To start from $0:

```tsx
<YAxis
  domain={[0, "dataMax * 1.1"]}  // Start at 0, end at 110% of max
  // ...
/>
```

### Custom Tooltip with Payload Data
Recharts tooltip receives limited data by default. To access custom fields:

```tsx
// In chart data, add extra fields
const chartData = data.map(d => ({
  ...d,
  formattedDate: format(d.timestamp, "MMM d, yyyy"),
}));

// In tooltip, access via payload
function CustomTooltip({ payload }) {
  const formattedDate = payload[0]?.payload?.formattedDate;
  // ...
}
```

---

## Redis JSON Serialization

### The Problem
When storing objects with Date fields in Redis:
```typescript
await redis.set(key, JSON.stringify({ date: new Date() }));
const data = JSON.parse(await redis.get(key));
// data.date is now a STRING, not a Date object!
```

### Solution Options

1. **Type check before use**:
```typescript
const isoString = value instanceof Date
  ? value.toISOString()
  : String(value);
```

2. **Use a reviver function**:
```typescript
JSON.parse(str, (key, value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value);
  }
  return value;
});
```

3. **Store as ISO strings intentionally**:
```typescript
await redis.set(key, JSON.stringify({
  date: new Date().toISOString()
}));
```

---

## Data Interpolation Strategy

### Problem
Historical data has gaps where price APIs don't have data for certain tokens at certain timestamps. Raw data shows:
```
$15,000 -> $15,200 -> $0 -> $15,400 -> $15,300
```

### Solution: Anomaly Detection + Forward Fill

1. **Calculate median** of non-zero values
2. **Define threshold** as percentage of median (30% works well)
3. **Forward pass**: Replace values below threshold with last good value
4. **Backward pass**: Fill leading anomalies with first good value

```typescript
const anomalyThreshold = medianValue * 0.3;

// Forward pass
let lastGoodValue = 0;
for (let i = 0; i < result.length; i++) {
  if (result[i].totalUsd < anomalyThreshold && lastGoodValue > 0) {
    result[i].totalUsd = lastGoodValue;
  } else if (result[i].totalUsd >= anomalyThreshold) {
    lastGoodValue = result[i].totalUsd;
  }
}
```

### Key Insight
Using exact zero check (`=== 0`) misses partial data scenarios where only some tokens have prices.

---

## Component Design Patterns

### Token Logo with Fallback
```tsx
{token.logoUrl ? (
  <img
    src={token.logoUrl}
    onError={(e) => {
      e.target.style.display = 'none';
      e.target.nextElementSibling?.classList.remove('hidden');
    }}
  />
) : null}
<div className={token.logoUrl ? 'hidden' : ''}>
  {token.symbol.slice(0, 2)}
</div>
```

### Chain Badge Overlay
Position a small chain indicator on a token logo:
```tsx
<div className="relative">
  <TokenLogo />
  <div className="absolute -bottom-0.5 -right-0.5">
    <ChainDot chainId={token.chainId} size="sm" />
  </div>
</div>
```

### Smart Balance Formatting
```typescript
function formatBalance(balance: number): string {
  if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(2)}M`;
  if (balance >= 1_000) return `${(balance / 1_000).toFixed(2)}K`;
  if (balance >= 1) return balance.toFixed(2);
  if (balance >= 0.0001) return balance.toFixed(4);
  return balance.toExponential(2);
}
```

---

## Performance Patterns

### Parallel API Fetching
When fetching data from multiple chains, use `Promise.allSettled` for resilience:
```typescript
const results = await Promise.allSettled(
  chains.map(chainId => fetchChainData(chainId))
);

for (const result of results) {
  if (result.status === "fulfilled") {
    allData.push(...result.value);
  }
  // Failures are silently skipped - partial data is better than no data
}
```

### Dust Filtering
Hide positions worth less than $1 to reduce noise:
```typescript
const MIN_POSITION_VALUE_USD = 1;
const filteredPositions = positions.filter(
  p => Math.abs(p.balanceUsd) >= MIN_POSITION_VALUE_USD
);
```

---

## SSE (Server-Sent Events) for Real-Time Updates

### Connection Hook Pattern
```typescript
// src/hooks/use-live-prices.ts
export function useLivePrices() {
  const [isConnected, setIsConnected] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const eventSource = new EventSource('/api/events/prices');

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => setIsConnected(false);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setPrices(prev => ({ ...prev, ...data }));
    };

    return () => eventSource.close();
  }, []);

  return { isConnected, prices };
}
```

### Key Insights
- SSE auto-reconnects on connection loss (browser handles this)
- `onopen` fires on successful connection
- `onerror` fires on connection failure or close
- Always clean up with `eventSource.close()` in useEffect return
- Server must send `text/event-stream` content type

### Gotcha: SSE Without Backend
If building frontend before backend is ready:
- Connection will show "connected" briefly then disconnect
- `onerror` will fire repeatedly as browser tries to reconnect
- Consider debouncing the connected state or adding a "connecting..." state

---

## Skeleton Loading Components

### Shimmer Animation CSS
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 0%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Component Patterns
```tsx
// SkeletonCircle - for avatars, logos
<div className="skeleton h-10 w-10 rounded-full" />

// SkeletonRow - for table rows, list items
<div className="skeleton h-4 w-full rounded" />

// SkeletonCard - for card placeholders
<div className="skeleton h-32 w-full rounded-lg" />
```

### When to Use
- Show skeletons immediately on mount, hide when data arrives
- Match skeleton dimensions to actual content (prevents layout shift)
- Use `min-h` if content height varies

---

## SVG Sparklines

### Basic Structure
```tsx
function Sparkline({ data, width = 60, height = 20 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </svg>
  );
}
```

### Key Insights
- Normalize data to fit within SVG viewBox
- Handle edge case where all values are equal (range = 0)
- Use `currentColor` for stroke to inherit text color
- Keep stroke width thin (1-2px) for mini charts

### Generating Deterministic Mock Data
```typescript
// Hash string to number for seeding
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Generate consistent data for same input
function generateMockSparkline(seed: string, points: number = 7): number[] {
  const hash = hashString(seed);
  const data: number[] = [];
  let value = (hash % 100) + 50; // Start between 50-150

  for (let i = 0; i < points; i++) {
    const change = ((hash * (i + 1)) % 20) - 10; // -10 to +10
    value = Math.max(10, value + change);
    data.push(value);
  }
  return data;
}
```

---

## Toast Notifications with Sonner

### Setup
```tsx
// In layout or providers
import { Toaster } from 'sonner';

function Layout({ children }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors />
    </>
  );
}
```

### Usage Patterns
```typescript
import { toast } from 'sonner';

// Success feedback
toast.success('Address copied to clipboard');

// Error handling
try {
  await fetchData();
} catch (error) {
  toast.error('Failed to load portfolio', {
    description: error.message,
  });
}

// Loading states with promise
toast.promise(fetchPortfolio(), {
  loading: 'Refreshing portfolio...',
  success: 'Portfolio updated',
  error: 'Failed to refresh',
});
```

### Key Insights
- `richColors` prop enables colored backgrounds for success/error
- Position `bottom-right` works well for dashboards
- Toasts auto-dismiss after ~4 seconds by default
- Can add `duration: Infinity` for persistent toasts

---

## Mobile Responsive Sheets

### Pattern for Full-Width on Mobile
```tsx
<Sheet>
  <SheetContent
    className="w-full sm:max-w-lg"
    side="right" // slides from right on desktop
  >
    {/* On mobile, can override to slide from bottom */}
    <style jsx>{`
      @media (max-width: 640px) {
        [data-side="right"] {
          inset: auto 0 0 0 !important;
          transform: translateY(100%);
          width: 100%;
          height: auto;
          max-height: 90vh;
        }
      }
    `}</style>
    ...
  </SheetContent>
</Sheet>
```

### Key Insights
- Sheets from right work well on desktop, from bottom on mobile
- Use `max-h-[90vh]` to prevent sheet from covering entire screen
- Add `overflow-y-auto` for scrollable content
- Consider swipe-to-dismiss for mobile (Radix supports this)

---

## Cursor and Selection Fixes

### The Problem
Web apps often feel "web-like" because:
1. Text cursor (I-beam) appears over non-text elements
2. Users can accidentally select UI text by dragging
3. Double-click selects words in buttons/labels

### The Solution
```css
/* In globals.css */
body {
  cursor: default;
  user-select: none;
  -webkit-user-select: none; /* Safari */
}

/* Allow selection where needed */
.select-text {
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

/* Ensure buttons and interactive elements have pointer */
button, [role="button"], a {
  cursor: pointer;
}
```

### Key Insights
- Apply globally, then whitelist specific elements
- `-webkit-` prefix still needed for Safari
- Add `select-text` class to addresses, code snippets, etc.
- Interactive elements should always have `cursor: pointer`

---

---

## Framer Motion Patterns

### AnimatePresence for Mount/Unmount
```tsx
import { motion, AnimatePresence } from "framer-motion";

// Wrap conditional content for exit animations
<AnimatePresence mode="wait">
  {isVisible && (
    <motion.div
      key="unique-key"  // Required for AnimatePresence
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      Content
    </motion.div>
  )}
</AnimatePresence>
```

### Rotating Content (Cycling through items)
```tsx
<AnimatePresence mode="wait">
  <motion.p
    key={currentIndex}  // Change key to trigger animation
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    transition={{ duration: 0.3 }}
  >
    {items[currentIndex]}
  </motion.p>
</AnimatePresence>
```

### Spinner/Loading Animation
```tsx
<motion.div
  className="border-2 border-primary/20 border-t-primary rounded-full h-8 w-8"
  animate={{ rotate: 360 }}
  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
/>
```

### Pulsing Glow Effect
```tsx
<motion.div
  animate={{
    scale: [1, 1.2, 1],
    opacity: [0.3, 0.1, 0.3],
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  }}
/>
```

### Key Insights
- Always provide `key` prop for AnimatePresence children
- `mode="wait"` makes exit animation complete before enter
- `layout` prop enables automatic layout animations
- Keep transitions short (0.2-0.3s) for snappy feel
- Use `ease: "linear"` for continuous animations (spinners)
- Use `ease: "easeInOut"` for natural feeling transitions

---

## Client-Side Progress Simulation

### The Problem
Server-side progress tracking (Redis + polling) had issues:
- Race conditions: Progress from wrong request
- Cache hits skip progress entirely
- Polling overhead and latency
- Complex distributed state to manage

### The Solution: Simulated Progress
```typescript
const PROGRESS_STAGES = [
  { status: "scanning", stage: "Scanning chains...", percent: 20, durationMs: 3000 },
  { status: "prices", stage: "Fetching prices...", percent: 60, durationMs: 8000 },
  { status: "processing", stage: "Processing...", percent: 90, durationMs: 4000 },
];

function useSimulatedProgress(isLoading: boolean) {
  const [progress, setProgress] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    startTime.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current!;
      // Calculate progress based on elapsed time...
    }, 200);

    return () => clearInterval(interval);
  }, [isLoading]);

  return progress;
}
```

### Key Insights
- Users care about perceived progress, not exact accuracy
- 200ms update interval feels smooth without being expensive
- Cap progress at 95% until data actually arrives
- Match stages to actual backend work for authenticity
- Set to 100% only when data is received
- Much simpler than distributed progress tracking

---

## React Query Background Prefetching

### Pattern for Preloading Related Data
```typescript
const utils = trpc.useUtils();
const preloadedRef = useRef<Set<string>>(new Set());

useEffect(() => {
  // Only preload after primary data loads
  if (!data || isLoading) return;

  // Don't preload same thing twice
  const key = generateKey(params);
  if (preloadedRef.current.has(key)) return;
  preloadedRef.current.add(key);

  // Stagger to avoid overwhelming API
  setTimeout(() => utils.endpoint.prefetch({ params: "variant1" }), 2000);
  setTimeout(() => utils.endpoint.prefetch({ params: "variant2" }), 5000);
}, [data, isLoading]);
```

### Key Insights
- `prefetch` runs silently in background, doesn't affect UI
- Stagger requests to be nice to APIs and network
- Track what's been preloaded to avoid duplicate fetches
- User interactions (like tab switching) become instant
- Prefetch doesn't count against staleTime

---

## Controlled Concurrency for API Calls

### Problem
Sequential API calls are slow; full parallel may overwhelm API.

### Solution: Batched Parallel Requests
```typescript
async function fetchWithConcurrency<T>(
  items: T[],
  fetcher: (item: T) => Promise<any>,
  concurrency: number = 5
) {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(item => fetcher(item))
    );
    results.push(...batchResults);
  }

  return results;
}
```

### Key Insights
- 5 concurrent requests is a good default for most APIs
- `Promise.allSettled` handles partial failures gracefully
- Total time = (items / concurrency) * average_request_time
- Can add delay between batches if needed for rate limiting
- Easy to tune concurrency up/down based on API tolerance

---

## Reducing Data Granularity for Performance

### The Trade-off
More data points = more accurate charts but slower loads.

### Analysis
For time-series charts:
- Line charts interpolate between points
- 14 points for 7 days (every 12h) is visually smooth
- 24 points for 1 year (every ~2 weeks) captures trends
- Users notice loading time more than missing points

### Key Insights
- Start with fewer points, increase only if users complain
- Each data point may trigger multiple API calls (compound effect)
- Visual perception: >10 points looks like a continuous line
- Consider: how zoomed in is the user actually viewing this?
- Can always add progressive refinement later

---

*Document Last Updated: January 21, 2025 (Session 5)*
