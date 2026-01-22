/**
 * Protocol metadata including logos, colors, and display info
 * Logo URLs use DeFiLlama's reliable CDN
 */

export interface ProtocolMeta {
  id: string;
  name: string;
  logo: string;
  color: string;
  url?: string;
}

// DeFiLlama protocol icon CDN
const DEFILLAMA_ICONS = "https://icons.llama.fi/protocols";

export const PROTOCOL_METADATA: Record<string, ProtocolMeta> = {
  lido: {
    id: "lido",
    name: "Lido",
    logo: `${DEFILLAMA_ICONS}/lido.jpg`,
    color: "#00A3FF",
    url: "https://lido.fi",
  },
  etherfi: {
    id: "etherfi",
    name: "Ether.fi",
    logo: `${DEFILLAMA_ICONS}/ether.fi.jpg`,
    color: "#735CFF",
    url: "https://ether.fi",
  },
  "aave-v3": {
    id: "aave-v3",
    name: "Aave V3",
    logo: `${DEFILLAMA_ICONS}/aave-v3.jpg`,
    color: "#B6509E",
    url: "https://app.aave.com",
  },
  "compound-v3": {
    id: "compound-v3",
    name: "Compound V3",
    logo: `${DEFILLAMA_ICONS}/compound-v3.jpg`,
    color: "#00D395",
    url: "https://app.compound.finance",
  },
  spark: {
    id: "spark",
    name: "Spark",
    logo: `${DEFILLAMA_ICONS}/spark.jpg`,
    color: "#F7931A",
    url: "https://app.spark.fi",
  },
  morpho: {
    id: "morpho",
    name: "Morpho",
    logo: `${DEFILLAMA_ICONS}/morpho.jpg`,
    color: "#0052FF",
    url: "https://app.morpho.org",
  },
  eigenlayer: {
    id: "eigenlayer",
    name: "EigenLayer",
    logo: `${DEFILLAMA_ICONS}/eigenlayer.jpg`,
    color: "#1E0038",
    url: "https://app.eigenlayer.xyz",
  },
  pendle: {
    id: "pendle",
    name: "Pendle",
    logo: `${DEFILLAMA_ICONS}/pendle.jpg`,
    color: "#15BED5",
    url: "https://app.pendle.finance",
  },
};

export function getProtocolMeta(protocolId: string): ProtocolMeta | undefined {
  return PROTOCOL_METADATA[protocolId];
}

export function getProtocolLogo(protocolId: string): string {
  const meta = PROTOCOL_METADATA[protocolId];
  if (meta) return meta.logo;
  // Fallback to DeFiLlama with the ID
  return `${DEFILLAMA_ICONS}/${protocolId}.jpg`;
}

export function getProtocolColor(protocolId: string): string {
  return PROTOCOL_METADATA[protocolId]?.color ?? "#6366F1";
}

/**
 * Common token logo sources
 * Falls back through multiple sources for reliability
 */
export function getTokenLogo(
  tokenAddress: string,
  chainId: number,
  symbol?: string
): string {
  // Try TrustWallet assets first
  const chainName = CHAIN_TO_TRUSTWALLET[chainId];
  if (chainName && tokenAddress !== "0x0000000000000000000000000000000000000000") {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${tokenAddress}/logo.png`;
  }

  // For native tokens, use specific URLs
  if (tokenAddress === "0x0000000000000000000000000000000000000000") {
    if (chainId === 137) {
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png";
    }
    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
  }

  // Fallback to CoinGecko's generic token icon
  return "";
}

const CHAIN_TO_TRUSTWALLET: Record<number, string> = {
  1: "ethereum",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  137: "polygon",
};

/**
 * Position type display info
 */
export const POSITION_TYPE_INFO: Record<string, { label: string; color: string }> = {
  supply: { label: "Supplied", color: "#22C55E" },
  borrow: { label: "Borrowed", color: "#EF4444" },
  stake: { label: "Staked", color: "#8B5CF6" },
  lp: { label: "Liquidity", color: "#06B6D4" },
  vault: { label: "Vault", color: "#F59E0B" },
};
