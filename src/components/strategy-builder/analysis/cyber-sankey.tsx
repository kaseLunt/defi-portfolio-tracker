"use client";

/**
 * CyberSankey - Premium 3D Sankey Flow Visualization
 *
 * An advanced flow visualization inspired by sci-fi interfaces.
 * Features animated energy flows, particle systems, holographic nodes,
 * and real-time value transformations.
 */

import { useEffect, useState, useMemo, memo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  displayValue?: string;
  color: string;
  glowColor?: string;
  icon?: React.ReactNode;
  column: number; // 0 = left, 1 = middle, 2 = right
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
  label?: string;
  isNegative?: boolean;
}

interface CyberSankeyProps {
  nodes: FlowNode[];
  links: FlowLink[];
  width?: number;
  height?: number;
  className?: string;
  showParticles?: boolean;
  particleCount?: number;
  enableGlow?: boolean;
  animated?: boolean;
}

// ============================================================================
// Particle System
// ============================================================================

interface Particle {
  id: number;
  linkIndex: number;
  progress: number;
  speed: number;
  size: number;
  opacity: number;
}

function useParticleSystem(
  linkCount: number,
  particleCount: number,
  enabled: boolean
) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || linkCount === 0) return;

    // Initialize particles
    const initialParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      initialParticles.push({
        id: i,
        linkIndex: Math.floor(Math.random() * linkCount),
        progress: Math.random(),
        speed: 0.15 + Math.random() * 0.25,
        size: 2 + Math.random() * 4,
        opacity: 0.6 + Math.random() * 0.4,
      });
    }
    setParticles(initialParticles);

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      setParticles((prev) =>
        prev.map((particle) => {
          let newProgress = particle.progress + (particle.speed * deltaTime) / 2000;
          if (newProgress > 1) {
            return {
              ...particle,
              progress: 0,
              linkIndex: Math.floor(Math.random() * linkCount),
              speed: 0.15 + Math.random() * 0.25,
              size: 2 + Math.random() * 4,
              opacity: 0.6 + Math.random() * 0.4,
            };
          }
          return { ...particle, progress: newProgress };
        })
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, linkCount, particleCount]);

  return particles;
}

// ============================================================================
// Holographic Node Component
// ============================================================================

interface HoloNodeProps {
  node: FlowNode;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

function HoloNode({ node, x, y, width, height, index }: HoloNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Safeguard all numeric values
  const safeX = typeof x === "number" && isFinite(x) ? x : 0;
  const safeY = typeof y === "number" && isFinite(y) ? y : 0;
  const safeWidth = typeof width === "number" && isFinite(width) ? width : 160;
  const safeHeight = typeof height === "number" && isFinite(height) ? height : 70;
  const nodeValue = typeof node?.value === "number" && isFinite(node.value) ? node.value : 0;
  const nodeColor = node?.color || "#a855f7";
  const nodeLabel = node?.label || "Node";

  // Format display value safely
  const displayValue = node?.displayValue || `${nodeValue >= 0 ? "+" : ""}${nodeValue.toFixed(2)}%`;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {/* Outer glow pulse */}
      <motion.rect
        x={safeX - 6}
        y={safeY - 6}
        width={safeWidth + 12}
        height={safeHeight + 12}
        rx={16}
        fill="none"
        stroke={node?.glowColor || nodeColor}
        strokeWidth={1.5}
        initial={{ opacity: 0.2 }}
        animate={{
          opacity: isHovered ? [0.4, 0.7, 0.4] : [0.1, 0.3, 0.1],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        filter="url(#node-glow)"
      />

      {/* Glass background */}
      <rect
        x={safeX}
        y={safeY}
        width={safeWidth}
        height={safeHeight}
        rx={12}
        fill="url(#glass-gradient)"
        stroke={nodeColor}
        strokeWidth={2}
        filter="url(#glass-blur)"
      />

      {/* Inner gradient overlay */}
      <rect
        x={safeX + 2}
        y={safeY + 2}
        width={safeWidth - 4}
        height={safeHeight - 4}
        rx={10}
        fill={`url(#node-inner-${index})`}
        opacity={0.5}
      />

      {/* Holographic shimmer line */}
      <rect
        x={safeX}
        y={safeY}
        width={safeWidth}
        height={2}
        rx={1}
        fill={nodeColor}
        opacity={0.6}
      />

      {/* Label */}
      <text
        x={safeX + safeWidth / 2}
        y={safeY + 22}
        textAnchor="middle"
        className="fill-white/80 text-xs font-medium"
        style={{ fontFamily: "var(--font-display), system-ui" }}
      >
        {nodeLabel}
      </text>

      {/* Sublabel */}
      {node?.sublabel && (
        <text
          x={safeX + safeWidth / 2}
          y={safeY + 38}
          textAnchor="middle"
          className="fill-white/40 text-[10px]"
        >
          {node.sublabel}
        </text>
      )}

      {/* Value */}
      <text
        x={safeX + safeWidth / 2}
        y={safeY + safeHeight - 14}
        textAnchor="middle"
        className="text-base font-bold"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fill: nodeColor,
          filter: `drop-shadow(0 0 8px ${nodeColor})`,
        }}
      >
        {displayValue}
      </text>
    </motion.g>
  );
}

