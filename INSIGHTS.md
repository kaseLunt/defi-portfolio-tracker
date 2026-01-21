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

*Document Last Updated: January 21, 2025*
