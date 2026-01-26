# DeFi Strategy Builder - Design Document

## Overview

A visual drag-and-drop tool for building, simulating, and analyzing DeFi yield strategies. Users connect blocks representing DeFi primitives (stake, lend, borrow, swap) to create complex strategies, then see real-time simulations of projected returns and risks.

**Goal**: Portfolio-quality feature demonstrating frontend excellence, DeFi domain expertise, and product thinking.

---

## User Experience

### Flow
1. User lands on `/strategies` page
2. Sees pre-built templates OR starts with blank canvas
3. Drags blocks from sidebar onto canvas
4. Connects blocks to create asset flow
5. Simulation runs automatically as they build
6. Results panel shows: APY, risk level, gas costs, projections
7. Can save, share, or (future) execute strategy

### Key Interactions
- **Drag from sidebar** → Block appears on canvas
- **Connect blocks** → Draw edge between output/input handles
- **Click block** → Opens configuration panel (amount, protocol choice, parameters)
- **Invalid connection** → Visual feedback (red, shake)
- **Hover on edge** → Shows asset flow ("10 eETH")

---

## Architecture

### Directory Structure
```
src/
├── app/strategies/
│   └── page.tsx                    # Main strategy builder page
├── components/strategy-builder/
│   ├── canvas.tsx                  # React Flow canvas wrapper
│   ├── sidebar.tsx                 # Block palette sidebar
│   ├── results-panel.tsx           # Simulation results display
│   ├── block-config-panel.tsx      # Selected block configuration
│   ├── blocks/
│   │   ├── base-block.tsx          # Base block component
│   │   ├── input-block.tsx         # Starting capital
│   │   ├── stake-block.tsx         # LST staking (Lido, EtherFi, etc)
│   │   ├── lend-block.tsx          # Lending (Aave, Compound, Morpho)
│   │   ├── borrow-block.tsx        # Borrowing against collateral
│   │   ├── swap-block.tsx          # DEX swaps
│   │   ├── lp-block.tsx            # Liquidity provision
│   │   └── loop-block.tsx          # Leverage loop modifier
│   └── edges/
│       └── asset-edge.tsx          # Custom edge with asset label
├── lib/strategy/
│   ├── types.ts                    # Strategy, Block, Edge types
│   ├── simulation.ts               # Simulation engine
│   ├── risk-analysis.ts            # Risk calculations
│   ├── protocols.ts                # Protocol definitions & rates
│   └── templates.ts                # Pre-built strategy templates
└── server/routers/
    └── strategy.ts                 # tRPC router for yields/rates
```

### Tech Stack
- **React Flow (@xyflow/react)** - Node-based canvas
- **Zustand** - Strategy state management
- **Framer Motion** - Animations
- **DefiLlama API** - Live protocol yields
- **tRPC** - Backend data fetching

---

## Block Definitions

### Input Block
```typescript
{
  type: 'input',
  data: {
    asset: 'ETH' | 'USDC' | 'USDT' | 'DAI',
    amount: number,
  },
  outputs: ['asset'] // Single output handle
}
```

### Stake Block
```typescript
{
  type: 'stake',
  data: {
    protocol: 'lido' | 'etherfi' | 'rocketpool' | 'frax' | 'coinbase',
    inputAsset: string,   // Computed from connection
    outputAsset: string,  // e.g., 'stETH', 'eETH'
    apy: number,          // Fetched from DefiLlama
  },
  inputs: ['asset'],
  outputs: ['asset']
}
```

### Lend Block
```typescript
{
  type: 'lend',
  data: {
    protocol: 'aave-v3' | 'compound-v3' | 'morpho' | 'spark',
    chain: number,
    supplyApy: number,    // Fetched
    maxLtv: number,       // For borrow calculations
    liquidationThreshold: number,
  },
  inputs: ['collateral'],
  outputs: ['position']   // Can connect to borrow block
}
```

### Borrow Block
```typescript
{
  type: 'borrow',
  data: {
    asset: 'ETH' | 'USDC' | 'USDT' | 'DAI',
    ltvPercent: number,   // User configurable (e.g., 75%)
    borrowApy: number,    // Fetched (negative yield)
  },
  inputs: ['position'],   // From lend block
  outputs: ['asset']
}
```

### Swap Block
```typescript
{
  type: 'swap',
  data: {
    fromAsset: string,
    toAsset: string,
    slippage: number,     // Default 0.5%
    estimatedOutput: number,
  },
  inputs: ['asset'],
  outputs: ['asset']
}
```

### Loop Block (Modifier)
```typescript
{
  type: 'loop',
  data: {
    iterations: number,   // 2-5x leverage
    targetLtv: number,
  },
  inputs: ['strategy'],   // Wraps a sub-strategy
  outputs: ['position']
}
```

---

## Simulation Engine

