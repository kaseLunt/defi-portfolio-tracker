import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Seed Chains
  const chains = [
    {
      chainId: 1,
      name: "Ethereum",
      rpcUrl: "https://eth.llamarpc.com",
      explorerUrl: "https://etherscan.io",
    },
    {
      chainId: 42161,
      name: "Arbitrum",
      rpcUrl: "https://arbitrum.llamarpc.com",
      explorerUrl: "https://arbiscan.io",
    },
    {
      chainId: 10,
      name: "Optimism",
      rpcUrl: "https://optimism.llamarpc.com",
      explorerUrl: "https://optimistic.etherscan.io",
    },
    {
      chainId: 8453,
      name: "Base",
      rpcUrl: "https://base.llamarpc.com",
      explorerUrl: "https://basescan.org",
    },
    {
      chainId: 137,
      name: "Polygon",
      rpcUrl: "https://polygon.llamarpc.com",
      explorerUrl: "https://polygonscan.com",
    },
  ];

  for (const chain of chains) {
    await prisma.chain.upsert({
      where: { chainId: chain.chainId },
      update: chain,
      create: chain,
    });
  }
  console.log(`Seeded ${chains.length} chains`);

  // Seed Protocols
  const protocols = [
    {
      slug: "aave-v3",
      name: "Aave V3",
      category: "lending",
      websiteUrl: "https://aave.com",
      logoUrl: "https://cryptologos.cc/logos/aave-aave-logo.png",
      supportedChains: [1, 42161, 10, 8453, 137],
    },
    {
      slug: "lido",
      name: "Lido",
      category: "staking",
      websiteUrl: "https://lido.fi",
      logoUrl: "https://cryptologos.cc/logos/lido-dao-ldo-logo.png",
      supportedChains: [1],
    },
    {
      slug: "compound-v3",
      name: "Compound V3",
      category: "lending",
      websiteUrl: "https://compound.finance",
      logoUrl: "https://cryptologos.cc/logos/compound-comp-logo.png",
      supportedChains: [1, 42161, 8453, 137],
    },
    {
      slug: "uniswap-v3",
      name: "Uniswap V3",
      category: "dex",
      websiteUrl: "https://uniswap.org",
      logoUrl: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
      supportedChains: [1, 42161, 10, 8453, 137],
    },
    {
      slug: "etherfi",
      name: "Ether.fi",
      category: "staking",
      websiteUrl: "https://ether.fi",
      logoUrl: "https://app.ether.fi/images/logo.svg",
      supportedChains: [1],
    },
    {
      slug: "eigenlayer",
      name: "EigenLayer",
      category: "restaking",
      websiteUrl: "https://eigenlayer.xyz",
      logoUrl: "https://www.eigenlayer.xyz/logo.png",
      supportedChains: [1],
    },
    {
      slug: "curve",
      name: "Curve Finance",
      category: "dex",
      websiteUrl: "https://curve.fi",
      logoUrl: "https://cryptologos.cc/logos/curve-dao-token-crv-logo.png",
      supportedChains: [1, 42161, 10, 137],
    },
    {
      slug: "convex",
      name: "Convex Finance",
      category: "yield",
      websiteUrl: "https://convexfinance.com",
      logoUrl: "https://cryptologos.cc/logos/convex-finance-cvx-logo.png",
      supportedChains: [1],
    },
  ];

  for (const protocol of protocols) {
    await prisma.protocol.upsert({
      where: { slug: protocol.slug },
      update: protocol,
      create: protocol,
    });
  }
  console.log(`Seeded ${protocols.length} protocols`);

  // Seed common tokens for Ethereum mainnet
  const ethTokens = [
    {
      chainId: 1,
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      coingeckoId: "ethereum",
    },
    {
      chainId: 1,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      coingeckoId: "usd-coin",
    },
    {
      chainId: 1,
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      coingeckoId: "tether",
    },
    {
      chainId: 1,
      address: "0x6B175474E89094C44Da98b954EescdeCB5DE0001",
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
      coingeckoId: "dai",
    },
    {
      chainId: 1,
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      coingeckoId: "weth",
    },
    {
      chainId: 1,
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      decimals: 8,
      coingeckoId: "wrapped-bitcoin",
    },
    {
      chainId: 1,
      address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
      symbol: "stETH",
      name: "Lido Staked ETH",
      decimals: 18,
      coingeckoId: "staked-ether",
    },
    {
      chainId: 1,
      address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
      symbol: "cbETH",
      name: "Coinbase Wrapped Staked ETH",
      decimals: 18,
      coingeckoId: "coinbase-wrapped-staked-eth",
    },
    {
      chainId: 1,
      address: "0xfe0c30065B384F05761f15d0CC899D4F9F9Cc0eB",
      symbol: "eETH",
      name: "Ether.fi Staked ETH",
      decimals: 18,
      coingeckoId: "ether-fi-staked-eth",
    },
    {
      chainId: 1,
      address: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
      symbol: "weETH",
      name: "Wrapped eETH",
      decimals: 18,
      coingeckoId: "wrapped-eeth",
    },
  ];

  for (const token of ethTokens) {
    await prisma.token.upsert({
      where: {
        chainId_address: {
          chainId: token.chainId,
          address: token.address,
        },
      },
      update: token,
      create: token,
    });
  }
  console.log(`Seeded ${ethTokens.length} tokens`);

  console.log("Database seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
