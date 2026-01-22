import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/header";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Premium display font for headings - Clash Display from Fontshare
const clashDisplay = localFont({
  src: [
    {
      path: "../fonts/ClashDisplay-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/ClashDisplay-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/ClashDisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-clash-display",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "OnChain Wealth - DeFi Portfolio Intelligence",
  description:
    "Institutional-grade DeFi portfolio tracking across protocols and chains",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${clashDisplay.variable} antialiased min-h-screen mesh-gradient`}
      >
        <Providers>
          <Header />
          <main className="relative">{children}</main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "glass-heavy border border-border",
              style: {
                background: "hsl(var(--card) / 0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
