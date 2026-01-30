# Smart Route UX Design

## Overview

Gold-standard UX for DeFi strategy building with automatic route optimization, visual token flow, and intelligent error handling.

## Target Users

Sophisticated DeFi users (EtherFi team, power users) who:
- Understand token wrapping/unwrapping
- Want transparency about transaction steps
- Expect professional-grade tooling

## Design Decisions

### 1. Auto-Insert Wrap Steps (P0)

**Approach: Visual but Automatic**

When a user connects incompatible protocols (e.g., EtherFi → Aave):
- System automatically inserts a small "wrap" node on the canvas
- Node is visually distinct (smaller, different color/style)
- Shows "eETH → weETH" transformation clearly
- User can click to see details but doesn't need to configure

**Token Compatibility Map:**
```
ETH ←→ WETH (wrapping)
eETH ←→ weETH (EtherFi wrap)
stETH ←→ wstETH (Lido wrap)
```

**Visual Treatment:**
- Auto-inserted nodes: Smaller, muted color, dashed border
- Badge: "Auto" indicator
- Tooltip: "Automatically added to convert eETH to weETH for Aave compatibility"

### 2. Visual Token Flow on Edges (P1)

Show token transformations directly on the canvas edges:
- Animated flow direction (dots moving along edge)
- Token symbols at source/target: `ETH → eETH`
- Amount display with percentage: `1.5 ETH (100%)`
- Color coding by asset type

### 3. Plain-English Simulation Errors (P1)

Transform technical errors into actionable guidance:

| Technical Error | User Message |
|-----------------|--------------|
| `ERC20: transfer amount exceeds balance` | "Insufficient weETH balance. EtherFi outputs eETH which needs to be wrapped first." |
| `execution reverted` | "Transaction would fail. Common causes: slippage too low, insufficient liquidity." |
| `insufficient funds for gas` | "Not enough ETH for gas fees. Estimated: 0.02 ETH needed." |

**Fix Suggestions:**
- Show one-click fix button when applicable
- "Add wrap step" → auto-inserts missing node

### 4. Pre-Simulation Validation (P2)

Validate before hitting Tenderly API:
- Check token compatibility between connected blocks
- Verify amounts flow correctly (outputs ≥ inputs)
- Validate protocol support for chains
- Show inline warnings on canvas

### 5. Approval Checking (P3)

Before simulation:
- Query existing token approvals on-chain
- Skip approval transactions if already approved
- Show "Approval Status" in preview: ✓ weETH approved, ⏳ USDC needs approval

### 6. Multicall Batching (P3)

For gas optimization:
- Group compatible transactions into multicall
- Show "Batched: 3 transactions → 1" indicator
- Estimate gas savings

## Implementation Phases

### Phase 1: Core Route Building (P0)
1. Create token compatibility registry
2. Build route optimizer that inserts wrap/unwrap steps
3. Add visual "auto" nodes to canvas
4. Update transaction builder to handle auto-nodes

### Phase 2: Visual Polish (P1)
1. Enhance edge rendering with token flow
2. Create error message mapping
3. Add fix suggestion system
4. Implement animated token flow

### Phase 3: Validation Layer (P2)
1. Pre-simulation validation rules
2. Inline warnings on canvas
3. Block connection validation

### Phase 4: Optimization (P3)
1. On-chain approval queries
2. Multicall integration
3. Gas estimation improvements

## File Changes

### New Files
- `src/lib/strategy/route-optimizer.ts` - Token compatibility and route building
- `src/lib/strategy/error-messages.ts` - Error translation and fix suggestions
- `src/components/strategy-builder/nodes/auto-wrap-node.tsx` - Visual auto-node

### Modified Files
- `src/lib/transactions/builder.ts` - Integrate route optimizer
- `src/components/strategy-builder/edges/flow-edge.tsx` - Enhanced token flow
- `src/components/strategy-builder/simulation-results.tsx` - Better error display
- `src/lib/strategy/store.ts` - Auto-node management
