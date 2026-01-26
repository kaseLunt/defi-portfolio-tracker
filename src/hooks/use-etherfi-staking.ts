"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSimulateContract,
} from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import {
  ETHERFI_ADDRESSES,
  LIQUIDITY_POOL_ABI,
  EETH_ABI,
  WEETH_ABI,
  ERC20_ABI,
  ERC4626_ABI,
} from "@/lib/etherfi-contracts";
import { ETHERFI_CHAIN_ID } from "@/lib/etherfi-contracts";

export type StakingTab = "stake" | "wrap" | "unwrap";

export type TransactionStatus =
  | "idle"
  | "simulating"
  | "ready"
  | "confirming"
  | "pending"
  | "success"
  | "error";

/**
 * Hook for ETH balance
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useEthBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  const { data, isLoading, refetch } = useBalance({
    address: address as Address | undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: data?.value ?? 0n,
    formatted: data ? formatEther(data.value) : "0",
    isLoading,
    refetch,
  };
}

/**
 * Hook for eETH balance
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useEethBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: ETHERFI_ADDRESSES.eETH,
    abi: EETH_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: (data as bigint) ?? 0n,
    formatted: formatEther((data as bigint) ?? 0n),
    isLoading,
    refetch,
  };
}

/**
 * Hook for weETH balance
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useWeethBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: (data as bigint) ?? 0n,
    formatted: formatEther((data as bigint) ?? 0n),
    isLoading,
    refetch,
  };
}

/**
 * Hook for ETHFI token balance
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useEthfiBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: ETHERFI_ADDRESSES.ETHFI,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: (data as bigint) ?? 0n,
    formatted: formatEther((data as bigint) ?? 0n),
    isLoading,
    refetch,
  };
}

/**
 * Hook for staked ETHFI (sETHFI) balance
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useSethfiBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: ETHERFI_ADDRESSES.sETHFI,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  return {
    balance: (data as bigint) ?? 0n,
    formatted: formatEther((data as bigint) ?? 0n),
    isLoading,
    refetch,
  };
}

/**
 * Hook for eBTC balance (8 decimals like BTC)
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useEbtcBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: ETHERFI_ADDRESSES.eBTC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // eBTC uses 8 decimals like BTC
  const balance = (data as bigint) ?? 0n;
  const formatted = Number(balance) / 1e8;

  return {
    balance,
    formatted: formatted.toString(),
    decimals: 8,
    isLoading,
    refetch,
  };
}

/**
 * Hook for Liquid Vault ETH shares
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useLiquidVaultEthBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  // Get share balance
  const { data: shareBalance, isLoading: isShareLoading, refetch: refetchShares } = useReadContract({
    address: ETHERFI_ADDRESSES.liquidVaultETH,
    abi: ERC4626_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // Convert shares to assets (underlying value)
  const shares = (shareBalance as bigint) ?? 0n;
  const { data: assetValue, isLoading: isAssetLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.liquidVaultETH,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: [shares],
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: shares > 0n,
    },
  });

  return {
    shares,
    sharesFormatted: formatEther(shares),
    assetValue: (assetValue as bigint) ?? 0n,
    assetFormatted: formatEther((assetValue as bigint) ?? 0n),
    isLoading: isShareLoading || isAssetLoading,
    refetch: refetchShares,
  };
}

/**
 * Hook for Liquid Vault USD shares
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useLiquidVaultUsdBalance(walletAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = walletAddress || connectedAddress;

  // Get share balance
  const { data: shareBalance, isLoading: isShareLoading, refetch: refetchShares } = useReadContract({
    address: ETHERFI_ADDRESSES.liquidVaultUSD,
    abi: ERC4626_ABI,
    functionName: "balanceOf",
    args: address ? [address as Address] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  // Convert shares to assets (underlying value) - USDC has 6 decimals
  const shares = (shareBalance as bigint) ?? 0n;
  const { data: assetValue, isLoading: isAssetLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.liquidVaultUSD,
    abi: ERC4626_ABI,
    functionName: "convertToAssets",
    args: [shares],
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: shares > 0n,
    },
  });

  // USD vault uses 6 decimals (USDC)
  const assets = (assetValue as bigint) ?? 0n;
  const assetFormatted = Number(assets) / 1e6;

  return {
    shares,
    sharesFormatted: formatEther(shares), // Shares are 18 decimals
    assetValue: assets,
    assetFormatted: assetFormatted.toFixed(2),
    decimals: 6,
    isLoading: isShareLoading || isAssetLoading,
    refetch: refetchShares,
  };
}

/**
 * Hook for getting eETH amount from weETH (for unwrap quote)
 */
export function useWeethToEeth(weethAmount: bigint) {
  const { data, isLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "getEETHByWeETH",
    args: [weethAmount],
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: weethAmount > 0n,
    },
  });

  return {
    eethAmount: (data as bigint) ?? 0n,
    formatted: formatEther((data as bigint) ?? 0n),
    isLoading,
  };
}

