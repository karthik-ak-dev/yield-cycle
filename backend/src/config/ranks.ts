// Rank qualification criteria and rewards configuration
export const RANK_CRITERIA = {
  BRONZE: {
    directReferrals: 5,
    teamVolume: 5000, // $5K team volume
    timeLimit: 30, // days from registration
    reward: 50, // One-time achievement reward
    mfaBonus: 5, // Monthly Fast Action Bonus
    mfaMonths: 12, // Number of months to receive MFA
  },
  SILVER: {
    teamMembers: 25, // Total team members (not just direct)
    teamVolume: 25000, // $25K team volume
    timeLimit: 60, // days from registration
    reward: 150, // One-time achievement reward
    mfaBonus: 25, // Monthly Fast Action Bonus
    mfaMonths: 12, // Number of months to receive MFA
  },
  PLATINUM: {
    teamMembers: 125, // Total team members
    teamVolume: 125000, // $125K team volume
    timeLimit: 120, // days from registration
    reward: 500, // One-time achievement reward
    mfaBonus: 50, // Monthly Fast Action Bonus
    mfaMonths: 12, // Number of months to receive MFA
  },
  GOLD: {
    teamMembers: 625, // Total team members
    teamVolume: 625000, // $625K team volume
    timeLimit: 180, // days from registration
    reward: 2000, // One-time achievement reward
    mfaBonus: 100, // Monthly Fast Action Bonus
    mfaMonths: 12, // Number of months to receive MFA
  },
  DIAMOND: {
    teamMembers: 3125, // Total team members
    teamVolume: 3125000, // $3.125M team volume
    timeLimit: 365, // days from registration
    reward: 5000, // One-time achievement reward
    mfaBonus: 250, // Monthly Fast Action Bonus
    mfaMonths: 12, // Number of months to receive MFA
  },
};

// Rank order for progression checks
export const RANK_ORDER = ['BRONZE', 'SILVER', 'PLATINUM', 'GOLD', 'DIAMOND'] as const;

export type RankType = keyof typeof RANK_CRITERIA;

// Helper function to get rank criteria
export function getRankCriteria(rank: RankType) {
  return RANK_CRITERIA[rank];
}

// Helper function to get next rank
export function getNextRank(currentRank?: RankType): RankType | null {
  if (!currentRank) {
    return 'BRONZE';
  }
  
  const currentIndex = RANK_ORDER.indexOf(currentRank);
  if (currentIndex === -1 || currentIndex === RANK_ORDER.length - 1) {
    return null; // Already at highest rank or invalid rank
  }
  
  return RANK_ORDER[currentIndex + 1];
}

// Helper function to check if user meets rank criteria
export function checkRankEligibility(
  rank: RankType,
  userStats: {
    directReferrals?: number;
    teamMembers: number;
    teamVolume: number;
    daysSinceRegistration: number;
  }
): boolean {
  const criteria = RANK_CRITERIA[rank];
  
  // Check time limit
  if (userStats.daysSinceRegistration > criteria.timeLimit) {
    return false;
  }
  
  // Check team volume
  if (userStats.teamVolume < criteria.teamVolume) {
    return false;
  }
  
  // Check specific criteria based on rank
  if (rank === 'BRONZE') {
    // Bronze requires direct referrals
    const bronzeCriteria = criteria as typeof RANK_CRITERIA.BRONZE;
    return (userStats.directReferrals || 0) >= bronzeCriteria.directReferrals;
  } else {
    // Other ranks require total team members
    const teamCriteria = criteria as typeof RANK_CRITERIA.SILVER;
    return userStats.teamMembers >= teamCriteria.teamMembers;
  }
}

// Get all available ranks
export function getAllRanks(): RankType[] {
  return [...RANK_ORDER];
} 