

// User model interface matching DynamoDB table structure
export interface User {
  userId: string;           // Primary Key (UUID)
  email: string;            // Unique email address
  passwordHash: string;     // Bcrypt hashed password
  referralCode: string;     // Unique referral code for this user
  referredBy?: string;      // Referral code of the user who referred this user
  createdAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp

}

// User creation input (without generated fields)
export interface CreateUserInput {
  email: string;
  password: string;         // Plain password (will be hashed)
  referralCode?: string;    // Optional referral code from referrer
}

// User update input
export interface UpdateUserInput {
  email?: string;
}

// User response (without sensitive data)
export interface UserResponse {
  userId: string;
  email: string;
  referralCode: string;
  referredBy?: string;
  createdAt: string;

}

// User login input
export interface LoginInput {
  email: string;
  password: string;
}

// User login response
export interface LoginResponse {
  user: UserResponse;
  token: string;
  refreshToken?: string;
}

// Complete user dashboard data
export interface UserDashboardData {
  // Basic user info
  userId: string;
  email: string;
  referralCode: string;
  createdAt: string;
  
  // Deposit info
  depositAmount: number;        // 1000 if confirmed, 0 if not
  depositStatus: string;        // pending, confirmed, failed
  walletAddress: string;        // User's deposit address
  
  // Team info
  directReferrals: number;      // Level 1 referrals
  totalTeamSize: number;        // All levels
  totalTeamVolume: number;      // Team deposit volume
  
  // Earnings (all database calculations)
  monthlyEarnings: number;      // Total monthly earnings
  commissionEarnings: number;   // Total commission earnings
  achievementRewards: number;   // Total achievement rewards
  mfaBonuses: number;          // Total MFA bonuses
  
  // Available balance
  availableBalance: number;     // Sum of all earnings
  
  // Current rank
  currentRank?: string;        // Highest rank achieved
} 