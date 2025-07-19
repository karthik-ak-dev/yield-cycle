# Yield-Cycle MVP Implementation Plan

## Project Overview
Simple MVP for a cryptocurrency investment platform with MLM features, single $1000 USDT deposit per user, 60-month returns, and 5-level commission structure.

**Important**: All earnings, commissions, and rewards are **web2 database records only**. No blockchain transactions occur except for:
1. **Deposit**: User deposits $1000 USDT to generated BSC address
2. **Withdrawal**: Platform transfers accumulated earnings from company wallet to user wallet

## Project Structure

### Backend Structure (`/backend`)
```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # DynamoDB connection config
│   │   ├── blockchain.ts        # BSC network configuration
│   │   ├── auth.ts             # JWT and authentication config
│   │   ├── ranks.ts            # Rank criteria and rewards config
│   │   └── constants.ts        # System constants (deposit amount, commission rates)
│   ├── models/
│   │   ├── User.ts             # User model with basic auth and profile data
│   │   ├── Deposit.ts          # Single deposit tracking per user
│   │   ├── Wallet.ts           # User BSC wallet address management
│   │   ├── Commission.ts       # Commission earnings tracking
│   │   ├── MonthlyEarning.ts   # Monthly staking earnings
│   │   ├── Achievement.ts      # Rank achievements and MFA bonuses
│   │   └── ReferralTree.ts     # Simple referral relationships
│   ├── services/
│   │   ├── AuthService.ts      # Login/register logic
│   │   ├── DepositService.ts   # Deposit processing and validation
│   │   ├── WalletService.ts    # HD wallet generation and management
│   │   ├── BlockchainService.ts # BSC transaction validation
│   │   ├── CommissionService.ts # 5-level commission calculations
│   │   ├── EarningsService.ts  # Monthly earnings record creation
│   │   ├── RankService.ts      # Rank progression and rewards
│   │   ├── WithdrawalService.ts # Withdrawal processing and transfers
│   │   └── ReferralService.ts  # Simple referral code management
│   ├── controllers/
│   │   ├── AuthController.ts   # Authentication endpoints
│   │   ├── DepositController.ts # Deposit flow endpoints
│   │   ├── DashboardController.ts # User dashboard data
│   │   └── SyncController.ts   # Manual deposit sync
│   ├── middleware/
│   │   ├── auth.ts             # JWT validation middleware
│   │   ├── validation.ts       # Request validation
│   │   └── errorHandler.ts     # Error handling middleware
│   ├── routes/
│   │   ├── auth.ts             # Authentication routes
│   │   ├── deposit.ts          # Deposit routes
│   │   ├── dashboard.ts        # Dashboard routes
│   │   └── sync.ts             # Sync routes
│   ├── jobs/
│   │   ├── monthlyDistribution.ts # Monthly $50 earnings job
│   │   ├── commissionProcessor.ts # Commission distribution job
│   │   └── rankCalculator.ts      # Rank progression job
│   ├── utils/
│   │   ├── hdWallet.ts         # HD wallet derivation utilities
│   │   ├── encryption.ts       # Password hashing utilities
│   │   └── helpers.ts          # Common helper functions
│   └── app.ts                  # Express app setup
├── package.json
└── serverless.yml              # AWS Lambda deployment config
```