/**
 * Hook for weETH/eETH exchange rate
 * Returns how much eETH 1 weETH is worth
 */
export function useWeethExchangeRate() {
  const oneWeeth = parseEther("1");

  const { data, isLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "getEETHByWeETH",
    args: [oneWeeth],
    chainId: ETHERFI_CHAIN_ID,
  });

  const rate = (data as bigint) ?? parseEther("1");
  const rateNum = parseFloat(formatEther(rate));

  return {
    rate,
    rateFormatted: rateNum.toFixed(4),
    isLoading,
  };
}

/**
 * Hook for total eETH and weETH supply
 */
export function useEtherFiSupply() {
  const { data: eethSupply, isLoading: eethLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.eETH,
    abi: EETH_ABI,
    functionName: "totalSupply",
    chainId: ETHERFI_CHAIN_ID,
  });

  const { data: weethSupply, isLoading: weethLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "totalSupply",
    chainId: ETHERFI_CHAIN_ID,
  });

  return {
    eethSupply: (eethSupply as bigint) ?? 0n,
    eethSupplyFormatted: formatEther((eethSupply as bigint) ?? 0n),
    weethSupply: (weethSupply as bigint) ?? 0n,
    weethSupplyFormatted: formatEther((weethSupply as bigint) ?? 0n),
    isLoading: eethLoading || weethLoading,
  };
}

/**
 * Hook for getting weETH amount from eETH (for wrap quote)
 */
export function useEethToWeeth(eethAmount: bigint) {
  const { data, isLoading } = useReadContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "getWeETHByeETH",
    args: [eethAmount],
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: eethAmount > 0n,
    },
  });

  return {
    weethAmount: (data as bigint) ?? 0n,
    formatted: formatEther((data as bigint) ?? 0n),
    isLoading,
  };
}

/**
 * Hook for staking ETH to get eETH
 */
