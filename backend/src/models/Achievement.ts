import { RankType } from '../config/ranks';

// Achievement model interface for rank achievements and MFA bonuses (web2 database records)
export interface Achievement {
  achievementId: string;    // Primary Key (UUID)
  userId: string;           // User who achieved the rank
  rank: RankType;           // Achieved rank
  achievedAt: string;       // ISO timestamp when rank was achieved
  rewardAmount: number;     // One-time achievement reward
  mfaAmount: number;        // Monthly Fast Action bonus amount
  mfaMonthsTotal: number;   // Total months of MFA bonus
  mfaMonthsRemaining: number; // Months remaining for MFA bonus
  mfaLastPaidMonth?: string; // Last month MFA was paid (YYYY-MM format)
  createdAt: string;        // ISO timestamp when record was created
  updatedAt: string;        // ISO timestamp when record was last updated
}

// Achievement creation input
export interface CreateAchievementInput {
  userId: string;
  rank: RankType;
  rewardAmount: number;
  mfaAmount: number;
  mfaMonthsTotal: number;
}

// Achievement response
export interface AchievementResponse {
  achievementId: string;
  userId: string;
  rank: RankType;
  achievedAt: string;
  rewardAmount: number;
  mfaAmount: number;
  mfaMonthsRemaining: number;
}

// User achievement summary for dashboard
export interface UserAchievementSummary {
  currentRank?: RankType;   // Current highest rank achieved
  totalRewards: number;     // Total one-time achievement rewards
  totalMfaBonuses: number;  // Total MFA bonuses earned
  activeMfaAmount: number;  // Monthly MFA amount (if active)
} 