### Core Algorithm
```typescript
interface SimulationResult {
  // Yields
  grossApy: number;           // Before costs
  netApy: number;             // After costs

  // Projections
  projectedValue1Y: number;
  projectedYield1Y: number;

  // Costs
  gasCostUsd: number;
  protocolFees: number;

  // Risk metrics
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  liquidationPrice: number | null;
  healthFactor: number | null;
  maxDrawdown: number;

  // Breakdown
  yieldSources: Array<{
    protocol: string;
    apy: number;
    weight: number;
  }>;
}

function simulate(strategy: Strategy): SimulationResult {
  // 1. Topologically sort blocks (DAG)
  // 2. Walk through blocks, computing outputs
  // 3. Accumulate APYs (positive for yields, negative for borrows)
  // 4. Calculate risk metrics based on leverage
  // 5. Return aggregated result
}
```

### Risk Scoring
| Factor | Weight | Calculation |
|--------|--------|-------------|
| Leverage | 30% | >2x = medium, >3x = high, >4x = extreme |
| Protocol risk | 25% | Based on TVL, audit status, age |
| Liquidation buffer | 25% | Distance from liquidation price |
| Complexity | 20% | Number of blocks, protocols involved |

---

## Protocol Data Integration

### DefiLlama Yields API
```typescript
// GET https://yields.llama.fi/pools
// Filter for relevant pools, cache for 10 minutes

interface ProtocolYield {
  protocol: string;
  chain: string;
  asset: string;
  supplyApy: number;
  borrowApy: number;
  tvl: number;
  ltv: number;
}

// Pre-mapped protocol configs
const PROTOCOLS = {
  'lido': { yields: 'lido:steth', assets: ['stETH', 'wstETH'] },
  'etherfi': { yields: 'ether.fi-stake:weeth', assets: ['eETH', 'weETH'] },
  'aave-v3': { yields: 'aave-v3:...', markets: [...] },
  // etc.
}
```

### Supported Protocols (MVP)

**Staking (LSTs)**
- Lido (stETH/wstETH)
- EtherFi (eETH/weETH)
- RocketPool (rETH)
- Frax (sfrxETH)
- Coinbase (cbETH)

**Lending**
- Aave V3
- Compound V3
- Morpho
- Spark

**Swaps**
- Abstracted (assume 1inch routing, 0.3% fee)

---

## UI Design

### Color Palette (Dark Theme)
```css
--canvas-bg: #0a0a0f;
--block-bg: #12121a;
--block-border: rgba(255,255,255,0.1);
--block-selected: #735CFF;
--edge-default: #3f3f46;
--edge-active: #735CFF;
--success: #22C55E;
--warning: #F59E0B;
--danger: #EF4444;
```

### Block Visual Design
- Rounded rectangle with subtle gradient
- Icon + title at top
- Key metrics in body
- Input handles on left, output handles on right
- Glow effect when selected
- Color-coded by category:
  - Input: Blue
  - Stake: Purple (EtherFi brand)
  - Lend: Green
  - Borrow: Orange
  - Swap: Cyan

### Results Panel
- Fixed to bottom or right side
- Expandable/collapsible
- Key metrics in large text
- Risk gauge visualization
- Yield breakdown chart
- Projection chart (1M, 3M, 1Y)

---

## Pre-built Templates

### 1. Conservative LST
- Input: ETH → Stake: EtherFi → Done
- APY: ~3%
- Risk: Low

### 2. LST + Lending
- Input: ETH → Stake: EtherFi → Lend: Aave
- APY: ~4-5%
- Risk: Low

### 3. Leveraged LST (2x)
- Input: ETH → Stake: EtherFi → Lend: Aave → Borrow: ETH → Stake: EtherFi → Lend: Aave
- APY: ~6-8%
- Risk: Medium

### 4. Points Maximizer
- Input: ETH → Stake: EtherFi → Restake: EigenLayer
- APY: ~3% + points
- Risk: Medium

### 5. Stablecoin Yield
- Input: USDC → Lend: Morpho
- APY: ~5-8%
- Risk: Low

---

## Implementation Phases

### Phase 1: Canvas & Blocks (Day 1-2)
- [ ] Set up React Flow with custom theme
- [ ] Create base block component
- [ ] Implement Input, Stake, Lend blocks
- [ ] Basic connection validation
- [ ] Sidebar with draggable blocks

### Phase 2: Simulation (Day 2-3)
- [ ] Build simulation engine
- [ ] Integrate DefiLlama yields
- [ ] Create results panel
- [ ] Live simulation updates

### Phase 3: Risk & Polish (Day 3-4)
- [ ] Risk analysis calculations
- [ ] Borrow block with liquidation warnings
- [ ] Add Swap block
- [ ] Pre-built templates

### Phase 4: UX Excellence (Day 4-5)
- [ ] Animations (Framer Motion)
- [ ] Block configuration panel
- [ ] Mobile responsiveness
- [ ] Error states, loading states
- [ ] Keyboard shortcuts

---

## Success Criteria

1. **Functional**: Can build and simulate a 3-block strategy
2. **Accurate**: Yields within 10% of actual protocol rates
3. **Beautiful**: Smooth animations, polished UI, distinctive design
4. **Educational**: Helps users understand DeFi strategy mechanics
5. **Impressive**: Makes hiring managers say "we need this person"

---

## Future Enhancements (Post-MVP)

- Transaction execution via wallet
- Save/load strategies to database
- Share strategies via URL
- Historical backtesting
- More block types (LP, restaking, bridging)
- Multi-chain support
- Mobile app
