# OnChain Wealth - Feature Roadmap

This document consolidates all planned features, prioritized for maximum impact when demonstrating to the EtherFi team.

---

## Recently Completed

### The Graph Integration (January 2025)
**Status**: DONE

Implemented Graph-accelerated adapters for major protocols, achieving ~25x faster position queries:
- Aave V3 Graph adapter
- Compound V3 Graph adapter
- Lido Graph adapter
- EtherFi Graph adapter

DeFi position loading reduced from ~38s to ~1-2s through subgraph queries.

### HyperSync Historical Data (January 2025)
**Status**: DONE

Integrated Envio HyperSync for backward balance reconstruction:
- Block time estimation for historical queries
- Fast ERC-20 transfer log retrieval
- Backward balance calculation from current state

### Live Price Animation Fix (January 2025)
**Status**: DONE

Fixed price ticker animation re-triggering issue in the dashboard.

### Performance Optimization (January 2025)
**Status**: DONE

Major performance improvements across the application:
- DeFi position loading: 38s → 1-2s
- Graph-accelerated protocol adapters
- Optimized data fetching patterns

---

## Priority Tiers

| Tier | Focus | Why It Matters |
|------|-------|----------------|
| **P0** | EtherFi-Specific | Shows deep understanding of their product |
| **P1** | Real-Time & Polish | Makes the app feel production-ready |
| **P2** | Risk Intelligence | Demonstrates DeFi expertise |
| **P3** | DeFi Actions | Full-featured product vision |

---

## P0: EtherFi-Specific Features

### Feature: EtherFi & EigenLayer Points Tracker

**Why EtherFi Cares**: Points are their core value proposition. Users choose EtherFi specifically for dual points (EtherFi + EigenLayer). No competitor tracks this well.

**User Experience**:
```
┌─────────────────────────────────────────────────────────────┐
│  YOUR POINTS                                    [Refresh 🔄] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EtherFi Points                     EigenLayer Points       │
│  ┌─────────────────────┐           ┌─────────────────────┐ │
│  │  ⭐ 142,850         │           │  🔷 89,420          │ │
│  │  +2,340 today       │           │  +1,890 today       │ │
│  │  ~$428 est. value*  │           │  ~$268 est. value*  │ │
│  └─────────────────────┘           └─────────────────────┘ │
│                                                             │
│  Points Earning Rate                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Your weETH: 12.5 ($41,250)                         │   │
│  │  EtherFi:     ~156 points/day (1.25x multiplier)   │   │
│  │  EigenLayer:  ~98 points/day                        │   │
│  │                                                      │   │
│  │  📈 At current rate:                                │   │
│  │     30 days: +4,680 EtherFi / +2,940 EigenLayer    │   │
│  │     90 days: +14,040 EtherFi / +8,820 EigenLayer   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  * Estimated based on community speculation. Not guaranteed.│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation**:

```
src/server/
├── services/
│   └── points.ts                # Points calculation service
├── adapters/
│   └── etherfi.ts               # Extend with getPoints()
└── routers/
    └── points.ts                # Points API endpoints

src/components/
└── points/
    ├── points-card.tsx          # Main points display
    ├── earning-rate.tsx         # Rate projection
    └── points-history.tsx       # Historical accumulation
```

**Data Sources**:
- EtherFi API: `https://app.ether.fi/api/portfolio/v3/{address}` (if available)
- Fallback: Calculate from weETH holdings × time × multipliers
- EigenLayer: Query EigenLayer contracts for restaking points

**Key Insight**: Even if exact point values aren't available via API, showing *earning rate projections* based on holdings demonstrates product understanding.

---

### Feature: Restaking Flow Visualization

**Why EtherFi Cares**: Their product is complex (ETH → eETH → weETH → EigenLayer operators). Visualizing this flow shows deep protocol understanding.

