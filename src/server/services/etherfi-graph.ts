/**
 * EtherFi Graph Service
 *
 * Queries the EtherFi subgraph for user positions, protocol stats,
 * and historical data.
 */

import { GraphQLClient, gql } from "graphql-request";
import type { Address } from "viem";
import { ETHERFI_SUBGRAPH_ID } from "@/lib/etherfi-contracts";
import type {
  EtherFiTier,
  ValidatorPhase,
  EarlyAdopterStatus,
  HistoryTimeframe,
} from "@/lib/etherfi-constants";
import { HISTORY_TIMEFRAMES } from "@/lib/etherfi-constants";

// Graph Gateway endpoint
const GRAPH_GATEWAY = "https://gateway.thegraph.com/api";

// Types for Graph responses
export interface MembershipData {
  id: string;
  tier: number;
  loyaltyPoints: string;
  tierPoints: string;
  amount: string;
  status?: string;
}

export interface EarlyAdopterData {
  id: string;
  amount: string;
  points: string;
  status: EarlyAdopterStatus;
  depositTime: string;
  migrationDepositAmount: string;
}

export interface ValidatorData {
  id: string;
  phase: ValidatorPhase;
  validatorPubKey: string;
  restaked: boolean;
  isSoloStaker: boolean;
  stakerAddress: string;
}

export interface TnftData {
  id: string;
  owner: string;
  isBurned: boolean;
  validator: {
    id: string;
    phase: ValidatorPhase;
    validatorPubKey: string;
    restaked: boolean;
  };
}

export interface WithdrawalRequestData {
  id: string;
  amountOfEEth: string;
  shareOfEEth: string;
  fee: string;
  owner: string;
  isClaimed: boolean;
}

export interface ReferralData {
  id: string;
  stakedAmount: string;
  points: string;
}

export interface AccountData {
  id: string;
  stakedAmount: string;
}

export interface RebaseEventData {
  id: string;
  timestamp: string;
  // APR data fields - actual fields depend on subgraph schema
}

export interface ProtocolStats {
  totalValidators: number;
  validatorsByPhase: Record<ValidatorPhase, number>;
  totalStakers: number;
  totalStaked: string;
}

// GraphQL Queries
const MEMBERSHIP_QUERY = gql`
  query GetMembership($user: String!) {
    membershipNFTs(
      where: { owner: $user }
      first: 5
      orderBy: tierPoints
      orderDirection: desc
    ) {
      id
      tier
      loyaltyPoints
      tierPoints
      amount
      status
    }
  }
`;

// Query to find top membership NFT holders (for testing)
const TOP_MEMBERS_QUERY = gql`
  query GetTopMembers {
    membershipNFTs(
      where: { status: MINTED }
      first: 20
      orderBy: tierPoints
      orderDirection: desc
    ) {
      id
      owner
      tier
      loyaltyPoints
      tierPoints
      amount
    }
  }
`;

const EARLY_ADOPTER_QUERY = gql`
  query GetEarlyAdopter($user: String!) {
    earlyAdopters(where: { id: $user }) {
      id
      amount
      points
      status
      depositTime
      migrationDepositAmount
    }
  }
`;

const VALIDATORS_QUERY = gql`
  query GetValidators($user: String!) {
    validators(where: { stakerAddress: $user }) {
      id
      phase
      validatorPubKey
      restaked
      isSoloStaker
      stakerAddress
    }
  }
`;

const TNFTS_QUERY = gql`
  query GetTnfts($user: String!) {
    tnfts(where: { owner: $user, isBurned: false }) {
      id
      owner
      isBurned
      validator {
        id
        phase
        validatorPubKey
        restaked
      }
    }
  }
`;

const WITHDRAWALS_QUERY = gql`
  query GetWithdrawals($user: String!) {
    withdrawRequestNFTs(where: { owner: $user, isClaimed: false }) {
      id
      amountOfEEth
      shareOfEEth
      fee
      owner
      isClaimed
    }
  }
`;

const REFERRALS_QUERY = gql`
  query GetReferrals($user: String!) {
    referrals(where: { id: $user }) {
      id
      stakedAmount
      points
    }
  }
`;

const ACCOUNT_QUERY = gql`
  query GetAccount($user: String!) {
    account(id: $user) {
      id
      stakedAmount
    }
  }
`;

const PROTOCOL_STATS_QUERY = gql`
  query GetProtocolStats {
    validators(first: 1000) {
      phase
    }
    accounts(first: 1000, orderBy: stakedAmount, orderDirection: desc) {
      stakedAmount
    }
  }
`;

const REBASE_EVENTS_QUERY = gql`
  query GetRebaseEvents($since: BigInt!) {
    rebaseEvents(
      where: { timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      id
      timestamp
    }
  }
`;

/**
 * EtherFi Graph Service
 */
class EtherFiGraphService {
  private client: GraphQLClient | null = null;

  private getClient(): GraphQLClient | null {
    if (this.client) return this.client;

    const apiKey = process.env.GRAPH_API_KEY;
    if (!apiKey) {
      console.warn("[EtherFi Graph] GRAPH_API_KEY not configured");
      return null;
    }

    const url = `${GRAPH_GATEWAY}/${apiKey}/subgraphs/id/${ETHERFI_SUBGRAPH_ID}`;
    this.client = new GraphQLClient(url, {
      headers: { "Content-Type": "application/json" },
    });

    return this.client;
  }

  private async query<T>(
    queryDoc: string,
    variables?: Record<string, unknown>
  ): Promise<T | null> {
    const client = this.getClient();
    if (!client) {
      console.warn("[EtherFi Graph] No client available (API key missing?)");
      return null;
    }

    try {
      return await client.request<T>(queryDoc, variables);
    } catch (error) {
      console.error("[EtherFi Graph] Query failed:", error);
      return null;
    }
  }