// ============================================================================
// Energy Flow Link Component
// ============================================================================

interface EnergyLinkProps {
  path: string;
  color: string;
  label?: string;
  labelX: number;
  labelY: number;
  index: number;
  isNegative?: boolean;
  width: number;
}

function EnergyLink({
  path,
  color,
  label,
  labelX,
  labelY,
  index,
  isNegative,
  width,
}: EnergyLinkProps) {
  // Clamp stroke width between 4 and 24
  const strokeWidth = Math.max(4, Math.min(24, width));

  return (
    <g>
      {/* Background glow path */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 8}
        strokeOpacity={0.1}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: index * 0.15 }}
        filter="url(#link-glow)"
      />

      {/* Main flow path */}
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#flow-gradient-${index})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: index * 0.15 }}
      />

      {/* Animated energy dash overlay */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 10"
        strokeLinecap="round"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: isNegative ? 32 : -32 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        opacity={0.7}
      />

      {/* Secondary thin line for depth */}
      <motion.path
        d={path}
        fill="none"
        stroke="white"
        strokeWidth={1}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: index * 0.15 + 0.2 }}
        opacity={0.15}
      />

      {/* Flow label */}
      {label && (
        <motion.g
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + index * 0.1 }}
        >
          <rect
            x={labelX - 24}
            y={labelY - 10}
            width={48}
            height={20}
            rx={4}
            fill="rgba(10, 10, 15, 0.9)"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={labelX}
            y={labelY + 4}
            textAnchor="middle"
            className="text-[10px] font-bold"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fill: color,
            }}
          >
            {label}
          </text>
        </motion.g>
      )}
    </g>
  );
}

// ============================================================================
// Main CyberSankey Component
// ============================================================================

