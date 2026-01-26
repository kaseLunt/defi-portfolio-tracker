# OnChain Wealth - Phase 2 & 3 Implementation Plan

## Status Summary

> **Last Updated:** January 2026

### Recently Completed

- [x] **The Graph Integration** - Fast DeFi queries for Aave V3, Compound V3, Lido, EtherFi
- [x] **HyperSync Historical Data** - Improved historical balance reconstruction
- [x] **Performance Optimization** - Dashboard load time reduced from 38s to 1-2s
- [x] **Historical Portfolio Reconstruction (Feature 2.1)** - COMPLETE

---

## Overview

**Phase 2: Risk Intelligence** - Help users understand and protect their positions
**Phase 3: DeFi Actions** - Enable users to act directly from the dashboard

---

## Phase 2: Risk Intelligence

### Feature 2.1: Historical Portfolio Reconstruction - COMPLETE

**Status:** IMPLEMENTED

**Goal:** Show portfolio value over time for ANY wallet without requiring prior snapshots.

**User Experience:**
```
┌─────────────────────────────────────────────────────────────┐
│  Portfolio Value Over Time                    [1W][1M][1Y]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  $85,000 ─┐                                          ┌──    │
│           │    ╭─────╮                              ╱       │
│  $70,000 ─┤   ╱      ╰──────╮    ╭────────╮      ╱         │
│           │  ╱               ╰──╯          ╰────╯           │
│  $55,000 ─┼─╯                                               │
│           │                                                 │
│  $40,000 ─┴─────────────────────────────────────────────    │
│           Jan    Feb    Mar    Apr    May    Jun            │
│                                                             │
│  Total Value: $82,450  |  30D Change: +$12,300 (+17.5%)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```
src/server/
├── services/
│   └── historical.ts              # Historical data reconstruction
├── lib/
│   ├── covalent.ts                # Covalent API client
│   └── defillama.ts               # DeFi Llama price history
└── routers/
    └── portfolio.ts               # Add getHistoricalValue endpoint
```

**Data Flow:**
```
1. User requests 30-day history for wallet 0x...
                    ↓
2. Generate time points (daily for 30d, hourly for 7d)
                    ↓
3. For each time point (parallelized):
   a. Get token balances via Covalent historical API
   b. Get DeFi positions via subgraph/eth_call at block
   c. Get prices at that timestamp via DeFi Llama
   d. Calculate total USD value
                    ↓
4. Cache results in Redis (1hr TTL)
                    ↓
5. Return time series data
```

**API Design:**
```typescript
// New tRPC endpoint
portfolio.getHistoricalValue.query({
  walletAddress: Address,
  timeframe: "1d" | "7d" | "30d" | "90d" | "1y",
  chains?: SupportedChainId[],
})

