// Commission model interface for MLM commission tracking (web2 database records)
export interface Commission {
  commissionId: string;     // Primary Key (UUID)
  fromUserId: string;       // User who generated the commission (depositor)
  toUserId: string;         // User receiving the commission (upline)
  level: number;            // Commission level (1-5)
  amount: number;           // Commission amount in USDT
  percentage: number;       // Commission percentage used (0.10, 0.05, 0.03, 0.01, 0.01)
  depositAmount: number;    // Original deposit amount that triggered this commission
  createdAt: string;        // ISO timestamp when commission was calculated
  updatedAt: string;        // ISO timestamp when record was last updated
}

// Commission creation input
export interface CreateCommissionInput {
  fromUserId: string;
  toUserId: string;
  level: number;
  amount: number;
  percentage: number;
  depositAmount: number;
}

// Commission response
export interface CommissionResponse {
  commissionId: string;
  fromUserId: string;
  toUserId: string;
  level: number;
  amount: number;
  percentage: number;
  createdAt: string;
}

// Commission summary for user dashboard
export interface UserCommissionSummary {
  totalEarned: number;      // Total commission amount earned by user
  commissionCount: number;  // Number of commission records
} 