function CyberSankeyComponent({
  nodes,
  links,
  width = 800,
  height = 400,
  className,
  showParticles = true,
  particleCount = 40,
  enableGlow = true,
  animated = true,
}: CyberSankeyProps) {
  // Validate inputs
  const safeWidth = typeof width === "number" && isFinite(width) && width > 0 ? width : 800;
  const safeHeight = typeof height === "number" && isFinite(height) && height > 0 ? height : 400;
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeLinks = Array.isArray(links) ? links : [];

  // Calculate node positions by column FIRST
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};

    if (safeNodes.length === 0) return positions;

    const nodeWidth = 160;
    const nodeHeight = 70;
    const padding = 40;
    const columnGap = (safeWidth - 2 * padding - nodeWidth) / 2;

    // Group nodes by column
    const columns: FlowNode[][] = [[], [], []];
    safeNodes.forEach((node) => {
      if (node && typeof node.column === "number" && node.column >= 0 && node.column <= 2) {
        columns[node.column].push(node);
      }
    });

    // Position each column
    columns.forEach((columnNodes, colIndex) => {
      if (columnNodes.length === 0) return;

      const colX = padding + colIndex * columnGap;
      const totalHeight = columnNodes.length * nodeHeight + (columnNodes.length - 1) * 20;
      const startY = Math.max(padding, (safeHeight - totalHeight) / 2);

      columnNodes.forEach((node, nodeIndex) => {
        if (node && node.id) {
          positions[node.id] = {
            x: colX,
            y: startY + nodeIndex * (nodeHeight + 20),
            width: nodeWidth,
            height: nodeHeight,
          };
        }
      });
    });

    return positions;
  }, [safeNodes, safeWidth, safeHeight]);

  // Calculate link paths
  const linkPaths = useMemo(() => {
    if (safeLinks.length === 0 || Object.keys(nodePositions).length === 0) {
      return [];
    }

    return safeLinks.map((link) => {
      if (!link || !link.source || !link.target) return null;

      const source = nodePositions[link.source];
      const target = nodePositions[link.target];

      // Both source and target must exist
      if (!source || !target) {
        return null;
      }

      const fromX = source.x + source.width;
      const fromY = source.y + source.height / 2;
      const toX = target.x;
      const toY = target.y + target.height / 2;

      // Validate coordinates
      if (!isFinite(fromX) || !isFinite(fromY) || !isFinite(toX) || !isFinite(toY)) {
        return null;
      }

      const controlOffset = Math.abs(toX - fromX) * 0.4;

      const path = `M ${fromX} ${fromY}
                    C ${fromX + controlOffset} ${fromY},
                      ${toX - controlOffset} ${toY},
                      ${toX} ${toY}`;

      const sourceNode = safeNodes.find((n) => n.id === link.source);
      const color = link.isNegative ? "#EF4444" : sourceNode?.color || "#a855f7";

      return {
        path,
        color,
        link,
        fromX,
        fromY,
        toX,
        toY,
        midX: (fromX + toX) / 2,
        midY: (fromY + toY) / 2,
      };
    }).filter(Boolean) as {
      path: string;
      color: string;
      link: FlowLink;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      midX: number;
      midY: number;
    }[];
  }, [safeLinks, nodePositions, safeNodes]);

  // Initialize particle system AFTER linkPaths is calculated
  // Use linkPaths.length to ensure particles only reference valid paths
  const particles = useParticleSystem(
    linkPaths.length,
    particleCount,
    showParticles && linkPaths.length > 0
  );

  // Get point on bezier curve for particles
  const getPointOnPath = useCallback(
    (linkIndex: number, t: number) => {
      const pathData = linkPaths[linkIndex];
      if (!pathData) return { x: 0, y: 0 };

      const { fromX, fromY, toX, toY } = pathData;
      const controlOffset = Math.abs(toX - fromX) * 0.4;
      const cp1x = fromX + controlOffset;
      const cp1y = fromY;
      const cp2x = toX - controlOffset;
      const cp2y = toY;

      const x =
        Math.pow(1 - t, 3) * fromX +
        3 * Math.pow(1 - t, 2) * t * cp1x +
        3 * (1 - t) * Math.pow(t, 2) * cp2x +
        Math.pow(t, 3) * toX;
      const y =
        Math.pow(1 - t, 3) * fromY +
        3 * Math.pow(1 - t, 2) * t * cp1y +
        3 * (1 - t) * Math.pow(t, 2) * cp2y +
        Math.pow(t, 3) * toY;

      return { x, y };
    },
    [linkPaths]
  );

  return (
    <div className={cn("relative", className)}>
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 60%)",
          }}
        />
      </div>

      <svg
        width={safeWidth}
        height={safeHeight}
        viewBox={`0 0 ${safeWidth} ${safeHeight}`}
        className="overflow-visible"
      >
        <defs>
          {/* Glass gradient for nodes */}
          <linearGradient id="glass-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(20, 20, 30, 0.95)" />
            <stop offset="100%" stopColor="rgba(10, 10, 15, 0.98)" />
          </linearGradient>

          {/* Scan line gradient */}
          <linearGradient id="scan-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          {/* Node glow filter */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Link glow filter */}
          <filter id="link-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
            </feMerge>
          </filter>

          {/* Particle glow filter */}
          <filter id="particle-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Glass blur */}
          <filter id="glass-blur">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>

          {/* Flow gradients for each link */}
          {linkPaths.map((pathData, i) => (
            <linearGradient
              key={`flow-gradient-${i}`}
              id={`flow-gradient-${i}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={pathData.color} stopOpacity={0.7} />
              <stop offset="50%" stopColor={pathData.color} stopOpacity={1} />
              <stop offset="100%" stopColor={pathData.color} stopOpacity={0.7} />
            </linearGradient>
          ))}

          {/* Node inner gradients */}
          {safeNodes.map((node, i) => (
            node && node.color ? (
              <linearGradient
                key={`node-inner-${i}`}
                id={`node-inner-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={node.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            ) : null
          ))}
        </defs>

        {/* Grid background */}
        <pattern id="cyber-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(168, 85, 247, 0.05)"
            strokeWidth="0.5"
          />
        </pattern>
        <rect width={safeWidth} height={safeHeight} fill="url(#cyber-grid)" />

        {/* Links */}
        {linkPaths.map((pathData, i) => (
          <EnergyLink
            key={`link-${i}`}
            path={pathData.path}
            color={pathData.color}
            label={pathData.link.label}
            labelX={pathData.midX}
            labelY={pathData.midY - 15}
            index={i}
            isNegative={pathData.link.isNegative}
            width={Math.max(4, Math.min(20, (pathData.link.value / 10) * 8))}
          />
        ))}

        {/* Particles */}
        {showParticles &&
          linkPaths.length > 0 &&
          particles
            .filter((p) => typeof p.size === "number" && p.size > 0)
            .map((particle) => {
              // Ensure linkIndex is within bounds
              if (linkPaths.length === 0) return null;
              const safeIndex = Math.abs(particle.linkIndex) % linkPaths.length;
              const pathData = linkPaths[safeIndex];
              if (!pathData) return null;

              const point = getPointOnPath(safeIndex, particle.progress);
              if (typeof point.x !== "number" || typeof point.y !== "number") return null;

              const size = particle.size || 3;

              return (
                <motion.circle
                  key={particle.id}
                  cx={point.x}
                  cy={point.y}
                  r={size}
                  fill={pathData.color}
                  opacity={(particle.opacity || 0.5) * (1 - Math.abs(particle.progress - 0.5) * 0.5)}
                  filter="url(#particle-glow)"
                />
              );
            })}

        {/* Nodes */}
        {safeNodes.map((node, i) => {
          if (!node || !node.id) return null;
          const pos = nodePositions[node.id];
          if (!pos) return null;

          return (
            <HoloNode
              key={node.id}
              node={node}
              x={pos.x}
              y={pos.y}
              width={pos.width}
              height={pos.height}
              index={i}
            />
          );
        })}
      </svg>
    </div>
  );
}