// Response
{
  dataPoints: Array<{
    timestamp: number,
    totalValueUsd: number,
    breakdown: {
      wallet: number,      // Token balances
      defi: number,        // Protocol positions
    }
  }>,
  changePercent: number,
  changeUsd: number,
}
```

**External APIs:**
- Covalent: `GET /v1/{chainId}/address/{address}/portfolio_v2/` (has historical)
- DeFi Llama: `GET /prices/historical/{timestamp}/{coins}` (batch prices)
- Subgraphs: Query with `block: {number: X}` parameter

**Caching Strategy:**
- Cache per wallet + timeframe + date
- 1-hour TTL for recent data
- 24-hour TTL for older data (>7 days ago)
- Store in Redis as compressed JSON

**Implementation Notes (Completed):**
- Historical service implemented in `src/server/services/historical/`
- Supports GoldRush/Covalent, HyperSync, and DeFi Llama price sources
- Includes data interpolation to handle missing/anomalous values
- Progress tracking via Redis for long-running requests
- tRPC endpoint: `history.getPortfolioHistory`

---

### Feature 2.2: Liquidation Risk Engine - NEXT PRIORITY

**Status:** NOT STARTED - Recommended next feature

**Goal:** Real-time monitoring of all lending positions with liquidation predictions.

**Why This Is Easier Now:**
With The Graph integration complete for Aave V3 and Compound V3, we can efficiently query:
- User account data (health factors, collateral, debt)
- Reserve configuration (liquidation thresholds)
- Historical position data for trend analysis

The existing Graph adapters in `src/server/adapters/graph/` can be extended with `getLiquidationData()` methods.

**User Experience:**
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
│  │                                                      │   │
│  │  Collateral                      Debt                │   │
│  │  ┌──────────────────┐           ┌──────────────────┐│   │
│  │  │ 12.5 wstETH      │           │ 28,100 USDC      ││   │
│  │  │ $41,250          │           │ $28,100          ││   │
│  │  │                  │           │                  ││   │
│  │  │ 1.2 WETH         │           │ Borrow APY: 4.2% ││   │
│  │  │ $3,980           │           │                  ││   │
│  │  └──────────────────┘           └──────────────────┘│   │
│  │                                                      │   │
│  │  Liquidation Threshold: 82.5%                        │   │
│  │  Current LTV: 62.1%                                  │   │
│  │                                                      │   │
│  │  ⚠️  LIQUIDATION TRIGGERS                           │   │
│  │  ├─ If ETH drops 18% → $2,847 (from $3,472)         │   │
│  │  ├─ If wstETH drops 20% → $2,640                     │   │
│  │  └─ If USDC depegs above $1.15                       │   │
│  │                                                      │   │
│  │  📊 Price Scenarios                                  │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ ETH Price    Health Factor    Status           │ │   │
│  │  │ $3,472       1.42             ✅ Safe          │ │   │
│  │  │ $3,200       1.31             ✅ Safe          │ │   │
│  │  │ $3,000       1.22             ⚠️ Caution      │ │   │
│  │  │ $2,847       1.00             🔴 Liquidation   │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  [+ Set Alert]  [Add Collateral]  [Repay Debt]      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Morpho · Base                                Health: 2.81  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Status: ✅ SAFE - Liquidation at ETH $1,923 (-45%) │   │
│  │  [Expand Details]                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Spark · Ethereum                             Health: 1.89  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Status: ✅ SAFE - Liquidation at ETH $2,180 (-37%) │   │
│  │  [Expand Details]                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```
src/server/
├── services/
│   └── liquidation.ts             # Liquidation calculations
├── adapters/
│   ├── aave-v3.ts                 # Add getLiquidationData()
│   ├── compound-v3.ts             # Add getLiquidationData()
│   ├── morpho.ts                  # Add getLiquidationData()
│   └── spark.ts                   # Add getLiquidationData()
└── routers/
    └── risk.ts                    # New risk router

src/app/
└── risk/
    └── page.tsx                   # Risk dashboard page

src/components/
└── risk/
    ├── liquidation-card.tsx       # Per-protocol risk card
    ├── health-gauge.tsx           # Visual health indicator
    └── price-scenarios.tsx        # What-if table
```

**New Adapter Method:**
```typescript
interface LiquidationData {
  protocol: string;
  chainId: SupportedChainId;
  healthFactor: number;              // Current health (1.0 = liquidation)
  collaterals: Array<{
    token: string;
    amount: number;
    valueUsd: number;
    liquidationThreshold: number;    // e.g., 0.825 for 82.5%
    isCollateralEnabled: boolean;
  }>;
  debts: Array<{
    token: string;
    amount: number;
    valueUsd: number;
    borrowApy: number;
  }>;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  currentLtv: number;                // totalDebt / totalCollateral
  maxLtv: number;                    // Weighted average threshold
  liquidationPrices: Array<{        // Key insight!
    token: string;
    currentPrice: number;
    liquidationPrice: number;
    dropPercent: number;
  }>;
  borrowingPowerUsd: number;         // How much more can borrow
}

// Add to BaseAdapter
abstract getLiquidationData?(
  walletAddress: Address,
  chainId: SupportedChainId
): Promise<LiquidationData | null>;
```

**Liquidation Price Calculation:**
```typescript
// For each collateral token, calculate price where health = 1

