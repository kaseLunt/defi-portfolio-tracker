# Historical Portfolio Reconstruction - Implementation Plan

## Overview

**Goal:** Show portfolio value over time for ANY wallet instantly, without requiring prior snapshots.

**Why this is a differentiator:** Competitors require wallet connection and time to accumulate data. We show history immediately.

---

## User Experience

```
┌─────────────────────────────────────────────────────────────┐
│  Portfolio Value                              [1W][1M][3M]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  $85,000 ─┐                                          ┌──    │
│           │    ╭─────╮                              ╱       │
│  $70,000 ─┤   ╱      ╰──────╮    ╭────────╮      ╱         │
│           │  ╱               ╰──╯          ╰────╯           │
│  $55,000 ─┼─╯                                               │
│           │                                                 │
│  $40,000 ─┴─────────────────────────────────────────────    │
│           Jan 1   Jan 8   Jan 15  Jan 22  Jan 29            │
│                                                             │
│  Current: $82,450                                           │
│  30D Change: +$12,300 (+17.5%)                              │
│  All-Time High: $91,200 (Jan 12)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### 1. Token Balances at Historical Blocks

**Primary: Covalent API**
```
GET /v1/{chainId}/address/{address}/portfolio_v2/

Returns:
- Token balances at each day for the past year
- Includes ERC-20 tokens held
- Free tier: 100,000 credits/month (~10,000 requests)
```

**Fallback: eth_call at block**
```typescript
// Requires archive node access
const balance = await client.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [walletAddress],
  blockNumber: historicalBlock,
});
```

### 2. Historical Prices

**Primary: DeFi Llama**
```
GET /prices/historical/{timestamp}/{coins}

Example:
GET /prices/historical/1704067200/ethereum:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

Returns: { "coins": { "ethereum:0x...": { "price": 2345.67 } } }

- Free, no API key required
- Supports batch queries (up to 100 tokens)
- Historical data back to 2020
```

**Fallback: CoinGecko**
```
GET /coins/{id}/history?date=30-12-2024

- Rate limited (50/min free tier)
- Good for tokens DeFi Llama doesn't have
```

### 3. DeFi Positions at Historical Blocks

**Via Subgraphs (where available):**
```graphql
# Aave V3 Subgraph
{
  userReserves(
    where: { user: "0x..." }
    block: { number: 18500000 }
  ) {
    reserve { symbol, underlyingAsset }
    currentATokenBalance
    currentVariableDebt
  }
}
```

**Via eth_call at block:**
```typescript
// For protocols without subgraphs
const position = await client.readContract({
  address: aavePoolDataProvider,
  abi: aaveAbi,
  functionName: 'getUserReserveData',
  args: [assetAddress, walletAddress],
  blockNumber: historicalBlock,
});
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Historical Service                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Covalent  │    │ DeFi Llama  │    │  Subgraphs  │     │
│  │   Client    │    │   Client    │    │   Client    │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │   Aggregator    │                       │
│                   │                 │                       │
│                   │ - Merge data    │                       │
│                   │ - Fill gaps     │                       │
│                   │ - Calculate USD │                       │
│                   └────────┬────────┘                       │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  Redis Cache    │                       │
│                   │                 │                       │
│                   │ Key: wallet:    │                       │
│                   │      timeframe: │                       │
│                   │      chain:     │                       │
│                   │ TTL: 1-24 hours │                       │
│                   └────────┬────────┘                       │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  tRPC Endpoint  │                       │
│                   └─────────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: External API Clients

