/**
 * Route Optimizer
 *
 * Analyzes strategy graphs and automatically inserts wrap/unwrap steps
 * to ensure token compatibility between connected protocols.
 */

import type { AssetType, StrategyBlock, StrategyEdge, BlockType, BlockData } from "./types";
import { STAKING_PROTOCOLS, LENDING_PROTOCOLS } from "./protocols";

// ============================================================================
// Token Compatibility Registry
// ============================================================================

/**
 * Token wrapper definitions.
 * Maps unwrapped tokens to their wrapped equivalents and vice versa.
 */
export interface TokenWrapper {
  unwrapped: AssetType;
  wrapped: AssetType;
  wrapperContract: string;
  wrapMethod: "deposit" | "wrap" | "submit";
  unwrapMethod: "withdraw" | "unwrap" | "redeem";
  /** Protocols that directly output this wrapped version */
  directOutputFrom?: string[];
}

export const TOKEN_WRAPPERS: TokenWrapper[] = [
  {
    unwrapped: "ETH",
    wrapped: "stETH",
    wrapperContract: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", // Lido stETH
    wrapMethod: "submit",
    unwrapMethod: "withdraw",
    directOutputFrom: ["lido"],
  },
  {
    unwrapped: "stETH",
    wrapped: "wstETH",
    wrapperContract: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", // Lido wstETH
    wrapMethod: "wrap",
    unwrapMethod: "unwrap",
  },
  {
    unwrapped: "ETH",
    wrapped: "eETH",
    wrapperContract: "0x35fA164735182de50811E8e2E824cFb9B6118ac2", // EtherFi eETH
    wrapMethod: "deposit",
    unwrapMethod: "withdraw",
    directOutputFrom: ["etherfi"],
  },
  {
    unwrapped: "eETH",
    wrapped: "weETH",
    wrapperContract: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee", // EtherFi weETH
    wrapMethod: "wrap",
    unwrapMethod: "unwrap",
  },
  {
    unwrapped: "ETH",
    wrapped: "rETH",
    wrapperContract: "0xae78736Cd615f374D3085123A210448E74Fc6393", // Rocket Pool rETH
    wrapMethod: "deposit",
    unwrapMethod: "withdraw",
    directOutputFrom: ["rocketpool"],
  },
  {
    unwrapped: "ETH",
    wrapped: "cbETH",
    wrapperContract: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", // Coinbase cbETH
    wrapMethod: "deposit",
    unwrapMethod: "withdraw",
    directOutputFrom: ["coinbase"],
  },
  {
    unwrapped: "ETH",
    wrapped: "sfrxETH",
    wrapperContract: "0xac3E018457B222d93114458476f3E3416Abbe38F", // Frax sfrxETH
    wrapMethod: "deposit",
    unwrapMethod: "withdraw",
    directOutputFrom: ["frax"],
  },
];

/**
 * Protocol asset acceptance.
 * Maps protocols to the assets they accept as collateral.
 */
export const PROTOCOL_ACCEPTED_ASSETS: Record<string, AssetType[]> = {
  "aave-v3": ["ETH", "weETH", "wstETH", "USDC", "USDT", "DAI"],
  "compound-v3": ["ETH", "USDC", "USDT"],
  "morpho": ["ETH", "weETH", "wstETH", "USDC", "DAI"],
  "spark": ["ETH", "wstETH", "DAI"],
};

/**
 * Token addresses by chain and symbol.
 * Used to update downstream block params when wrap blocks are inserted.
 */
const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  1: { // Ethereum Mainnet
    stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
    rETH: "0xae78736Cd615f374D3085123A210448E74Fc6393",
    cbETH: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
    sfrxETH: "0xac3E018457B222d93114458476f3E3416Abbe38F",
  },
  42161: { // Arbitrum
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529",
    weETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
  },
  8453: { // Base
    wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
    weETH: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A",
  },
};

/**
 * Get the token address for an asset symbol on a given chain.
 */
function getAssetAddress(asset: AssetType, chainId: number): string | null {
  return TOKEN_ADDRESSES[chainId]?.[asset] ?? null;
}

// ============================================================================
// Route Analysis
// ============================================================================