function calculateLiquidationPrice(data: LiquidationData, token: string): number {
  const collateral = data.collaterals.find(c => c.token === token);
  if (!collateral) return 0;

  // Health Factor = (Σ collateral_i * price_i * LT_i) / total_debt
  // At liquidation, HF = 1
  // Solve for price_i:
  // 1 = (collateral_i * price_i * LT_i + other_collateral_value) / total_debt
  // price_i = (total_debt - other_collateral_value) / (collateral_i * LT_i)

  const otherCollateralValue = data.collaterals
    .filter(c => c.token !== token)
    .reduce((sum, c) => sum + c.valueUsd * c.liquidationThreshold, 0);

  const liquidationPrice =
    (data.totalDebtUsd - otherCollateralValue) /
    (collateral.amount * collateral.liquidationThreshold);

  return Math.max(0, liquidationPrice);
}
```

**Protocol-Specific Data Sources:**

| Protocol | Health Factor | Collateral/Debt | Thresholds |
|----------|--------------|-----------------|------------|
| Aave V3 | `getUserAccountData()` | `getUserReserveData()` | `getReserveConfigurationData()` |
| Compound V3 | `isLiquidatable()` + calc | `userCollateral()`, `borrowBalance()` | `getAssetInfo()` |
| Morpho | `healthFactor()` | `collateral()`, `borrow()` | Market params |
| Spark | Same as Aave | Same as Aave | Same as Aave |

**Alert Integration:**
```typescript
// New alert rule type
interface LiquidationAlertRule {
  ruleType: "liquidation";
  conditions: {
    protocol: string;
    chainId: number;
    healthFactorBelow: number;  // e.g., 1.3
  };
}

// Background worker checks every minute
// Triggers when health factor drops below threshold
```

---

### Feature 2.3: Transaction Simulation Engine

**Status:** NOT STARTED

**Goal:** Preview exact transaction outcomes before signing.

**User Experience:**
```
┌─────────────────────────────────────────────────────────────┐
│  TRANSACTION SIMULATION                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Simulating: Supply 5 ETH to Aave V3 on Ethereum            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✅ SIMULATION SUCCESSFUL                            │   │
│  │                                                      │   │
│  │  TOKEN BALANCE CHANGES                               │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ Token      Before        After       Change    │ │   │
│  │  │ ─────────────────────────────────────────────  │ │   │
│  │  │ ETH        12.5000  →    7.5000     -5.0000   │ │   │
│  │  │ aWETH       0.0000  →    5.0000     +5.0000   │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  POSITION CHANGES                                    │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ Metric              Before      After          │ │   │
│  │  │ ─────────────────────────────────────────────  │ │   │
│  │  │ Total Collateral    $45,230     $61,890       │ │   │
│  │  │ Health Factor       1.42        1.94          │ │   │
│  │  │ Borrowing Power     $8,200      $24,860       │ │   │
│  │  │ Net APY             2.8%        3.1%          │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  TRANSACTION DETAILS                                 │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ Gas Estimate:    142,000 gas                   │ │   │
│  │  │ Gas Price:       25 gwei                       │ │   │
│  │  │ Max Fee:         0.00355 ETH (~$11.82)        │ │   │
│  │  │ Expected Time:   ~12 seconds                   │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel]                        [Execute Transaction →]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

// Error case:
┌─────────────────────────────────────────────────────────────┐
│  ❌ SIMULATION FAILED                                       │
│                                                             │
│  Error: Insufficient collateral for this borrow amount      │
│                                                             │
│  The transaction would fail because:                        │
│  • Requested borrow: $50,000 USDC                          │
│  • Available borrowing power: $24,200                       │
│  • Shortfall: $25,800                                       │
│                                                             │
│  Suggestions:                                               │
│  • Reduce borrow amount to $24,000 or less                 │
│  • Add more collateral first                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

**Option A: Tenderly Simulation API (Recommended for MVP)**
```typescript
// Pros: Reliable, full trace, decodes errors
// Cons: Costs ~$50/month for starter tier

interface TenderlySimulation {
  simulation: {
    status: boolean;
    gas_used: number;
    block_number: number;
  };
  transaction: {
    status: boolean;
    error_message?: string;
  };
  contracts: Array<{
    address: string;
    balance_diff: Array<{ before: string; after: string; token: string }>;
  }>;
  logs: Array<{ name: string; inputs: any[] }>;
}

// API call
POST https://api.tenderly.co/api/v1/account/{account}/project/{project}/simulate
{
  "network_id": "1",
  "from": "0x...",
  "to": "0x...",
  "input": "0x...",
  "value": "0",
  "save": false,
  "save_if_fails": false,
  "simulation_type": "quick"  // or "full" for complete trace
}
```

