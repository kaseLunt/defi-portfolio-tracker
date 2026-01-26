"use client";

import { useState, createContext, useContext, useRef, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { WagmiProvider, useAccount } from "wagmi";
import superjson from "superjson";
import { config } from "@/lib/wagmi";
import { trpc } from "@/lib/trpc";
import { RealtimeProvider } from "@/hooks/use-realtime";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// Context to share wallet address with components
interface WalletContextType {
  address: string | undefined;
}

const WalletContext = createContext<WalletContextType>({
  address: undefined,
});

export function useWalletContext() {
  return useContext(WalletContext);
}

// Inner provider that has access to wagmi hooks
function TRPCWrapper({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();

  // Use ref to always have the latest address in headers() closure
  const addressRef = useRef<string | undefined>(address);
  addressRef.current = address;

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            // Send the connected wallet address with each request
            // Uses ref to always get the latest address
            if (addressRef.current) {
              return {
                "x-wallet-address": addressRef.current,
              };
            }
            return {};
          },
        }),
      ],
    })
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ address }), [address]);

  return (
    <WalletContext.Provider value={contextValue}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <RealtimeProvider>{children}</RealtimeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </WalletContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <TRPCWrapper>{children}</TRPCWrapper>
    </WagmiProvider>
  );
}