### Frontend Structure (`/frontend`)
```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx   # Simple email/password login
│   │   │   └── RegisterForm.tsx # Register with referral code
│   │   ├── deposit/
│   │   │   ├── DepositAddress.tsx # Show unique BSC address with QR
│   │   │   ├── DepositStatus.tsx  # Deposit status indicator
│   │   │   └── SyncButton.tsx     # Manual sync functionality
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx      # Reusable stats display
│   │   │   ├── EarningsCard.tsx   # Earnings breakdown
│   │   │   ├── TeamCard.tsx       # Team stats
│   │   │   └── RankCard.tsx       # Current rank display
│   │   └── common/
│   │       ├── Layout.tsx         # Main app layout
│   │       ├── Header.tsx         # Navigation header
│   │       └── Loading.tsx        # Loading component
│   ├── pages/
│   │   ├── Login.tsx              # Login page
│   │   ├── Register.tsx           # Registration page
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   └── Deposit.tsx            # Deposit flow page
│   ├── services/
│   │   ├── api.ts                 # API client setup
│   │   ├── auth.ts                # Authentication API calls
│   │   ├── deposit.ts             # Deposit API calls
│   │   └── dashboard.ts           # Dashboard API calls
│   ├── store/
│   │   ├── authStore.ts           # User authentication state
│   │   ├── depositStore.ts        # Deposit state
│   │   └── dashboardStore.ts      # Dashboard data state
│   ├── utils/
│   │   ├── constants.ts           # Frontend constants
│   │   └── formatters.ts          # Data formatting utilities
│   └── App.tsx                    # Main app component
├── package.json
└── vite.config.ts                 # Vite configuration
```

## Database Schema (DynamoDB Tables)

### 1. Users Table
```typescript
interface User {
  userId: string;           // Primary Key
  email: string;            // Unique
  passwordHash: string;
  referralCode: string;     // Unique generated code
  referredBy?: string;      // Parent user's referralCode
  createdAt: string;
  status: 'active' | 'inactive';
}
```

### 2. Deposits Table
```typescript
interface Deposit {
  userId: string;           // Primary Key (one deposit per user)
  amount: number;           // Always 1000
  walletAddress: string;    // Generated BSC address
  transactionHash?: string; // BSC transaction hash
  status: 'pending' | 'confirmed' | 'failed';
  depositedAt?: string;
  confirmedAt?: string;
  confirmations: number;
}
```

### 3. Wallets Table
```typescript
interface Wallet {
  userId: string;           // Primary Key
  address: string;          // BSC address
  privateKey: string;       // Encrypted private key
  derivationPath: string;   // HD wallet path
  createdAt: string;
}
```

### 4. MonthlyEarnings Table
```typescript
interface MonthlyEarning {
  earningId: string;        // Primary Key
  userId: string;           // GSI
  amount: number;           // $50
  month: string;            // YYYY-MM format
  status: 'pending' | 'paid';
  paidAt?: string;
  createdAt: string;
}
```

### 5. Commissions Table
```typescript
interface Commission {
  commissionId: string;     // Primary Key
  fromUserId: string;       // User who generated the commission
  toUserId: string;         // User receiving the commission
  level: number;            // 1-5
  amount: number;           // Commission amount
  percentage: number;       // Commission percentage used
  status: 'pending' | 'paid';
  createdAt: string;
  paidAt?: string;
}
```

### 6. Achievements Table
```typescript
interface Achievement {
  achievementId: string;    // Primary Key
  userId: string;           // GSI
  rank: 'bronze' | 'silver' | 'platinum' | 'gold' | 'diamond';
  achievedAt: string;
  rewardAmount: number;     // One-time reward
  mfaAmount: number;        // Monthly bonus amount
  mfaMonthsRemaining: number; // Months left for MFA
  status: 'active' | 'completed';
}
```

### 7. ReferralTree Table
```typescript
interface ReferralTree {
  userId: string;           // Primary Key
  parentId?: string;        // Direct referrer
  level1Count: number;      // Direct referrals
  level2Count: number;      // Level 2 team
  level3Count: number;      // Level 3 team
  level4Count: number;      // Level 4 team
  level5Count: number;      // Level 5 team
  totalTeamSize: number;    // Total team members
  totalTeamVolume: number;  // Total team deposit volume
  updatedAt: string;
}
```

### 8. Withdrawals Table
```typescript
interface Withdrawal {
  withdrawalId: string;     // Primary Key
  userId: string;           // User making withdrawal
  amount: number;           // Withdrawal amount
  feeAmount: number;        // Fee charged (5%)
  netAmount: number;        // Amount after fee
  toAddress: string;        // User's wallet address
  transactionHash?: string; // Blockchain transaction hash
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  processedAt?: string;
}
```