**Option B: eth_call with State Overrides (Free, limited)**
```typescript
// Pros: Free, works with any RPC
// Cons: Only shows success/fail, no balance diffs

const result = await client.call({
  to: contractAddress,
  data: calldata,
  account: userAddress,
  stateOverride: [{
    address: tokenAddress,
    balance: parseEther("1000"),  // Override balance for testing
  }],
});
```

**Option C: Anvil Fork (Free, powerful, requires infra)**
```typescript
// Pros: Full simulation, free, local
// Cons: Need to run Anvil, slower

// 1. Fork mainnet at current block
anvil --fork-url $RPC_URL --fork-block-number latest

// 2. Execute transaction on fork
// 3. Query state changes
// 4. Discard fork
```

**Recommended Approach: Tenderly + Fallback**
```
src/server/
├── services/
│   └── simulation.ts              # Simulation orchestration
├── lib/
│   ├── tenderly.ts                # Tenderly API client
│   └── simulation-fallback.ts     # eth_call fallback
└── routers/
    └── simulation.ts              # Simulation endpoints

src/components/
└── simulation/
    ├── simulation-modal.tsx       # Full simulation UI
    ├── balance-diff.tsx           # Token change display
    └── position-diff.tsx          # Position change display
```

**API Design:**
```typescript
// tRPC endpoint
simulation.simulate.mutate({
  chainId: number,
  from: Address,
  to: Address,
  data: Hex,           // Encoded calldata
  value?: string,      // ETH value in wei
})

// Response
{
  success: boolean,
  error?: string,
  gasUsed: number,
  gasPrice: bigint,
  balanceChanges: Array<{
    token: Address,
    symbol: string,
    before: string,
    after: string,
    change: string,
    changeUsd: number,
  }>,
  positionChanges?: {
    protocol: string,
    healthFactorBefore: number,
    healthFactorAfter: number,
    collateralBefore: number,
    collateralAfter: number,
    // ...
  },
  logs: Array<{ event: string, args: any }>,
}
```

**Integration Points:**
- Hook into any "Execute" button
- Can be called from Quick Actions (Phase 3)
- Show simulation before wallet popup

---

## Phase 3: DeFi Actions

### Feature 3.1: Unified DeFi Actions

**Status:** NOT STARTED - Benefits from Graph integration

**Goal:** Execute deposits, withdrawals, swaps from one interface.

**Graph Integration Benefits:**
The Graph adapters can be extended to fetch real-time APY data, making yield comparison instant.
Current Graph adapters already fetch supply/borrow rates for Aave V3 and Compound V3.

**User Experience:**
```
┌─────────────────────────────────────────────────────────────┐
│  ACTIONS                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Deposit │ │Withdraw │ │  Swap   │ │ Bridge  │          │
│  └────┬────┘ └─────────┘ └─────────┘ └─────────┘          │
│       ↓                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Deposit to Lending Protocol                         │   │
│  │                                                      │   │
│  │  From Wallet                                         │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  [ETH ▼]     [    5.0    ]    Balance: 12.5   │ │   │
│  │  │              ≈ $16,660                  [MAX]   │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  To Protocol                                         │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  ○ Aave V3 · Ethereum        3.2% APY         │ │   │
│  │  │  ● Morpho · Base             4.8% APY  ⭐ Best │ │   │
│  │  │  ○ Compound V3 · Arbitrum    3.9% APY         │ │   │
│  │  │  ○ Spark · Ethereum          3.1% APY         │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  Summary                                             │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │  You deposit    5.0 ETH ($16,660)              │ │   │
│  │  │  You receive    5.0 morphoETH                  │ │   │
│  │  │  Earn           ~$800/year at 4.8% APY         │ │   │
│  │  │  Gas            ~$3.50 (Base is cheap!)        │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  ⚠️ This requires bridging ETH to Base first.      │   │
│  │     We'll handle both steps automatically.          │   │
│  │                                                      │   │
│  │  [Preview Transaction]                               │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

```
src/server/
├── services/
│   ├── actions/
│   │   ├── types.ts               # Action interfaces
│   │   ├── deposit.ts             # Deposit action builder
│   │   ├── withdraw.ts            # Withdraw action builder
│   │   ├── swap.ts                # Swap via aggregator
│   │   └── bridge.ts              # Bridge via Li.Fi/Socket
│   └── routing.ts                 # Find optimal route
├── adapters/
│   └── [protocol].ts              # Add buildDepositTx, buildWithdrawTx
└── routers/
    └── actions.ts                 # Action endpoints