export interface TokenIncompatibility {
  sourceBlockId: string;
  targetBlockId: string;
  sourceOutput: AssetType;
  targetAccepts: AssetType[];
  requiredWrapSteps: WrapStep[];
}

export interface WrapStep {
  from: AssetType;
  to: AssetType;
  wrapperContract: string;
  method: string;
  isWrap: boolean; // true = wrap, false = unwrap
}

/**
 * Get the output asset of a block based on its type and configuration.
 */
export function getBlockOutputAsset(block: StrategyBlock): AssetType | null {
  const data = block.data;

  switch (block.type) {
    case "input":
      return (data as { asset?: AssetType }).asset ?? "ETH";

    case "stake": {
      const protocol = (data as { protocol?: string }).protocol;
      const stakingConfig = STAKING_PROTOCOLS.find(p => p.id === protocol);
      return stakingConfig?.outputAsset ?? null;
    }

    case "lend":
      // Lending doesn't change the asset, it deposits it
      return null; // Output is receipt token, handled by protocol

    case "borrow":
      return (data as { asset?: AssetType }).asset ?? null;

    case "swap":
      return (data as { toAsset?: AssetType }).toAsset ?? null;

    default:
      return null;
  }
}

/**
 * Get the assets a block accepts as input.
 */
export function getBlockAcceptedAssets(block: StrategyBlock): AssetType[] {
  const data = block.data;

  switch (block.type) {
    case "stake": {
      const protocol = (data as { protocol?: string }).protocol;
      const stakingConfig = STAKING_PROTOCOLS.find(p => p.id === protocol);
      return stakingConfig ? [stakingConfig.inputAsset] : ["ETH"];
    }

    case "lend": {
      const protocol = (data as { protocol?: string }).protocol;
      return PROTOCOL_ACCEPTED_ASSETS[protocol ?? ""] ?? ["ETH"];
    }

    case "swap":
      return [(data as { fromAsset?: AssetType }).fromAsset ?? "ETH"];

    default:
      return ["ETH", "USDC", "USDT", "DAI", "stETH", "eETH", "weETH", "wstETH", "rETH", "cbETH", "sfrxETH"];
  }
}

/**
 * Find the wrap path between two assets.
 * Returns null if no path exists.
 */
export function findWrapPath(from: AssetType, to: AssetType): WrapStep[] | null {
  if (from === to) return [];

  // Direct wrap (e.g., eETH → weETH)
  const directWrap = TOKEN_WRAPPERS.find(
    w => w.unwrapped === from && w.wrapped === to
  );
  if (directWrap) {
    return [{
      from,
      to,
      wrapperContract: directWrap.wrapperContract,
      method: directWrap.wrapMethod,
      isWrap: true,
    }];
  }

  // Direct unwrap (e.g., weETH → eETH)
  const directUnwrap = TOKEN_WRAPPERS.find(
    w => w.wrapped === from && w.unwrapped === to
  );
  if (directUnwrap) {
    return [{
      from,
      to,
      wrapperContract: directUnwrap.wrapperContract,
      method: directUnwrap.unwrapMethod,
      isWrap: false,
    }];
  }

  // Two-step path (e.g., ETH → stETH → wstETH)
  // Find intermediate via shared base
  for (const wrapper1 of TOKEN_WRAPPERS) {
    if (wrapper1.unwrapped === from) {
      // from → wrapper1.wrapped
      for (const wrapper2 of TOKEN_WRAPPERS) {
        if (wrapper2.unwrapped === wrapper1.wrapped && wrapper2.wrapped === to) {
          return [
            {
              from,
              to: wrapper1.wrapped,
              wrapperContract: wrapper1.wrapperContract,
              method: wrapper1.wrapMethod,
              isWrap: true,
            },
            {
              from: wrapper1.wrapped,
              to,
              wrapperContract: wrapper2.wrapperContract,
              method: wrapper2.wrapMethod,
              isWrap: true,
            },
          ];
        }
      }
    }
  }

  return null;
}

/**
 * Analyze a strategy for token incompatibilities.
 */
