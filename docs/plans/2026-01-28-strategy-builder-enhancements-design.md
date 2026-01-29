# Strategy Builder Enhancements Design

**Date:** 2026-01-28
**Status:** Approved
**Objective:** Gold-standard UX for portfolio-worthy DeFi strategy builder

## Overview

Four interconnected features that transform the strategy builder from functional to exceptional:

1. **Undo/Redo** - Safe experimentation with full history
2. **Smart Connections** - Auto-configure blocks on connect
3. **Value Propagation** - Real-time flow visualization
4. **Saved Loops** - User-created reusable block systems

---

## Feature 1: Undo/Redo System

### Architecture

Add history tracking to Zustand store:

```typescript
interface HistoryEntry {
  blocks: StrategyBlock[];
  edges: StrategyEdge[];
}

// Store additions
history: HistoryEntry[];        // Max 30 entries
historyIndex: number;           // Current position (-1 = no history)
canUndo: boolean;               // Computed
canRedo: boolean;               // Computed

// Actions
undo(): void;
redo(): void;
pushHistory(): void;            // Internal, called by mutating actions
```

### Keyboard Shortcuts

- `Ctrl+Z` - Undo
- `Ctrl+Y` or `Ctrl+Shift+Z` - Redo

### Tracked Actions

Push to history on:
- Add/remove/move blocks
- Add/remove edges
- Block configuration changes
- Paste operations
- Template/system placement

### Implementation Notes

- Only track `{ blocks, edges }`, not UI state (selection, panel open/closed)
- Deep clone state before pushing (avoid reference issues)
- Trim history when exceeding 30 entries (FIFO)
- Clear redo stack when new action is performed

---

## Feature 2: Smart Connections & Auto-Configure

### Connection Flow

When user connects Block A → Block B:

1. **Detect output** - Get output asset and computed value from source block
2. **Auto-configure** - Set target block's input asset to match
3. **Protocol selection** - If applicable, select best protocol for asset
4. **Toast feedback** - Brief "Auto-configured Stake for ETH" notification
5. **Simulate** - Run simulation, update all downstream values

### Asset Mapping

```typescript
const ASSET_COMPATIBILITY: Record<BlockType, AssetType[]> = {
  stake: ['ETH'],
  lend: ['ETH', 'eETH', 'weETH', 'stETH', 'USDC', 'DAI'],
  borrow: ['ETH', 'USDC', 'DAI'],
  swap: ['*'], // Any to any
};
```

### Validation

- Invalid connection: Red edge + shake animation
- Tooltip on hover: "Stake block requires ETH, but Swap outputs USDC"
- Allow connection but show warning state (user might add swap between)

### Store Changes

```typescript
// New action
autoConfigureBlock(blockId: string, incomingAsset: AssetType, incomingAmount: number): void;

// Called from addEdge after connection made
```

---

## Feature 3: Value Propagation Display

### On Edges

