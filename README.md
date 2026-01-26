# OnChain Wealth

A high-performance DeFi portfolio tracker for EtherFi, aggregating positions from 8 protocols across 5 EVM chains with sub-second query times powered by The Graph.

## Key Features

- **The Graph Integration**: Sub-second DeFi position queries (~100-500ms) using decentralized subgraph indexing, replacing slow RPC calls (~3-8s) for a ~25x performance improvement
- **8 DeFi Protocols**: Aave V3, Compound V3, Lido, EtherFi, EigenLayer, Morpho, Spark, Pendle
- **5 EVM Chains**: Ethereum, Arbitrum, Optimism, Base, Polygon
- **Historical Portfolio Tracking**: Reconstruct portfolio value over time with DeFi Llama price data
- **Real-time Updates**: Live position monitoring with WebSocket support
- **SIWE Authentication**: Sign-In with Ethereum for secure wallet-based auth

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 16, React 19, TailwindCSS, shadcn/ui, Recharts |
| **Backend** | tRPC 11, Prisma 7, PostgreSQL, Redis, BullMQ |
| **Web3** | wagmi v3, viem v2, The Graph, SIWE |
| **APIs** | DeFi Llama (prices/yields), GoldRush (token balances), CoinGecko (live prices) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Dashboard (React)                                │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         tRPC API Layer                                    │
│    portfolio.ts │ history.ts │ price.ts │ notification.ts │ user.ts      │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
    ┌───────────────────────────┐   ┌───────────────────────────────────────┐
    │    Protocol Adapters      │   │         External APIs                 │
    │                           │   │                                       │
    │  ┌─────────────────────┐  │   │  GoldRush ─── Token Balances          │
    │  │   Graph Adapters    │  │   │  DeFi Llama ─ Historical Prices       │
    │  │   (Fast Mode)       │  │   │  CoinGecko ── Live Prices             │
    │  │   ~100-500ms        │  │   │                                       │
    │  └─────────────────────┘  │   └───────────────────────────────────────┘
    │           │               │
    │           ▼ fallback      │
    │  ┌─────────────────────┐  │
    │  │   RPC Adapters      │  │
    │  │   (Standard Mode)   │  │
    │  │   ~3-8 seconds      │  │
    │  └─────────────────────┘  │
    └───────────────────────────┘
```

### Protocol Adapters

Each DeFi protocol has an adapter implementing a common interface:

```typescript
interface ProtocolAdapter {
  id: string;
  getPositions(walletAddress, chainId): Promise<Position[]>;
  supportsChain(chainId): boolean;
}
```

When `USE_GRAPH_ADAPTERS=true`, the system uses The Graph subgraphs for indexed queries. Graph adapters automatically fall back to RPC if subgraph queries fail.

**Graph-accelerated protocols:** Aave V3, Compound V3, Lido, EtherFi
**RPC-only protocols:** Spark, EigenLayer, Morpho, Pendle

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL and Redis)
- Alchemy API key (for RPC endpoints)
- WalletConnect Project ID

### Installation

1. Clone and install dependencies:

```bash
git clone <repository-url>
cd onchain-wealth
npm install
```

2. Copy environment file and configure:

```bash
cp .env.example .env
```

3. Start infrastructure services:

```bash
npm run services:up    # Starts PostgreSQL + Redis via Docker
```

4. Initialize database:

```bash
npm run db:push        # Sync Prisma schema
npm run db:seed        # Seed initial data
```

5. Start development server:

```bash
npm run dev            # Next.js dev server on http://localhost:3000
```

For background job processing (optional):

```bash
npm run workers        # Start BullMQ workers in separate terminal
```

## Environment Variables

### Required

```bash
# Database
DATABASE_URL="postgresql://dev:dev@localhost:5433/onchain_wealth"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# RPC Providers (Alchemy)
NEXT_PUBLIC_ALCHEMY_RPC_MAINNET="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"
NEXT_PUBLIC_ALCHEMY_RPC_ARBITRUM="https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY"
NEXT_PUBLIC_ALCHEMY_RPC_OPTIMISM="https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY"
NEXT_PUBLIC_ALCHEMY_RPC_BASE="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"
NEXT_PUBLIC_ALCHEMY_RPC_POLYGON="https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-project-id"
```

### The Graph Integration (Recommended)

Enable high-performance Graph-based adapters for ~25x faster position loading:

```bash
# Enable Graph adapters (set to "true" to activate)
USE_GRAPH_ADAPTERS="true"

# The Graph API key - Get from https://thegraph.com/studio/
GRAPH_API_KEY="your-graph-api-key"
```

### Optional

```bash
# Historical Portfolio Data - GoldRush (formerly Covalent)
# Get your API key at https://goldrush.dev/
COVALENT_API_KEY="your-goldrush-api-key"

# Price Data
COINGECKO_API_KEY="your-coingecko-api-key"

# Transaction Simulation - Tenderly
TENDERLY_ACCESS_KEY="your-tenderly-access-key"
TENDERLY_ACCOUNT="your-tenderly-account"
TENDERLY_PROJECT="your-tenderly-project"

# Notifications
RESEND_API_KEY="your-resend-api-key"
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
```

## Available Scripts

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run workers                # Start BullMQ background jobs

# Database
npm run db:push                # Sync Prisma schema to database
npm run db:studio              # Open Prisma Studio GUI
npm run db:seed                # Seed with initial data

# Infrastructure
npm run services:up            # Start PostgreSQL + Redis (Docker)
npm run services:down          # Stop Docker services

# Build & Lint
npm run build                  # Production build
npm run lint                   # ESLint
```

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 1 | Full support |
| Arbitrum | 42161 | Full support |
| Optimism | 10 | Full support |
| Base | 8453 | Full support |
| Polygon | 137 | Full support |

## Supported Protocols

| Protocol | Chains | Graph Support |
|----------|--------|---------------|
| Aave V3 | All 5 chains | Yes |
| Compound V3 | ETH, ARB, BASE, POLYGON | Yes |
| Lido | Ethereum | Yes |
| EtherFi | Ethereum | Yes |
| EigenLayer | Ethereum | No (RPC) |
| Morpho | ETH, BASE | No (RPC) |
| Spark | Ethereum | No (RPC) |
| Pendle | ETH, ARB | No (RPC) |

## Development Notes

### Hydration Safety

Next.js SSR requires the mounted state pattern to avoid hydration mismatches:

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```

### Graceful Degradation

- Protocol adapters use `Promise.allSettled` - if one chain fails, others still return data
- Graph adapters automatically fall back to RPC on query failures
- Price fetches log warnings but don't throw

### Caching Strategy

| Data Type | Cache | TTL |
|-----------|-------|-----|
| Positions | Redis | 2 minutes |
| Prices | In-memory | 1 minute |
| Yields | Redis | 10 minutes |
| Historical | Redis | 1 hour - 7 days |

## Documentation

- `ARCHITECTURE.md` - Detailed system design
- `PROJECT_CONTEXT.md` - Current state and evolution
- `DECISIONS.md` - Architectural decision records
- `CLAUDE.md` - AI assistant guidance

## License

MIT
