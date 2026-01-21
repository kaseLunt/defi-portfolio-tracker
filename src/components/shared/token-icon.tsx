"use client";

import { cn } from "@/lib/utils";

interface TokenIconProps {
  symbol: string;
  logoUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Fallback colors for common tokens
const TOKEN_COLORS: Record<string, string> = {
  ETH: "#627EEA",
  WETH: "#627EEA",
  stETH: "#00A3FF",
  wstETH: "#00A3FF",
  eETH: "#6C41F2",
  weETH: "#6C41F2",
  rETH: "#F79C5C",
  cbETH: "#0052FF",
  USDC: "#2775CA",
  USDT: "#26A17B",
  DAI: "#F5AC37",
  FRAX: "#000000",
  WBTC: "#F7931A",
  AAVE: "#B6509E",
  COMP: "#00D395",
  UNI: "#FF007A",
  LDO: "#F69988",
  ETHFI: "#6C41F2",
  MATIC: "#8247E5",
  WMATIC: "#8247E5",
};

export function TokenIcon({ symbol, logoUrl, size = "md", className }: TokenIconProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const fallbackColor = TOKEN_COLORS[symbol.toUpperCase()] ?? "#6B7280";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        className={cn("rounded-full", sizeClasses[size], className)}
        onError={(e) => {
          // On error, replace with fallback
          e.currentTarget.style.display = "none";
          const parent = e.currentTarget.parentElement;
          if (parent) {
            const fallback = document.createElement("div");
            fallback.className = cn(
              "rounded-full flex items-center justify-center font-semibold text-white",
              sizeClasses[size],
              className
            );
            fallback.style.backgroundColor = fallbackColor;
            fallback.textContent = symbol.slice(0, 2).toUpperCase();
            parent.appendChild(fallback);
          }
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: fallbackColor }}
      title={symbol}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface TokenWithChainProps {
  symbol: string;
  logoUrl?: string;
  chainColor?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TokenWithChain({
  symbol,
  logoUrl,
  chainColor,
  size = "md",
  className,
}: TokenWithChainProps) {
  return (
    <div className={cn("relative", className)}>
      <TokenIcon symbol={symbol} logoUrl={logoUrl} size={size} />
      {chainColor && (
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
          style={{ backgroundColor: chainColor }}
        />
      )}
    </div>
  );
}
