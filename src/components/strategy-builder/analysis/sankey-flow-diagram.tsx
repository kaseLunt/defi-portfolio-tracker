"use client";

/**
 * SankeyFlowDiagram Component
 *
 * An animated flow visualization showing how value flows and transforms
 * through a DeFi strategy. Features flowing particles, gradient paths,
 * and real-time value annotations.
 *
 * Inspired by sci-fi interfaces and premium data visualization.
 */

import { useEffect, useState, useMemo, memo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FlowNode {
  id: string;
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
  label?: string;
}

interface SankeyFlowDiagramProps {
  nodes: FlowNode[];
  links: FlowLink[];
  width?: number;
  height?: number;
  className?: string;
  showParticles?: boolean;
  particleCount?: number;
  animationDuration?: number;
}

// Particle component for animated flow
interface Particle {
  id: number;
  pathIndex: number;
  progress: number;
  speed: number;
  size: number;
}

function SankeyFlowDiagramComponent({
  nodes,
  links,
  width = 600,
  height = 300,
  className,
  showParticles = true,
  particleCount = 20,
  animationDuration = 3000,
}: SankeyFlowDiagramProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Calculate node positions
  const nodePositions = useMemo(() => {
    // Group nodes by column (left, middle, right)
    const leftNodes = nodes.filter((_, i) => i === 0);
    const middleNodes = nodes.filter((_, i) => i > 0 && i < nodes.length - 1);
    const rightNodes = nodes.filter((_, i) => i === nodes.length - 1);

    const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
    const nodeWidth = 120;
    const nodeHeight = 60;
    const padding = 40;

    // Position left nodes
    leftNodes.forEach((node, i) => {
      positions[node.id] = {
        x: padding,
        y: height / 2 - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    // Position middle nodes
    const middleX = width / 2 - nodeWidth / 2;
    const middleSpacing = (height - padding * 2) / Math.max(middleNodes.length, 1);
    middleNodes.forEach((node, i) => {
      positions[node.id] = {
        x: middleX,
        y: padding + i * middleSpacing + (middleSpacing - nodeHeight) / 2,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    // Position right nodes
    rightNodes.forEach((node, i) => {
      positions[node.id] = {
        x: width - padding - nodeWidth,
        y: height / 2 - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
      };
    });

    return positions;
  }, [nodes, width, height]);

  // Generate smooth bezier paths for links
  const linkPaths = useMemo(() => {
    return links.map((link, index) => {
      const source = nodePositions[link.source];
      const target = nodePositions[link.target];

      if (!source || !target) return { path: "", color: "#00ffd0", link };

      const sourceX = source.x + source.width;
      const sourceY = source.y + source.height / 2;
      const targetX = target.x;
      const targetY = target.y + target.height / 2;

      // Calculate control points for smooth curve
      const midX = (sourceX + targetX) / 2;
      const controlOffset = Math.abs(targetX - sourceX) * 0.4;

      const path = `M ${sourceX} ${sourceY}
                    C ${sourceX + controlOffset} ${sourceY},
                      ${targetX - controlOffset} ${targetY},
                      ${targetX} ${targetY}`;

      // Get color from source node
      const sourceNode = nodes.find(n => n.id === link.source);
      const color = sourceNode?.color || "#00ffd0";

      return { path, color, link, sourceX, sourceY, targetX, targetY };
    });
  }, [links, nodePositions, nodes]);

  // Initialize particles
  useEffect(() => {
    if (!showParticles || linkPaths.length === 0) return;

    const initialParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      initialParticles.push({
        id: i,
        pathIndex: Math.floor(Math.random() * linkPaths.length),
        progress: Math.random(),
        speed: 0.3 + Math.random() * 0.4,
        size: 2 + Math.random() * 3,
      });
    }
    setParticles(initialParticles);
  }, [showParticles, particleCount, linkPaths.length]);

  // Animate particles
  useEffect(() => {
    if (!showParticles || particles.length === 0) return;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      setParticles(prev =>
        prev.map(particle => {
          let newProgress = particle.progress + (particle.speed * deltaTime) / animationDuration;
          if (newProgress > 1) {
            newProgress = 0;
            return {
              ...particle,
              progress: newProgress,
              pathIndex: Math.floor(Math.random() * linkPaths.length),
              speed: 0.3 + Math.random() * 0.4,
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
  }, [showParticles, particles.length, animationDuration, linkPaths.length]);

  // Get point on bezier curve
  const getPointOnPath = useCallback(
    (pathIndex: number, t: number) => {
      const pathData = linkPaths[pathIndex];
      if (!pathData) return { x: 0, y: 0 };

      const { sourceX, sourceY, targetX, targetY } = pathData;
      if (sourceX === undefined) return { x: 0, y: 0 };

      const controlOffset = Math.abs(targetX - sourceX) * 0.4;
      const cp1x = sourceX + controlOffset;
      const cp1y = sourceY;
      const cp2x = targetX - controlOffset;
      const cp2y = targetY;

      // Cubic bezier formula
      const x =
        Math.pow(1 - t, 3) * sourceX +
        3 * Math.pow(1 - t, 2) * t * cp1x +
        3 * (1 - t) * Math.pow(t, 2) * cp2x +
        Math.pow(t, 3) * targetX;
      const y =
        Math.pow(1 - t, 3) * sourceY +
        3 * Math.pow(1 - t, 2) * t * cp1y +
        3 * (1 - t) * Math.pow(t, 2) * cp2y +
        Math.pow(t, 3) * targetY;

      return { x, y };
    },
    [linkPaths]
  );

  return (
    <div className={cn("relative", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Defs for gradients and filters */}
        <defs>
          {/* Glow filter */}
          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Particle glow */}
          <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradients for each link */}
          {linkPaths.map((pathData, i) => (
            <linearGradient
              key={`gradient-${i}`}
              id={`link-gradient-${i}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={pathData.color} stopOpacity={0.8} />
              <stop offset="50%" stopColor={pathData.color} stopOpacity={1} />
              <stop offset="100%" stopColor={pathData.color} stopOpacity={0.8} />
            </linearGradient>
          ))}
        </defs>

        {/* Flow paths */}
        {linkPaths.map((pathData, i) => (
          <g key={`link-${i}`}>
            {/* Base path (wider, dimmer) */}
            <motion.path
              d={pathData.path}
              fill="none"
              stroke={pathData.color}
              strokeWidth={8}
              strokeOpacity={0.1}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, delay: i * 0.2 }}
            />

            {/* Main path */}
            <motion.path
              d={pathData.path}
              fill="none"
              stroke={`url(#link-gradient-${i})`}
              strokeWidth={3}
              strokeLinecap="round"
              filter="url(#flow-glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, delay: i * 0.2 }}
            />

            {/* Animated dash overlay */}
            <motion.path
              d={pathData.path}
              fill="none"
              stroke={pathData.color}
              strokeWidth={2}
              strokeDasharray="4 8"
              strokeLinecap="round"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -24 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{ opacity: 0.5 }}
            />

            {/* Value label on path */}
            {pathData.link.label && (
              <motion.text
                x={(pathData.sourceX! + pathData.targetX!) / 2}
                y={(pathData.sourceY! + pathData.targetY!) / 2 - 15}
                textAnchor="middle"
                className="fill-white/60 text-xs font-mono"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 + i * 0.2 }}
              >
                {pathData.link.label}
              </motion.text>
            )}
          </g>
        ))}

        {/* Particles */}
        {showParticles &&
          linkPaths.length > 0 &&
          particles
            .filter((p) => typeof p.size === "number" && p.size > 0)
            .map(particle => {
              if (linkPaths.length === 0) return null;
              const safeIndex = Math.abs(particle.pathIndex) % linkPaths.length;
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
                  filter="url(#particle-glow)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 0.5,
                    times: [0, 0.1, 0.9, 1],
                  }}
                />
              );
            })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
            >
              {/* Node background with glow */}
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                rx={12}
                fill="rgba(10, 10, 15, 0.9)"
                stroke={node.color}
                strokeWidth={2}
                filter="url(#flow-glow)"
              />

              {/* Inner gradient */}
              <rect
                x={pos.x + 2}
                y={pos.y + 2}
                width={pos.width - 4}
                height={pos.height - 4}
                rx={10}
                fill={`url(#node-inner-${node.id})`}
                opacity={0.3}
              />

              {/* Node label */}
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + 22}
                textAnchor="middle"
                className="fill-white/70 text-xs font-medium"
              >
                {node.label}
              </text>

              {/* Node value */}
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + 42}
                textAnchor="middle"
                className="text-sm font-mono font-bold"
                fill={node.color}
                style={{
                  filter: `drop-shadow(0 0 8px ${node.color})`,
                }}
              >
                {node.value.toFixed(2)}%
              </text>

              {/* Pulsing ring on hover */}
              <motion.rect
                x={pos.x - 3}
                y={pos.y - 3}
                width={pos.width + 6}
                height={pos.height + 6}
                rx={14}
                fill="none"
                stroke={node.color}
                strokeWidth={1}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

export const SankeyFlowDiagram = memo(SankeyFlowDiagramComponent);

/**
 * APYBreakdownFlow - Pre-configured Sankey for APY visualization
 */
interface APYSource {
  name: string;
  apy: number;
  color: string;
}

interface APYBreakdownFlowProps {
  sources: APYSource[];
  totalAPY: number;
  width?: number;
  height?: number;
  className?: string;
}

export function APYBreakdownFlow({
  sources,
  totalAPY,
  width = 600,
  height = 280,
  className,
}: APYBreakdownFlowProps) {
  // Convert sources to nodes and links
  const { nodes, links } = useMemo(() => {
    const inputNode: FlowNode = {
      id: "input",
      label: "Strategy Input",
      value: totalAPY,
      color: "#a855f7",
    };

    const sourceNodes: FlowNode[] = sources.map((source, i) => ({
      id: `source-${i}`,
      label: source.name,
      value: source.apy,
      color: source.color,
    }));

    const outputNode: FlowNode = {
      id: "output",
      label: "Total APY",
      value: totalAPY,
      color: "#00ffd0",
    };

    const flowNodes = [inputNode, ...sourceNodes, outputNode];

    const flowLinks: FlowLink[] = [
      // Input to sources
      ...sources.map((source, i) => ({
        source: "input",
        target: `source-${i}`,
        value: source.apy,
        label: `${source.apy.toFixed(1)}%`,
      })),
      // Sources to output
      ...sources.map((source, i) => ({
        source: `source-${i}`,
        target: "output",
        value: source.apy,
      })),
    ];

    return { nodes: flowNodes, links: flowLinks };
  }, [sources, totalAPY]);

  return (
    <SankeyFlowDiagram
      nodes={nodes}
      links={links}
      width={width}
      height={height}
      className={className}
      showParticles={true}
      particleCount={30}
    />
  );
}