**User Experience**:
```
┌─────────────────────────────────────────────────────────────┐
│  YOUR RESTAKING JOURNEY                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────────────────┐  │
│  │ ETH  │ -> │ eETH │ -> │weETH │ -> │ EigenLayer AVS   │  │
│  │      │    │      │    │      │    │                  │  │
│  │ 0.0  │    │ 0.0  │    │12.5  │    │ ✓ EigenDA       │  │
│  │      │    │      │    │      │    │ ✓ Hyperlane     │  │
│  │      │    │      │    │      │    │ ✓ Lagrange      │  │
│  └──────┘    └──────┘    └──────┘    └──────────────────┘  │
│       ↓           ↓           ↓                ↓            │
│    Stake      Wrap for    Restake to     Validate for      │
│    to Lido    DeFi use    EigenLayer     extra rewards     │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Yield Breakdown                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Base ETH Staking:           3.1% APY              │   │
│  │  EtherFi Points:             ~2.0% (estimated)     │   │
│  │  EigenLayer Points:          ~1.5% (estimated)     │   │
│  │  ──────────────────────────────────────────────    │   │
│  │  Total Effective Yield:      ~6.6% APY             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Stake More ETH]  [Wrap eETH → weETH]  [View Operators]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation**:

```
src/components/
└── restaking/
    ├── flow-diagram.tsx         # Visual flow (Sankey or step diagram)
    ├── yield-breakdown.tsx      # Stacked yield sources
    └── operator-list.tsx        # EigenLayer operator selection

src/server/
├── services/
│   └── eigenlayer.ts            # Query operator delegations
└── adapters/
    └── eigenlayer.ts            # Extend with getOperatorDelegations()
```

**Data Sources**:
- EigenLayer contracts: `DelegationManager.delegatedTo()`
- EtherFi: eETH/weETH balances (already have this)
- Operator metadata: EigenLayer operator registry or API

---

### Feature: weETH DeFi Integrations Map

**Why EtherFi Cares**: weETH is used across DeFi (Pendle, Morpho, Aave). Showing where users have deployed weETH demonstrates ecosystem awareness.

**User Experience**:
```
┌─────────────────────────────────────────────────────────────┐
│  YOUR weETH ACROSS DEFI                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Total weETH: 12.5 ($41,250)                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Wallet                  5.0 weETH    $16,500       │   │
│  │  ████████████████░░░░░░░░░░░░░░░░░░  40%           │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Pendle PT-weETH         4.2 weETH    $13,860       │   │
│  │  █████████████░░░░░░░░░░░░░░░░░░░░░  33.6%  +8.2%  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Morpho (collateral)     3.3 weETH    $10,890       │   │
│  │  ██████████░░░░░░░░░░░░░░░░░░░░░░░░  26.4%  +4.1%  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 All positions continue earning EtherFi + EL points     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**: Extend existing adapters to flag positions containing weETH, then aggregate into a dedicated view.

---

## P1: Real-Time & Polish

### Feature: Live Price Animation
**Status**: DONE

Fixed price ticker animation re-triggering. Prices now animate smoothly when values change.

---

### Feature: Live Price Streaming via SSE

**Status**: Partially implemented - infrastructure exists (`use-live-prices.ts`, `LiveIndicator`), backend broadcasting not yet implemented.

**What's Missing**:
1. Background job to fetch prices periodically (every 10s)
2. Redis pub/sub to broadcast price updates
3. SSE endpoint to stream to connected clients
4. Frontend to update prices without full refetch

**Technical Implementation**:

```typescript
// src/server/jobs/workers.ts - Add price broadcasting worker
const priceStreamWorker = new Worker('price-stream', async () => {
  const prices = await fetchLivePrices(['ETH', 'BTC', 'weETH', ...]);
  await redis.publish('price-updates', JSON.stringify(prices));
}, { connection: redis, every: 10000 }); // Every 10 seconds

// src/app/api/events/route.ts - Extend SSE endpoint
redis.subscribe('price-updates', (message) => {
  sendToAllClients({ type: 'price-update', data: JSON.parse(message) });
});
```

**User Experience**:
- Prices update in real-time without page refresh
- `LiveIndicator` pulses green when streaming
- Portfolio value updates live as prices change

---

### Feature: Improved Loading States

**Status**: `LoadingOrchestrator` exists but could be enhanced.

**Enhancements**:
1. **Skeleton shimmer for sparklines** - Show placeholder sparklines during load
2. **Optimistic UI for timeframe switches** - Show cached data immediately, update when fresh data arrives
3. **Progressive data reveal** - Show tokens as they load, don't wait for all chains

---

## P2: Risk Intelligence

### Feature: Liquidation Risk Engine

**Goal**: Real-time monitoring of lending positions with liquidation predictions.