## Core Business Logic Implementation

### 1. Authentication Service (`AuthService.ts`)
```typescript
class AuthService {
  // Register user with email/password and optional referral code
  async register(email: string, password: string, referralCode?: string): Promise<User>
  
  // Login with email/password
  async login(email: string, password: string): Promise<{ user: User, token: string }>
  
  // Generate unique referral code for new users
  private generateReferralCode(): string
  
  // Validate referral code exists
  private validateReferralCode(code: string): Promise<boolean>
}
```

### 2. Deposit Service (`DepositService.ts`)
```typescript
class DepositService {
  // Generate unique BSC address for user deposit
  async generateDepositAddress(userId: string): Promise<string>
  
  // Manual sync - check blockchain for deposits
  async syncDeposit(userId: string): Promise<DepositStatus>
  
  // Process confirmed deposit and trigger business logic
  private async processConfirmedDeposit(userId: string, txHash: string): Promise<void>
  
  // Trigger commission distribution after deposit confirmation
  private async triggerCommissionDistribution(userId: string): Promise<void>
}
```

### 3. Commission Service (`CommissionService.ts`)
```typescript
class CommissionService {
  // Calculate and create 5-level commission records (database only)
  async createCommissionRecords(newUserId: string, depositAmount: number): Promise<void>
  
  // Get user's upline chain (5 levels)
  private async getUplineChain(userId: string): Promise<string[]>
  
  // Calculate commission amount based on level
  private calculateCommissionAmount(depositAmount: number, level: number): number
  
  // Commission rates: [10%, 5%, 3%, 1%, 1%]
  private readonly COMMISSION_RATES = [0.10, 0.05, 0.03, 0.01, 0.01];
}
```

### 4. Earnings Service (`EarningsService.ts`)
```typescript
class EarningsService {
  // Create monthly $50 earning records for all active users (database only)
  async createMonthlyEarningRecords(): Promise<void>
  
  // Check if user is eligible for monthly earnings
  private async isEligibleForEarnings(userId: string): Promise<boolean>
  
  // Create monthly earning record in database
  private async createMonthlyEarning(userId: string, month: string): Promise<void>
}
```

### 5. Rank Service (`RankService.ts`)
```typescript
class RankService {
  // Check and update user rank based on team performance
  async evaluateRankProgression(userId: string): Promise<void>
  
  // Calculate team stats for rank evaluation
  private async calculateTeamStats(userId: string): Promise<TeamStats>
  
  // Award rank achievement and MFA bonus
  private async awardRankAchievement(userId: string, rank: string): Promise<void>
  
  // Process monthly MFA bonuses
  async processMFABonuses(): Promise<void>
}
```

### 6. Wallet Service (`WalletService.ts`)
```typescript
class WalletService {
  // Generate HD wallet address for user
  async generateWalletAddress(userId: string): Promise<string>
  
  // Derive address from master wallet
  private deriveAddressFromMaster(index: number): Promise<WalletData>
  
  // Encrypt and store private key
  private async storeWalletData(userId: string, walletData: WalletData): Promise<void>
}
```

### 7. Blockchain Service (`BlockchainService.ts`)
```typescript
class BlockchainService {
  // Check USDT transactions for deposit address (deposit validation only)
  async checkUSDTTransactions(address: string): Promise<Transaction[]>
  
  // Validate transaction has 12+ confirmations
  async validateTransactionConfirmations(txHash: string): Promise<boolean>
  
  // Transfer USDT from company wallet to user wallet (withdrawal only)
  async transferUSDT(toAddress: string, amount: number): Promise<string>
}
```

### 8. Withdrawal Service (`WithdrawalService.ts`)
```typescript
class WithdrawalService {
  // Calculate total available balance for withdrawal
  async calculateAvailableBalance(userId: string): Promise<number>
  
  // Process withdrawal request and transfer funds
  async processWithdrawal(userId: string, amount: number): Promise<string>
  
  // Validate withdrawal eligibility and limits
  private async validateWithdrawal(userId: string, amount: number): Promise<boolean>
}
```