export function useStakeEth() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const amountWei = useMemo(() => {
    try {
      return amount ? parseEther(amount) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  // Simulate the transaction
  const { data: simulateData, isLoading: isSimulating } = useSimulateContract({
    address: ETHERFI_ADDRESSES.liquidityPool,
    abi: LIQUIDITY_POOL_ABI,
    functionName: "deposit",
    value: amountWei,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address && amountWei > 0n,
    },
  });

  // Write contract
  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Execute stake
  const stake = useCallback(async () => {
    if (!simulateData?.request) {
      setError("Unable to simulate transaction");
      return;
    }

    try {
      setStatus("confirming");
      setError(null);
      writeContract(simulateData.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStatus("error");
    }
  }, [simulateData, writeContract]);

  // Update status based on transaction state
  useMemo(() => {
    if (isSimulating) setStatus("simulating");
    else if (simulateData && !isWriting && !txHash) setStatus("ready");
    else if (isWriting) setStatus("confirming");
    else if (isConfirming) setStatus("pending");
    else if (isSuccess) setStatus("success");
  }, [isSimulating, simulateData, isWriting, txHash, isConfirming, isSuccess]);

  const reset = useCallback(() => {
    setAmount("");
    setStatus("idle");
    setError(null);
    resetWrite();
  }, [resetWrite]);

  return {
    amount,
    setAmount,
    amountWei,
    stake,
    status,
    error,
    txHash,
    isSimulating,
    isReady: status === "ready",
    reset,
    // Quote: 1 ETH = ~1 eETH (simplified, actual rate may vary slightly)
    estimatedOutput: amount,
  };
}

/**
 * Hook for wrapping eETH to weETH
 */
export function useWrapEeth() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const amountWei = useMemo(() => {
    try {
      return amount ? parseEther(amount) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  // Get output quote
  const { weethAmount, isLoading: isQuoting } = useEethToWeeth(amountWei);

  // Check allowance
  const { data: allowance } = useReadContract({
    address: ETHERFI_ADDRESSES.eETH,
    abi: EETH_ABI,
    functionName: "allowance",
    args: address ? [address, ETHERFI_ADDRESSES.weETH] : undefined,
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address,
    },
  });

  const needsApproval = (allowance as bigint) < amountWei;

  // Simulate wrap
  const { data: simulateData, isLoading: isSimulating } = useSimulateContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "wrap",
    args: [amountWei],
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address && amountWei > 0n && !needsApproval,
    },
  });

  // Write contract
  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Execute wrap
  const wrap = useCallback(async () => {
    if (!simulateData?.request) {
      setError("Unable to simulate transaction");
      return;
    }

    try {
      setStatus("confirming");
      setError(null);
      writeContract(simulateData.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStatus("error");
    }
  }, [simulateData, writeContract]);

  // Approve eETH spending
  const approve = useCallback(async () => {
    try {
      setStatus("confirming");
      writeContract({
        address: ETHERFI_ADDRESSES.eETH,
        abi: EETH_ABI,
        functionName: "approve",
        args: [ETHERFI_ADDRESSES.weETH, amountWei],
        chainId: ETHERFI_CHAIN_ID,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
      setStatus("error");
    }
  }, [amountWei, writeContract]);

  const reset = useCallback(() => {
    setAmount("");
    setStatus("idle");
    setError(null);
    resetWrite();
  }, [resetWrite]);

  return {
    amount,
    setAmount,
    amountWei,
    wrap,
    approve,
    needsApproval,
    status,
    error,
    txHash,
    isQuoting,
    isSimulating,
    isReady: status === "ready" && !needsApproval,
    reset,
    estimatedOutput: formatEther(weethAmount),
  };
}

/**
 * Hook for unwrapping weETH to eETH
 */
export function useUnwrapWeeth() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const amountWei = useMemo(() => {
    try {
      return amount ? parseEther(amount) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  // Get output quote
  const { eethAmount, isLoading: isQuoting } = useWeethToEeth(amountWei);

  // Simulate unwrap
  const { data: simulateData, isLoading: isSimulating } = useSimulateContract({
    address: ETHERFI_ADDRESSES.weETH,
    abi: WEETH_ABI,
    functionName: "unwrap",
    args: [amountWei],
    chainId: ETHERFI_CHAIN_ID,
    query: {
      enabled: !!address && amountWei > 0n,
    },
  });

  // Write contract
  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Execute unwrap
  const unwrap = useCallback(async () => {
    if (!simulateData?.request) {
      setError("Unable to simulate transaction");
      return;
    }

    try {
      setStatus("confirming");
      setError(null);
      writeContract(simulateData.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStatus("error");
    }
  }, [simulateData, writeContract]);

  const reset = useCallback(() => {
    setAmount("");
    setStatus("idle");
    setError(null);
    resetWrite();
  }, [resetWrite]);

  return {
    amount,
    setAmount,
    amountWei,
    unwrap,
    status,
    error,
    txHash,
    isQuoting,
    isSimulating,
    isReady: status === "ready",
    reset,
    estimatedOutput: formatEther(eethAmount),
  };
}

/**
 * Combined hook for all EtherFi balances
 * @param walletAddress - Optional wallet address to view. If not provided, uses connected wallet.
 */
export function useEtherFiBalances(walletAddress?: string) {
  const eth = useEthBalance(walletAddress);
  const eeth = useEethBalance(walletAddress);
  const weeth = useWeethBalance(walletAddress);
  const ethfi = useEthfiBalance(walletAddress);
  const sethfi = useSethfiBalance(walletAddress);
  const ebtc = useEbtcBalance(walletAddress);
  const vaultEth = useLiquidVaultEthBalance(walletAddress);
  const vaultUsd = useLiquidVaultUsdBalance(walletAddress);

  const refetchAll = useCallback(() => {
    eth.refetch();
    eeth.refetch();
    weeth.refetch();
    ethfi.refetch();
    sethfi.refetch();
    ebtc.refetch();
    vaultEth.refetch();
    vaultUsd.refetch();
  }, [eth, eeth, weeth, ethfi, sethfi, ebtc, vaultEth, vaultUsd]);

  const isLoading =
    eth.isLoading ||
    eeth.isLoading ||
    weeth.isLoading ||
    ethfi.isLoading ||
    sethfi.isLoading ||
    ebtc.isLoading ||
    vaultEth.isLoading ||
    vaultUsd.isLoading;

  // Check if user has any EtherFi positions
  const hasAnyPosition =
    eth.balance > 0n ||
    eeth.balance > 0n ||
    weeth.balance > 0n ||
    ethfi.balance > 0n ||
    sethfi.balance > 0n ||
    ebtc.balance > 0n ||
    vaultEth.shares > 0n ||
    vaultUsd.shares > 0n;

  return {
    // Core staking tokens
    eth: {
      balance: eth.balance,
      formatted: eth.formatted,
    },
    eeth: {
      balance: eeth.balance,
      formatted: eeth.formatted,
    },
    weeth: {
      balance: weeth.balance,
      formatted: weeth.formatted,
    },
    // ETHFI tokens
    ethfi: {
      balance: ethfi.balance,
      formatted: ethfi.formatted,
    },
    sethfi: {
      balance: sethfi.balance,
      formatted: sethfi.formatted,
    },
    // eBTC
    ebtc: {
      balance: ebtc.balance,
      formatted: ebtc.formatted,
      decimals: ebtc.decimals,
    },
    // Liquid Vaults
    vaultEth: {
      shares: vaultEth.shares,
      sharesFormatted: vaultEth.sharesFormatted,
      assetValue: vaultEth.assetValue,
      assetFormatted: vaultEth.assetFormatted,
    },
    vaultUsd: {
      shares: vaultUsd.shares,
      sharesFormatted: vaultUsd.sharesFormatted,
      assetValue: vaultUsd.assetValue,
      assetFormatted: vaultUsd.assetFormatted,
    },
    // Metadata
    isLoading,
    hasAnyPosition,
    refetch: refetchAll,
  };
}