**File: `src/server/lib/covalent.ts`**
```typescript
const COVALENT_API_KEY = process.env.COVALENT_API_KEY;
const BASE_URL = 'https://api.covalenthq.com/v1';

interface CovalentPortfolioResponse {
  data: {
    items: Array<{
      contract_decimals: number;
      contract_ticker_symbol: string;
      contract_address: string;
      holdings: Array<{
        timestamp: string;
        close: {
          balance: string;
          quote: number;
        };
      }>;
    }>;
  };
}

export async function getHistoricalPortfolio(
  chainId: number,
  walletAddress: string,
  days: number = 30
): Promise<CovalentPortfolioResponse> {
  const chainName = COVALENT_CHAIN_NAMES[chainId]; // "eth-mainnet", "arbitrum-mainnet", etc.

  const response = await fetch(
    `${BASE_URL}/${chainName}/address/${walletAddress}/portfolio_v2/?days=${days}`,
    {
      headers: {
        'Authorization': `Bearer ${COVALENT_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Covalent API error: ${response.status}`);
  }

  return response.json();
}

// Chain name mapping
const COVALENT_CHAIN_NAMES: Record<number, string> = {
  1: 'eth-mainnet',
  42161: 'arbitrum-mainnet',
  10: 'optimism-mainnet',
  8453: 'base-mainnet',
  137: 'matic-mainnet',
};
```

**File: `src/server/lib/defillama.ts`**
```typescript
const BASE_URL = 'https://coins.llama.fi';

interface DefiLlamaPriceResponse {
  coins: Record<string, {
    price: number;
    timestamp: number;
    confidence: number;
  }>;
}

export async function getHistoricalPrices(
  tokens: Array<{ chainId: number; address: string }>,
  timestamp: number
): Promise<Map<string, number>> {
  // Format: "ethereum:0x...,arbitrum:0x..."
  const coins = tokens
    .map(t => `${DEFILLAMA_CHAIN_NAMES[t.chainId]}:${t.address}`)
    .join(',');

  const response = await fetch(
    `${BASE_URL}/prices/historical/${timestamp}/${coins}`
  );

  if (!response.ok) {
    throw new Error(`DeFi Llama API error: ${response.status}`);
  }

  const data: DefiLlamaPriceResponse = await response.json();

  const prices = new Map<string, number>();
  for (const [key, value] of Object.entries(data.coins)) {
    prices.set(key.toLowerCase(), value.price);
  }

  return prices;
}

// Batch multiple timestamps
export async function getHistoricalPricesBatch(
  tokens: Array<{ chainId: number; address: string }>,
  timestamps: number[]
): Promise<Map<number, Map<string, number>>> {
  // Parallelize requests (DeFi Llama is generous with rate limits)
  const results = await Promise.all(
    timestamps.map(ts => getHistoricalPrices(tokens, ts))
  );

  const pricesByTimestamp = new Map<number, Map<string, number>>();
  timestamps.forEach((ts, i) => {
    pricesByTimestamp.set(ts, results[i]);
  });

  return pricesByTimestamp;
}

const DEFILLAMA_CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  137: 'polygon',
};
```

### Step 2: Historical Service

**File: `src/server/services/historical.ts`**
```typescript
import { getHistoricalPortfolio } from '../lib/covalent';
import { getHistoricalPricesBatch } from '../lib/defillama';
import { getFromCache, setInCache } from '../lib/redis';
import type { SupportedChainId } from '@/lib/constants';

export interface HistoricalDataPoint {
  timestamp: number;
  date: string;  // "2024-01-15"
  totalValueUsd: number;
  breakdown: {
    tokens: number;      // Wallet token balances
    defiPositions: number;  // Protocol positions
  };
  tokens: Array<{
    symbol: string;
    address: string;
    chainId: number;
    balance: number;
    priceUsd: number;
    valueUsd: number;
  }>;
}

export interface HistoricalPortfolio {
  dataPoints: HistoricalDataPoint[];
  summary: {
    currentValueUsd: number;
    startValueUsd: number;
    changeUsd: number;
    changePercent: number;
    highValueUsd: number;
    highDate: string;
    lowValueUsd: number;
    lowDate: string;
  };
}

export type Timeframe = '7d' | '30d' | '90d' | '1y';

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};

const CACHE_TTL: Record<Timeframe, number> = {
  '7d': 60 * 30,      // 30 minutes
  '30d': 60 * 60,     // 1 hour
  '90d': 60 * 60 * 6, // 6 hours
  '1y': 60 * 60 * 24, // 24 hours
};

export async function getHistoricalPortfolioData(
  walletAddress: string,
  timeframe: Timeframe,
  chainIds?: SupportedChainId[]
): Promise<HistoricalPortfolio> {
  const normalizedAddress = walletAddress.toLowerCase();
  const targetChains = chainIds || [1, 42161, 10, 8453, 137];
  const days = TIMEFRAME_DAYS[timeframe];

  // Check cache
  const cacheKey = `historical:${normalizedAddress}:${timeframe}:${targetChains.sort().join(',')}`;
  const cached = await getFromCache<HistoricalPortfolio>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from all chains in parallel
  const chainDataPromises = targetChains.map(chainId =>
    fetchChainHistoricalData(normalizedAddress, chainId, days)
  );

  const chainResults = await Promise.allSettled(chainDataPromises);

  // Merge data from all chains
  const mergedData = mergeChainData(
    chainResults
      .filter((r): r is PromiseFulfilledResult<ChainHistoricalData> => r.status === 'fulfilled')
      .map(r => r.value),
    days
  );

  // Calculate summary stats
  const summary = calculateSummary(mergedData);

  const result: HistoricalPortfolio = {
    dataPoints: mergedData,
    summary,
  };

  // Cache the result
  await setInCache(cacheKey, result, CACHE_TTL[timeframe]);

  return result;
}

interface ChainHistoricalData {
  chainId: number;
  dataPoints: Map<string, {  // keyed by date "2024-01-15"
    tokens: Array<{
      symbol: string;
      address: string;
      balance: number;
      valueUsd: number;
    }>;
    totalValueUsd: number;
  }>;
}

async function fetchChainHistoricalData(
  walletAddress: string,
  chainId: number,
  days: number
): Promise<ChainHistoricalData> {
  // Get historical balances from Covalent
  const portfolio = await getHistoricalPortfolio(chainId, walletAddress, days);

  const dataPoints = new Map<string, any>();

  // Covalent returns data per token with daily holdings
  for (const token of portfolio.data.items) {
    for (const holding of token.holdings) {
      const date = holding.timestamp.split('T')[0]; // "2024-01-15"

      if (!dataPoints.has(date)) {
        dataPoints.set(date, { tokens: [], totalValueUsd: 0 });
      }

      const point = dataPoints.get(date)!;
      const balance = parseFloat(holding.close.balance) / Math.pow(10, token.contract_decimals);
      const valueUsd = holding.close.quote || 0;

      if (balance > 0) {
        point.tokens.push({
          symbol: token.contract_ticker_symbol,
          address: token.contract_address,
          balance,
          valueUsd,
        });
        point.totalValueUsd += valueUsd;
      }
    }
  }

  return { chainId, dataPoints };
}

function mergeChainData(
  chainData: ChainHistoricalData[],
  days: number
): HistoricalDataPoint[] {
  // Get all unique dates
  const allDates = new Set<string>();
  for (const chain of chainData) {
    for (const date of chain.dataPoints.keys()) {
      allDates.add(date);
    }
  }

  // Sort dates
  const sortedDates = Array.from(allDates).sort();

  // Take last N days
  const recentDates = sortedDates.slice(-days);

  // Merge data for each date
  return recentDates.map(date => {
    let totalValueUsd = 0;
    const allTokens: HistoricalDataPoint['tokens'] = [];

    for (const chain of chainData) {
      const dayData = chain.dataPoints.get(date);
      if (dayData) {
        totalValueUsd += dayData.totalValueUsd;
        allTokens.push(
          ...dayData.tokens.map(t => ({
            ...t,
            chainId: chain.chainId,
            priceUsd: t.balance > 0 ? t.valueUsd / t.balance : 0,
          }))
        );
      }
    }

    return {
      timestamp: new Date(date).getTime() / 1000,
      date,
      totalValueUsd,
      breakdown: {
        tokens: totalValueUsd,
        defiPositions: 0, // TODO: Add DeFi position historical data
      },
      tokens: allTokens,
    };
  });
}

function calculateSummary(dataPoints: HistoricalDataPoint[]): HistoricalPortfolio['summary'] {
  if (dataPoints.length === 0) {
    return {
      currentValueUsd: 0,
      startValueUsd: 0,
      changeUsd: 0,
      changePercent: 0,
      highValueUsd: 0,
      highDate: '',
      lowValueUsd: 0,
      lowDate: '',
    };
  }

  const currentValueUsd = dataPoints[dataPoints.length - 1].totalValueUsd;
  const startValueUsd = dataPoints[0].totalValueUsd;
  const changeUsd = currentValueUsd - startValueUsd;
  const changePercent = startValueUsd > 0 ? (changeUsd / startValueUsd) * 100 : 0;

  let highValueUsd = 0;
  let highDate = '';
  let lowValueUsd = Infinity;
  let lowDate = '';

  for (const point of dataPoints) {
    if (point.totalValueUsd > highValueUsd) {
      highValueUsd = point.totalValueUsd;
      highDate = point.date;
    }
    if (point.totalValueUsd < lowValueUsd && point.totalValueUsd > 0) {
      lowValueUsd = point.totalValueUsd;
      lowDate = point.date;
    }
  }

  if (lowValueUsd === Infinity) {
    lowValueUsd = 0;
  }

  return {
    currentValueUsd,
    startValueUsd,
    changeUsd,
    changePercent,
    highValueUsd,
    highDate,
    lowValueUsd,
    lowDate,
  };
}
```

### Step 3: tRPC Endpoint

**File: `src/server/routers/portfolio.ts` (add to existing)**
```typescript
import { getHistoricalPortfolioData, type Timeframe } from '../services/historical';

// Add to existing portfolio router
export const portfolioRouter = router({
  // ... existing procedures ...

  getHistoricalValue: publicProcedure
    .input(z.object({
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      timeframe: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
      chainIds: z.array(z.number()).optional(),
    }))
    .query(async ({ input }) => {
      return getHistoricalPortfolioData(
        input.walletAddress,
        input.timeframe as Timeframe,
        input.chainIds
      );
    }),
});
```

### Step 4: React Hook

**File: `src/hooks/use-historical.ts`**
```typescript
import { trpc } from '@/lib/trpc';
import type { Timeframe } from '@/server/services/historical';

export function useHistoricalPortfolio(
  walletAddress: string | undefined,
  timeframe: Timeframe = '30d',
  chainIds?: number[]
) {
  return trpc.portfolio.getHistoricalValue.useQuery(
    {
      walletAddress: walletAddress!,
      timeframe,
      chainIds,
    },
    {
      enabled: !!walletAddress,
      staleTime: 1000 * 60 * 5,  // 5 minutes
      refetchOnWindowFocus: false,
    }
  );
}
```

### Step 5: Chart Component Update

**File: `src/components/portfolio/value-chart.tsx` (update)**
```typescript
'use client';

import { useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatUSD, formatPercent } from '@/lib/utils';
import { useHistoricalPortfolio } from '@/hooks/use-historical';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Timeframe = '7d' | '30d' | '90d' | '1y';

interface ValueChartProps {
  walletAddress: string;
}

export function ValueChart({ walletAddress }: ValueChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');

  const { data, isLoading, error } = useHistoricalPortfolio(
    walletAddress,
    timeframe
  );

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: '1y', label: '1Y' },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Unable to load historical data
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.dataPoints.map(point => ({
    date: point.date,
    value: point.totalValueUsd,
    formattedDate: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  const isPositive = data.summary.changePercent >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio History</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">
                {formatUSD(data.summary.currentValueUsd)}
              </span>
              <span
                className={cn(
                  'flex items-center text-sm',
                  isPositive ? 'text-green-500' : 'text-red-500'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {isPositive ? '+' : ''}
                {formatUSD(data.summary.changeUsd)} (
                {formatPercent(data.summary.changePercent / 100)})
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            {timeframeOptions.map((option) => (
              <Button
                key={option.value}
                variant={timeframe === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeframe(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? '#22c55e' : '#ef4444'}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? '#22c55e' : '#ef4444'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="formattedDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#888', fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#888', fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                domain={['dataMin - 1000', 'dataMax + 1000']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="text-sm text-muted-foreground">
                          {payload[0].payload.formattedDate}
                        </div>
                        <div className="text-lg font-bold">
                          {formatUSD(payload[0].value as number)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Period Start</div>
            <div className="font-medium">{formatUSD(data.summary.startValueUsd)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">All-Time High</div>
            <div className="font-medium">{formatUSD(data.summary.highValueUsd)}</div>
            <div className="text-xs text-muted-foreground">{data.summary.highDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">All-Time Low</div>
            <div className="font-medium">{formatUSD(data.summary.lowValueUsd)}</div>
            <div className="text-xs text-muted-foreground">{data.summary.lowDate}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Change</div>
            <div className={cn(
              'font-medium',
              isPositive ? 'text-green-500' : 'text-red-500'
            )}>
              {isPositive ? '+' : ''}{formatPercent(data.summary.changePercent / 100)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 6: Dashboard Integration

**File: `src/app/dashboard/page.tsx` (update)**
```typescript
// Update the ValueChart usage to pass walletAddress
<ValueChart walletAddress={walletToView} />
```

---

## Phase 2: Add DeFi Position History (Enhancement)

After the basic implementation works, add historical DeFi positions:

### Approach 1: Subgraph Queries

```typescript
// src/server/lib/subgraphs.ts
const SUBGRAPH_URLS: Record<string, Record<number, string>> = {
  'aave-v3': {
    1: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
    42161: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum',
    // ...
  },
  'compound-v3': {
    1: 'https://api.thegraph.com/subgraphs/name/compound-finance/compound-v3',
    // ...
  },
};

export async function getHistoricalAavePositions(
  walletAddress: string,
  chainId: number,
  blockNumber: number
): Promise<AavePosition[]> {
  const url = SUBGRAPH_URLS['aave-v3'][chainId];
  if (!url) return [];

  const query = `
    {
      userReserves(
        where: { user: "${walletAddress.toLowerCase()}" }
        block: { number: ${blockNumber} }
      ) {
        reserve {
          symbol
          underlyingAsset
          decimals
          liquidityRate
        }
        currentATokenBalance
        currentVariableDebt
      }
    }
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  return data.data?.userReserves || [];
}
```

### Approach 2: eth_call at Historical Block

```typescript
// For protocols without subgraphs
export async function getHistoricalPosition(
  walletAddress: Address,
  protocol: string,
  chainId: number,
  blockNumber: bigint
): Promise<Position | null> {
  const client = getClient(chainId);
  const adapter = adapterRegistry.get(protocol);

  if (!adapter) return null;

  // This requires archive node access
  try {
    const position = await client.readContract({
      address: adapter.config.contracts[chainId].poolDataProvider,
      abi: adapter.abi,
      functionName: 'getUserReserveData',
      args: [assetAddress, walletAddress],
      blockNumber,
    });

    return parsePosition(position);
  } catch (error) {
    // Block too old or not available
    return null;
  }
}
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Cache Hierarchy                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 1: React Query (Client)                              │
│  ├─ Key: ['historical', walletAddress, timeframe]          │
│  ├─ Stale time: 5 minutes                                  │
│  └─ Refetch on window focus: false                         │
│                                                             │
│  Level 2: Redis (Server)                                    │
│  ├─ Key: historical:{wallet}:{timeframe}:{chains}          │
│  ├─ TTL by timeframe:                                      │
│  │   7d  → 30 minutes                                      │
│  │   30d → 1 hour                                          │
│  │   90d → 6 hours                                         │
│  │   1y  → 24 hours                                        │
│  └─ Invalidate on new day                                  │
│                                                             │
│  Level 3: Covalent Cache (Their side)                       │
│  └─ They cache responses, we benefit                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling

```typescript
// Graceful degradation
try {
  const chainData = await fetchChainHistoricalData(wallet, chainId, days);
  return chainData;
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Queue for retry
    await delay(1000);
    return fetchChainHistoricalData(wallet, chainId, days);
  }

  if (error.message.includes('not found')) {
    // Wallet has no history on this chain
    return { chainId, dataPoints: new Map() };
  }

  // Log but don't fail entirely
  console.error(`Failed to fetch ${chainId} history:`, error);
  return { chainId, dataPoints: new Map() };
}
```

---

## Environment Variables

```env
# .env.local
COVALENT_API_KEY=your_covalent_api_key

# Optional - for DeFi position history via subgraphs
THEGRAPH_API_KEY=your_graph_api_key
```

---

## Testing Plan

1. **Unit Tests**
   - Covalent client response parsing
   - DeFi Llama price parsing
   - Data merging logic
   - Summary calculation

2. **Integration Tests**
   - Full flow with mock APIs
   - Cache behavior
   - Error handling

3. **Manual Testing**
   - Test with known wallets:
     - vitalik.eth (large, diverse portfolio)
     - A small wallet (edge cases)
     - Empty wallet (should handle gracefully)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Initial load time (30d) | < 3 seconds |
| Cached load time | < 500ms |
| Data accuracy vs. DeBank | > 95% match |
| API cost per query | < $0.01 |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/server/lib/covalent.ts` | CREATE | Covalent API client |
| `src/server/lib/defillama.ts` | CREATE | DeFi Llama price client |
| `src/server/services/historical.ts` | CREATE | Historical data service |
| `src/server/routers/portfolio.ts` | MODIFY | Add getHistoricalValue endpoint |
| `src/hooks/use-historical.ts` | CREATE | React Query hook |
| `src/components/portfolio/value-chart.tsx` | MODIFY | Real data integration |
| `src/app/dashboard/page.tsx` | MODIFY | Pass wallet to chart |
| `.env.local` | MODIFY | Add COVALENT_API_KEY |