src/app/
└── actions/
    └── page.tsx                   # Actions page

src/components/
└── actions/
    ├── action-modal.tsx           # Main action UI
    ├── token-selector.tsx         # Token dropdown
    ├── protocol-selector.tsx      # Protocol picker with APYs
    ├── route-preview.tsx          # Show multi-step routes
    └── execution-status.tsx       # Progress during execution
```

**Adapter Extensions:**
```typescript
// Add to ProtocolAdapter interface
interface ProtocolAdapter {
  // Existing
  getPositions(...): Promise<Position[]>;

  // New action methods
  supportsAction?(action: "deposit" | "withdraw" | "borrow" | "repay"): boolean;

  buildDepositTx?(params: {
    chainId: SupportedChainId;
    token: Address;
    amount: bigint;
    recipient: Address;
  }): Promise<TransactionRequest>;

  buildWithdrawTx?(params: {
    chainId: SupportedChainId;
    token: Address;
    amount: bigint;      // Use maxUint256 for "max"
    recipient: Address;
  }): Promise<TransactionRequest>;

  // For lending protocols
  buildBorrowTx?(...): Promise<TransactionRequest>;
  buildRepayTx?(...): Promise<TransactionRequest>;
}

interface TransactionRequest {
  to: Address;
  data: Hex;
  value?: bigint;
  chainId: number;
  // For permit2/gasless
  permit?: {
    token: Address;
    amount: bigint;
    deadline: number;
    signature?: Hex;
  };
}
```

**Yield Comparison Service:**
```typescript
// Find best yields for a token across all protocols
async function findBestYields(
  token: string,  // "ETH", "USDC", etc.
  amount: number,
  userChainId?: number  // Prefer user's current chain
): Promise<Array<{
  protocol: string;
  chainId: number;
  apy: number;
  apyBreakdown: {
    base: number;
    rewards?: number;
  };
  tvl: number;
  riskScore: number;  // From protocol health scores
  requiresBridge: boolean;
  estimatedGas: number;
}>>
```

**Swap Integration (1inch/0x):**
```typescript
// Use 1inch Fusion for MEV protection
async function buildSwapTx(params: {
  chainId: number;
  fromToken: Address;
  toToken: Address;
  amount: bigint;
  slippage: number;  // 0.5 = 0.5%
}): Promise<{
  tx: TransactionRequest;
  quote: {
    toAmount: bigint;
    priceImpact: number;
    route: string[];  // DEXs used
  };
}>
```

**Bridge Integration (Li.Fi):**
```typescript
// Li.Fi aggregates bridges
async function buildBridgeTx(params: {
  fromChainId: number;
  toChainId: number;
  fromToken: Address;
  toToken: Address;
  amount: bigint;
}): Promise<{
  tx: TransactionRequest;
  quote: {
    toAmount: bigint;
    bridgeUsed: string;  // "stargate", "hop", "across"
    estimatedTime: number;  // seconds
    fee: bigint;
  };
}>
```

---

### Feature 3.2: Automation Rules

**Status:** NOT STARTED

**Goal:** Set up automated DeFi actions based on conditions.

**User Experience:**
```
┌─────────────────────────────────────────────────────────────┐
│  AUTOMATION RULES                            [+ New Rule]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Active Rules                                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🛡️ Liquidation Protection                          │   │
│  │                                                      │   │
│  │  WHEN  Aave V3 health factor < 1.2                   │   │
│  │  THEN  Repay 25% of USDC debt from wallet            │   │
│  │                                                      │   │
│  │  Status: Armed ✅                                    │   │
│  │  Current health: 1.42 (safe)                         │   │
│  │  Last checked: 30 seconds ago                        │   │
│  │                                                      │   │
│  │  [Edit] [Pause] [Test Run] [Delete]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔄 Auto-Compound Rewards                            │   │
│  │                                                      │   │
│  │  WHEN  Unclaimed rewards > $50                       │   │
│  │  THEN  Claim → Swap to ETH → Deposit to Lido        │   │
│  │                                                      │   │
│  │  Status: Armed ✅                                    │   │
│  │  Pending rewards: $23.50                             │   │
│  │  Last executed: 5 days ago                           │   │
│  │                                                      │   │
│  │  [Edit] [Pause] [Test Run] [Delete]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📈 Take Profit                                      │   │
│  │                                                      │   │
│  │  WHEN  ETH price > $5,000                            │   │
│  │  THEN  Swap 20% of ETH to USDC                       │   │
│  │                                                      │   │
│  │  Status: Armed ✅                                    │   │
│  │  Current price: $3,472                               │   │
│  │                                                      │   │
│  │  [Edit] [Pause] [Test Run] [Delete]                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Execution History                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Jan 15  Auto-Compound    Claimed $52 → Deposited   │    │
│  │ Jan 10  Liquidation      Repaid $5,000 USDC        │    │
│  │ Jan 3   Auto-Compound    Claimed $61 → Deposited   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**

