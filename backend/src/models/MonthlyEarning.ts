// Monthly earning model interface for $50 monthly distributions (web2 database records)
export interface MonthlyEarning {
  earningId: string;        // Primary Key (UUID)
  userId: string;           // User receiving the earning
  amount: number;           // Fixed amount (50 USDT)
  month: string;            // Month in YYYY-MM format
  earningMonth: number;     // Sequential earning month (1-60)
  eligibleAt: string;       // ISO timestamp when user became eligible
  createdAt: string;        // ISO timestamp when record was created
  updatedAt: string;        // ISO timestamp when record was last updated
}

// Monthly earning creation input
export interface CreateMonthlyEarningInput {
  userId: string;
  month: string;
  earningMonth: number;
  eligibleAt: string;
}

// Monthly earning response
export interface MonthlyEarningResponse {
  earningId: string;
  userId: string;
  amount: number;
  month: string;
  earningMonth: number;
  createdAt: string;
}

// Monthly earning summary for user dashboard
export interface UserMonthlyEarningSummary {
  totalEarned: number;      // Total monthly earnings (number of months × $50)
  monthsEligible: number;   // Number of months user has been eligible
  nextEarningDate?: string; // Next month when earning will be created
} 