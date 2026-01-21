// EigenLayer Strategy Manager ABI
export const strategyManagerAbi = [
  {
    inputs: [
      { name: "staker", type: "address" },
      { name: "strategy", type: "address" },
    ],
    name: "stakerStrategyShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "staker", type: "address" }],
    name: "stakerStrategyListLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// EigenLayer Strategy ABI
export const strategyAbi = [
  {
    inputs: [],
    name: "totalShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "underlyingToken",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "amountShares", type: "uint256" }],
    name: "sharesToUnderlyingView",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "shares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// EigenPod Manager ABI (for native ETH restaking)
export const eigenPodManagerAbi = [
  {
    inputs: [{ name: "podOwner", type: "address" }],
    name: "podOwnerShares",
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "podOwner", type: "address" }],
    name: "hasPod",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
