// eETH (rebasing liquid staking token) ABI
export const eETHAbi = [
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
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_account", type: "address" }],
    name: "shares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// weETH (wrapped eETH, non-rebasing) ABI
export const weETHAbi = [
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
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_weETHAmount", type: "uint256" }],
    name: "getEETHByWeETH",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getRate",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ========== Write Functions ==========
  {
    inputs: [{ name: "_eETHAmount", type: "uint256" }],
    name: "wrap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_weETHAmount", type: "uint256" }],
    name: "unwrap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Liquifier (for depositing ETH) ABI
export const liquifierAbi = [
  {
    inputs: [],
    name: "getTotalPooledEther",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // ========== Write Functions ==========
  {
    inputs: [{ name: "_referral", type: "address" }],
    name: "deposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "depositWithERC20",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// EtherFi LiquidityPool ABI (alternative staking entry point)
export const etherFiLiquidityPoolAbi = [
  {
    inputs: [{ name: "_referral", type: "address" }],
    name: "deposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalPooledEther",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
