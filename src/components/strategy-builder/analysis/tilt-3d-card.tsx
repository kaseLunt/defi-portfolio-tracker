"use client";

/**
 * Tilt3DCard Component
 *
 * A card with 3D perspective tilt that responds to mouse movement.
 * Creates depth through multiple parallax layers that move at different speeds.
 * Inspired by Apple's spatial computing and premium fintech interfaces.
 */

import { useRef, useState, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  intensity?: number; // 0-1, how much the card tilts
  scale?: number; // hover scale
  borderGradient?: boolean;
}

export function Tilt3DCard({
  children,
  className,
  glowColor = "rgba(0, 255, 208, 0.15)",
  intensity = 0.5,
  scale = 1.02,
  borderGradient = true,
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position relative to card center (-1 to 1)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring physics for smooth movement
  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(useTransform(mouseY, [-1, 1], [10 * intensity, -10 * intensity]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-1, 1], [-10 * intensity, 10 * intensity]), springConfig);

  // Glow position follows mouse
  const glowX = useSpring(useTransform(mouseX, [-1, 1], [0, 100]), springConfig);
  const glowY = useSpring(useTransform(mouseY, [-1, 1], [0, 100]), springConfig);

  // Parallax layers move at different speeds
  const layer1X = useSpring(useTransform(mouseX, [-1, 1], [-5, 5]), springConfig);
  const layer1Y = useSpring(useTransform(mouseY, [-1, 1], [-5, 5]), springConfig);
  const layer2X = useSpring(useTransform(mouseX, [-1, 1], [-10, 10]), springConfig);
  const layer2Y = useSpring(useTransform(mouseY, [-1, 1], [-10, 10]), springConfig);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normalizedX = (e.clientX - centerX) / (rect.width / 2);
    const normalizedY = (e.clientY - centerY) / (rect.height / 2);
    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: "1000px",
      }}
      whileHover={{ scale }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative rounded-2xl overflow-hidden",
        className
      )}
    >
      {/* Animated border gradient */}
      {borderGradient && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: isHovered
              ? `conic-gradient(from 0deg at 50% 50%,
                  rgba(0, 255, 208, 0.5),
                  rgba(168, 85, 247, 0.5),
                  rgba(255, 0, 128, 0.5),
                  rgba(0, 255, 208, 0.5))`
              : "transparent",
            opacity: isHovered ? 1 : 0,
            padding: "1px",
          }}
          animate={{
            rotate: isHovered ? 360 : 0,
          }}
          transition={{
            rotate: { duration: 8, repeat: Infinity, ease: "linear" },
            opacity: { duration: 0.3 },
          }}
        >
          <div className="absolute inset-[1px] rounded-2xl bg-[#0a0a0f]" />
        </motion.div>
      )}

      {/* Dynamic glow that follows mouse */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0"
        style={{
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glowColor}, transparent 50%)`,
          opacity: isHovered ? 0.8 : 0,
        }}
      />

      {/* Glass background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(15, 15, 20, 0.9) 0%, rgba(10, 10, 15, 0.95) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      />

      {/* Parallax layer 1 - slow movement */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          x: layer1X,
          y: layer1Y,
          transform: "translateZ(20px)",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </motion.div>

      {/* Parallax layer 2 - faster movement */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          x: layer2X,
          y: layer2Y,
          transform: "translateZ(40px)",
        }}
      >
        {/* Corner accents */}
        <div className="absolute top-3 left-3 w-8 h-8 border-l-2 border-t-2 border-white/10 rounded-tl-lg" />
        <div className="absolute top-3 right-3 w-8 h-8 border-r-2 border-t-2 border-white/10 rounded-tr-lg" />
        <div className="absolute bottom-3 left-3 w-8 h-8 border-l-2 border-b-2 border-white/10 rounded-bl-lg" />
        <div className="absolute bottom-3 right-3 w-8 h-8 border-r-2 border-b-2 border-white/10 rounded-br-lg" />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-10"
        style={{
          transform: "translateZ(60px)",
        }}
      >
        {children}
      </motion.div>

      {/* Shine effect on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(
            105deg,
            transparent 40%,
            rgba(255, 255, 255, 0.03) 45%,
            rgba(255, 255, 255, 0.05) 50%,
            rgba(255, 255, 255, 0.03) 55%,
            transparent 60%
          )`,
          transform: isHovered ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.6s ease",
        }}
      />
    </motion.div>
  );
}

/**
 * DepthLayer Component
 *
 * For creating content with parallax depth within a Tilt3DCard
 */
interface DepthLayerProps {
  children: ReactNode;
  depth?: number; // 1-3, how much parallax
  className?: string;
}

export function DepthLayer({ children, depth = 1, className }: DepthLayerProps) {
  return (
    <div
      className={cn("relative", className)}
      style={{
        transform: `translateZ(${depth * 20}px)`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
}
