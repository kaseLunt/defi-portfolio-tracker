/**
 * Pyth Network Price Feed ID mappings
 *
 * Feed IDs from: https://pyth.network/developers/price-feed-ids
 * These are the Hermes/Pythnet price feed IDs (not EVM contract addresses)
 */

// Pyth price feed IDs for supported tokens
export const PYTH_PRICE_FEED_IDS: Record<string, string> = {
  // Core tokens
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "WBTC/USD": "0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33",

  // Stablecoins
  "USDC/USD": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  "USDT/USD": "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",

  // Liquid staking tokens
  "STETH/USD": "0x846ae1bdb6300b817cee5fdee2a6da192775030db5615b94a465f53bd40850b5",
  "CBETH/USD": "0x15ecddd26d49e1a8f1de9376ebebc03916ede873447c1255d2d5891b92ce5717",

  // DeFi governance tokens
  "AAVE/USD": "0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
  "COMP/USD": "0x4a8e42861cabc5ecb50996f92e7cfa2bce3fd0a2423b0c44c9b423fb2bd25478",
  "UNI/USD": "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
};

// Map token symbols to their Pyth feed IDs
export const SYMBOL_TO_PYTH_ID: Record<string, string> = {
  // Native/Wrapped ETH
  ETH: PYTH_PRICE_FEED_IDS["ETH/USD"],
  WETH: PYTH_PRICE_FEED_IDS["ETH/USD"],

  // Bitcoin
  BTC: PYTH_PRICE_FEED_IDS["BTC/USD"],
  WBTC: PYTH_PRICE_FEED_IDS["WBTC/USD"],

  // Stablecoins
  USDC: PYTH_PRICE_FEED_IDS["USDC/USD"],
  USDT: PYTH_PRICE_FEED_IDS["USDT/USD"],

  // Liquid staking - use ETH price as base (they're pegged)
  stETH: PYTH_PRICE_FEED_IDS["STETH/USD"],
  wstETH: PYTH_PRICE_FEED_IDS["STETH/USD"], // wstETH tracks stETH value
  cbETH: PYTH_PRICE_FEED_IDS["CBETH/USD"],
  rETH: PYTH_PRICE_FEED_IDS["ETH/USD"], // Use ETH as proxy

  // EtherFi tokens - use ETH price as they're ETH-pegged
  eETH: PYTH_PRICE_FEED_IDS["ETH/USD"],
  weETH: PYTH_PRICE_FEED_IDS["ETH/USD"],

  // DeFi governance
  AAVE: PYTH_PRICE_FEED_IDS["AAVE/USD"],
  COMP: PYTH_PRICE_FEED_IDS["COMP/USD"],
  UNI: PYTH_PRICE_FEED_IDS["UNI/USD"],
};

// Reverse mapping: Pyth feed ID -> symbol (for parsing updates)
export const PYTH_ID_TO_SYMBOL: Record<string, string> = {};
for (const [symbol, pythId] of Object.entries(SYMBOL_TO_PYTH_ID)) {
  if (pythId && !PYTH_ID_TO_SYMBOL[pythId.toLowerCase()]) {
    PYTH_ID_TO_SYMBOL[pythId.toLowerCase()] = symbol;
  }
}

// Get unique feed IDs for subscription (deduplicated)
export function getUniqueFeedIds(): string[] {
  const uniqueIds = new Set<string>();
  for (const id of Object.values(PYTH_PRICE_FEED_IDS)) {
    if (id && !id.includes("Placeholder")) {
      uniqueIds.add(id);
    }
  }
  return Array.from(uniqueIds);
}

// Map CoinGecko ID to Pyth symbol for compatibility
export const COINGECKO_TO_SYMBOL: Record<string, string> = {
  ethereum: "ETH",
  weth: "WETH",
  bitcoin: "BTC",
  "wrapped-bitcoin": "WBTC",
  "usd-coin": "USDC",
  tether: "USDT",
  "staked-ether": "stETH",
  "wrapped-steth": "wstETH",
  "coinbase-wrapped-staked-eth": "cbETH",
  "rocket-pool-eth": "rETH",
  "ether-fi-staked-eth": "eETH",
  "wrapped-eeth": "weETH",
  aave: "AAVE",
  "compound-governance-token": "COMP",
  uniswap: "UNI",
};
