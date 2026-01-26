# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OnChain Wealth is a DeFi portfolio tracking application for EtherFi. It reads positions from 8 protocols across 5 EVM chains, enriches them with prices, and displays historical portfolio value.

**Tech Stack:** Next.js 16, tRPC 11, Prisma 7, PostgreSQL, Redis, wagmi v3, viem v2

## Available Plugins

These Claude Code plugins are installed and should be used when appropriate:

| Plugin | Type | How to Use |
|--------|------|------------|
| **context7** | MCP | Direct tool calls to fetch up-to-date library documentation (e.g., Next.js, Prisma, viem docs) |
| **serena** | MCP | Semantic code analysis - find symbols, references, rename across codebase |
| **typescript-lsp** | LSP | Transparent TypeScript intelligence (types, completions, diagnostics) |
| **feature-dev** | Skill | Invoke with `/feature-dev` for guided feature development with architecture focus |
| **frontend-design** | Skill | Invoke with `/frontend-design` for production-grade UI components |
| **code-simplifier** | Agent | Use `Task` tool with `code-simplifier:code-simplifier` to refactor for clarity |
| **explanatory-output-style** | Behavior | Auto-applied - provides `★ Insight` educational boxes during work |

**When to use each:**
- **context7**: When unsure about library APIs or need current documentation
- **serena**: For refactoring, finding all usages of a function, or understanding symbol relationships
- **feature-dev**: For multi-step feature implementation with planning
- **frontend-design**: When building new UI components or pages
- **code-simplifier**: After implementing features, to clean up and simplify code

## Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run workers                # Start BullMQ background jobs (separate terminal)

# Database
npm run db:push                # Sync Prisma schema to database
npm run db:studio              # Open Prisma Studio GUI
npm run db:seed                # Seed with initial protocol/chain/token data

# Infrastructure
npm run services:up            # Start PostgreSQL + Redis via Docker
npm run services:down          # Stop Docker services

# Build & Lint
npm run build                  # Production build (runs TypeScript check)
npm run lint                   # ESLint
```

## Architecture

### Protocol Adapter Pattern

Each DeFi protocol has an adapter in `src/server/adapters/` implementing `ProtocolAdapter`:

```typescript
interface ProtocolAdapter {
  id: string;
  getPositions(walletAddress, chainId): Promise<Position[]>;
  supportsChain(chainId): boolean;
}
```

**Graph-Accelerated Adapters (Recommended)**

When `USE_GRAPH_ADAPTERS=true`, the registry uses The Graph subgraph queries for ~25x faster position loading:

| Adapter | Location | Performance |
|---------|----------|-------------|
| Aave V3 | `src/server/adapters/graph/adapters/aave-v3.ts` | ~100-500ms vs 3-8s RPC |
| Compound V3 | `src/server/adapters/graph/adapters/compound-v3.ts` | ~100-500ms vs 3-8s RPC |
| Lido | `src/server/adapters/graph/adapters/lido.ts` | ~100ms (mainnet Graph, L2 RPC) |
| EtherFi | `src/server/adapters/graph/adapters/etherfi.ts` | ~100ms (mainnet Graph, L2 RPC) |

Graph adapters automatically fall back to RPC on failure. RPC adapters in `src/server/adapters/*.ts` remain as fallbacks.

Adapters are registered in `src/server/adapters/registry.ts`. To add a new protocol:
1. Create adapter file implementing the interface
2. (Optional) Create Graph adapter in `graph/adapters/` for fast queries
3. Register in registry.ts
4. Add protocol to Prisma seed data

### Data Flow for Portfolio

```
Dashboard → usePortfolioHistory hook → tRPC history router
                                              ↓
                           src/server/services/historical/index.ts
                                              ↓
               ┌──────────────────────────────┴──────────────────────────────┐
               ↓                                                              ↓
    GoldRush API (token balances)                            Protocol Adapters (DeFi positions)
               ↓                                                              ↓
               └──────────────────────────────┬──────────────────────────────┘
                                              ↓
                              DeFi Llama API (historical prices)
                                              ↓
                                    Aggregate + interpolate gaps
                                              ↓
                                       Return to chart
```

### Key Services

| Service | Location | Purpose |
|---------|----------|---------|
| `portfolio.ts` | `src/server/services/` | Aggregates positions from adapters + GoldRush |
| `historical/index.ts` | `src/server/services/` | Reconstructs portfolio value over time |
| `price.ts` | `src/server/services/` | CoinGecko prices with Redis caching |
| `yields.ts` | `src/server/services/` | DeFi Llama yield data |

### tRPC Routers

All in `src/server/routers/`:
- `portfolio.ts` - getLivePortfolio, getPortfolio
- `history.ts` - getPortfolioHistory (public, reconstructs from APIs)
- `notification.ts` - alert rules and notifications
- `price.ts` - token prices
- `user.ts` - user preferences

### Authentication

SIWE (Sign-In with Ethereum) via `src/server/lib/siwe.ts`. Endpoints in `src/app/api/auth/`. Session stored in httpOnly cookies. For development, pass `x-wallet-address` header to bypass auth.

### Caching

- **Redis**: Portfolio data (30s TTL), yields (10min), historical (1hr-7d by timeframe)
- **In-memory**: Price data (1min)
- **React Query**: Client-side with configurable staleTime

Cache helpers in `src/server/lib/redis.ts`: `getFromCache()`, `setInCache()`, `invalidateCache()`

## Supported Chains & Protocols

**Chains:** Ethereum (1), Arbitrum (42161), Optimism (10), Base (8453), Polygon (137)

**Protocols:** Aave V3, Compound V3, Lido, EtherFi, EigenLayer, Morpho, Spark, Pendle

Chain/protocol constants in `src/lib/constants.ts`. Protocol metadata (names, logos) in `src/lib/protocol-metadata.ts`.

## External APIs

| API | Purpose | Rate Limits |
|-----|---------|-------------|
| **The Graph** | DeFi position queries | 100K queries/mo free |
| GoldRush (Covalent) | Token balances | 100k credits/mo free |
| DeFi Llama | Historical prices, yields | Free, generous |
| CoinGecko | Live prices | 50 calls/min free |

The Graph client in `src/server/adapters/graph/client.ts`. API clients in `src/server/services/`. Chain name mappings for GoldRush: `eth-mainnet`, `arbitrum-mainnet`, `optimism-mainnet`, `base-mainnet`, `matic-mainnet`.

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_ALCHEMY_RPC_ETHEREUM=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
COVALENT_API_KEY=...          # GoldRush
NEXTAUTH_SECRET=...           # For SIWE sessions

# The Graph (optional but recommended for 25x faster DeFi queries)
USE_GRAPH_ADAPTERS=true       # Enable Graph-accelerated adapters
GRAPH_API_KEY=...             # From https://thegraph.com/studio/apikeys/
```

## Important Patterns

### Hydration Safety
Next.js SSR requires `mounted` state pattern:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```

### Graceful Degradation
Adapters use `Promise.allSettled` - if one chain fails, others still return data. Price fetches log warnings but don't throw.

### Historical Data Interpolation
`src/server/services/historical/index.ts` handles gaps in price data. Values < 30% of median are treated as anomalies and interpolated.

## Documentation

- `ARCHITECTURE.md` - Detailed system design (65KB)
- `PROJECT_CONTEXT.md` - Current state and evolution
- `DECISIONS.md` - Architectural decision records
- `PHASE_2_3_PLAN.md` - Roadmap for liquidation risk, tx simulation, DeFi actions
