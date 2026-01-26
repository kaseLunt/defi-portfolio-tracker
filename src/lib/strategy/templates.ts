/**
 * DeFi Strategy Builder - Pre-built Templates
 *
 * Ready-to-use strategy templates for common DeFi strategies.
 */

import type {
  StrategyBlock,
  StrategyEdge,
  StrategyTemplate,
  InputBlockData,
  StakeBlockData,
  LendBlockData,
  BorrowBlockData,
} from "./types";

// ============================================================================
// Template Definitions
// ============================================================================

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "conservative-lst",
    name: "Conservative LST",
    description: "Simple ETH staking with EtherFi for steady yield",
    riskLevel: "low",
    estimatedApy: "3-4%",
    tags: ["beginner", "eth", "staking"],
    blocks: [],
    edges: [],
  },
  {
    id: "lst-lending",
    name: "LST + Lending",
    description: "Stake ETH, then supply LST to earn additional yield",
    riskLevel: "low",
    estimatedApy: "4-5%",
    tags: ["intermediate", "eth", "lending"],
    blocks: [],
    edges: [],
  },
  {
    id: "leveraged-lst-2x",
    name: "Leveraged LST (2x)",
    description: "Loop staking with 2x leverage for amplified returns",
    riskLevel: "medium",
    estimatedApy: "6-8%",
    tags: ["advanced", "leverage", "looping"],
    blocks: [],
    edges: [],
  },
  {
    id: "stablecoin-yield",
    name: "Stablecoin Yield",
    description: "Supply USDC to Morpho for high stablecoin yields",
    riskLevel: "low",
    estimatedApy: "8-12%",
    tags: ["beginner", "stablecoin", "usdc"],
    blocks: [],
    edges: [],
  },
];

// ============================================================================
// Template Block Generators
// ============================================================================

/**
 * Generate blocks and edges for Conservative LST template
 */
export function generateConservativeLST(): { blocks: StrategyBlock[]; edges: StrategyEdge[] } {
  const inputBlock: StrategyBlock = {
    id: "template_input_1",
    type: "input",
    position: { x: 100, y: 200 },
    data: {
      type: "input",
      asset: "ETH",
      amount: 1,
      label: "Input Capital",
      isConfigured: true,
      isValid: true,
    } as InputBlockData,
  };

  const stakeBlock: StrategyBlock = {
    id: "template_stake_1",
    type: "stake",
    position: { x: 400, y: 200 },
    data: {
      type: "stake",
      protocol: "etherfi",
      inputAsset: "ETH",
      outputAsset: "eETH",
      apy: 3.2,
      label: "Stake",
      isConfigured: true,
      isValid: true,
    } as StakeBlockData,
  };

  const edges: StrategyEdge[] = [
    {
      id: "template_edge_1",
      source: "template_input_1",
      target: "template_stake_1",
      type: "smoothstep",
      animated: true,
    },
  ];

  return { blocks: [inputBlock, stakeBlock], edges };
}

/**
 * Generate blocks and edges for LST + Lending template
 */
export function generateLSTLending(): { blocks: StrategyBlock[]; edges: StrategyEdge[] } {
  const inputBlock: StrategyBlock = {
    id: "template_input_1",
    type: "input",
    position: { x: 100, y: 200 },
    data: {
      type: "input",
      asset: "ETH",
      amount: 1,
      label: "Input Capital",
      isConfigured: true,
      isValid: true,
    } as InputBlockData,
  };

  const stakeBlock: StrategyBlock = {
    id: "template_stake_1",
    type: "stake",
    position: { x: 350, y: 200 },
    data: {
      type: "stake",
      protocol: "etherfi",
      inputAsset: "ETH",
      outputAsset: "eETH",
      apy: 3.2,
      label: "Stake",
      isConfigured: true,
      isValid: true,
    } as StakeBlockData,
  };

  const lendBlock: StrategyBlock = {
    id: "template_lend_1",
    type: "lend",
    position: { x: 600, y: 200 },
    data: {
      type: "lend",
      protocol: "aave-v3",
      chain: 1,
      supplyApy: 0.5,
      maxLtv: 77,
      liquidationThreshold: 80,
      label: "Lend",
      isConfigured: true,
      isValid: true,
    } as LendBlockData,
  };

  const edges: StrategyEdge[] = [
    {
      id: "template_edge_1",
      source: "template_input_1",
      target: "template_stake_1",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "template_edge_2",
      source: "template_stake_1",
      target: "template_lend_1",
      type: "smoothstep",
      animated: true,
    },
  ];

  return { blocks: [inputBlock, stakeBlock, lendBlock], edges };
}

