# EtherFi Insights Feature Design

**Goal:** Impress EtherFi engineering team with a dedicated EtherFi experience that showcases deep protocol understanding and production-grade DeFi engineering.

**Date:** 2025-01-23

---

## Overview

Two components:
1. **Dashboard Card** - "EtherFi Insights" teaser on main dashboard
2. **Dedicated Page** - Full `/etherfi` analytics + staking UI

Visual style: Gaming-inspired with animated tier badges, glow effects, and micro-interactions.

---

## Data Sources

### The Graph Subgraph
- **ID:** `4xkDLEfEpWo5XJ9x8mYjBwKDKHMAPbRdqm1j2fXYhF2A`
- **Network:** Ethereum Mainnet

### Available Entities

| Entity | User Data | Protocol Data | Fields |
|--------|-----------|---------------|--------|
| **MembershipNFT** | ✅ | | tier, loyaltyPoints, tierPoints, amount, status, owner |
| **EarlyAdopter** | ✅ | | amount, points, status, depositTime, migrationDepositAmount |
| **Validator** | ✅ | ✅ | phase, stakerAddress, restaked, isSoloStaker, validatorPubKey, sourceOfFunds, BNFTHolder, TNFTHolder |
| **Account** | ✅ | | id (address), stakedAmount |
| **Referral** | ✅ | | stakedAmount, points |
| **Tnft** | ✅ | | id, owner, validator, isBurned |
| **Bnft** | ✅ | | id, owner, validator, isBurned |
| **WithdrawRequestNFT** | ✅ | | amountOfEEth, shareOfEEth, fee, owner, isClaimed |
| **RebaseEvent** | | ✅ | timestamp, APR data (7-day history) |
| **Bid** | | ✅ | amount, status, bidderAddress, pubKeyIndex |
| **RegisteredNodeOperator** | | ✅ | address, totalKeys, keysUsed, ipfsHash |

### Smart Contracts (for staking UI)
| Contract | Address | Purpose |
|----------|---------|---------|
| LiquidityPool | `0x308861A430be4cce5502d0A12724771Fc6DaF216` | Stake ETH → eETH |
| eETH | `0x35fA164735182de50811E8e2E824cFb9B6118ac2` | Rebasing LST |
| weETH | `0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee` | Wrapped eETH |
| MembershipNFT | `0x7623e9DC0DA6FF821ddb9EbABA794054E078f8c4` | Loyalty NFT |

---

## Component 1: Dashboard Card

### Location
Main dashboard, after stat cards row, before the chart. Full-width on mobile, alongside chain distribution on desktop.

### Content (User Has Positions)