export const CyberSankey = memo(CyberSankeyComponent);

// ============================================================================
// Strategy Flow Preset - Pre-configured for APY visualization
// ============================================================================

interface APYSource {
  name: string;
  sublabel?: string;
  apy: number;
  color: string;
  icon?: React.ReactNode;
}

interface StrategyFlowProps {
  sources: APYSource[];
  borrowCosts: APYSource[];
  netApy: number;
  initialValue: number;
  projectedValue: number;
  width?: number;
  height?: number;
  className?: string;
}

export function StrategyFlow({
  sources,
  borrowCosts,
  netApy,
  initialValue,
  projectedValue,
  width = 900,
  height = 450,
  className,
}: StrategyFlowProps) {
  // Ensure all values are valid numbers
  const safeWidth = typeof width === "number" && isFinite(width) && width > 0 ? width : 900;
  const safeHeight = typeof height === "number" && isFinite(height) && height > 0 ? height : 450;
  const safeInitialValue = typeof initialValue === "number" && isFinite(initialValue) ? initialValue : 10000;
  const safeProjectedValue = typeof projectedValue === "number" && isFinite(projectedValue) ? projectedValue : 10000;
  const safeNetApy = typeof netApy === "number" && isFinite(netApy) ? netApy : 0;
  const safeSources = Array.isArray(sources) ? sources.filter(s => s && typeof s.apy === "number") : [];
  const safeBorrowCosts = Array.isArray(borrowCosts) ? borrowCosts.filter(c => c && typeof c.apy === "number") : [];

  // Convert to Sankey nodes and links
  const { nodes, links } = useMemo(() => {
    // If no sources and no costs, show a simple two-node flow
    const hasSources = safeSources.length > 0;
    const hasCosts = safeBorrowCosts.length > 0;

    // Input node
    const inputNode: FlowNode = {
      id: "input",
      label: "Initial Capital",
      sublabel: `$${safeInitialValue.toLocaleString()}`,
      value: 100,
      displayValue: "$" + safeInitialValue.toLocaleString(),
      color: "#06B6D4",
      glowColor: "#22D3EE",
      column: 0,
    };

    // Source nodes (middle column - yields)
    const sourceNodes: FlowNode[] = safeSources.map((source, i) => ({
      id: `source-${i}`,
      label: source.name || "Source",
      sublabel: source.sublabel,
      value: typeof source.apy === "number" && isFinite(source.apy) ? source.apy : 0,
      color: source.color || "#22C55E",
      icon: source.icon,
      column: 1,
    }));

    // Cost nodes (middle column - below yields)
    const costNodes: FlowNode[] = safeBorrowCosts.map((cost, i) => ({
      id: `cost-${i}`,
      label: cost.name || "Cost",
      sublabel: cost.sublabel,
      value: typeof cost.apy === "number" && isFinite(cost.apy) ? -cost.apy : 0,
      color: "#EF4444",
      icon: cost.icon,
      column: 1,
    }));

    // Output node - adjust column if no middle nodes
    const outputColumn = hasSources || hasCosts ? 2 : 1;
    const yearlyGain = Math.round(safeProjectedValue - safeInitialValue);
    const outputNode: FlowNode = {
      id: "output",
      label: "Net Result",
      sublabel: `${yearlyGain >= 0 ? "+" : ""}$${Math.abs(yearlyGain).toLocaleString()}/yr`,
      value: safeNetApy,
      displayValue: `${safeNetApy >= 0 ? "+" : ""}${safeNetApy.toFixed(2)}%`,
      color: safeNetApy >= 0 ? "#22C55E" : "#EF4444",
      glowColor: safeNetApy >= 0 ? "#4ADE80" : "#F87171",
      column: outputColumn,
    };

    const allNodes = [inputNode, ...sourceNodes, ...costNodes, outputNode];

    // Create links
    let flowLinks: FlowLink[] = [];

    if (!hasSources && !hasCosts) {
      // Direct link from input to output when no middle nodes
      flowLinks = [
        {
          source: "input",
          target: "output",
          value: Math.abs(safeNetApy),
          label: `${safeNetApy >= 0 ? "+" : ""}${safeNetApy.toFixed(1)}%`,
          isNegative: safeNetApy < 0,
        },
      ];
    } else {
      flowLinks = [
        // Input to sources
        ...safeSources.map((source, i) => {
          const apy = typeof source.apy === "number" && isFinite(source.apy) ? source.apy : 0;
          return {
            source: "input",
            target: `source-${i}`,
            value: apy,
            label: `+${apy.toFixed(1)}%`,
          };
        }),
        // Input to costs
        ...safeBorrowCosts.map((cost, i) => {
          const apy = typeof cost.apy === "number" && isFinite(cost.apy) ? cost.apy : 0;
          return {
            source: "input",
            target: `cost-${i}`,
            value: apy,
            label: `-${apy.toFixed(1)}%`,
            isNegative: true,
          };
        }),
        // Sources to output
        ...safeSources.map((source, i) => {
          const apy = typeof source.apy === "number" && isFinite(source.apy) ? source.apy : 0;
          return {
            source: `source-${i}`,
            target: "output",
            value: apy,
          };
        }),
        // Costs to output
        ...safeBorrowCosts.map((cost, i) => {
          const apy = typeof cost.apy === "number" && isFinite(cost.apy) ? cost.apy : 0;
          return {
            source: `cost-${i}`,
            target: "output",
            value: apy,
            isNegative: true,
          };
        }),
      ];
    }

    return { nodes: allNodes, links: flowLinks };
  }, [safeSources, safeBorrowCosts, safeNetApy, safeInitialValue, safeProjectedValue]);

  // Debug info at top
  const debugInfo = `Nodes: ${nodes.length}, Links: ${links.length}, Sources: ${safeSources.length}, Costs: ${safeBorrowCosts.length}`;

  // Always show something - even if just input->output
  if (nodes.length < 2) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-white/50 py-16", className)}
           style={{ width: safeWidth, height: safeHeight, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="text-lg mb-2">Strategy Flow</div>
        <div className="text-sm opacity-60">Build a strategy to see the flow visualization</div>
        <div className="text-xs mt-4 text-purple-400/60">{debugInfo}</div>
      </div>
    );
  }

  return (
    <div style={{ width: safeWidth, height: safeHeight, border: "1px solid rgba(168,85,247,0.2)", borderRadius: "8px" }}>
      <div className="text-xs text-center text-purple-400/60 py-1">{debugInfo}</div>
      <CyberSankey
        nodes={nodes}
        links={links}
        width={safeWidth}
        height={safeHeight - 24}
        className={className}
        showParticles={false}
        particleCount={0}
      />
    </div>
  );
}
