"use client";

/**
 * ParticleField Component
 *
 * A canvas-based particle system creating ambient atmosphere.
 * Features floating particles, connection lines, and mouse interaction.
 * Optimized for performance with requestAnimationFrame.
 */

import { useEffect, useRef, memo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  pulsePhase: number;
}

interface ParticleFieldProps {
  className?: string;
  particleCount?: number;
  colors?: string[];
  maxSpeed?: number;
  connectionDistance?: number;
  showConnections?: boolean;
  mouseInteraction?: boolean;
  mouseForce?: number;
  backgroundGradient?: boolean;
  intensity?: "low" | "medium" | "high";
}

function ParticleFieldComponent({
  className,
  particleCount,
  colors = ["#00ffd0", "#a855f7", "#ec4899", "#3b82f6"],
  maxSpeed = 0.5,
  connectionDistance = 120,
  showConnections = true,
  mouseInteraction = true,
  mouseForce = 100,
  backgroundGradient = true,
  intensity = "medium",
}: ParticleFieldProps) {
  // Adjust particle count based on intensity
  const adjustedParticleCount = particleCount ?? (
    intensity === "low" ? 25 :
    intensity === "medium" ? 50 :
    75
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number | null>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  // Initialize particles
  const initParticles = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    particlesRef.current = Array.from({ length: adjustedParticleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * maxSpeed * 2,
      vy: (Math.random() - 0.5) * maxSpeed * 2,
      radius: 1 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.3 + Math.random() * 0.5,
      pulsePhase: Math.random() * Math.PI * 2,
    }));
  }, [adjustedParticleCount, colors, maxSpeed]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      dimensionsRef.current = { width: rect.width * dpr, height: rect.height * dpr };

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      initParticles();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initParticles]);

  // Handle mouse movement
  useEffect(() => {
    if (!mouseInteraction) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mouseRef.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [mouseInteraction]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;

    const animate = () => {
      const { width, height } = dimensionsRef.current;
      const dpr = window.devicePixelRatio || 1;

      // Clear canvas
      ctx.clearRect(0, 0, width / dpr, height / dpr);

      // Draw background gradient if enabled
      if (backgroundGradient) {
        const gradient = ctx.createRadialGradient(
          width / dpr / 2,
          height / dpr / 2,
          0,
          width / dpr / 2,
          height / dpr / 2,
          Math.max(width, height) / dpr / 2
        );
        gradient.addColorStop(0, "rgba(10, 10, 15, 0)");
        gradient.addColorStop(1, "rgba(10, 10, 15, 0.8)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width / dpr, height / dpr);
      }

      time += 0.01;

      // Update and draw particles
      particlesRef.current.forEach((particle, i) => {
        // Mouse interaction force
        if (mouseInteraction) {
          const dx = mouseRef.current.x / dpr - particle.x / dpr;
          const dy = mouseRef.current.y / dpr - particle.y / dpr;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouseForce) {
            const force = (mouseForce - dist) / mouseForce;
            particle.vx -= (dx / dist) * force * 0.5;
            particle.vy -= (dy / dist) * force * 0.5;
          }
        }

        // Apply velocity with damping
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Add slight random movement
        particle.vx += (Math.random() - 0.5) * 0.1;
        particle.vy += (Math.random() - 0.5) * 0.1;

        // Clamp velocity
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }

        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;

        // Pulsing alpha
        const pulseAlpha =
          particle.alpha * (0.7 + 0.3 * Math.sin(time * 2 + particle.pulsePhase));

        // Draw particle with glow
        const gradient = ctx.createRadialGradient(
          particle.x / dpr,
          particle.y / dpr,
          0,
          particle.x / dpr,
          particle.y / dpr,
          particle.radius * 3
        );
        gradient.addColorStop(0, particle.color);
        gradient.addColorStop(0.5, particle.color + "80");
        gradient.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.arc(particle.x / dpr, particle.y / dpr, particle.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = pulseAlpha * 0.5;
        ctx.fill();

        // Core particle
        ctx.beginPath();
        ctx.arc(particle.x / dpr, particle.y / dpr, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = pulseAlpha;
        ctx.fill();
      });

      // Draw connections
      if (showConnections) {
        ctx.globalAlpha = 1;
        particlesRef.current.forEach((p1, i) => {
          for (let j = i + 1; j < particlesRef.current.length; j++) {
            const p2 = particlesRef.current[j];
            const dx = (p1.x - p2.x) / dpr;
            const dy = (p1.y - p2.y) / dpr;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < connectionDistance) {
              const alpha = (1 - dist / connectionDistance) * 0.2;
              ctx.beginPath();
              ctx.moveTo(p1.x / dpr, p1.y / dpr);
              ctx.lineTo(p2.x / dpr, p2.y / dpr);
              ctx.strokeStyle = p1.color;
              ctx.globalAlpha = alpha;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        });
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    showConnections,
    connectionDistance,
    mouseInteraction,
    mouseForce,
    maxSpeed,
    backgroundGradient,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 w-full h-full pointer-events-auto", className)}
      style={{ opacity: 0.8 }}
    />
  );
}

export const ParticleField = memo(ParticleFieldComponent);

/**
 * DataStreamParticles - Vertical falling particles like data streams
 */
interface DataStreamParticlesProps {
  className?: string;
  streamCount?: number;
  color?: string;
}

export function DataStreamParticles({
  className,
  streamCount = 20,
  color = "#00ffd0",
}: DataStreamParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Stream particles
    interface Stream {
      x: number;
      y: number;
      speed: number;
      length: number;
      chars: string[];
    }

    const streams: Stream[] = [];
    const chars = "01アイウエオカキクケコ".split("");

    for (let i = 0; i < streamCount; i++) {
      streams.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        speed: 1 + Math.random() * 3,
        length: 5 + Math.floor(Math.random() * 15),
        chars: Array.from(
          { length: 5 + Math.floor(Math.random() * 15) },
          () => chars[Math.floor(Math.random() * chars.length)]
        ),
      });
    }

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = "rgba(10, 10, 15, 0.1)";
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.font = "12px monospace";

      streams.forEach(stream => {
        stream.y += stream.speed;

        stream.chars.forEach((char, i) => {
          const y = stream.y - i * 14;
          if (y > 0 && y < rect.height) {
            const alpha = 1 - i / stream.chars.length;
            ctx.fillStyle =
              i === 0 ? "#fff" : `rgba(0, 255, 208, ${alpha * 0.5})`;
            ctx.fillText(char, stream.x, y);
          }
        });

        // Randomly change leading character
        if (Math.random() > 0.95) {
          stream.chars[0] = chars[Math.floor(Math.random() * chars.length)];
        }

        // Reset stream when off screen
        if (stream.y - stream.length * 14 > rect.height) {
          stream.y = -stream.length * 14;
          stream.x = Math.random() * rect.width;
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [streamCount, color]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      style={{ opacity: 0.15 }}
    />
  );
}