export function analyzeRouteCompatibility(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): TokenIncompatibility[] {
  const incompatibilities: TokenIncompatibility[] = [];

  for (const edge of edges) {
    const sourceBlock = blocks.find(b => b.id === edge.source);
    const targetBlock = blocks.find(b => b.id === edge.target);

    if (!sourceBlock || !targetBlock) continue;

    const sourceOutput = getBlockOutputAsset(sourceBlock);
    const targetAccepts = getBlockAcceptedAssets(targetBlock);

    if (!sourceOutput) continue; // Source doesn't have a meaningful output

    // Check if target accepts the source output
    if (!targetAccepts.includes(sourceOutput)) {
      // Find required wrap steps - prefer wrapping over unwrapping
      // (wrapping preserves yield, unwrapping loses it)
      let bestPath: WrapStep[] | null = null;
      let bestIsWrap = false;

      for (const acceptedAsset of targetAccepts) {
        const wrapPath = findWrapPath(sourceOutput, acceptedAsset);
        if (wrapPath && wrapPath.length > 0) {
          const isWrapPath = wrapPath.every(step => step.isWrap);

          // Prefer wrap paths over unwrap paths
          if (!bestPath || (isWrapPath && !bestIsWrap)) {
            bestPath = wrapPath;
            bestIsWrap = isWrapPath;
          }

          // If we found a pure wrap path, stop looking
          if (isWrapPath) break;
        }
      }

      if (bestPath) {
        incompatibilities.push({
          sourceBlockId: sourceBlock.id,
          targetBlockId: targetBlock.id,
          sourceOutput,
          targetAccepts,
          requiredWrapSteps: bestPath,
        });
      }
    }
  }

  return incompatibilities;
}

// ============================================================================
// Auto-Insert Wrap Nodes
// ============================================================================

export interface AutoWrapBlockData {
  type: "auto-wrap";
  label: string;
  isConfigured: true;
  isValid: true;
  isAutoInserted: true;
  wrapStep: WrapStep;
  fromAsset: AssetType;
  toAsset: AssetType;
  wrapperContract: string;
}

export interface OptimizedRoute {
  blocks: StrategyBlock[];
  edges: StrategyEdge[];
  autoInsertedBlockIds: string[];
  insertedWrapSteps: Array<{
    blockId: string;
    from: AssetType;
    to: AssetType;
    afterBlockId: string;
    beforeBlockId: string;
  }>;
}

/**
 * Optimize a strategy by auto-inserting wrap/unwrap nodes.
 */