**Execution Options:**

| Option | How it Works | Pros | Cons |
|--------|--------------|------|------|
| **Session Keys** | User signs a limited-permission key | Gasless for user | Complex setup |
| **Gelato Automate** | Chainlink keeper network | Decentralized, reliable | Costs per execution |
| **Backend Signing** | User deposits funds, we execute | Simple UX | Custodial-ish |
| **Notification Only** | Alert user, they execute | Non-custodial | Requires user action |

**Recommended: Notification + Optional Session Keys**

```
src/server/
├── services/
│   └── automation.ts              # Rule evaluation engine
├── jobs/
│   └── workers.ts                 # Add automation worker
└── routers/
    └── automation.ts              # CRUD for automation rules

src/components/
└── automation/
    ├── rule-builder.tsx           # Visual rule creator
    ├── condition-picker.tsx       # Condition configuration
    ├── action-picker.tsx          # Action configuration
    └── execution-log.tsx          # History display
```

**Rule Schema:**
```typescript
interface AutomationRule {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;

  // Trigger condition
  trigger: {
    type: "health_factor" | "price" | "time" | "reward_balance";
    params: {
      // health_factor
      protocol?: string;
      chainId?: number;
      threshold?: number;
      comparison?: "lt" | "gt";

      // price
      token?: string;
      targetPrice?: number;

      // time
      cronExpression?: string;  // "0 0 * * *" = daily

      // reward_balance
      minValueUsd?: number;
    };
  };

  // What to do when triggered
  action: {
    type: "repay" | "add_collateral" | "claim_compound" | "swap" | "notify_only";
    params: {
      // repay
      protocol?: string;
      token?: string;
      amountPercent?: number;  // 25 = 25% of debt

      // swap
      fromToken?: string;
      toToken?: string;
      amountPercent?: number;

      // claim_compound
      claimProtocols?: string[];
      swapTo?: string;
      depositTo?: string;
    };
  };

  // Execution settings
  execution: {
    mode: "notify" | "auto_execute";
    maxGasPrice?: number;  // Don't execute if gas too high
    cooldownMinutes: number;
  };

  // Stats
  lastEvaluatedAt?: Date;
  lastTriggeredAt?: Date;
  executionCount: number;
}
```

