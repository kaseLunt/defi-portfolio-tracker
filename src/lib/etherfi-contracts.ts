/**
 * EtherFi Smart Contract Definitions
 *
 * Contract addresses and ABIs for staking interactions.
 * All contracts are on Ethereum Mainnet.
 */

import { type Address } from "viem";

/**
 * Contract addresses
 */
export const ETHERFI_ADDRESSES = {
  // Core staking contracts
  liquidityPool: "0x308861A430be4cce5502d0A12724771Fc6DaF216" as Address,
  eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2" as Address,
  weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee" as Address,

  // NFT contracts
  membershipNFT: "0xb49e4420eA6e35F98060Cd133842DbeA9c27e479" as Address,
  TNFT: "0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c" as Address,
  BNFT: "0x87CE158c03C996fe1B4B740F5C59B1bD5e51b538" as Address,

  // Withdrawal
  withdrawRequestNFT: "0x7d5706f6ef3F89B3951E23e557CDFBC3239D4E2c" as Address,

  // ETHFI Token & Staking
  ETHFI: "0xFe0c30065B384F05761f15d0CC899D4F9F9Cc0eB" as Address,
  sETHFI: "0x86B5780b606940Eb59A062aA85a07959518c0161" as Address, // Staked ETHFI

  // eBTC - Bitcoin restaking
  eBTC: "0x657e8c867d8b37dcc18fa4caead9c45eb088c642" as Address,

  // Liquid Vaults (ERC-4626)
  liquidVaultETH: "0xf0bb20865277abd641a307ece5ee04e79073416c" as Address,
  liquidVaultUSD: "0x08c6F91e2B681FaF5e17227F2a44C307b3C1364C" as Address,
} as const;

/**
 * LiquidityPool ABI - for staking ETH to get eETH
 */
export const LIQUIDITY_POOL_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "mintedAmount", type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_referral", type: "address" }],
    outputs: [{ name: "mintedAmount", type: "uint256" }],
  },
  {
    name: "getTotalPooledEther",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTotalEtherClaimOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * eETH ABI - rebasing liquid staking token
 */
export const EETH_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "shares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * weETH ABI - wrapped eETH (non-rebasing)
 */
export const WEETH_ABI = [
  // Wrap/unwrap
  {
    name: "wrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_eETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "unwrap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_weETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Conversion helpers
  {
    name: "getWeETHByeETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_eETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getEETHByWeETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_weETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ERC20 standard
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * MembershipNFT ABI - for querying tier/points (if needed beyond Graph)
 */
export const MEMBERSHIP_NFT_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Standard ERC20 ABI - for ETHFI, eBTC tokens
 */
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * ERC4626 Vault ABI - for Liquid Vaults
 */
export const ERC4626_ABI = [
  // ERC20 base
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // ERC4626 specific
  {
    name: "asset",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToShares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "previewRedeem",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Combined contract configs for wagmi
 */
export const ETHERFI_CONTRACTS = {
  liquidityPool: {
    address: ETHERFI_ADDRESSES.liquidityPool,
    abi: LIQUIDITY_POOL_ABI,
  },
  eETH: {
    address: ETHERFI_ADDRESSES.eETH,
    abi: EETH_ABI,
  },
  weETH: {
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
  },
  membershipNFT: {
    address: ETHERFI_ADDRESSES.membershipNFT,
    abi: MEMBERSHIP_NFT_ABI,
  },
  // ETHFI token
  ETHFI: {
    address: ETHERFI_ADDRESSES.ETHFI,
    abi: ERC20_ABI,
  },
  // Staked ETHFI
  sETHFI: {
    address: ETHERFI_ADDRESSES.sETHFI,
    abi: ERC20_ABI,
  },
  // eBTC
  eBTC: {
    address: ETHERFI_ADDRESSES.eBTC,
    abi: ERC20_ABI,
  },
  // Liquid Vaults
  liquidVaultETH: {
    address: ETHERFI_ADDRESSES.liquidVaultETH,
    abi: ERC4626_ABI,
  },
  liquidVaultUSD: {
    address: ETHERFI_ADDRESSES.liquidVaultUSD,
    abi: ERC4626_ABI,
  },
} as const;

/**
 * Chain ID for EtherFi contracts (Ethereum Mainnet)
 */
export const ETHERFI_CHAIN_ID = 1;

/**
 * The Graph subgraph ID for EtherFi
 */
export const ETHERFI_SUBGRAPH_ID = "4xkDLEfEpWo5XJ9x8mYjBwKDKHMAPbRdqm1j2fXYhF2A";