**User Experience**:
```
┌─────────────────────────────────────────────────────────────┐
│  LIQUIDATION RISK MONITOR                      [Refresh 🔄] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Overall Risk Score: MODERATE                               │
│  ████████████░░░░░░░░  62/100                              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Aave V3 · Ethereum                           Health: 1.42  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Collateral: 12.5 wstETH ($41,250)                  │   │
│  │  Debt: 28,100 USDC                                  │   │
│  │  Current LTV: 62.1% (Max: 82.5%)                    │   │
│  │                                                      │   │
│  │  ⚠️  Liquidation if ETH drops 18% → $2,847          │   │
│  │                                                      │   │
│  │  [+ Set Alert]  [Add Collateral]  [Repay Debt]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation**:

```typescript
// Extend ProtocolAdapter interface
interface ProtocolAdapter {
  // Existing
  getPositions(...): Promise<Position[]>;

  // New for lending protocols
  getLiquidationData?(
    walletAddress: Address,
    chainId: SupportedChainId
  ): Promise<LiquidationData | null>;
}

interface LiquidationData {
  healthFactor: number;
  collaterals: Array<{
    token: string;
    amount: number;
    valueUsd: number;
    liquidationThreshold: number;
  }>;
  debts: Array<{
    token: string;
    amount: number;
    valueUsd: number;
  }>;
  liquidationPrices: Array<{
    token: string;
    currentPrice: number;
    liquidationPrice: number;
    dropPercent: number;
  }>;
}
```

**Protocol-Specific Data Sources**:

| Protocol | Health Factor | Data Method |
|----------|--------------|-------------|
| Aave V3 | `getUserAccountData()` | Direct contract call |
| Compound V3 | Calculate from `borrowBalance()` / `collateralValue()` | Contract calls |
| Morpho | `healthFactor()` | Contract call |
| Spark | Same as Aave | Aave V3 fork |

---

### Feature: Transaction Simulation

**Goal**: Preview exact transaction outcomes before signing.

**User Experience**:
```
┌─────────────────────────────────────────────────────────────┐
│  TRANSACTION PREVIEW                                        │
├─────────────────────────────────────────────────────────────┤
│  ✅ SIMULATION SUCCESSFUL                                   │
│                                                             │
│  TOKEN CHANGES                                              │
│  ┌────────────────────────────────────────────────┐        │
│  │ Token      Before        After       Change    │        │
│  │ ETH        12.5000  →    7.5000     -5.0000   │        │
│  │ aWETH       0.0000  →    5.0000     +5.0000   │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  POSITION IMPACT                                            │
│  ┌────────────────────────────────────────────────┐        │
│  │ Health Factor    1.42  →  1.94  (+36%)        │        │
│  │ Borrowing Power  $8,200 → $24,860             │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  Gas: ~0.003 ETH ($10.50)                                  │
│                                                             │
│  [Cancel]                        [Execute Transaction →]    │
└─────────────────────────────────────────────────────────────┘
```

**Technical Approach**: Tenderly API (primary) + eth_call fallback

```typescript
// src/server/services/simulation.ts
export async function simulateTransaction(params: {
  chainId: number;
  from: Address;
  to: Address;
  data: Hex;
  value?: bigint;
}): Promise<SimulationResult> {
  try {
    // Primary: Tenderly
    return await tenderlySimulate(params);
  } catch {
    // Fallback: eth_call (limited info)
    return await ethCallSimulate(params);
  }
}
```

---

## P3: DeFi Actions

### Feature: Unified Deposit/Withdraw

**Goal**: Execute deposits, withdrawals across protocols from one interface.

**Key Capabilities**:
- Deposit to any supported protocol
- Compare yields across protocols before depositing
- Auto-detect if bridging is needed (ETH on mainnet → Base for Morpho)
- Transaction simulation before execution

**Adapter Extensions**:
```typescript
interface ProtocolAdapter {
  // Existing
  getPositions(...): Promise<Position[]>;