**Background Worker:**
```typescript
// Runs every minute
automationWorker.process(async () => {
  const activeRules = await prisma.automationRule.findMany({
    where: { isActive: true },
  });

  for (const rule of activeRules) {
    // Check cooldown
    if (isInCooldown(rule)) continue;

    // Evaluate trigger
    const shouldTrigger = await evaluateTrigger(rule);

    if (shouldTrigger) {
      if (rule.execution.mode === "notify") {
        // Send notification with action button
        await sendAutomationAlert(rule);
      } else {
        // Build and queue transaction
        const tx = await buildAutomationTx(rule);
        await queueForExecution(rule.userId, tx);
      }
    }
  }
});
```

---

## Implementation Timeline

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Risk Intelligence                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Week 1-2: Historical Portfolio - COMPLETE                  │
│  ├─ [x] Covalent/GoldRush API integration                   │
│  ├─ [x] DeFi Llama price history integration                │
│  ├─ [x] Historical reconstruction service                   │
│  ├─ [x] HyperSync for faster historical data                │
│  ├─ [x] Data interpolation for missing values               │
│  ├─ [x] Chart component updates                             │
│  └─ [x] Redis caching with progress tracking                │
│                                                             │
│  Week 3-4: Liquidation Risk Engine - NEXT                   │
│  ├─ Extend Graph adapters with getLiquidationData()         │
│  │   (Easier now: Aave V3, Compound V3 Graph adapters exist)│
│  ├─ Liquidation calculation service                         │
│  ├─ Risk dashboard UI                                       │
│  ├─ Liquidation alerts integration                          │
│  └─ Price scenario simulations                              │
│                                                             │
│  Week 5-6: Transaction Simulation                           │
│  ├─ Tenderly API integration                                │
│  ├─ Simulation service                                      │
│  ├─ Balance/position diff parsing                           │
│  ├─ Simulation modal UI                                     │
│  └─ Integration with action buttons                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: DeFi Actions                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Week 7-8: Unified Actions (Deposit/Withdraw)               │
│  ├─ Extend adapters with buildDepositTx(), etc.             │
│  ├─ Yield comparison service                                │
│  │   (Faster now: Graph adapters already fetch APY data)    │
│  ├─ Actions UI                                              │
│  ├─ Transaction building + signing flow                     │
│  └─ Simulation integration                                  │
│                                                             │
│  Week 9-10: Swap & Bridge                                   │
│  ├─ 1inch/0x swap integration                               │
│  ├─ Li.Fi bridge integration                                │
│  ├─ Route optimization                                      │
│  ├─ Multi-step transaction handling                         │
│  └─ Cross-chain flow UI                                     │
│                                                             │
│  Week 11-12: Automation Rules                               │
│  ├─ Rule schema and database                                │
│  ├─ Evaluation engine                                       │
│  ├─ Rule builder UI                                         │
│  ├─ Execution options (notify vs. auto)                     │
│  └─ Execution history and logging                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure (Current & Planned)

