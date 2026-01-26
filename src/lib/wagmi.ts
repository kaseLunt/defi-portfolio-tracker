import { http, createConfig, fallback } from "wagmi";
import { mainnet, arbitrum, optimism, base, polygon } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

// WalletConnect project ID - get from https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

// Build Alchemy RPC URLs from API key if available
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const alchemyRpcs = alchemyKey
  ? {
      mainnet: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      optimism: `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      base: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
      polygon: `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    }
  : null;

// Fast public RPCs as fallbacks (Ankr is generally faster than llamarpc)
const publicRpcs = {
  mainnet: ["https://rpc.ankr.com/eth", "https://eth.llamarpc.com", "https://cloudflare-eth.com"],
  arbitrum: ["https://rpc.ankr.com/arbitrum", "https://arbitrum.llamarpc.com"],
  optimism: ["https://rpc.ankr.com/optimism", "https://optimism.llamarpc.com"],
  base: ["https://rpc.ankr.com/base", "https://base.llamarpc.com"],
  polygon: ["https://rpc.ankr.com/polygon", "https://polygon.llamarpc.com"],
};

// Create transport with fallback for reliability
function createTransport(chain: keyof typeof publicRpcs) {
  const urls = [
    process.env[`NEXT_PUBLIC_ALCHEMY_RPC_${chain.toUpperCase()}`],
    alchemyRpcs?.[chain],
    ...publicRpcs[chain],
  ].filter(Boolean) as string[];

  // Use fallback transport for reliability
  return fallback(urls.map((url) => http(url, { timeout: 10_000 })));
}

export const config = createConfig({
  chains: [mainnet, arbitrum, optimism, base, polygon],
  connectors: [
    injected(),
    walletConnect({ projectId }),
    coinbaseWallet({ appName: "OnChain Wealth" }),
  ],
  transports: {
    [mainnet.id]: createTransport("mainnet"),
    [arbitrum.id]: createTransport("arbitrum"),
    [optimism.id]: createTransport("optimism"),
    [base.id]: createTransport("base"),
    [polygon.id]: createTransport("polygon"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
