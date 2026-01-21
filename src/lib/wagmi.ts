import { http, createConfig } from "wagmi";
import { mainnet, arbitrum, optimism, base, polygon } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

// WalletConnect project ID - get from https://cloud.walletconnect.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const config = createConfig({
  chains: [mainnet, arbitrum, optimism, base, polygon],
  connectors: [
    injected(),
    walletConnect({ projectId }),
    coinbaseWallet({ appName: "OnChain Wealth" }),
  ],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_MAINNET ||
        "https://eth.llamarpc.com"
    ),
    [arbitrum.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_ARBITRUM ||
        "https://arbitrum.llamarpc.com"
    ),
    [optimism.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_OPTIMISM ||
        "https://optimism.llamarpc.com"
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_BASE || "https://base.llamarpc.com"
    ),
    [polygon.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_POLYGON ||
        "https://polygon.llamarpc.com"
    ),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