export function optimizeRoute(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): OptimizedRoute {
  const incompatibilities = analyzeRouteCompatibility(blocks, edges);

  if (incompatibilities.length === 0) {
    return {
      blocks,
      edges,
      autoInsertedBlockIds: [],
      insertedWrapSteps: [],
    };
  }

  const newBlocks = [...blocks];
  const newEdges: StrategyEdge[] = [];
  const autoInsertedBlockIds: string[] = [];
  const insertedWrapSteps: OptimizedRoute["insertedWrapSteps"] = [];

  // Track which edges to replace
  const edgesToReplace = new Set<string>();

  for (const incompat of incompatibilities) {
    const edgeKey = `${incompat.sourceBlockId}->${incompat.targetBlockId}`;
    edgesToReplace.add(edgeKey);

    // Get source block position for placing wrap nodes
    const sourceBlock = blocks.find(b => b.id === incompat.sourceBlockId);
    const targetBlock = blocks.find(b => b.id === incompat.targetBlockId);

    if (!sourceBlock || !targetBlock) continue;

    let previousBlockId = incompat.sourceBlockId;
    let currentAsset = incompat.sourceOutput;

    // Insert wrap blocks for each step
    for (let i = 0; i < incompat.requiredWrapSteps.length; i++) {
      const step = incompat.requiredWrapSteps[i];
      const wrapBlockId = `auto-wrap-${incompat.sourceBlockId}-${i}-${Date.now()}`;

      // Calculate position between source and target
      const sourceX = sourceBlock.position.x;
      const sourceY = sourceBlock.position.y;
      const targetX = targetBlock.position.x;
      const targetY = targetBlock.position.y;

      const progress = (i + 1) / (incompat.requiredWrapSteps.length + 1);
      const wrapX = sourceX + (targetX - sourceX) * progress;
      const wrapY = sourceY + (targetY - sourceY) * progress;

      console.log("[route-optimizer] Creating wrap block, step:", JSON.stringify(step));
      const wrapBlockData: AutoWrapBlockData = {
        type: "auto-wrap",
        label: `${step.from} → ${step.to}`,
        isConfigured: true,
        isValid: true,
        isAutoInserted: true,
        fromAsset: step.from,
        toAsset: step.to,
        wrapStep: step,
        wrapperContract: step.wrapperContract,
      };
      console.log("[route-optimizer] Created wrapBlockData:", JSON.stringify(wrapBlockData));

      const wrapBlock: StrategyBlock = {
        id: wrapBlockId,
        type: "auto-wrap" as BlockType,
        position: { x: wrapX, y: wrapY },
        data: wrapBlockData as unknown as BlockData,
      };

      newBlocks.push(wrapBlock);
      autoInsertedBlockIds.push(wrapBlockId);
      insertedWrapSteps.push({
        blockId: wrapBlockId,
        from: step.from,
        to: step.to,
        afterBlockId: previousBlockId,
        beforeBlockId: i === incompat.requiredWrapSteps.length - 1
          ? incompat.targetBlockId
          : `auto-wrap-${incompat.sourceBlockId}-${i + 1}-${Date.now()}`,
      });

      // Create edge from previous to wrap
      newEdges.push({
        id: `edge-${previousBlockId}-${wrapBlockId}`,
        source: previousBlockId,
        target: wrapBlockId,
        type: "flow",
        data: {
          asset: currentAsset,
          flowPercent: 100,
        },
      });

      previousBlockId = wrapBlockId;
      currentAsset = step.to;
    }

    // Create edge from last wrap to target
    newEdges.push({
      id: `edge-${previousBlockId}-${incompat.targetBlockId}`,
      source: previousBlockId,
      target: incompat.targetBlockId,
      type: "flow",
      data: {
        asset: currentAsset,
        flowPercent: 100,
      },
    });

    // Update target block's asset params to match the wrapped output
    // This ensures the lend block knows to deposit weETH instead of defaulting to wstETH
    const targetBlockIndex = newBlocks.findIndex(b => b.id === incompat.targetBlockId);
    if (targetBlockIndex !== -1) {
      // Get chainId from block data (LendBlockData has 'chain' property) or default to 1
      const blockData = newBlocks[targetBlockIndex].data as { chain?: number };
      const chainId = blockData.chain ?? 1;
      const assetAddress = getAssetAddress(currentAsset, chainId);
      if (assetAddress) {
        console.log(`[route-optimizer] Updating target block ${incompat.targetBlockId} asset to ${currentAsset} (${assetAddress})`);
        // Use type assertion to add asset params (these are read from block.params in builder)
        newBlocks[targetBlockIndex] = {
          ...newBlocks[targetBlockIndex],
          data: {
            ...newBlocks[targetBlockIndex].data,
            asset: assetAddress,
            assetSymbol: currentAsset,
          } as BlockData,
        };
      }
    }
  }

  // Add edges that don't need replacement
  for (const edge of edges) {
    const edgeKey = `${edge.source}->${edge.target}`;
    if (!edgesToReplace.has(edgeKey)) {
      newEdges.push(edge);
    }
  }

  return {
    blocks: newBlocks,
    edges: newEdges,
    autoInsertedBlockIds,
    insertedWrapSteps,
  };
}

// ============================================================================
// Route Validation
// ============================================================================

export interface RouteValidationResult {
  isValid: boolean;
  errors: RouteValidationError[];
  warnings: RouteValidationWarning[];
}

export interface RouteValidationError {
  type: "incompatible_tokens" | "missing_connection" | "invalid_chain" | "unsupported_asset";
  message: string;
  blockId?: string;
  edgeId?: string;
  suggestedFix?: string;
}

export interface RouteValidationWarning {
  type: "high_gas" | "low_liquidity" | "high_slippage";
  message: string;
  blockId?: string;
}

/**
 * Validate a route before simulation.
 */