  // New action methods
  supportsAction?(action: "deposit" | "withdraw"): boolean;
  buildDepositTx?(params: DepositParams): Promise<TransactionRequest>;
  buildWithdrawTx?(params: WithdrawParams): Promise<TransactionRequest>;
}
```

---

### Feature: Swap & Bridge Integration

**Swap**: 1inch Fusion API for MEV-protected swaps
**Bridge**: Li.Fi aggregator for cross-chain transfers

**User Flow**:
1. User wants to deposit ETH to Morpho on Base
2. System detects ETH is on mainnet
3. Auto-proposes: Swap → Bridge → Deposit as single flow
4. Simulates entire sequence
5. User approves, executes step by step

---

### Feature: Automation Rules

**Goal**: Set up automated actions based on conditions.

**Example Rules**:
- "If health factor < 1.2, notify me to add collateral"
- "If ETH > $5,000, swap 20% to USDC"
- "When rewards > $50, auto-compound to staking"

**Execution Model**: Notification-first (non-custodial), optional session keys for power users.

---

## File Structure (Target)

```
src/server/
├── adapters/
│   ├── types.ts                   # + LiquidationData, action methods
│   ├── etherfi.ts                 # + getPoints(), operators
│   ├── eigenlayer.ts              # + getOperatorDelegations()
│   ├── aave-v3.ts                 # + getLiquidationData(), buildDepositTx()
│   └── ...
│
├── services/
│   ├── points.ts                  # NEW: Points calculation
│   ├── liquidation.ts             # NEW: Risk calculations
│   ├── simulation.ts              # NEW: Tenderly integration
│   ├── yields.ts                  # EXISTS: DeFi Llama yields
│   └── ...
│
├── routers/
│   ├── points.ts                  # NEW: Points endpoints
│   ├── risk.ts                    # NEW: Liquidation endpoints
│   ├── simulation.ts              # NEW: Simulation endpoints
│   └── ...
│
└── jobs/
    └── workers.ts                 # + price-stream worker

src/components/
├── points/
│   ├── points-card.tsx
│   └── earning-rate.tsx
├── restaking/
│   ├── flow-diagram.tsx
│   └── yield-breakdown.tsx
├── risk/
│   ├── liquidation-card.tsx
│   └── health-gauge.tsx
└── simulation/
    ├── simulation-modal.tsx
    └── balance-diff.tsx
```

---

## External Dependencies

| Service | Purpose | Cost | Status |
|---------|---------|------|--------|
| GoldRush (Covalent) | Token balances | Free tier | ✅ Implemented |
| DeFi Llama | Prices, yields | Free | ✅ Implemented |
| CoinGecko | Live prices | Free tier | ✅ Implemented |
| The Graph | DeFi position queries | Free tier | ✅ Implemented |
| Envio HyperSync | Historical balance reconstruction | Free | ✅ Implemented |
| EtherFi API | Points data | Free (if available) | 🔲 To investigate |
| EigenLayer Contracts | Delegation data | Free (RPC) | 🔲 Planned |
| Tenderly | TX simulation | ~$50/month | 🔲 Planned |
| 1inch Fusion | Swaps | Free | 🔲 Planned |
| Li.Fi | Bridging | Free | 🔲 Planned |

---

## Implementation Order

**Recommended sequence for maximum demo impact:**

1. ~~**Performance Optimization**~~ DONE
   - Graph-accelerated adapters for major protocols
   - DeFi position loading: 38s → 1-2s

2. **Live Price Streaming** (P1) - IN PROGRESS
   - Animation fixed, backend broadcasting next
   - Infrastructure mostly exists

3. **EtherFi Points Tracker** (P0) - NEXT PRIORITY
   - High EtherFi relevance
   - Can start with estimation if API unavailable

4. **Restaking Flow Visualization** (P0)
   - Visual impact, shows product understanding
   - Mostly frontend work

5. **Liquidation Risk Dashboard** (P2)
   - Demonstrates DeFi expertise
   - Backend complexity but high value

6. **Transaction Simulation** (P2)
   - Requires Tenderly setup
   - Critical for trust in any "actions" features

7. **weETH DeFi Map** (P0)
   - Builds on existing adapters
   - EtherFi-specific insight

8. **Unified Actions** (P3)
   - Full product vision
   - Depends on simulation being ready

---

## Success Criteria

| Feature | Metric | Status |
|---------|--------|--------|
| Live Prices | Updates visible within 10s of price change | In Progress |
| Points Tracker | Earning rate within 10% of actual | Planned |
| Liquidation Monitor | Health factor accurate to 2 decimal places | Planned |
| Transaction Simulation | 99%+ accuracy vs actual execution | Planned |
| Load Time | Dashboard < 3s, historical chart < 5s | ACHIEVED (1-2s) |

---

*Document Version: 1.1*
*Created: January 21, 2025*
*Last Updated: January 23, 2025*
*Consolidates: PHASE_2_3_PLAN.md + new EtherFi-specific recommendations*

### Changelog
- **v1.1** (Jan 23, 2025): Added "Recently Completed" section documenting The Graph integration, HyperSync historical data, live price animation fix, and performance optimizations. Updated success criteria and external dependencies.
