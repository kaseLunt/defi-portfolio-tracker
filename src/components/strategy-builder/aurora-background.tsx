"use client";

/**
 * Aurora Background Component
 *
 * Creates a mesmerizing aurora borealis effect using animated gradients.
 * Features multiple layers of color that shift and blend creating a
 * living, breathing cyberpunk atmosphere.
 */

import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AuroraBackgroundProps {
  intensity?: "low" | "medium" | "high";
  className?: string;
}

function AuroraBackgroundComponent({ intensity = "medium", className = "" }: AuroraBackgroundProps) {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  // Subtle mouse tracking for interactive aurora
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const opacityMultiplier = {
    low: 0.5,
    medium: 0.75,
    high: 1,
  }[intensity];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Base dark gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-[#0a0a12] to-[#08080c]" />

      {/* Primary aurora layer - Purple/Violet */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(ellipse 120% 80% at ${mousePosition.x * 0.3 + 10}% ${mousePosition.y * 0.2 + 10}%, rgba(120, 0, 255, 0.15), transparent 50%)`,
            `radial-gradient(ellipse 100% 60% at ${mousePosition.x * 0.3 + 20}% ${mousePosition.y * 0.2 + 20}%, rgba(140, 20, 255, 0.12), transparent 50%)`,
            `radial-gradient(ellipse 120% 80% at ${mousePosition.x * 0.3 + 10}% ${mousePosition.y * 0.2 + 10}%, rgba(120, 0, 255, 0.15), transparent 50%)`,
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{ opacity: opacityMultiplier }}
      />

      {/* Secondary aurora layer - Cyan/Teal */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(ellipse 80% 60% at 70% 60%, rgba(0, 255, 200, 0.08), transparent 50%)`,
            `radial-gradient(ellipse 100% 80% at 60% 70%, rgba(0, 220, 180, 0.1), transparent 50%)`,
            `radial-gradient(ellipse 80% 60% at 70% 60%, rgba(0, 255, 200, 0.08), transparent 50%)`,
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ opacity: opacityMultiplier }}
      />

      {/* Tertiary aurora layer - Pink/Magenta */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(ellipse 60% 40% at 20% 80%, rgba(255, 0, 128, 0.06), transparent 40%)`,
            `radial-gradient(ellipse 80% 50% at 30% 70%, rgba(255, 50, 150, 0.08), transparent 40%)`,
            `radial-gradient(ellipse 60% 40% at 20% 80%, rgba(255, 0, 128, 0.06), transparent 40%)`,
          ],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{ opacity: opacityMultiplier }}
      />

      {/* Accent layer - Gold/Amber shimmer */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            `radial-gradient(ellipse 40% 30% at 85% 30%, rgba(255, 180, 0, 0.04), transparent 30%)`,
            `radial-gradient(ellipse 50% 40% at 80% 35%, rgba(255, 200, 50, 0.05), transparent 30%)`,
            `radial-gradient(ellipse 40% 30% at 85% 30%, rgba(255, 180, 0, 0.04), transparent 30%)`,
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ opacity: opacityMultiplier }}
      />

      {/* Floating orb particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3 + Math.random() * 4,
            height: 3 + Math.random() * 4,
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            background: [
              "rgba(120, 0, 255, 0.4)",
              "rgba(0, 255, 200, 0.3)",
              "rgba(255, 0, 128, 0.3)",
            ][i % 3],
            boxShadow: `0 0 ${10 + Math.random() * 10}px ${
              ["rgba(120, 0, 255, 0.3)", "rgba(0, 255, 200, 0.2)", "rgba(255, 0, 128, 0.2)"][i % 3]
            }`,
          }}
          animate={{
            y: [0, -30 - Math.random() * 20, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 6 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Horizontal aurora streaks */}
      <motion.div
        className="absolute w-full h-px top-1/4"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(120, 0, 255, 0.2), transparent)",
        }}
        animate={{
          opacity: [0, 0.5, 0],
          scaleX: [0.5, 1, 0.5],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-full h-px top-2/3"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0, 255, 200, 0.15), transparent)",
        }}
        animate={{
          opacity: [0, 0.4, 0],
          scaleX: [0.6, 1, 0.6],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)",
        }}
      />

      {/* Noise texture overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export const AuroraBackground = memo(AuroraBackgroundComponent);