export function validateRoute(
  blocks: StrategyBlock[],
  edges: StrategyEdge[]
): RouteValidationResult {
  const errors: RouteValidationError[] = [];
  const warnings: RouteValidationWarning[] = [];

  // Check for unresolvable incompatibilities
  const incompatibilities = analyzeRouteCompatibility(blocks, edges);

  for (const incompat of incompatibilities) {
    // Check if we found a valid wrap path
    if (incompat.requiredWrapSteps.length === 0) {
      errors.push({
        type: "incompatible_tokens",
        message: `Cannot convert ${incompat.sourceOutput} to any asset accepted by the target block`,
        blockId: incompat.sourceBlockId,
        edgeId: `${incompat.sourceBlockId}->${incompat.targetBlockId}`,
        suggestedFix: `Add a swap block to convert ${incompat.sourceOutput} to ${incompat.targetAccepts[0]}`,
      });
    }
  }

  // Check for disconnected blocks
  const connectedBlocks = new Set<string>();
  for (const edge of edges) {
    connectedBlocks.add(edge.source);
    connectedBlocks.add(edge.target);
  }

  const inputBlocks = blocks.filter(b => b.type === "input");
  const actionBlocks = blocks.filter(b => b.type !== "input");

  for (const block of actionBlocks) {
    if (!connectedBlocks.has(block.id)) {
      warnings.push({
        type: "high_gas",
        message: `Block "${block.data.label}" is not connected to the strategy flow`,
        blockId: block.id,
      });
    }
  }

  // Check for blocks without input (except input blocks)
  for (const block of actionBlocks) {
    const hasIncomingEdge = edges.some(e => e.target === block.id);
    if (!hasIncomingEdge) {
      errors.push({
        type: "missing_connection",
        message: `Block "${block.data.label}" has no input connection`,
        blockId: block.id,
        suggestedFix: "Connect an output from another block to this block's input",
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Error Message Translation
// ============================================================================

export interface TranslatedError {
  title: string;
  description: string;
  technicalDetails?: string;
  suggestedFixes: SuggestedFix[];
}

export interface SuggestedFix {
  label: string;
  action: "add_wrap" | "add_swap" | "increase_slippage" | "reduce_amount";
  params?: Record<string, unknown>;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  translate: (match: RegExpMatchArray, context?: ErrorContext) => TranslatedError;
}> = [
  {
    pattern: /ERC20: transfer amount exceeds balance/i,
    translate: (_match, context) => ({
      title: "Insufficient Token Balance",
      description: context?.expectedAsset && context?.receivedAsset
        ? `The protocol expects ${context.expectedAsset} but received ${context.receivedAsset}. A wrap step is needed.`
        : "The transaction requires more tokens than available. This often happens when tokens need to be wrapped first.",
      suggestedFixes: context?.expectedAsset && context?.receivedAsset
        ? [{
            label: `Add ${context.receivedAsset} → ${context.expectedAsset} wrap`,
            action: "add_wrap" as const,
            params: { from: context.receivedAsset, to: context.expectedAsset },
          }]
        : [],
    }),
  },
  {
    pattern: /execution reverted(?:: (.+))?/i,
    translate: (match) => ({
      title: "Transaction Would Fail",
      description: match[1] || "The transaction would revert if executed. This could be due to slippage, liquidity, or permission issues.",
      technicalDetails: match[0],
      suggestedFixes: [
        { label: "Increase slippage tolerance", action: "increase_slippage" as const },
        { label: "Reduce transaction amount", action: "reduce_amount" as const },
      ],
    }),
  },
  {
    pattern: /insufficient funds for gas/i,
    translate: () => ({
      title: "Not Enough ETH for Gas",
      description: "Your wallet needs ETH to pay for transaction fees.",
      suggestedFixes: [],
    }),
  },
  {
    pattern: /allowance/i,
    translate: (_match, context) => ({
      title: "Token Approval Required",
      description: `You need to approve the protocol to spend your ${context?.token ?? "tokens"}.`,
      suggestedFixes: [],
    }),
  },
];

export interface ErrorContext {
  expectedAsset?: AssetType;
  receivedAsset?: AssetType;
  token?: string;
  amount?: string;
}

/**
 * Translate a technical error message into user-friendly guidance.
 */
export function translateError(
  technicalError: string,
  context?: ErrorContext
): TranslatedError {
  for (const { pattern, translate } of ERROR_PATTERNS) {
    const match = technicalError.match(pattern);
    if (match) {
      return translate(match, context);
    }
  }

  // Default fallback
  return {
    title: "Transaction Error",
    description: "Something went wrong with this transaction step.",
    technicalDetails: technicalError,
    suggestedFixes: [],
  };
}