  /**
   * Get user's membership NFT data (tier, points)
   */
  async getMembership(walletAddress: Address): Promise<MembershipData | null> {
    const result = await this.query<{ membershipNFTs: MembershipData[] }>(
      MEMBERSHIP_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    // Filter for MINTED status and return the best one
    const mintedNFTs = result?.membershipNFTs?.filter(nft => nft.status === "MINTED" || !nft.status) ?? [];

    return mintedNFTs[0] ?? null;
  }

  /**
   * Get user's early adopter status
   */
  async getEarlyAdopter(
    walletAddress: Address
  ): Promise<EarlyAdopterData | null> {
    const result = await this.query<{ earlyAdopters: EarlyAdopterData[] }>(
      EARLY_ADOPTER_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    return result?.earlyAdopters?.[0] ?? null;
  }

  /**
   * Get user's validators
   */
  async getValidators(walletAddress: Address): Promise<ValidatorData[]> {
    const result = await this.query<{ validators: ValidatorData[] }>(
      VALIDATORS_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    return result?.validators ?? [];
  }

  /**
   * Get user's T-NFTs (staking receipts)
   */
  async getTnfts(walletAddress: Address): Promise<TnftData[]> {
    const result = await this.query<{ tnfts: TnftData[] }>(TNFTS_QUERY, {
      user: walletAddress.toLowerCase(),
    });

    return result?.tnfts ?? [];
  }

  /**
   * Get user's pending withdrawal requests
   */
  async getWithdrawalRequests(
    walletAddress: Address
  ): Promise<WithdrawalRequestData[]> {
    const result = await this.query<{
      withdrawRequestNFTs: WithdrawalRequestData[];
    }>(WITHDRAWALS_QUERY, { user: walletAddress.toLowerCase() });

    return result?.withdrawRequestNFTs ?? [];
  }

  /**
   * Get user's referral data
   */
  async getReferrals(walletAddress: Address): Promise<ReferralData | null> {
    const result = await this.query<{ referrals: ReferralData[] }>(
      REFERRALS_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    return result?.referrals?.[0] ?? null;
  }

  /**
   * Get user's account data (total staked)
   */
  async getAccount(walletAddress: Address): Promise<AccountData | null> {
    const result = await this.query<{ account: AccountData | null }>(
      ACCOUNT_QUERY,
      { user: walletAddress.toLowerCase() }
    );

    return result?.account ?? null;
  }

  /**
   * Get all user data in parallel
   */
  async getAllUserData(walletAddress: Address) {
    const [
      membership,
      earlyAdopter,
      validators,
      tnfts,
      withdrawals,
      referrals,
      account,
    ] = await Promise.all([
      this.getMembership(walletAddress),
      this.getEarlyAdopter(walletAddress),
      this.getValidators(walletAddress),
      this.getTnfts(walletAddress),
      this.getWithdrawalRequests(walletAddress),
      this.getReferrals(walletAddress),
      this.getAccount(walletAddress),
    ]);

    return {
      membership,
      earlyAdopter,
      validators,
      tnfts,
      withdrawals,
      referrals,
      account,
    };
  }

  /**
   * Get protocol-level statistics
   */
  async getProtocolStats(): Promise<ProtocolStats | null> {
    const result = await this.query<{
      validators: { phase: ValidatorPhase }[];
      accounts: { stakedAmount: string }[];
    }>(PROTOCOL_STATS_QUERY, {});

    if (!result) return null;

    // Count validators by phase
    const validatorsByPhase: Record<ValidatorPhase, number> = {
      NOT_INITIALIZED: 0,
      STAKE_DEPOSITED: 0,
      LIVE: 0,
      EXITED: 0,
      CANCELLED: 0,
      BEING_SLASHED: 0,
    };

    for (const v of result.validators) {
      if (v.phase in validatorsByPhase) {
        validatorsByPhase[v.phase]++;
      }
    }

    // Calculate total staked
    let totalStaked = 0n;
    for (const a of result.accounts) {
      totalStaked += BigInt(a.stakedAmount || "0");
    }

    return {
      totalValidators: result.validators.length,
      validatorsByPhase,
      totalStakers: result.accounts.length,
      totalStaked: totalStaked.toString(),
    };
  }

  /**
   * Get rebase events for APY history
   */
  async getRebaseEvents(
    timeframe: HistoryTimeframe
  ): Promise<RebaseEventData[]> {
    const secondsAgo = HISTORY_TIMEFRAMES[timeframe];
    const since = Math.floor(Date.now() / 1000) - secondsAgo;

    const result = await this.query<{ rebaseEvents: RebaseEventData[] }>(
      REBASE_EVENTS_QUERY,
      { since: since.toString() }
    );

    return result?.rebaseEvents ?? [];
  }

  /**
   * Get top membership NFT holders (for testing/demo purposes)
   */
  async getTopMembers(): Promise<Array<{
    id: string;
    owner: string;
    tier: number;
    loyaltyPoints: string;
    tierPoints: string;
    amount: string;
  }>> {
    const result = await this.query<{
      membershipNFTs: Array<{
        id: string;
        owner: string;
        tier: number;
        loyaltyPoints: string;
        tierPoints: string;
        amount: string;
      }>;
    }>(TOP_MEMBERS_QUERY, {});

    console.log("[EtherFi Graph] Top members result:", JSON.stringify(result));

    return result?.membershipNFTs ?? [];
  }
}

// Export singleton instance
export const etherfiGraphService = new EtherFiGraphService();
