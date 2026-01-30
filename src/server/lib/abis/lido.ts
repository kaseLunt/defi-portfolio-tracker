// stETH (rebasing token) ABI
export const stETHAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalPooledEther",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_account", type: "address" }],
    name: "sharesOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_sharesAmount", type: "uint256" }],
    name: "getPooledEthByShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ========== Write Functions ==========
  {
    inputs: [{ name: "_referral", type: "address" }],
    name: "submit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// wstETH (wrapped stETH, non-rebasing) ABI
export const wstETHAbi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "stEthPerToken",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tokensPerStEth",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    name: "getStETHByWstETH",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ========== Write Functions ==========
  {
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    name: "wrap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    name: "unwrap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