- **Flow label**: Asset + amount displayed mid-edge (e.g., "2.1 ETH")
- **Thickness scaling**: Edge stroke width scales with relative value
- **Color coding**:
  - Default: Purple (#735CFF)
  - Gain path: Green tint
  - Cost path (borrow): Amber tint
- **Animation**: Particles flowing along edge direction

### On Blocks

Input/output badges showing computed values:

```
┌─────────────────────────────┐
│  ↓ 2.1 ETH ($6,930)        │  ← Input badge
├─────────────────────────────┤
│                             │
│        STAKE                │
│       EtherFi               │
│                             │
├─────────────────────────────┤
│  ↓ 2.03 eETH ($6,699)      │  ← Output badge
└─────────────────────────────┘
         │
    (gas: $12)               ← Edge shows cost
```

### Computed Values Store

```typescript
interface ComputedBlockValue {
  inputAsset: AssetType;
  inputAmount: number;
  inputValueUsd: number;
  outputAsset: AssetType;
  outputAmount: number;
  outputValueUsd: number;
  gasCostUsd: number;
  apy: number;
}

// Store addition
blockComputedValues: Map<string, ComputedBlockValue>;

// Updated by simulation engine
setBlockComputedValues(values: Map<string, ComputedBlockValue>): void;
```

### Animation Details

- Numbers animate/count up when values change
- Brief green flash on increase, amber on decrease
- Skeleton shimmer while recalculating

---

## Feature 4: Saved Loops ("My Loops")

### User Flow

1. **Select blocks** - Shift+drag or Shift+click multiple blocks
2. **Action bar appears** - Floating toolbar slides in below selection
3. **Click "Save as Loop"** - Modal opens
4. **Name & save** - Enter name, optional description, save
5. **Appears in sidebar** - "My Loops" section shows new entry
6. **Drag to reuse** - Drag saved loop onto canvas, blocks expand

### Contextual Action Bar

Appears when 2+ blocks selected:

```
┌──────────────────────────────────────────────────┐
│  💾 Save as Loop  │  ⎘ Duplicate  │  🗑 Delete   │
└──────────────────────────────────────────────────┘
```

- Fades in with spring animation
- Positioned below selection bounding box
- Keyboard hints on hover

### Save Modal

```
┌─────────────────────────────────────────────────┐
│  Save as Reusable Loop                      ✕   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Name                                           │
│  ┌─────────────────────────────────────────┐   │
│  │ 2x Leverage Loop                        │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Description (optional)                         │
│  ┌─────────────────────────────────────────┐   │
│  │ Stake ETH, lend eETH, borrow ETH        │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Preview                                        │
│  ┌─────────────────────────────────────────┐   │
│  │  [Stake] → [Lend] → [Borrow]            │   │
│  │  3 blocks · ~6-8% APY                   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                          [Cancel]  [Save Loop]  │
└─────────────────────────────────────────────────┘
```

### Sidebar Section

```
┌──────────────────────────────────────┐
│  📦 MY LOOPS                    ▼    │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ 2x Leverage Loop          •••  │  │
│  │ 3 blocks · Stake→Lend→Borrow  │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Stablecoin Farm           •••  │  │
│  │ 2 blocks · Swap→Lend          │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  Empty state:                        │
│  "Select multiple blocks to save     │
│   as a reusable loop"                │
└──────────────────────────────────────┘
```

### Data Schema

```typescript
interface SavedSystem {
  id: string;
  name: string;
  description?: string;
  blocks: StrategyBlock[];   // Positions relative to first block
  edges: StrategyEdge[];
  createdAt: number;
  updatedAt: number;
}

// localStorage key: 'strategy-builder-saved-systems'
```

### Placement Logic

When dragging saved system onto canvas:

1. Generate new IDs for all blocks and edges
2. Calculate offset from drop position
3. Detect collision with existing blocks, offset if needed
4. Animate blocks "unfolding" from drop point
5. Auto-select all placed blocks
6. Push to history (single undo reverts entire placement)

---

## Implementation Order

### Phase 1: Undo/Redo (Foundation)
- Add history state to store
- Wrap mutating actions with pushHistory
- Add keyboard listeners
- Add undo/redo buttons to canvas controls

### Phase 2: Smart Connections
- Create autoConfigureBlock action
- Hook into addEdge flow
- Add toast notifications
- Add validation styling for invalid connections

### Phase 3: Value Propagation
- Extend simulation to return per-block values
- Create BlockValueBadge component
- Create EdgeValueLabel component
- Add value animations

### Phase 4: Saved Loops
- Create SelectionActionBar component
- Create SaveSystemModal component
- Add savedSystems to store with localStorage persistence
- Create MySystems sidebar section
- Implement drag-to-place with ID regeneration

---

## Success Metrics

- **Discoverability**: First-time user saves a loop within 5 minutes
- **Efficiency**: 50% fewer clicks to build leverage strategy
- **Delight**: Users screenshot/share their strategies
- **Polish**: No janky animations, everything feels intentional

---

## Files to Create/Modify

### New Files
- `src/components/strategy-builder/selection-action-bar.tsx`
- `src/components/strategy-builder/save-system-modal.tsx`
- `src/components/strategy-builder/block-value-badge.tsx`
- `src/components/strategy-builder/edge-value-label.tsx`
- `src/components/strategy-builder/my-systems.tsx`
- `src/lib/strategy/history.ts`
- `src/lib/strategy/saved-systems.ts`

### Modified Files
- `src/lib/strategy/store.ts` - History, computed values, saved systems
- `src/lib/strategy/simulation.ts` - Return per-block computed values
- `src/lib/strategy/types.ts` - New interfaces
- `src/components/strategy-builder/canvas.tsx` - Action bar, keyboard shortcuts
- `src/components/strategy-builder/sidebar.tsx` - My Loops section
- `src/components/strategy-builder/blocks/*.tsx` - Value badges
- `src/components/strategy-builder/edges/flow-edge.tsx` - Value labels
