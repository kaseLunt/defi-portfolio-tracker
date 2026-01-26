/**
 * Graph Adapters Index
 *
 * Exports all Graph-based protocol adapters that use The Graph
 * for fast, indexed blockchain data queries.
 */

export { aaveV3GraphAdapter } from "./adapters/aave-v3";
export { compoundV3GraphAdapter } from "./adapters/compound-v3";
export { lidoGraphAdapter } from "./adapters/lido";
export { etherfiGraphAdapter } from "./adapters/etherfi";

// Re-export client utilities
export {
  getGraphClient,
  executeGraphQuery,
  USE_GRAPH_ADAPTERS,
  SUBGRAPH_IDS,
  hasGraphSubgraph,
  getGraphSupportedChains,
  rayToApy,
} from "./client";
