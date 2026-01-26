# Strategy Builder UX Enhancements

## Overview

Upgrade the Strategy Builder to handle sophisticated DeFi strategies used by whales: leverage looping, partial allocations, and multi-path flows. Design philosophy: "Bloomberg Terminal meets Gaming" - powerful yet visually stunning.

## Feature 1: Smart Edge Flow Control

### Behavior
- **Default**: 100% of value flows to next block (current behavior)
- **On hover**: Edge shows flow amount (e.g., "→ 700 ETH")
- **On click**: Popover appears with allocation controls

### Edge Popover UI
```
┌─────────────────────────────┐
│  Flow Amount                │
│  ○ Percentage  ● Amount     │
│  ┌─────────────────────┐    │
│  │ 70              [%] │    │
│  └─────────────────────┘    │
│  = 700 ETH ($2.1M)          │
│                    [Apply]  │
└─────────────────────────────┘
```

### Data Model Changes
```typescript
// StrategyEdge additions
interface StrategyEdge {
  // ... existing fields
  flowType: "percentage" | "amount";
  flowValue: number; // percentage (0-100) or absolute amount
}
```

### Visual Treatment
- Edges show subtle flow label on hover
- Customized edges get a small indicator dot
- Animated dashed line shows "partial flow"

---

## Feature 2: Smart Loop Detection

### Behavior
1. User connects blocks normally: Stake → Lend → Borrow
2. User connects Borrow output back to Stake input (creating cycle)
3. System detects loop, shows visual indicator
4. User can set iteration count (default: 1)
5. Simulation calculates compounded results

### Loop Detection Algorithm
```typescript
function detectLoops(blocks, edges): Loop[] {
  // Find strongly connected components (Tarjan's algorithm)
  // Return array of loops with their block IDs
}
```

### Visual Treatment
- Looped blocks share a subtle glowing border (purple gradient)
- Floating badge appears near loop: "🔄 ×3"
- Badge shows effective leverage on hover
- Click badge to open Loop Settings panel

### Loop Settings Panel
```
┌────────────────────────────────────┐
│  ⟳ Leverage Loop                   │
├────────────────────────────────────┤
│  Iterations                        │
│  [1] [2] [3] [4] [5] [6+]         │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Iter │ Amount  │ Health     │  │
│  │  1   │ 1000 ETH│ ∞          │  │
│  │  2   │  700 ETH│ 1.43       │  │
│  │  3   │  490 ETH│ 1.22       │  │
│  │  4   │  343 ETH│ 1.12 ⚠️    │  │
│  │  5   │  240 ETH│ 1.06 🔴    │  │
│  └──────────────────────────────┘  │
│                                    │
│  Effective Leverage: 3.2x          │
│  Total Position: $8.2M             │
│  Liquidation Price: $2,847         │
│                                    │
│  ⚠️ High liquidation risk at 5     │
│     iterations. Consider ≤3.       │
└────────────────────────────────────┘
```

### Data Model Changes
```typescript
// New loop tracking in store
interface StrategyState {
  // ... existing
  loops: DetectedLoop[];
}

interface DetectedLoop {
  id: string;
  blockIds: string[];  // Blocks in this loop
  iterations: number;  // User-configured
  entryEdgeId: string; // Edge entering the loop
  exitEdgeId: string;  // Edge creating the cycle
}
```

---

## Feature 3: Multi-Output from Blocks

### Behavior
- User can drag multiple edges from a single block's output
- Each edge can have its own flow percentage
- Total must equal 100% (or system normalizes)

### Visual Treatment
- Output handle expands slightly when dragging second edge
- Shows "50% | 50%" split indicator
- Edges fan out with slight curve separation

---

## Implementation Order

### Phase 1: Edge Flow Display (Quick Win)
1. Add flow labels to edges (show on hover)
2. Calculate flow amounts in simulation
3. Style edges with flow indicators

### Phase 2: Edge Click-to-Edit
1. Create EdgePopover component
2. Add flowType/flowValue to edge data
3. Update simulation to use edge flow values

### Phase 3: Loop Detection
1. Implement cycle detection algorithm
2. Add loops[] to store
3. Create LoopBadge component
4. Visual treatment for looped blocks

### Phase 4: Loop Settings Panel
1. Create LoopSettingsPanel component
2. Iteration selector with preview table
3. Calculate per-iteration health factors
4. Risk warnings

### Phase 5: Multi-Output Support
1. Allow multiple edges from same source
2. Auto-split percentages
3. Normalization logic

---

## Files to Create/Modify

### New Files
- `src/components/strategy-builder/edge-popover.tsx`
- `src/components/strategy-builder/loop-badge.tsx`
- `src/components/strategy-builder/loop-settings-panel.tsx`
- `src/lib/strategy/loop-detection.ts`

### Modified Files
- `src/lib/strategy/types.ts` - Add edge flow fields, loop types
- `src/lib/strategy/store.ts` - Add loops state, loop actions
- `src/lib/strategy/simulation.ts` - Support edge flows, loop iterations
- `src/components/strategy-builder/canvas.tsx` - Custom edge rendering
- `src/app/strategies/page.tsx` - Loop settings panel integration

---

## Success Criteria

1. User can create a leverage loop in <30 seconds
2. System correctly calculates effective leverage and health factors
3. Visual design feels premium/gaming-inspired
4. No canvas clutter even with complex strategies
5. "Wow, it understood what I'm building" moment