```
src/server/
├── adapters/
│   ├── types.ts                   # Extended with liquidation + actions
│   ├── registry.ts
│   ├── aave-v3.ts                 # + getLiquidationData, buildDepositTx
│   ├── compound-v3.ts             # + getLiquidationData, buildDepositTx
│   ├── morpho.ts                  # + getLiquidationData, buildDepositTx
│   ├── spark.ts                   # + getLiquidationData, buildDepositTx
│   ├── lido.ts                    # + buildDepositTx
│   ├── etherfi.ts                 # + buildDepositTx
│   ├── pendle.ts
│   └── graph/                     # IMPLEMENTED: The Graph adapters
│       ├── index.ts               # Exports all Graph adapters
│       ├── client.ts              # Graph client with caching
│       └── adapters/
│           ├── aave-v3.ts         # Fast Aave queries via subgraph
│           ├── compound-v3.ts     # Fast Compound queries via subgraph
│           ├── lido.ts            # Lido staking via subgraph
│           └── etherfi.ts         # EtherFi via subgraph
│
├── services/
│   ├── portfolio.ts
│   ├── price.ts
│   ├── historical/                # IMPLEMENTED: Historical reconstruction
│   │   ├── index.ts               # Main orchestrator
│   │   ├── covalent.ts            # GoldRush API client
│   │   ├── defillama.ts           # DeFi Llama price history
│   │   ├── hypersync.ts           # HyperSync for fast historical data
│   │   ├── progress.ts            # Progress tracking
│   │   ├── types.ts               # Type definitions
│   │   └── utils.ts               # Helpers
│   ├── liquidation.ts             # TODO: Liquidation calculations
│   ├── simulation.ts              # TODO: Transaction simulation
│   ├── routing.ts                 # TODO: Route optimization
│   └── automation.ts              # TODO: Rule evaluation
│
├── lib/
│   ├── redis.ts                   # IMPLEMENTED: Caching
│   ├── tenderly.ts                # TODO: Tenderly simulation
│   ├── oneinch.ts                 # TODO: 1inch swap API
│   └── lifi.ts                    # TODO: Li.Fi bridge API
│
├── routers/
│   ├── portfolio.ts
│   ├── history.ts                 # IMPLEMENTED: getPortfolioHistory, getProgress
│   ├── risk.ts                    # TODO: Liquidation endpoints
│   ├── simulation.ts              # TODO: Simulation endpoints
│   ├── actions.ts                 # TODO: Action building
│   └── automation.ts              # TODO: Rule CRUD
│
└── jobs/
    ├── workers.ts                 # + automation worker
    └── queues.ts                  # + automation queue

src/app/
├── risk/
│   └── page.tsx                   # NEW: Risk dashboard
├── actions/
│   └── page.tsx                   # NEW: Actions page
└── automation/
    └── page.tsx                   # NEW: Automation rules page

src/components/
├── risk/
│   ├── liquidation-card.tsx
│   ├── health-gauge.tsx
│   └── price-scenarios.tsx
├── simulation/
│   ├── simulation-modal.tsx
│   ├── balance-diff.tsx
│   └── position-diff.tsx
├── actions/
│   ├── action-modal.tsx
│   ├── deposit-form.tsx
│   ├── withdraw-form.tsx
│   ├── swap-form.tsx
│   └── bridge-form.tsx
└── automation/
    ├── rule-builder.tsx
    ├── rule-card.tsx
    └── execution-log.tsx
```

---

## External Dependencies

| Service | Purpose | Cost | Alternative |
|---------|---------|------|-------------|
| **Covalent** | Historical balances | Free tier: 100k credits/mo | Alchemy, Moralis |
| **DeFi Llama** | Historical prices | Free | CoinGecko (rate limited) |
| **Tenderly** | TX simulation | $50/mo starter | eth_call (limited) |
| **1inch Fusion** | Swaps (MEV protected) | Free | 0x, Paraswap |
| **Li.Fi** | Bridging | Free | Socket, Jumper |
| **Gelato** | Automation (optional) | Pay per execution | Self-hosted keeper |

---

## Success Metrics

| Feature | Metric | Target | Status |
|---------|--------|--------|--------|
| Historical Portfolio | Time to load 30d chart | < 3 seconds | ACHIEVED (1-2s) |
| Historical Portfolio | Performance improvement | Significant | ACHIEVED (38s -> 1-2s) |
| Liquidation Monitor | Alert before liquidation | > 95% accuracy | NOT STARTED |
| Transaction Simulation | Simulation accuracy | > 99% match actual | NOT STARTED |
| Unified Actions | Successful transactions | > 98% success rate | NOT STARTED |
| Automation Rules | Rule trigger accuracy | > 99% correct triggers | NOT STARTED |

---

## Infrastructure Already in Place

These components were built during the historical feature work and benefit future features:

1. **The Graph Integration** (`src/server/adapters/graph/`)
   - Fast, indexed queries for Aave V3, Compound V3, Lido, EtherFi
   - Reduces RPC calls significantly
   - Makes liquidation data fetching trivial

2. **HyperSync** (`src/server/services/historical/hypersync.ts`)
   - Ultra-fast historical blockchain data
   - Useful for transaction history in automation features

3. **Redis Caching** (`src/server/lib/redis.ts`)
   - Production-ready caching infrastructure
   - Progress tracking for long-running operations

4. **DeFi Llama Integration** (`src/server/services/historical/defillama.ts`)
   - Historical price data
   - Yield/TVL data (already used elsewhere)