/**
 * Generate blocks and edges for Leveraged LST template
 */
export function generateLeveragedLST(): { blocks: StrategyBlock[]; edges: StrategyEdge[] } {
  const inputBlock: StrategyBlock = {
    id: "template_input_1",
    type: "input",
    position: { x: 100, y: 200 },
    data: {
      type: "input",
      asset: "ETH",
      amount: 1,
      label: "Input Capital",
      isConfigured: true,
      isValid: true,
    } as InputBlockData,
  };

  const stakeBlock1: StrategyBlock = {
    id: "template_stake_1",
    type: "stake",
    position: { x: 300, y: 200 },
    data: {
      type: "stake",
      protocol: "etherfi",
      inputAsset: "ETH",
      outputAsset: "eETH",
      apy: 3.2,
      label: "Stake",
      isConfigured: true,
      isValid: true,
    } as StakeBlockData,
  };

  const lendBlock: StrategyBlock = {
    id: "template_lend_1",
    type: "lend",
    position: { x: 500, y: 200 },
    data: {
      type: "lend",
      protocol: "aave-v3",
      chain: 1,
      supplyApy: 0.5,
      maxLtv: 77,
      liquidationThreshold: 80,
      label: "Lend",
      isConfigured: true,
      isValid: true,
    } as LendBlockData,
  };

  const borrowBlock: StrategyBlock = {
    id: "template_borrow_1",
    type: "borrow",
    position: { x: 700, y: 200 },
    data: {
      type: "borrow",
      asset: "ETH",
      ltvPercent: 70,
      borrowApy: 2.8,
      label: "Borrow",
      isConfigured: true,
      isValid: true,
    } as BorrowBlockData,
  };

  const stakeBlock2: StrategyBlock = {
    id: "template_stake_2",
    type: "stake",
    position: { x: 900, y: 200 },
    data: {
      type: "stake",
      protocol: "etherfi",
      inputAsset: "ETH",
      outputAsset: "eETH",
      apy: 3.2,
      label: "Stake",
      isConfigured: true,
      isValid: true,
    } as StakeBlockData,
  };

  const edges: StrategyEdge[] = [
    {
      id: "template_edge_1",
      source: "template_input_1",
      target: "template_stake_1",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "template_edge_2",
      source: "template_stake_1",
      target: "template_lend_1",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "template_edge_3",
      source: "template_lend_1",
      target: "template_borrow_1",
      type: "smoothstep",
      animated: true,
    },
    {
      id: "template_edge_4",
      source: "template_borrow_1",
      target: "template_stake_2",
      type: "smoothstep",
      animated: true,
    },
  ];

  return {
    blocks: [inputBlock, stakeBlock1, lendBlock, borrowBlock, stakeBlock2],
    edges,
  };
}

/**
 * Generate blocks and edges for Stablecoin Yield template
 */
export function generateStablecoinYield(): { blocks: StrategyBlock[]; edges: StrategyEdge[] } {
  const inputBlock: StrategyBlock = {
    id: "template_input_1",
    type: "input",
    position: { x: 100, y: 200 },
    data: {
      type: "input",
      asset: "USDC",
      amount: 10000,
      label: "Input Capital",
      isConfigured: true,
      isValid: true,
    } as InputBlockData,
  };

  const lendBlock: StrategyBlock = {
    id: "template_lend_1",
    type: "lend",
    position: { x: 400, y: 200 },
    data: {
      type: "lend",
      protocol: "morpho",
      chain: 1,
      supplyApy: 10.2,
      maxLtv: 86,
      liquidationThreshold: 91.5,
      label: "Lend",
      isConfigured: true,
      isValid: true,
    } as LendBlockData,
  };

  const edges: StrategyEdge[] = [
    {
      id: "template_edge_1",
      source: "template_input_1",
      target: "template_lend_1",
      type: "smoothstep",
      animated: true,
    },
  ];

  return { blocks: [inputBlock, lendBlock], edges };
}

// ============================================================================
// Template Loader
// ============================================================================

/**
 * Get generated strategy for a template
 */
export function loadTemplate(templateId: string): { blocks: StrategyBlock[]; edges: StrategyEdge[] } | null {
  switch (templateId) {
    case "conservative-lst":
      return generateConservativeLST();
    case "lst-lending":
      return generateLSTLending();
    case "leveraged-lst-2x":
      return generateLeveragedLST();
    case "stablecoin-yield":
      return generateStablecoinYield();
    default:
      return null;
  }
}

/**
 * Get template info by ID
 */
export function getTemplate(templateId: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.id === templateId);
}