## Configuration Files

### Rank Configuration (`config/ranks.ts`)
```typescript
export const RANK_CRITERIA = {
  BRONZE: {
    directReferrals: 5,
    teamVolume: 5000,
    timeLimit: 30, // days
    reward: 50,
    mfaBonus: 5,
    mfaMonths: 12
  },
  SILVER: {
    teamMembers: 25,
    teamVolume: 25000,
    timeLimit: 60,
    reward: 150,
    mfaBonus: 25,
    mfaMonths: 12
  },
  // ... other ranks
};
```

### System Constants (`config/constants.ts`)
```typescript
export const SYSTEM_CONSTANTS = {
  DEPOSIT_AMOUNT: 1000,
  MONTHLY_EARNING: 50,
  EARNING_MONTHS: 60,
  COMMISSION_RATES: [0.10, 0.05, 0.03, 0.01, 0.01],
  MIN_WITHDRAWAL: 20,
  WITHDRAWAL_FEE: 0.05,
  REQUIRED_CONFIRMATIONS: 12
};
```

## API Endpoints

### Authentication Routes
- `POST /api/v1/auth/register` - User registration with email/password
- `POST /api/v1/auth/login` - User login

### Deposit Routes
- `GET /api/v1/deposit/address` - Get user's unique BSC deposit address
- `POST /api/v1/deposit/sync` - Manual deposit sync from blockchain

### Dashboard Routes
- `GET /api/v1/dashboard` - Get complete user dashboard data

### Withdrawal Routes
- `POST /api/v1/withdrawal/request` - Request withdrawal
- `GET /api/v1/withdrawal/status` - Get withdrawal status

## Frontend Components Logic

### Dashboard Component (`Dashboard.tsx`)
```typescript
// Display calculated totals from database records:
// - Deposit status and amount ($1000 if confirmed)
// - Team member count (from referral tree)
// - Team volume (sum of team deposits)
// - Total monthly earnings ($50 × months eligible)
// - Total commission earnings (sum from commission records)
// - Total MFA bonuses (sum from achievement records)
// - Total achievement rewards (sum from achievement records)
// - Current rank (if any achieved)
// - Available withdrawal balance (sum of all above)
```

### Deposit Component (`Deposit.tsx`)
```typescript
// Simple deposit flow:
// - Show unique BSC address with QR code
// - Copy address functionality
// - Manual sync button
// - Deposit status indicator
```

## Background Jobs

### Monthly Distribution Job (`jobs/monthlyDistribution.ts`)
```typescript
// Run on 1st of every month
// Create $50 earning records for all eligible users (database only)
// No actual fund transfers - just record creation
```

### Commission Processor Job (`jobs/commissionProcessor.ts`)
```typescript
// Create commission records when new deposits are confirmed
// Calculate upline commissions and store in database
// No actual fund transfers - just record creation
```

### Rank Calculator Job (`jobs/rankCalculator.ts`)
```typescript
// Daily evaluation of rank progression
// Award rank achievements
// Process MFA bonuses
```

## Key MVP Principles

1. **Single Deposit Only**: Each user can deposit exactly once ($1000)
2. **Simple Referral**: Just referral codes, no complex tree building
3. **Config-Based Ranks**: All rank criteria in config files
4. **Limited Dashboard**: Only essential data points
5. **Manual Sync**: User-initiated deposit synchronization
6. **Class-Based Pattern**: All services follow class-based architecture
7. **Multiple Tables**: Separate DynamoDB table for each entity
8. **No Over-Engineering**: MVP-focused implementation

## Development Priority

1. **Phase 1**: Authentication & User Management
2. **Phase 2**: Wallet Generation & Deposit Flow
3. **Phase 3**: Dashboard & Basic Data Display
4. **Phase 4**: Commission & Earnings Logic
5. **Phase 5**: Rank System & Background Jobs

This MVP implementation focuses on core functionality without unnecessary complexity, ensuring a clean, maintainable codebase that addresses all business requirements. 