```
┌─────────────────────────────────────────────────────────────────┐
│  ✦ ETHER.FI                                      View All →    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌────────────┐                                                │
│   │   ◆ GOLD   │    12,450 loyalty points                      │
│   │    TIER    │    ████████████░░░░░░ 2,550 to Platinum       │
│   └────────────┘                                                │
│                                                                 │
│   weETH Balance       Restaking        Daily Yield    APY      │
│   2.45 weETH          ✓ Active         $0.42          3.2%     │
│   $8,124              EigenLayer                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Content (No Positions - Empty State)

```
┌─────────────────────────────────────────────────────────────────┐
│  ✦ ETHER.FI                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Stake ETH. Earn More.                                        │
│                                                                 │
│   • 3.2% APY on staked ETH                                     │
│   • Earn EigenLayer points                                     │
│   • Unlock loyalty rewards                                     │
│                                                                 │
│   [Stake ETH] ←── Primary CTA (opens staking modal)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Interactions
- Tier badge pulses with EtherFi purple (#735CFF) glow
- Progress bar animates on load (fills from 0 to current)
- Card has `hover-lift` effect
- Click anywhere navigates to `/etherfi`
- "View All →" link in header

---

## Component 2: `/etherfi` Page

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                         HERO SECTION                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │      [Giant Animated Tier Badge]                         │  │
│  │              ◆ GOLD TIER                                 │  │
│  │                                                          │  │
│  │   12,450 Loyalty Points    8,200 Tier Points            │  │
│  │   ████████████░░░░░░ 2,550 to Platinum                  │  │
│  │                                                          │  │
│  │   [Early Adopter Badge]  [Restaking Active Badge]       │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      STAKING ACTIONS                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   [Stake]  [Wrap]  [Unwrap]  ←── Tab navigation         │  │
│  │                                                          │  │
│  │   Amount: [___________] ETH        Balance: 1.5 ETH     │  │
│  │                                                          │  │
│  │   You'll receive: ~1.0 eETH                             │  │
│  │   Exchange rate: 1 ETH = 1.0 eETH                       │  │
│  │   Gas estimate: ~$6.50                                  │  │
│  │                                                          │  │
│  │   [Stake ETH] ←── Full-width primary button             │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│       YOUR HOLDINGS          │  │      PROTOCOL STATS          │
├──────────────────────────────┤  ├──────────────────────────────┤
│                              │  │                              │
│  eETH    0.5 eETH   $1,650  │  │  Total Value Locked          │
│  weETH   2.45 weETH $8,124  │  │  $9.2B                       │
│  ─────────────────────────  │  │                              │
│  Total         $9,774       │  │  Active Validators           │
│                              │  │  12,847                      │
│  Daily Yield   $0.86        │  │                              │
│  Annual Yield  $312         │  │  Total Stakers               │
│                              │  │  24,592                      │
│                              │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘

┌──────────────────────────────┐  ┌──────────────────────────────┐
│       APY HISTORY            │  │      POINTS HISTORY          │
├──────────────────────────────┤  ├──────────────────────────────┤
│                              │  │                              │
│   [Chart: 7d/30d/90d]        │  │   [Chart: 30d/90d/All]       │
│                              │  │                              │
│   ~~~~~/\~~~~~/\~~~~~        │  │   ___________/‾‾‾‾‾‾‾        │
│                              │  │                              │
│   Current: 3.2% APY          │  │   Total: 12,450 pts          │
│   7d Avg:  3.1% APY          │  │   This month: +2,100 pts     │
│                              │  │                              │
└──────────────────────────────┘  └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      REFERRAL PROGRAM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Your Referrals                                                │
│   ──────────────                                                │
│   Total Referred: 5.2 ETH staked                               │
│   Referral Points: 1,200 pts                                   │
│                                                                 │
│   Share your link: [https://ether.fi/ref/0x...] [Copy]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      T-NFT GALLERY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Your Staking NFTs (T-NFTs)                                   │
│                                                                 │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                        │
│   │  T-NFT  │  │  T-NFT  │  │  T-NFT  │                        │
│   │  #1234  │  │  #1235  │  │  #1236  │                        │
│   │  32 ETH │  │  32 ETH │  │  32 ETH │                        │
│   │  LIVE   │  │  LIVE   │  │ PENDING │                        │
│   └─────────┘  └─────────┘  └─────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   PENDING WITHDRAWALS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Request #4521                                                │
│   Amount: 1.5 eETH ($4,950)                                    │
│   Status: Processing (est. 2 days)                             │
│   [Claim] ←── Enabled when ready                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   VALIDATOR STATUS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Your Validators (if node operator)                           │
│                                                                 │
│   Phase Breakdown:                                              │
│   ● LIVE          3 validators   ████████████████              │
│   ● PENDING       1 validator    ████                          │
│   ● EXITED        0 validators                                 │
│                                                                 │
│   Restaked: 3/4 (EigenLayer active)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Section Visibility Logic

| Section | Show When |
|---------|-----------|
| Hero (Tier) | User has MembershipNFT |
| Staking Actions | Always (main CTA) |
| Your Holdings | User has eETH or weETH |
| Protocol Stats | Always |
| APY History | Always (protocol data) |
| Points History | User has MembershipNFT |
| Referral Program | User has Referral data |
| T-NFT Gallery | User has Tnft records |
| Pending Withdrawals | User has unclaimed WithdrawRequestNFT |
| Validator Status | User has Validator records |
| Early Adopter Badge | User has EarlyAdopter record |

### Empty State (No Positions)
Show staking panel prominently with benefits:
- "Stake ETH to unlock your EtherFi journey"
- List benefits: APY, EigenLayer points, Loyalty tiers
- Protocol stats still visible (shows TVL, validators)

---

## Staking UI Details

### Tabs
1. **Stake** - ETH → eETH (via LiquidityPool.deposit)
2. **Wrap** - eETH → weETH (via WeETH.wrap)
3. **Unwrap** - weETH → eETH (via WeETH.unwrap)

### Transaction Flow States

```
IDLE → SIMULATING → READY → CONFIRMING → PENDING → SUCCESS
                                              ↓
                                           ERROR
```

| State | UI |
|-------|-----|
| **Idle** | Input enabled, button says "Stake ETH" |
| **Simulating** | Button shows spinner + "Calculating..." |
| **Ready** | Shows quote, gas estimate, button enabled |
| **Confirming** | Button says "Confirm in Wallet", wallet popup open |
| **Pending** | Spinner, "Transaction Pending", etherscan link |
| **Success** | Confetti animation, new balance shown, "Stake More" button |
| **Error** | Red state, error message, "Try Again" button |

### Input Validation
- Max button sets to full balance (minus gas buffer for ETH)
- Minimum stake: 0.01 ETH
- Show warning if balance insufficient
- Disable button until valid amount entered

---

## Technical Architecture

### New Files

```
src/
├── app/etherfi/
│   └── page.tsx                      # Main /etherfi page
├── components/etherfi/
│   ├── etherfi-insights-card.tsx     # Dashboard card
│   ├── tier-badge.tsx                # Animated tier display
│   ├── tier-progress.tsx             # Progress bar to next tier
│   ├── points-chart.tsx              # Points history chart
│   ├── apy-chart.tsx                 # APY history chart
│   ├── staking-panel.tsx             # Stake/Wrap/Unwrap UI
│   ├── holdings-display.tsx          # eETH/weETH balances
│   ├── protocol-stats.tsx            # TVL, validators, stakers
│   ├── referral-card.tsx             # Referral program stats
│   ├── tnft-gallery.tsx              # T-NFT display
│   ├── withdrawal-requests.tsx       # Pending withdrawals
│   ├── validator-status.tsx          # Validator phase breakdown
│   ├── early-adopter-badge.tsx       # Special OG badge
│   └── empty-state.tsx               # No positions CTA
├── server/
│   ├── routers/etherfi.ts            # tRPC router
│   └── services/etherfi-graph.ts     # Graph query service
├── hooks/
│   ├── use-etherfi-membership.ts     # Fetch tier/points
│   ├── use-etherfi-protocol.ts       # Fetch protocol stats
│   ├── use-etherfi-staking.ts        # Staking transactions
│   ├── use-etherfi-history.ts        # Points/APY history
│   └── use-etherfi-user.ts           # All user data combined
└── lib/
    ├── etherfi-contracts.ts          # ABIs + addresses
    └── etherfi-constants.ts          # Tier thresholds, colors
```

### tRPC Router Endpoints

```typescript
// src/server/routers/etherfi.ts

etherfi: {
  // User-specific data
  getMembership: (walletAddress) => { tier, loyaltyPoints, tierPoints, nextTierThreshold }
  getEarlyAdopter: (walletAddress) => { isEarlyAdopter, amount, points, depositTime }
  getReferrals: (walletAddress) => { totalStaked, points }
  getTnfts: (walletAddress) => [{ id, validatorPubKey, phase, restaked }]
  getWithdrawals: (walletAddress) => [{ id, amount, fee, isClaimed }]
  getValidators: (walletAddress) => { byPhase: { LIVE, PENDING, EXITED }, restaked }
  getPointsHistory: (walletAddress, timeframe) => [{ timestamp, points }]

  // Protocol-level data
  getProtocolStats: () => { tvl, totalValidators, totalStakers, currentApy }
  getApyHistory: (timeframe) => [{ timestamp, apy }]
}
```

### Graph Queries

```graphql
# User membership
query GetMembership($user: String!) {
  membershipNFTs(where: { owner: $user, status: MINTED }, first: 1) {
    id
    tier
    loyaltyPoints
    tierPoints
    amount
  }
}

# Early adopter status
query GetEarlyAdopter($user: String!) {
  earlyAdopters(where: { id: $user }) {
    id
    amount
    points
    status
    depositTime
  }
}

# User's T-NFTs
query GetTnfts($user: String!) {
  tnfts(where: { owner: $user, isBurned: false }) {
    id
    validator {
      validatorPubKey
      phase
      restaked
    }
  }
}

# Pending withdrawals
query GetWithdrawals($user: String!) {
  withdrawRequestNFTs(where: { owner: $user, isClaimed: false }) {
    id
    amountOfEEth
    shareOfEEth
    fee
  }
}

# User referrals
query GetReferrals($user: String!) {
  referrals(where: { id: $user }) {
    stakedAmount
    points
  }
}

# Protocol stats
query GetProtocolStats {
  validators(first: 1000) {
    phase
  }
  accounts(first: 1000) {
    stakedAmount
  }
}

# APY history from rebase events
query GetRebaseEvents($since: BigInt!) {
  rebaseEvents(
    where: { timestamp_gte: $since }
    orderBy: timestamp
    orderDirection: asc
  ) {
    id
    timestamp
    # APR fields from the event
  }
}
```

### Contract ABIs (minimal)

```typescript
// src/lib/etherfi-contracts.ts

export const ETHERFI_CONTRACTS = {
  liquidityPool: {
    address: '0x308861A430be4cce5502d0A12724771Fc6DaF216',
    abi: [
      'function deposit() external payable returns (uint256)',
      'function deposit(address _referral) external payable returns (uint256)',
    ],
  },
  weETH: {
    address: '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
    abi: [
      'function wrap(uint256 _eETHAmount) external returns (uint256)',
      'function unwrap(uint256 _weETHAmount) external returns (uint256)',
      'function getEETHByWeETH(uint256 _weETHAmount) external view returns (uint256)',
      'function getWeETHByeETH(uint256 _eETHAmount) external view returns (uint256)',
    ],
  },
  eETH: {
    address: '0x35fA164735182de50811E8e2E824cFb9B6118ac2',
    abi: [
      'function balanceOf(address account) external view returns (uint256)',
      'function approve(address spender, uint256 amount) external returns (bool)',
    ],
  },
} as const;
```

### Constants

```typescript
// src/lib/etherfi-constants.ts

export const ETHERFI_TIERS = {
  0: { name: 'Bronze', color: '#CD7F32', glowColor: '#CD7F3240', minPoints: 0 },
  1: { name: 'Silver', color: '#C0C0C0', glowColor: '#C0C0C040', minPoints: 5000 },
  2: { name: 'Gold', color: '#FFD700', glowColor: '#FFD70040', minPoints: 15000 },
  3: { name: 'Platinum', color: '#E5E4E2', glowColor: '#E5E4E240', minPoints: 50000 },
} as const;

export const ETHERFI_BRAND = {
  primary: '#735CFF',
  primaryGlow: '#735CFF40',
  gradient: 'linear-gradient(135deg, #735CFF 0%, #5B3FD9 100%)',
} as const;

export const VALIDATOR_PHASES = {
  NOT_INITIALIZED: { label: 'Not Initialized', color: '#6B7280' },
  STAKE_DEPOSITED: { label: 'Pending', color: '#F59E0B' },
  LIVE: { label: 'Active', color: '#22C55E' },
  EXITED: { label: 'Exited', color: '#EF4444' },
  CANCELLED: { label: 'Cancelled', color: '#6B7280' },
} as const;
```

---

## Visual Design System

### Color Palette
- **Primary:** EtherFi Purple `#735CFF`
- **Tier Bronze:** `#CD7F32`
- **Tier Silver:** `#C0C0C0`
- **Tier Gold:** `#FFD700`
- **Tier Platinum:** `#E5E4E2` (with shimmer effect)

### Animations
- **Tier badge:** Subtle pulse glow (2s infinite)
- **Progress bar:** Fill animation on load (0.8s ease-out)
- **Points counter:** Count-up animation when data loads
- **Success state:** Confetti particles (use canvas-confetti)
- **Card hover:** Lift + glow intensify

### Typography
- Tier name: `font-display` (bold, uppercase)
- Points: `tabular-nums` for alignment
- Stats: `font-mono` for numbers

---

## Implementation Order

### Phase 1: Core Infrastructure
1. [ ] Create `/app/etherfi/page.tsx` with basic layout
2. [ ] Create `src/server/services/etherfi-graph.ts` with queries
3. [ ] Create `src/server/routers/etherfi.ts` tRPC router
4. [ ] Add router to main app router
5. [ ] Create `src/lib/etherfi-contracts.ts` and constants

### Phase 2: Dashboard Card
6. [ ] Create `etherfi-insights-card.tsx`
7. [ ] Create `tier-badge.tsx` with animations
8. [ ] Add card to dashboard page
9. [ ] Implement empty state

### Phase 3: /etherfi Page - User Data
10. [ ] Create hero section with giant tier badge
11. [ ] Create holdings display component
12. [ ] Create points history chart
13. [ ] Create staking panel (UI only)

### Phase 4: Staking Integration
14. [ ] Create wagmi hooks for staking
15. [ ] Implement stake flow with simulation
16. [ ] Implement wrap/unwrap flows
17. [ ] Add transaction states and success animation

### Phase 5: Additional Features
18. [ ] Protocol stats component
19. [ ] APY history chart
20. [ ] Referral card
21. [ ] T-NFT gallery
22. [ ] Pending withdrawals
23. [ ] Validator status

### Phase 6: Polish
24. [ ] Animations and micro-interactions
25. [ ] Loading skeletons
26. [ ] Error states
27. [ ] Mobile responsiveness
28. [ ] Performance optimization

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Staking works end-to-end | User can stake ETH and receive eETH |
| Tier badge looks premium | Gaming-inspired with animations |
| Data loads fast | < 2s for all Graph queries |
| Empty state converts | Clear CTA to start staking |
| Code is clean | Reusable components, typed, documented |
| Mobile works | Fully responsive design |

---

## Demo Script

For presenting to EtherFi:

1. **Open dashboard** - Show EtherFi card with tier badge
2. **Click into /etherfi** - Show full analytics page
3. **Highlight tier system** - "I integrated your MembershipNFT data"
4. **Show points history** - "Historical data from your subgraph"
5. **Demo staking** - Actually stake a small amount of ETH
6. **Show transaction flow** - Simulation, confirmation, success
7. **Protocol stats** - "Also pulling aggregate protocol data"

Key talking points:
- "Built with production-grade patterns"
- "Integrated your subgraph deeply"
- "Actually executes transactions, not just a dashboard"
- "Gamification makes staking engaging"
