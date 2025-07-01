# Yield Cycle Platform - Technical Documentation

## 📋 Table of Contents

- [System Architecture Overview](#system-architecture-overview)
- [Technology Stack](#technology-stack)
- [Entity Definitions & Relationships](#entity-definitions--relationships)
- [DynamoDB Schema Design](#dynamodb-schema-design)
- [Authentication & Authorization](#authentication--authorization)
- [API Specifications](#api-specifications)
- [Referral Tree Management](#referral-tree-management)
- [Blockchain Integration](#blockchain-integration)
- [Business Logic Implementation](#business-logic-implementation)
- [Security Implementation](#security-implementation)
- [Performance Considerations](#performance-considerations)
- [Deployment Architecture](#deployment-architecture)

## 🏗️ System Architecture Overview

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   DynamoDB      │
│   (React/Next)  │◄──►│   (Node.js/TS)  │◄──►│   Multi-Table   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Blockchain    │
                       │   Integration   │
                       │   (BSC/USDT)    │
                       └─────────────────┘
```

### Core Components

- **Authentication Service**: JWT-based auth with OTP verification
- **User Management**: Admin and Depositor role management
- **Deposit Service**: USDT deposit handling with blockchain validation
- **Referral Engine**: Multi-level commission calculation and distribution
- **Wallet Service**: Three-pocket system management
- **Notification Service**: OTP and transaction notifications
- **Blockchain Monitor**: Real-time transaction monitoring on BSC

## 🛠️ Technology Stack

### Backend Framework

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: AWS DynamoDB (Multi-table pattern)
- **Authentication**: JWT with refresh tokens
- **Validation**: Joi/Yup for request validation
- **Blockchain**: Web3.js for BSC integration
- **Email Service**: AWS SES for OTP delivery
- **Environment**: AWS Lambda + API Gateway (Serverless)

### Development Tools

- **Language**: TypeScript 5.0+
- **Package Manager**: npm/yarn
- **Testing**: Jest + Supertest
- **Code Quality**: ESLint + Prettier
- **Documentation**: OpenAPI/Swagger
- **Build Tool**: webpack/esbuild

## 📊 Entity Definitions & Relationships

### Core Entities

#### 1. User Entity

```typescript
interface User {
  userId: string; // UUID v4
  email: string; // Unique identifier
  passwordHash: string; // bcrypt hashed
  role: UserRole; // ADMIN | DEPOSITOR
  status: UserStatus; // ACTIVE | SUSPENDED | PENDING_VERIFICATION
  referralCode: string; // Unique 8-character code
  referredBy?: string; // Parent user's userId
  isEmailVerified: boolean;
  profile: UserProfile;
  depositAddress?: string; // User's unique BSC address for receiving USDT deposits
  createdAt: Date;
  updatedAt: Date;
}

enum UserRole {
  ADMIN = 'ADMIN',
  DEPOSITOR = 'DEPOSITOR',
}

enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

interface UserProfile {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  country?: string;
  timezone?: string;
}
```

#### 2. Deposit Entity

```typescript
interface Deposit {
  depositId: string; // UUID v4
  userId: string; // Foreign key to User
  amount: number; // USDT amount in wei
  status: DepositStatus; // PENDING | ACTIVE | DORMANT | COMPLETED
  transactionHash?: string; // BSC transaction hash
  blockNumber?: number; // Block confirmation
  depositAddress: string; // User's unique BSC address
  tenure: number; // Months (default: 25)
  monthlyReturn: number; // Percentage (default: 8)
  totalReturns: number; // Total amount earned
  remainingMonths: number; // Months left for earning
  isWithinLimit: boolean; // Whether deposit is within user limits
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date; // When deposit became active
  completedAt?: Date; // When 25 months completed
}

enum DepositStatus {
  PENDING = 'PENDING', // Transaction not confirmed
  ACTIVE = 'ACTIVE', // Earning monthly returns
  DORMANT = 'DORMANT', // Exceeds limits, no returns
  COMPLETED = 'COMPLETED', // 25 months completed
}
```

#### 3. Wallet Pocket Entity

```typescript
interface WalletPocket {
  userId: string;
  pocketType: PocketType;
  balance: number; // Amount in USDT wei
  totalEarnings: number; // Lifetime earnings for this pocket type
  lastUpdated: Date;
  transactions: PocketTransaction[];
}

enum PocketType {
  ACTIVE_DEPOSITS = 'ACTIVE_DEPOSITS', // Current active deposits earning 8% monthly
  INCOME = 'INCOME', // Monthly 8% earnings from active deposits
  COMMISSION = 'COMMISSION', // Referral commission earnings
  TOTAL_EARNINGS = 'TOTAL_EARNINGS', // Calculated: income + commission
}

interface PocketTransaction {
  transactionId: string;
  amount: number;
  type: TransactionType;
  description: string;
  timestamp: Date;
  relatedDepositId?: string;
  relatedUserId?: string; // For commissions
}

enum TransactionType {
  ACTIVE_DEPOSIT_CREDIT = 'ACTIVE_DEPOSIT_CREDIT', // Active deposit added
  ACTIVE_DEPOSIT_DEBIT = 'ACTIVE_DEPOSIT_DEBIT', // Active deposit removed/expired
  MONTHLY_INCOME = 'MONTHLY_INCOME', // 8% monthly income
  COMMISSION_L1 = 'COMMISSION_L1', // Level 1 commission (10%)
  COMMISSION_L2 = 'COMMISSION_L2', // Level 2 commission (5%)
  COMMISSION_L3 = 'COMMISSION_L3', // Level 3 commission (3%)
  COMMISSION_L4 = 'COMMISSION_L4', // Level 4 commission (1%)
  COMMISSION_L5 = 'COMMISSION_L5', // Level 5 commission (1%)
  WITHDRAWAL = 'WITHDRAWAL', // Withdrawal after 25 months
}
```

#### 4. Referral Network Entity

```typescript
interface ReferralNode {
  userId: string;
  parentUserId?: string; // Direct upline
  level: number; // Distance from root (0 = root)
  path: string; // Materialized path (e.g., "/root/user1/user2")
  directReferrals: string[]; // Direct downline userIds
  totalTeamSize: number; // Total downline count
  totalTeamVolume: number; // Total deposits from team
  commissionEarned: number; // Total commission from this node
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5. Commission Distribution Entity

```typescript
interface CommissionDistribution {
  distributionId: string; // UUID v4
  triggerDepositId: string; // Deposit that triggered commission
  triggerUserId: string; // User who made the deposit
  triggerAmount: number; // Deposit amount
  distributions: CommissionAllocation[];
  totalDistributed: number;
  createdAt: Date;
}

interface CommissionAllocation {
  recipientUserId: string;
  level: number; // 1-5
  percentage: number; // 10%, 5%, 3%, 1%, 1%
  amount: number; // Calculated commission amount
  status: CommissionStatus;
}

enum CommissionStatus {
  PENDING = 'PENDING',
  CREDITED = 'CREDITED',
  FAILED = 'FAILED',
}
```

#### 6. OTP Entity

```typescript
interface OTPRecord {
  otpId: string;
  email: string;
  code: string; // 6-digit code
  type: OTPType;
  attempts: number; // Failed attempts counter
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

enum OTPType {
  REGISTRATION = 'REGISTRATION',
  LOGIN = 'LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
}
```

## 🗃️ DynamoDB Schema Design

### Multi-Table Design Strategy

We'll use separate DynamoDB tables for each entity type to ensure clear data separation, simplified access patterns, and better scalability. Each table is optimized for its specific use case with appropriate indexes.

### Table Structures Overview

```typescript
// Common fields for all tables
interface BaseTableItem {
  CreatedAt: string; // ISO timestamp
  UpdatedAt: string; // ISO timestamp
  TTL?: number; // For temporary records
}
```

### 1. Users Table: `YieldCycle-Users`

**Address System**: Each user gets a unique BSC address for receiving USDT deposits. This address is derived from the platform's master wallet using HD wallet technology.

```typescript
interface UsersTable extends BaseTableItem {
  // Primary Key
  userId: string; // Partition Key

  // User Data
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  referralCode: string;
  referredBy?: string;
  isEmailVerified: boolean;
  profile: UserProfile;
  depositAddress?: string; // User's unique BSC address for receiving USDT deposits
  lastLoginAt?: string;
  earningsLimit: number;
  totalEarnings: number;
}

// Global Secondary Indexes
interface UsersEmailCreatedAtGSI {
  email: string; // PK
  createdAt: string; // SK
}

interface UsersReferralCodeUserIdGSI {
  referralCode: string; // PK
  userId: string; // SK
}

interface UsersStatusCreatedAtGSI {
  status: UserStatus; // PK
  createdAt: string; // SK
}
```

### 2. Deposits Table: `YieldCycle-Deposits`

**Deposit Address**: Each deposit record references the user's deposit address where the USDT was sent. This is the same address stored in the Users table.

```typescript
interface DepositsTable extends BaseTableItem {
  // Primary Key
  depositId: string; // Partition Key

  // Deposit Data
  userId: string;
  amount: number;
  status: DepositStatus;
  transactionHash?: string;
  blockNumber?: number;
  depositAddress: string;
  tenure: number;
  monthlyReturn: number;
  totalReturns: number;
  remainingMonths: number;
  isWithinLimit: boolean;
  activatedAt?: string;
  completedAt?: string;
}

// Global Secondary Indexes
interface DepositsUserIdCreatedAtGSI {
  userId: string; // PK
  createdAt: string; // SK
}

interface DepositsStatusCreatedAtGSI {
  status: DepositStatus; // PK
  createdAt: string; // SK
}

interface DepositsAddressUserIdGSI {
  depositAddress: string; // PK
  userId: string; // SK
}
```

### 3. Wallet Pockets Table: `YieldCycle-WalletPockets`

```typescript
interface WalletPocketsTable extends BaseTableItem {
  // Composite Primary Key
  userId: string; // Partition Key
  pocketType: PocketType; // Sort Key

  // Wallet Data
  balance: number;
  totalEarnings: number;
  lastTransactionAt?: string;
}

// Global Secondary Index
interface WalletPocketsTypeBalanceGSI {
  pocketType: PocketType; // PK
  balance: number; // SK (for balance queries)
}
```

### 4. Wallet Transactions Table: `YieldCycle-WalletTransactions`

```typescript
interface WalletTransactionsTable extends BaseTableItem {
  // Primary Key
  transactionId: string; // Partition Key

  // Transaction Data
  userId: string;
  amount: number;
  type: TransactionType;
  pocketType: PocketType;
  description: string;
  relatedDepositId?: string;
  relatedUserId?: string;
  status: TransactionStatus;
}

// Global Secondary Indexes
interface WalletTransactionsUserIdCreatedAtGSI {
  userId: string; // PK
  createdAt: string; // SK
}

interface WalletTransactionsPocketTypeCreatedAtGSI {
  pocketType: string; // PK
  createdAt: string; // SK
}

interface WalletTransactionsTypeCreatedAtGSI {
  type: TransactionType; // PK
  createdAt: string; // SK
}
```

### 5. Referral Network Table: `YieldCycle-ReferralNetwork`

```typescript
interface ReferralNetworkTable extends BaseTableItem {
  // Primary Key
  userId: string; // Partition Key

  // Referral Data
  parentUserId?: string;
  level: number;
  path: string; // Materialized path for tree traversal
  directReferrals: string[];
  totalTeamSize: number;
  totalTeamVolume: number;
  commissionEarned: number;

  // Genealogy cache for fast upline lookups
  level1?: string; // Direct parent
  level2?: string; // Grandparent
  level3?: string; // Great-grandparent
  level4?: string; // Level 4 ancestor
  level5?: string; // Level 5 ancestor
}

// Global Secondary Indexes
interface ReferralNetworkParentUserIdCreatedAtGSI {
  parentUserId: string; // PK
  createdAt: string; // SK
}

interface ReferralNetworkLevelTeamVolumeGSI {
  level: number; // PK
  totalTeamVolume: number; // SK
}
```

### 6. Commission Distributions Table: `YieldCycle-CommissionDistributions`

```typescript
interface CommissionDistributionsTable extends BaseTableItem {
  // Primary Key
  distributionId: string; // Partition Key

  // Distribution Data
  triggerDepositId: string;
  triggerUserId: string;
  triggerAmount: number;
  totalDistributed: number;
  status: DistributionStatus;
  processedAt?: string;
}

// Global Secondary Index
interface CommissionDistributionsTriggerUserIdCreatedAtGSI {
  triggerUserId: string; // PK
  createdAt: string; // SK
}
```

### 7. Commission Allocations Table: `YieldCycle-CommissionAllocations`

```typescript
interface CommissionAllocationsTable extends BaseTableItem {
  // Composite Primary Key
  distributionId: string; // Partition Key
  recipientUserId: string; // Sort Key

  // Allocation Data
  triggerUserId: string;
  level: number;
  percentage: number;
  amount: number;
  status: CommissionStatus;
  processedAt?: string;
}

// Global Secondary Index
interface CommissionAllocationsRecipientUserIdCreatedAtGSI {
  recipientUserId: string; // PK
  createdAt: string; // SK
}
```

### 8. Monthly Income Table: `YieldCycle-MonthlyIncome`

```typescript
interface MonthlyIncomeTable extends BaseTableItem {
  // Composite Primary Key
  depositId: string; // Partition Key
  month: string; // Sort Key (YYYY-MM format)

  // Income Data
  userId: string;
  amount: number;
  year: number;
  monthNum: number;
  processed: boolean;
  processedAt?: string;
}

// Global Secondary Index
interface MonthlyIncomeUserIdMonthGSI {
  userId: string; // PK
  month: string; // SK
}
```

### 9. OTP Table: `YieldCycle-OTP`

```typescript
interface OTPTable extends BaseTableItem {
  // Composite Primary Key
  email: string; // Partition Key
  otpId: string; // Sort Key

  // OTP Data
  code: string;
  type: OTPType;
  attempts: number;
  isUsed: boolean;
  expiresAt: string;
  TTL: number; // Auto-delete after expiration
}

// Global Secondary Index
interface OTPCodeTypeGSI {
  code: string; // PK
  type: OTPType; // SK
}
```

### 10. User Sessions Table: `YieldCycle-Sessions`

```typescript
interface SessionsTable extends BaseTableItem {
  // Primary Key
  sessionId: string; // Partition Key

  // Session Data
  userId: string;
  accessToken: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: string;
  isActive: boolean;
  TTL: number; // Auto-delete after expiration
}

// Global Secondary Index
interface SessionsUserIdCreatedAtGSI {
  userId: string; // PK
  createdAt: string; // SK
}
```

### 11. Audit Logs Table: `YieldCycle-AuditLogs`

```typescript
interface AuditLogsTable extends BaseTableItem {
  // Primary Key
  logId: string; // Partition Key

  // Audit Data
  userId?: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
  metadata?: any;
}

// Global Secondary Indexes
interface AuditLogsUserIdTimestampGSI {
  userId: string; // PK
  timestamp: string; // SK
}

interface AuditLogsActionTimestampGSI {
  action: string; // PK
  timestamp: string; // SK
}
```

### Access Patterns & Query Examples

#### Pattern 1: User Authentication

```typescript
// Get user by email for login
const user = await dynamoDB.query({
  TableName: 'YieldCycle-Users',
  IndexName: 'email-createdAt-gsi',
  KeyConditionExpression: 'email = :email',
  ExpressionAttributeValues: {
    ':email': email,
  },
});
```

#### Pattern 2: User's Complete Financial Profile

```typescript
// Get all user's financial data in parallel
const [user, deposits, walletPockets, transactions] = await Promise.all([
  // User profile
  dynamoDB.getItem({
    TableName: 'YieldCycle-Users',
    Key: { userId },
  }),

  // All user deposits
  dynamoDB.query({
    TableName: 'YieldCycle-Deposits',
    IndexName: 'userId-createdAt-gsi',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  }),

  // All wallet pockets
  dynamoDB.query({
    TableName: 'YieldCycle-WalletPockets',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  }),

  // Recent transactions
  dynamoDB.query({
    TableName: 'YieldCycle-WalletTransactions',
    IndexName: 'userId-createdAt-gsi',
    KeyConditionExpression: 'userId = :userId',
    ScanIndexForward: false,
    Limit: 50,
    ExpressionAttributeValues: { ':userId': userId },
  }),
]);
```

#### Pattern 3: Referral Network Traversal

```typescript
// Get user's referral network data
const referralData = await dynamoDB.getItem({
  TableName: 'YieldCycle-ReferralNetwork',
  Key: { userId },
});

// Get direct referrals
const directReferrals = await dynamoDB.query({
  TableName: 'YieldCycle-ReferralNetwork',
  IndexName: 'parentUserId-createdAt-gsi',
  KeyConditionExpression: 'parentUserId = :parentUserId',
  ExpressionAttributeValues: {
    ':parentUserId': userId,
  },
});
```

#### Pattern 4: Admin Dashboard Queries

```typescript
// Get all pending deposits
const pendingDeposits = await dynamoDB.query({
  TableName: 'YieldCycle-Deposits',
  IndexName: 'status-createdAt-gsi',
  KeyConditionExpression: '#status = :status',
  ExpressionAttributeNames: {
    '#status': 'status',
  },
  ExpressionAttributeValues: {
    ':status': 'PENDING',
  },
});

// Get monthly commission summary for a user
const monthlyCommissions = await dynamoDB.query({
  TableName: 'YieldCycle-CommissionAllocations',
  IndexName: 'recipientUserId-createdAt-gsi',
  KeyConditionExpression: 'recipientUserId = :userId',
  ExpressionAttributeValues: {
    ':userId': userId,
  },
});
```

#### Pattern 5: Deposit Address Lookup

```typescript
// Find deposit by blockchain address
const deposit = await dynamoDB.query({
  TableName: 'YieldCycle-Deposits',
  IndexName: 'DepositAddressIndex',
  KeyConditionExpression: 'depositAddress = :address',
  ExpressionAttributeValues: {
    ':address': address,
  },
});
```

## 🔐 Authentication & Authorization

### JWT-Based Authentication Strategy

#### Token Structure

```typescript
interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat: number; // Issued at
  exp: number; // Expiration time
}

interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
}
```

#### Token Configuration

```typescript
const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m', // 15 minutes
  REFRESH_TOKEN_EXPIRY: '7d', // 7 days
  ALGORITHM: 'HS256',
  ISSUER: 'yield-cycle-platform',
  SECRET_KEY: process.env.JWT_SECRET, // From environment
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
};
```

### OTP Implementation

#### OTP Generation & Validation

```typescript
class OTPService {
  private static readonly OTP_LENGTH = 6;
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly MAX_ATTEMPTS = 3;

  static async generateOTP(email: string, type: OTPType): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    const otpRecord = {
      email,
      otpId: uuidv4(),
      code,
      type,
      attempts: 0,
      isUsed: false,
      expiresAt: expiresAt.toISOString(),
      TTL: Math.floor(expiresAt.getTime() / 1000),
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    await dynamoDB.putItem({
      TableName: 'YieldCycle-OTP',
      Item: otpRecord,
    });

    // Send email
    await EmailService.sendOTP(email, code, type);

    return code;
  }

  static async validateOTP(email: string, code: string, type: OTPType): Promise<boolean> {
    // Get latest OTP for this email and type
    const otpRecord = await this.getLatestOTP(email, type);

    if (!otpRecord) {
      throw new Error('No OTP found');
    }

    if (otpRecord.Data.isUsed) {
      throw new Error('OTP already used');
    }

    if (new Date() > new Date(otpRecord.Data.expiresAt)) {
      throw new Error('OTP expired');
    }

    if (otpRecord.Data.attempts >= this.MAX_ATTEMPTS) {
      throw new Error('Maximum attempts exceeded');
    }

    if (otpRecord.Data.code !== code) {
      // Increment attempt counter
      await this.incrementAttempts(otpRecord);
      throw new Error('Invalid OTP');
    }

    // Mark as used
    await this.markOTPAsUsed(otpRecord);
    return true;
  }
}
```

### Role-Based Access Control (RBAC)

#### Permission System

```typescript
enum Permission {
  // User Management
  CREATE_USER = 'CREATE_USER',
  READ_USER = 'READ_USER',
  UPDATE_USER = 'UPDATE_USER',
  DELETE_USER = 'DELETE_USER',

  // Deposit Management
  CREATE_DEPOSIT = 'CREATE_DEPOSIT',
  READ_DEPOSIT = 'READ_DEPOSIT',
  UPDATE_DEPOSIT = 'UPDATE_DEPOSIT',
  SYNC_DEPOSIT = 'SYNC_DEPOSIT',

  // Wallet Operations
  READ_WALLET = 'READ_WALLET',
  TRANSFER_FUNDS = 'TRANSFER_FUNDS',
  WITHDRAW_FUNDS = 'WITHDRAW_FUNDS',

  // Referral System
  READ_REFERRAL_TREE = 'READ_REFERRAL_TREE',
  MANAGE_COMMISSIONS = 'MANAGE_COMMISSIONS',

  // Admin Operations
  READ_ALL_USERS = 'READ_ALL_USERS',
  READ_SYSTEM_METRICS = 'READ_SYSTEM_METRICS',
  MANAGE_PLATFORM_SETTINGS = 'MANAGE_PLATFORM_SETTINGS',
  PROCESS_WITHDRAWALS = 'PROCESS_WITHDRAWALS',
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.DEPOSITOR]: [
    Permission.READ_USER,
    Permission.UPDATE_USER,
    Permission.CREATE_DEPOSIT,
    Permission.READ_DEPOSIT,
    Permission.SYNC_DEPOSIT,
    Permission.READ_WALLET,
    Permission.WITHDRAW_FUNDS,
    Permission.READ_REFERRAL_TREE,
  ],

  [UserRole.ADMIN]: [
    ...Object.values(Permission), // All permissions
  ],
};
```

#### Middleware Implementation

```typescript
// Authentication Middleware
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_CONFIG.SECRET_KEY) as JWTPayload;

    // Verify session exists and is valid
    const session = await SessionService.getSession(decoded.userId, decoded.sessionId);
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Authorization Middleware
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPermissions = ROLE_PERMISSIONS[userRole];

    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Resource ownership check
export const requireOwnership = (resourceParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedUserId = req.params[resourceParam];
    const authenticatedUserId = req.user?.userId;
    const userRole = req.user?.role;

    // Admins can access any resource
    if (userRole === UserRole.ADMIN) {
      return next();
    }

    // Users can only access their own resources
    if (requestedUserId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }

    next();
  };
};
```

### Session Management

#### Session Service Implementation

```typescript
class SessionService {
  static async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<SessionData> {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate tokens
    const accessToken = jwt.sign({ userId, sessionId, role: userRole }, JWT_CONFIG.SECRET_KEY, {
      expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign({ userId, sessionId }, JWT_CONFIG.REFRESH_SECRET, {
      expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY,
    });

    // Store session in DynamoDB
    const sessionRecord = {
      sessionId,
      userId,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent,
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      TTL: Math.floor(expiresAt.getTime() / 1000),
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    await dynamoDB.putItem({
      TableName: 'YieldCycle-Sessions',
      Item: sessionRecord,
    });

    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  static async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_CONFIG.REFRESH_SECRET) as RefreshTokenPayload;

      // Verify session exists
      const session = await this.getSession(decoded.userId, decoded.sessionId);
      if (!session || session.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user details for new access token
      const user = await UserService.getUserById(decoded.userId);

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: decoded.userId,
          email: user.email,
          role: user.role,
          sessionId: decoded.sessionId,
        },
        JWT_CONFIG.SECRET_KEY,
        { expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY }
      );

      // Update session with new access token
      await this.updateSessionToken(decoded.userId, decoded.sessionId, newAccessToken);

      return newAccessToken;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static async revokeSession(userId: string, sessionId: string): Promise<void> {
    await dynamoDB.deleteItem({
      TableName: 'YieldCycle-Sessions',
      Key: { sessionId },
    });
  }

  static async revokeAllSessions(userId: string): Promise<void> {
    // Query all sessions for user
    const sessions = await dynamoDB.query({
      TableName: 'YieldCycle-Sessions',
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    });

    // Delete all sessions
    const deletePromises = sessions.Items.map((session) =>
      dynamoDB.deleteItem({
        TableName: 'YieldCycle-Sessions',
        Key: { sessionId: session.sessionId },
      })
    );

    await Promise.all(deletePromises);
  }
}
```

### Password Security

#### Password Hashing & Validation

```typescript
class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_LENGTH = 8;
  private static readonly PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

  static validatePasswordStrength(password: string): boolean {
    if (password.length < this.MIN_LENGTH) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!this.PASSWORD_REGEX.test(password)) {
      throw new Error('Password must contain uppercase, lowercase, number and special character');
    }

    return true;
  }

  static async hashPassword(password: string): Promise<string> {
    this.validatePasswordStrength(password);
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}
```

### Rate Limiting

#### Request Rate Limiting

```typescript
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessful?: boolean;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 attempts per 15 minutes
  otp: { windowMs: 60 * 1000, maxRequests: 3 }, // 3 OTP requests per minute
  deposit: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 deposits per hour
  general: { windowMs: 15 * 60 * 1000, maxRequests: 100 }, // 100 requests per 15 minutes
};

export const rateLimiter = (limitType: keyof typeof RATE_LIMITS) => {
  return rateLimit({
    windowMs: RATE_LIMITS[limitType].windowMs,
    max: RATE_LIMITS[limitType].maxRequests,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use IP + user ID if authenticated, otherwise just IP
      const userId = req.user?.userId || '';
      return `${req.ip}:${userId}`;
    },
  });
};
```

## 🚀 API Specifications

### Base Configuration

```typescript
const API_CONFIG = {
  BASE_URL: '/api/v1',
  CONTENT_TYPE: 'application/json',
  MAX_REQUEST_SIZE: '10mb',
  CORS_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
};
```

### Standard Response Format

```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
  requestId: string;
}
```

### 1. Authentication Endpoints

#### POST /api/v1/auth/register

**Purpose**: Register a new user with email verification

**Request Body**:

```typescript
interface RegisterRequest {
  email: string; // Valid email format
  password: string; // Min 8 chars, mixed case, numbers, symbols
  confirmPassword: string; // Must match password
  referralCode?: string; // Optional 8-character code
  acceptTerms: boolean; // Must be true
}
```

**Response**:

```typescript
interface RegisterResponse {
  message: string;
  email: string;
  otpSent: boolean;
  expiresIn: number; // OTP expiry in seconds
}
```

**Implementation**:

```typescript
router.post(
  '/register',
  [rateLimiter('general'), validateRequest(registerSchema)],
  async (req: Request, res: Response) => {
    try {
      const { email, password, confirmPassword, referralCode, acceptTerms } = req.body;

      // Validate input
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          error: 'Passwords do not match',
        });
      }

      // Check if user already exists
      const existingUser = await UserService.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User already exists',
        });
      }

      // Validate referral code if provided
      if (referralCode) {
        const referrer = await UserService.getUserByReferralCode(referralCode);
        if (!referrer) {
          return res.status(400).json({
            success: false,
            error: 'Invalid referral code',
          });
        }
      }

      // Generate OTP
      await OTPService.generateOTP(email, OTPType.REGISTRATION);

      res.status(200).json({
        success: true,
        data: {
          message: 'Registration initiated. Please verify your email.',
          email,
          otpSent: true,
          expiresIn: 600, // 10 minutes
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Registration failed',
      });
    }
  }
);
```

#### POST /api/v1/auth/verify-registration

**Purpose**: Complete user registration with OTP verification

**Request Body**:

```typescript
interface VerifyRegistrationRequest {
  email: string;
  otp: string;
  password: string;
  referralCode?: string;
}
```

**Response**:

```typescript
interface VerifyRegistrationResponse {
  user: {
    userId: string;
    email: string;
    role: UserRole;
    referralCode: string;
    isEmailVerified: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}
```

#### POST /api/v1/auth/login

**Purpose**: Authenticate user and initiate login OTP

**Request Body**:

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response**:

```typescript
interface LoginResponse {
  message: string;
  otpSent: boolean;
  expiresIn: number;
}
```

#### POST /api/v1/auth/verify-login

**Purpose**: Complete login with OTP verification

**Request Body**:

```typescript
interface VerifyLoginRequest {
  email: string;
  otp: string;
}
```

**Response**:

```typescript
interface VerifyLoginResponse {
  user: UserProfile;
  tokens: TokenPair;
  permissions: Permission[];
}
```

#### POST /api/v1/auth/refresh

**Purpose**: Refresh access token using refresh token

**Request Body**:

```typescript
interface RefreshTokenRequest {
  refreshToken: string;
}
```

**Response**:

```typescript
interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}
```

#### POST /api/v1/auth/logout

**Purpose**: Logout user and invalidate session

**Headers**: `Authorization: Bearer <token>`

**Response**:

```typescript
interface LogoutResponse {
  message: string;
}
```

### 2. User Management Endpoints

#### GET /api/v1/users/profile

**Purpose**: Get current user's profile

**Headers**: `Authorization: Bearer <token>`

**Response**:

```typescript
interface UserProfileResponse {
  user: {
    userId: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    referralCode: string;
    profile: UserProfile;
    walletAddress?: string;
    isEmailVerified: boolean;
    createdAt: string;
  };
}
```

#### PUT /api/v1/users/profile

**Purpose**: Update user profile

**Headers**: `Authorization: Bearer <token>`

**Request Body**:

```typescript
interface UpdateProfileRequest {
  profile?: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    country?: string;
    timezone?: string;
  };
}
```

#### GET /api/v1/users/:userId/referral-tree

**Purpose**: Get user's referral network

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:

```typescript
interface ReferralTreeQuery {
  depth?: number; // Maximum depth to traverse (default: 5)
  includeStats?: boolean; // Include volume and commission stats
}
```

**Response**:

```typescript
interface ReferralTreeResponse {
  tree: {
    userId: string;
    email: string;
    level: number;
    directReferrals: number;
    totalTeamSize: number;
    totalVolume: number;
    commissionEarned: number;
    joinedAt: string;
    children: ReferralTreeNode[];
  };
  statistics: {
    totalLevels: number;
    totalMembers: number;
    totalVolume: number;
    totalCommissions: number;
  };
}
```

### 3. Deposit Management Endpoints

#### GET /api/v1/deposits/address

**Purpose**: Get user's unique deposit address

**Headers**: `Authorization: Bearer <token>`

**Response**:

```typescript
interface DepositAddressResponse {
  address: string;
  qrCode: string; // Base64 encoded QR code image
  network: string; // "BSC"
  token: string; // "USDT"
}
```

#### POST /api/v1/deposits/sync

**Purpose**: Sync and validate blockchain transactions

**Headers**: `Authorization: Bearer <token>`

**Request Body**:

```typescript
interface SyncDepositRequest {
  transactionHash?: string; // Optional specific transaction to check
}
```

**Response**:

```typescript
interface SyncDepositResponse {
  transactions: {
    transactionHash: string;
    amount: string; // In USDT
    status: 'PENDING' | 'CONFIRMED' | 'FAILED';
    blockNumber?: number;
    confirmations: number;
    depositId?: string;
  }[];
  newDeposits: number;
  totalSynced: number;
}
```

#### GET /api/v1/deposits

**Purpose**: Get user's deposit history

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:

```typescript
interface DepositQuery {
  page?: number;
  limit?: number;
  status?: DepositStatus;
  sortBy?: 'createdAt' | 'amount' | 'status';
  sortOrder?: 'asc' | 'desc';
}
```

**Response**:

```typescript
interface DepositsResponse {
  deposits: {
    depositId: string;
    amount: string;
    status: DepositStatus;
    transactionHash?: string;
    monthlyReturn: number;
    totalReturns: string;
    remainingMonths: number;
    isWithinLimit: boolean;
    createdAt: string;
    activatedAt?: string;
  }[];
  summary: {
    totalDeposits: string;
    activeDeposits: string;
    dormantDeposits: string;
    totalReturns: string;
    monthlyIncome: string;
  };
}
```

#### GET /api/v1/deposits/:depositId

**Purpose**: Get specific deposit details

**Headers**: `Authorization: Bearer <token>`

**Response**:

```typescript
interface DepositDetailsResponse {
  deposit: {
    depositId: string;
    amount: string;
    status: DepositStatus;
    transactionHash?: string;
    blockNumber?: number;
    tenure: number;
    monthlyReturn: number;
    totalReturns: string;
    remainingMonths: number;
    nextPaymentDate?: string;
    isWithinLimit: boolean;
    createdAt: string;
    activatedAt?: string;
    completedAt?: string;
  };
  paymentHistory: {
    month: number;
    year: number;
    amount: string;
    paidAt: string;
  }[];
}
```

### 4. Wallet Management Endpoints

#### GET /api/v1/wallet/balances

**Purpose**: Get all wallet pocket balances

**Headers**: `Authorization: Bearer <token>`

**Response**:

```typescript
interface WalletBalancesResponse {
  pockets: {
    [PocketType.DEPOSIT]: {
      balance: string;
      totalEarnings: string;
      lastUpdated: string;
    };
    [PocketType.INCOME]: {
      balance: string;
      totalEarnings: string;
      lastUpdated: string;
    };
    [PocketType.COMMISSION]: {
      balance: string;
      totalEarnings: string;
      lastUpdated: string;
    };
  };
  summary: {
    totalBalance: string;
    totalEarnings: string;
    maxEarningLimit: string;
    earningProgress: number; // Percentage (0-100)
    canEarnMore: boolean;
  };
}
```

#### GET /api/v1/wallet/transactions

**Purpose**: Get wallet transaction history

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:

```typescript
interface TransactionQuery {
  page?: number;
  limit?: number;
  pocketType?: PocketType;
  transactionType?: TransactionType;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
}
```

**Response**:

```typescript
interface TransactionsResponse {
  transactions: {
    transactionId: string;
    amount: string;
    type: TransactionType;
    pocketType: PocketType;
    description: string;
    timestamp: string;
    relatedDepositId?: string;
    relatedUserId?: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
  }[];
}
```

#### POST /api/v1/wallet/withdraw

**Purpose**: Initiate withdrawal request

**Headers**: `Authorization: Bearer <token>`

**Request Body**:

```typescript
interface WithdrawRequest {
  amount: string; // Amount in USDT
  walletAddress: string; // BSC wallet address
  pocketType: PocketType; // Which pocket to withdraw from
}
```

**Response**:

```typescript
interface WithdrawResponse {
  withdrawalId: string;
  amount: string;
  fee: string;
  netAmount: string;
  status: 'PENDING_APPROVAL';
  estimatedProcessingTime: string;
}
```

### 5. Commission & Referral Endpoints

#### GET /api/v1/commissions

**Purpose**: Get commission history

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:

```typescript
interface CommissionQuery {
  page?: number;
  limit?: number;
  level?: number; // 1-5
  startDate?: string;
  endDate?: string;
}
```

**Response**:

```typescript
interface CommissionsResponse {
  commissions: {
    distributionId: string;
    level: number;
    amount: string;
    percentage: number;
    triggerUserId: string;
    triggerUserEmail: string;
    triggerAmount: string;
    status: CommissionStatus;
    createdAt: string;
  }[];
  summary: {
    totalCommissions: string;
    thisMonth: string;
    byLevel: {
      [key: number]: {
        count: number;
        total: string;
      };
    };
  };
}
```

#### GET /api/v1/referrals/stats

**Purpose**: Get referral statistics

**Headers**: `Authorization: Bearer <token>`

**Response**:

```typescript
interface ReferralStatsResponse {
  overview: {
    totalReferrals: number;
    activeReferrals: number;
    totalVolume: string;
    totalCommissions: string;
  };
  byLevel: {
    level: number;
    count: number;
    volume: string;
    commissions: string;
  }[];
  recentActivity: {
    userId: string;
    email: string;
    action: 'JOINED' | 'DEPOSITED';
    amount?: string;
    timestamp: string;
  }[];
}
```

### 6. Admin Endpoints

#### GET /api/v1/admin/dashboard

**Purpose**: Get admin dashboard overview

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `READ_SYSTEM_METRICS`

**Response**:

```typescript
interface AdminDashboardResponse {
  users: {
    total: number;
    active: number;
    suspended: number;
    newThisMonth: number;
  };
  deposits: {
    total: string;
    active: string;
    dormant: string;
    pending: number;
    thisMonth: string;
  };
  commissions: {
    totalDistributed: string;
    thisMonth: string;
    pendingDistributions: number;
  };
  wallets: {
    collectionBalance: string;
    payoutBalance: string;
    totalUserBalances: string;
  };
  topPerformers: {
    userId: string;
    email: string;
    totalVolume: string;
    teamSize: number;
  }[];
}
```

#### GET /api/v1/admin/users

**Purpose**: Get all users with filtering

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `READ_ALL_USERS`

**Query Parameters**:

```typescript
interface AdminUsersQuery {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string; // Email search
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

#### PUT /api/v1/admin/users/:userId/status

**Purpose**: Update user status

**Headers**: `Authorization: Bearer <token>`

**Permissions**: `UPDATE_USER`

**Request Body**:

```typescript
interface UpdateUserStatusRequest {
  status: UserStatus;
  reason?: string;
}
```

### Error Handling

#### Standard Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
  requestId: string;
}
```

#### Error Codes

```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
```

### Request Validation

#### Joi Schemas

```typescript
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(PASSWORD_REGEX).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  referralCode: Joi.string().length(8).optional(),
  acceptTerms: Joi.boolean().valid(true).required(),
});

const depositSyncSchema = Joi.object({
  transactionHash: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
});

const withdrawSchema = Joi.object({
  amount: Joi.string()
    .pattern(/^\d+(\.\d{1,6})?$/)
    .required(),
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  pocketType: Joi.string()
    .valid(...Object.values(PocketType))
    .required(),
});
```

## 🌳 Referral Tree Management

### Tree Structure Design Philosophy

The referral system implements a 5-level MLM structure using a combination of **materialized path** and **genealogy caching** strategies for optimal performance. This hybrid approach ensures fast traversal, efficient commission distribution, and scalable team management.

### Core Tree Concepts

#### 1. Materialized Path Pattern

Each user maintains a path string representing their position in the tree:

```typescript
// Example paths:
// Root user: "/"
// Level 1: "/root-user-id/"
// Level 2: "/root-user-id/level1-user-id/"
// Level 3: "/root-user-id/level1-user-id/level2-user-id/"
```

#### 2. Genealogy Caching

For rapid commission distribution, we cache the 5-level ancestry for each user:

```typescript
interface Genealogy {
  userId: string;
  level1?: string; // Direct parent (immediate upline)
  level2?: string; // Grandparent
  level3?: string; // Great-grandparent
  level4?: string; // Level 4 ancestor
  level5?: string; // Level 5 ancestor
}
```

### Tree Operations Implementation

#### 1. Adding New User to Tree

```typescript
class ReferralTreeService {
  static async addUserToTree(newUserId: string, referrerCode?: string): Promise<void> {
    let parentUserId: string | undefined;
    let parentPath = '/';
    let level = 0;

    if (referrerCode) {
      // Find parent user by referral code
      const parent = await UserService.getUserByReferralCode(referrerCode);
      if (!parent) {
        throw new Error('Invalid referral code');
      }

      parentUserId = parent.userId;

      // Get parent's current position
      const parentNode = await this.getReferralNode(parentUserId);
      parentPath = parentNode.path;
      level = parentNode.level + 1;

      // Update parent's direct referrals list
      await this.addDirectReferral(parentUserId, newUserId);
    }

    // Create new user's referral node with genealogy cache
    const newUserPath = `${parentPath}${newUserId}/`;
    const genealogy = await this.buildGenealogy(parentUserId);

    const referralNode = {
      userId: newUserId,
      parentUserId,
      level,
      path: newUserPath,
      directReferrals: [],
      totalTeamSize: 0,
      totalTeamVolume: 0,
      commissionEarned: 0,
      // Include genealogy cache directly in the referral node
      level1: genealogy.level1,
      level2: genealogy.level2,
      level3: genealogy.level3,
      level4: genealogy.level4,
      level5: genealogy.level5,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    // Single write operation to referral network table
    await dynamoDB.putItem({
      TableName: 'YieldCycle-ReferralNetwork',
      Item: referralNode,
    });

    // Update team sizes up the chain
    await this.updateTeamSizesUpChain(newUserId, 1);
  }

  private static async buildGenealogy(parentUserId?: string): Promise<Genealogy> {
    const genealogy: Genealogy = { userId: '' };

    if (!parentUserId) {
      return genealogy;
    }

    // Get parent's genealogy
    const parentGenealogy = await this.getGenealogy(parentUserId);

    // Shift levels down and add new parent
    genealogy.level5 = parentGenealogy.level4;
    genealogy.level4 = parentGenealogy.level3;
    genealogy.level3 = parentGenealogy.level2;
    genealogy.level2 = parentGenealogy.level1;
    genealogy.level1 = parentUserId;

    return genealogy;
  }
}
```

#### 2. Commission Distribution Algorithm

```typescript
class CommissionService {
  private static readonly COMMISSION_RATES = [0.1, 0.05, 0.03, 0.01, 0.01]; // 10%, 5%, 3%, 1%, 1%

  static async distributeCommissions(
    depositId: string,
    userId: string,
    amount: number
  ): Promise<void> {
    // Get user's genealogy for fast ancestor lookup
    const genealogy = await ReferralTreeService.getGenealogy(userId);
    const ancestors = [
      genealogy.level1,
      genealogy.level2,
      genealogy.level3,
      genealogy.level4,
      genealogy.level5,
    ].filter(Boolean);

    if (ancestors.length === 0) {
      // No upline, no commission to distribute
      return;
    }

    const distributionId = uuidv4();
    const distributions: CommissionAllocation[] = [];
    let totalDistributed = 0;

    // Calculate commissions for each level
    for (let i = 0; i < ancestors.length; i++) {
      const recipientUserId = ancestors[i];
      const level = i + 1;
      const percentage = this.COMMISSION_RATES[i];
      const commissionAmount = amount * percentage;

      // Check if recipient can still earn (hasn't reached earning limit)
      const canEarn = await this.checkEarningEligibility(recipientUserId);

      if (canEarn) {
        distributions.push({
          recipientUserId,
          level,
          percentage,
          amount: commissionAmount,
          status: CommissionStatus.PENDING,
        });
        totalDistributed += commissionAmount;
      }
    }

    // Create commission distribution record
    const distributionRecord = {
      distributionId,
      triggerDepositId: depositId,
      triggerUserId: userId,
      triggerAmount: amount,
      totalDistributed,
      status: 'PROCESSING',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    await dynamoDB.putItem({
      TableName: 'YieldCycle-CommissionDistributions',
      Item: distributionRecord,
    });

    // Process individual commission allocations
    await this.processCommissionAllocations(distributionId, distributions);
  }

  private static async processCommissionAllocations(
    distributionId: string,
    distributions: CommissionAllocation[]
  ): Promise<void> {
    const allocationPromises = distributions.map(async (allocation) => {
      // Create individual commission record
      const allocationRecord = {
        distributionId,
        recipientUserId: allocation.recipientUserId,
        triggerUserId: allocation.triggerUserId,
        level: allocation.level,
        percentage: allocation.percentage,
        amount: allocation.amount,
        status: allocation.status,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      // Update user's commission pocket
      await Promise.all([
        dynamoDB.putItem({
          TableName: 'YieldCycle-CommissionAllocations',
          Item: allocationRecord,
        }),
        WalletService.creditCommissionPocket(
          allocation.recipientUserId,
          allocation.amount,
          allocation.level,
          distributionId
        ),
      ]);

      // Update allocation status to CREDITED
      allocation.status = CommissionStatus.CREDITED;
    });

    await Promise.all(allocationPromises);
  }
}
```

#### 3. Team Statistics Calculation

```typescript
class TeamStatsService {
  static async updateTeamStatsOnDeposit(userId: string, depositAmount: number): Promise<void> {
    // Get user's genealogy to find all ancestors
    const genealogy = await ReferralTreeService.getGenealogy(userId);
    const ancestors = [
      genealogy.level1,
      genealogy.level2,
      genealogy.level3,
      genealogy.level4,
      genealogy.level5,
    ].filter(Boolean);

    // Update volume for all ancestors
    const updatePromises = ancestors.map((ancestorId) =>
      this.incrementTeamVolume(ancestorId, depositAmount)
    );

    await Promise.all(updatePromises);
  }

  private static async incrementTeamVolume(userId: string, amount: number): Promise<void> {
    const updateExpression = 'ADD #data.#totalTeamVolume :amount SET #updatedAt = :timestamp';
    const expressionAttributeNames = {
      '#data': 'Data',
      '#totalTeamVolume': 'totalTeamVolume',
      '#updatedAt': 'UpdatedAt',
    };
    const expressionAttributeValues = {
      ':amount': amount,
      ':timestamp': new Date().toISOString(),
    };

    await dynamoDB.updateItem(
      {
        PK: `USER#${userId}`,
        SK: 'REFERRAL_NODE',
      },
      {
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }
    );
  }

  static async getTeamStatistics(userId: string, maxDepth: number = 5): Promise<TeamStatistics> {
    const statistics: TeamStatistics = {
      totalMembers: 0,
      totalVolume: 0,
      activeMembers: 0,
      levelBreakdown: [],
    };

    // Get statistics for each level
    for (let level = 1; level <= maxDepth; level++) {
      const levelStats = await this.getLevelStatistics(userId, level);
      statistics.levelBreakdown.push(levelStats);
      statistics.totalMembers += levelStats.memberCount;
      statistics.totalVolume += levelStats.totalVolume;
      statistics.activeMembers += levelStats.activeMembers;
    }

    return statistics;
  }

  private static async getLevelStatistics(userId: string, level: number): Promise<LevelStatistics> {
    // Query all users at specific level under this user
    const descendants = await this.getDescendantsAtLevel(userId, level);

    let totalVolume = 0;
    let activeMembers = 0;

    for (const descendant of descendants) {
      const userStats = await this.getUserStats(descendant.userId);
      totalVolume += userStats.totalDeposits;
      if (userStats.hasActiveDeposits) {
        activeMembers++;
      }
    }

    return {
      level,
      memberCount: descendants.length,
      totalVolume,
      activeMembers,
    };
  }
}
```

#### 4. Tree Traversal & Queries

```typescript
class TreeTraversalService {
  // Get direct children of a user
  static async getDirectReferrals(userId: string): Promise<ReferralNode[]> {
    const result = await dynamoDB.query({
      TableName: 'YieldCycle-ReferralNetwork',
      IndexName: 'ParentUserIdIndex',
      KeyConditionExpression: 'parentUserId = :parentUserId',
      ExpressionAttributeValues: {
        ':parentUserId': userId,
      },
    });

    return result.Items;
  }

  // Get all descendants up to specified depth
  static async getDescendantsTree(userId: string, maxDepth: number = 5): Promise<TreeNode> {
    const rootNode = await ReferralTreeService.getReferralNode(userId);
    const tree: TreeNode = {
      ...rootNode,
      children: [],
    };

    if (maxDepth > 0) {
      const directChildren = await this.getDirectReferrals(userId);

      const childPromises = directChildren.map(async (child) => {
        return await this.getDescendantsTree(child.userId, maxDepth - 1);
      });

      tree.children = await Promise.all(childPromises);
    }

    return tree;
  }

  // Find all users at specific level under a user
  static async getDescendantsAtLevel(userId: string, targetLevel: number): Promise<ReferralNode[]> {
    const userNode = await ReferralTreeService.getReferralNode(userId);
    const targetAbsoluteLevel = userNode.level + targetLevel;

    // Query users at target level whose path starts with user's path
    const result = await dynamoDB.query({
      TableName: 'YieldCycle-ReferralNetwork',
      IndexName: 'LevelIndex',
      KeyConditionExpression: '#level = :level',
      FilterExpression: 'begins_with(#path, :userPath)',
      ExpressionAttributeNames: {
        '#level': 'level',
        '#path': 'path',
      },
      ExpressionAttributeValues: {
        ':level': targetAbsoluteLevel,
        ':userPath': userNode.path,
      },
    });

    return result.Items;
  }

  // Find path between two users
  static async findRelationship(
    userId1: string,
    userId2: string
  ): Promise<RelationshipInfo | null> {
    const [user1Node, user2Node] = await Promise.all([
      ReferralTreeService.getReferralNode(userId1),
      ReferralTreeService.getReferralNode(userId2),
    ]);

    // Check if one is ancestor of the other
    if (user1Node.path.startsWith(user2Node.path)) {
      return {
        type: 'DESCENDANT',
        distance: user1Node.level - user2Node.level,
        path: user1Node.path.replace(user2Node.path, '').split('/').filter(Boolean),
      };
    }

    if (user2Node.path.startsWith(user1Node.path)) {
      return {
        type: 'ANCESTOR',
        distance: user2Node.level - user1Node.level,
        path: user2Node.path.replace(user1Node.path, '').split('/').filter(Boolean),
      };
    }

    // Find common ancestor
    const path1Parts = user1Node.path.split('/').filter(Boolean);
    const path2Parts = user2Node.path.split('/').filter(Boolean);

    let commonLength = 0;
    for (let i = 0; i < Math.min(path1Parts.length, path2Parts.length); i++) {
      if (path1Parts[i] === path2Parts[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    if (commonLength > 0) {
      return {
        type: 'COUSIN',
        distance: path1Parts.length - commonLength + (path2Parts.length - commonLength),
        commonAncestor: path1Parts[commonLength - 1],
      };
    }

    return null; // No relationship
  }
}
```

### Performance Optimizations

#### 1. Batch Operations

```typescript
class BatchTreeOperations {
  static async batchUpdateTeamStats(updates: TeamStatsUpdate[]): Promise<void> {
    // Group updates by user to avoid multiple updates to same record
    const groupedUpdates = updates.reduce(
      (acc, update) => {
        if (!acc[update.userId]) {
          acc[update.userId] = { volumeIncrease: 0, memberIncrease: 0 };
        }
        acc[update.userId].volumeIncrease += update.volumeIncrease || 0;
        acc[update.userId].memberIncrease += update.memberIncrease || 0;
        return acc;
      },
      {} as Record<string, { volumeIncrease: number; memberIncrease: number }>
    );

    // Execute batched updates
    const updatePromises = Object.entries(groupedUpdates).map(([userId, totals]) =>
      this.updateUserTeamStats(userId, totals.volumeIncrease, totals.memberIncrease)
    );

    await Promise.all(updatePromises);
  }
}
```

#### 2. Caching Strategy

```typescript
class TreeCacheService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static cache = new Map<string, { data: any; expires: number }>();

  static async getCachedTeamStats(userId: string): Promise<TeamStatistics | null> {
    const key = `team_stats_${userId}`;
    const cached = this.cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    return null;
  }

  static setCachedTeamStats(userId: string, stats: TeamStatistics): void {
    const key = `team_stats_${userId}`;
    this.cache.set(key, {
      data: stats,
      expires: Date.now() + this.CACHE_TTL * 1000,
    });
  }

  static invalidateUserCache(userId: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter((key) => key.includes(userId));
    keysToDelete.forEach((key) => this.cache.delete(key));
  }
}
```

### Tree Integrity & Validation

#### 1. Consistency Checks

```typescript
class TreeIntegrityService {
  static async validateTreeConsistency(userId: string): Promise<ValidationResult> {
    const issues: string[] = [];

    // Check if genealogy matches actual path
    const [node, genealogy] = await Promise.all([
      ReferralTreeService.getReferralNode(userId),
      ReferralTreeService.getGenealogy(userId),
    ]);

    // Validate path consistency
    const pathParts = node.path.split('/').filter(Boolean);
    if (pathParts.length !== node.level + 1) {
      issues.push('Path length does not match level');
    }

    // Validate genealogy consistency
    if (node.parentUserId !== genealogy.level1) {
      issues.push('Parent mismatch between node and genealogy');
    }

    // Check team size calculations
    const actualTeamSize = await this.calculateActualTeamSize(userId);
    if (actualTeamSize !== node.totalTeamSize) {
      issues.push(`Team size mismatch: recorded ${node.totalTeamSize}, actual ${actualTeamSize}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  static async repairTreeInconsistencies(userId: string): Promise<void> {
    // Recalculate and update team statistics
    const actualStats = await this.calculateActualTeamStats(userId);

    await ReferralTreeService.updateReferralNode(userId, {
      totalTeamSize: actualStats.totalMembers,
      totalTeamVolume: actualStats.totalVolume,
    });

    // Rebuild genealogy if needed
    const node = await ReferralTreeService.getReferralNode(userId);
    const correctGenealogy = await ReferralTreeService.buildGenealogy(node.parentUserId);

    await ReferralTreeService.updateGenealogy(userId, correctGenealogy);
  }
}
```

## ⛓️ Blockchain Integration

### BSC & USDT Integration Architecture

The system integrates with Binance Smart Chain (BSC) for USDT transactions using a centralized custodian model with individual user deposit addresses derived from a master wallet.

### Core Components

#### 1. Wallet Generation Service

```typescript
import { ethers } from 'ethers';
import HDWallet from 'ethereumjs-wallet/hdkey';
import * as bip39 from 'bip39';

class WalletService {
  private static readonly DERIVATION_PATH = "m/44'/60'/0'/0/";
  private static masterWallet: HDWallet;
  private static provider: ethers.providers.JsonRpcProvider;

  static async initialize(): Promise<void> {
    // Initialize BSC provider
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/'
    );

    // Initialize master wallet from mnemonic
    const mnemonic = process.env.MASTER_MNEMONIC;
    if (!mnemonic) {
      throw new Error('Master mnemonic not configured');
    }

    const seed = await bip39.mnemonicToSeed(mnemonic);
    this.masterWallet = HDWallet.fromMasterSeed(seed);
  }

  static generateUserWallet(userId: string): UserWallet {
    // Generate deterministic index from userId
    const userIndex = this.generateDeterministicIndex(userId);

    // Derive wallet at specific index
    const derivedWallet = this.masterWallet
      .derivePath(`${this.DERIVATION_PATH}${userIndex}`)
      .getWallet();

    const address = `0x${derivedWallet.getAddress().toString('hex')}`;
    const privateKey = `0x${derivedWallet.getPrivateKey().toString('hex')}`;

    return {
      address,
      privateKey,
      index: userIndex,
      userId,
    };
  }

  private static generateDeterministicIndex(userId: string): number {
    // Generate consistent index from userId hash
    const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(userId));
    const index = parseInt(hash.slice(2, 10), 16) % 1000000; // Limit to 1M addresses
    return index;
  }

  static async getWalletBalance(address: string): Promise<WalletBalance> {
    try {
      // Get native BNB balance
      const bnbBalance = await this.provider.getBalance(address);

      // Get USDT balance
      const usdtBalance = await this.getUSDTBalance(address);

      return {
        address,
        bnb: ethers.utils.formatEther(bnbBalance),
        usdt: ethers.utils.formatUnits(usdtBalance, 18),
        lastUpdated: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get wallet balance: ${error.message}`);
    }
  }

  private static async getUSDTBalance(address: string): Promise<ethers.BigNumber> {
    const usdtContract = new ethers.Contract(
      process.env.USDT_CONTRACT_ADDRESS!,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider
    );

    return await usdtContract.balanceOf(address);
  }
}
```

#### 2. Manual Transaction Sync Service

```typescript
class BlockchainSyncService {
  private static readonly USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS!;
  private static readonly CONFIRMATION_BLOCKS = 12; // BSC confirmations
  private static provider: ethers.providers.JsonRpcProvider;

  static async initialize(): Promise<void> {
    this.provider = new ethers.providers.JsonRpcProvider(
      process.env.BSC_RPC_URL!
    );
  }

  static async syncUserDeposits(userId: string): Promise<SyncResult> {
    try {
      const userWallet = await UserService.getUserWallet(userId);
      if (!userWallet) {
        throw new Error("User wallet not found");
      }

      console.log(`Syncing deposits for user ${userId} at address ${userWallet.address}`);

      // Get recent USDT transfers to this address
      const transfers = await this.getUSDTTransfers(userWallet.address);

      // Process each transfer
      const processed = [];
      for (const transfer of transfers) {
        const result = await this.processTransfer(userId, transfer);
        if (result) {
          processed.push(result);
        }
      }

      return {
        userId,
        address: userWallet.address,
        transfersFound: transfers.length,
        transfersProcessed: processed.length,
        processedTransfers: processed,
        syncedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to sync deposits for user ${userId}: ${error.message}`);
    }
  }

  private static async getUSDTTransfers(address: string): Promise<USDTTransfer[]> {
    const usdtContract = new ethers.Contract(
      this.USDT_CONTRACT,
      [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
      ],
      this.provider
    );

    const latestBlock = await this.provider.getBlockNumber();
    const fromBlock = latestBlock - 1000; // Check last 1000 blocks

    // Get Transfer events where 'to' is our address
    const events = await usdtContract.queryFilter(
      usdtContract.filters.Transfer(null, address),
      fromBlock,
      latestBlock
    );

    return events.map(event => ({
      from: event.args?.from,
      to: event.args?.to,
      amount: event.args?.value.toString(),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
    }));
  }

  private static async processTransfer(
    userId: string,
    transfer: USDTTransfer
  ): Promise<ProcessedTransfer | null> {
    try {
      // Check if this transaction was already processed
      const existingDeposit = await DepositService.getDepositByTransaction(
        transfer.transactionHash
      );

      if (existingDeposit) {
        console.log(`Transaction ${transfer.transactionHash} already processed`);
        return null;
      }

      // Validate transaction confirmations
      const txDetails = await this.getTransactionDetails(transfer.transactionHash);
      if (txDetails.confirmations < this.CONFIRMATION_BLOCKS) {
        console.log(
          `Transaction ${transfer.transactionHash} needs more confirmations: ${txDetails.confirmations}/${this.CONFIRMATION_BLOCKS}`
        );
        return null;
      }

      // Process the deposit
      const deposit = await DepositService.processIncomingTransfer({
        userId,
        amount: transfer.amount,
        transactionHash: transfer.transactionHash,
        blockNumber: transfer.blockNumber,
        fromAddress: transfer.from,
        toAddress: transfer.to,
      });

      return {
        transactionHash: transfer.transactionHash,
        amount: transfer.amount,
        status: "PROCESSED",
        depositId: deposit.depositId,
      };
    } catch (error) {
      console.error(`Error processing transfer ${transfer.transactionHash}:`, error);
      return {
        transactionHash: transfer.transactionHash,
        amount: transfer.amount,
        status: "FAILED",
        error: error.message,
      };
    }
  }

  private static async getTransactionDetails(txHash: string): Promise<any> {
    return await this.provider.getTransactionReceipt(txHash);
  }
}
    const transfers = await this.getUSDTTransfersForAddress(
      userWallet.address,
      startBlock,
      latestBlock
    );

    const syncedTransactions: TransactionInfo[] = [];

    for (const transfer of transfers) {
      const txInfo = await this.getTransactionDetails(transfer.transactionHash);
      syncedTransactions.push(txInfo);

      // Process if not already processed
      const existingDeposit = await DepositService.getDepositByTxHash(
        transfer.transactionHash
      );
      if (!existingDeposit) {
        await DepositService.processIncomingTransfer({
          userId,
          amount: transfer.returnValues.value,
          transactionHash: transfer.transactionHash,
          blockNumber: transfer.blockNumber,
          fromAddress: transfer.returnValues.from,
          toAddress: transfer.returnValues.to,
        });
      }
    }

    return {
      syncedCount: syncedTransactions.length,
      transactions: syncedTransactions,
      fromBlock: startBlock,
      toBlock: latestBlock,
    };
  }

  private static async getUSDTTransfersForAddress(
    address: string,
    fromBlock: number,
    toBlock: number
  ): Promise<any[]> {
    const usdtContract = new ethers.Contract(
      this.USDT_CONTRACT,
      [
        "event Transfer(address indexed from, address indexed to, uint256 value)",
      ],
      this.provider
    );

    // Filter for transfers TO this address
    const filter = usdtContract.filters.Transfer(null, address);
    const events = await usdtContract.queryFilter(filter, fromBlock, toBlock);

    return events;
  }

  static async getTransactionDetails(txHash: string): Promise<TransactionInfo> {
    const [tx, receipt] = await Promise.all([
      this.provider.getTransaction(txHash),
      this.provider.getTransactionReceipt(txHash),
    ]);

    if (!tx || !receipt) {
      throw new Error("Transaction not found");
    }

    const currentBlock = await this.provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.utils.formatEther(tx.value),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: ethers.utils.formatUnits(tx.gasPrice!, "gwei"),
      blockNumber: receipt.blockNumber,
      confirmations,
      status: receipt.status === 1 ? "SUCCESS" : "FAILED",
      timestamp: await this.getBlockTimestamp(receipt.blockNumber),
    };
  }
}
```

#### 3. Deposit Processing Service

```typescript
class DepositService {
  static async processIncomingTransfer(transfer: IncomingTransfer): Promise<void> {
    try {
      // Validate transaction
      const isValid = await this.validateTransfer(transfer);
      if (!isValid) {
        console.warn('Invalid transfer detected:', transfer);
        return;
      }

      // Check if already processed
      const existingDeposit = await this.getDepositByTxHash(transfer.transactionHash);
      if (existingDeposit) {
        console.log('Transfer already processed:', transfer.transactionHash);
        return;
      }

      // Convert amount from wei to USDT
      const usdtAmount = parseFloat(ethers.utils.formatUnits(transfer.amount, 18));

      // Get user limits
      const userLimits = await UserService.getUserDepositLimits(transfer.userId);
      const currentDeposits = await this.getUserTotalDeposits(transfer.userId);

      // Determine if deposit is within limits
      const remainingLimit = userLimits.maxDeposit - currentDeposits;
      const isWithinLimit = usdtAmount <= remainingLimit;

      // Create deposit record
      const depositId = uuidv4();
      const depositStatus = isWithinLimit ? DepositStatus.ACTIVE : DepositStatus.DORMANT;

      const deposit: Deposit = {
        depositId,
        userId: transfer.userId,
        amount: usdtAmount,
        status: depositStatus,
        transactionHash: transfer.transactionHash,
        blockNumber: transfer.blockNumber,
        depositAddress: transfer.toAddress,
        tenure: 25, // months
        monthlyReturn: 8, // percentage
        totalReturns: 0,
        remainingMonths: 25,
        isWithinLimit,
        createdAt: new Date(),
        updatedAt: new Date(),
        activatedAt: isWithinLimit ? new Date() : undefined,
      };

      // Save deposit
      await this.saveDeposit(deposit);

      // Update user's deposit pocket
      await WalletService.creditDepositPocket(transfer.userId, usdtAmount, depositId);

      // If active deposit, trigger commission distribution
      if (isWithinLimit) {
        await CommissionService.distributeCommissions(depositId, transfer.userId, usdtAmount);

        // Update team statistics
        await TeamStatsService.updateTeamStatsOnDeposit(transfer.userId, usdtAmount);
      }

      console.log(
        `Deposit processed: ${depositId} - ${usdtAmount} USDT - Status: ${depositStatus}`
      );
    } catch (error) {
      console.error('Error processing deposit:', error);
      throw error;
    }
  }

  private static async validateTransfer(transfer: IncomingTransfer): Promise<boolean> {
    try {
      // Get transaction details from blockchain
      const txDetails = await BlockchainMonitorService.getTransactionDetails(
        transfer.transactionHash
      );

      // Verify transaction exists and is successful
      if (txDetails.status !== 'SUCCESS') {
        return false;
      }

      // Verify minimum confirmations
      if (txDetails.confirmations < BlockchainMonitorService.CONFIRMATION_BLOCKS) {
        console.log(
          `Transfer ${transfer.transactionHash} needs more confirmations: ${txDetails.confirmations}/${BlockchainMonitorService.CONFIRMATION_BLOCKS}`
        );
        return false;
      }

      // Verify it's a USDT transfer (check contract interaction)
      if (txDetails.to?.toLowerCase() !== process.env.USDT_CONTRACT_ADDRESS?.toLowerCase()) {
        return false;
      }

      // Additional validation can be added here
      return true;
    } catch (error) {
      console.error('Transfer validation error:', error);
      return false;
    }
  }

  static async processPendingDeposits(): Promise<void> {
    // Get all pending deposits
    const pendingDeposits = await this.getPendingDeposits();

    for (const deposit of pendingDeposits) {
      try {
        // Check if transaction is now confirmed
        const txDetails = await BlockchainMonitorService.getTransactionDetails(
          deposit.transactionHash!
        );

        if (txDetails.confirmations >= BlockchainMonitorService.CONFIRMATION_BLOCKS) {
          if (txDetails.status === 'SUCCESS') {
            // Update deposit status
            await this.updateDepositStatus(
              deposit.depositId,
              deposit.isWithinLimit ? DepositStatus.ACTIVE : DepositStatus.DORMANT
            );

            // Process commissions if active
            if (deposit.isWithinLimit) {
              await CommissionService.distributeCommissions(
                deposit.depositId,
                deposit.userId,
                deposit.amount
              );
            }
          } else {
            // Transaction failed
            await this.updateDepositStatus(deposit.depositId, DepositStatus.FAILED);
          }
        }
      } catch (error) {
        console.error(`Error processing pending deposit ${deposit.depositId}:`, error);
      }
    }
  }
}
```

#### 4. Withdrawal Processing Service

```typescript
class WithdrawalService {
  private static masterWallet: ethers.Wallet;
  private static provider: ethers.providers.JsonRpcProvider;
  private static payoutWallet: ethers.Wallet;

  static async initialize(): Promise<void> {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL!);

    // Initialize payout wallet
    this.payoutWallet = new ethers.Wallet(process.env.PAYOUT_WALLET_PRIVATE_KEY!, this.provider);
  }

  static async processWithdrawal(withdrawalId: string): Promise<void> {
    try {
      const withdrawal = await this.getWithdrawalById(withdrawalId);
      if (!withdrawal || withdrawal.status !== 'PENDING_APPROVAL') {
        throw new Error('Invalid withdrawal request');
      }

      // Validate user eligibility
      await this.validateWithdrawalEligibility(withdrawal.userId);

      // Calculate fees
      const { netAmount, fee } = this.calculateWithdrawalAmounts(withdrawal.amount);

      // Check payout wallet balance
      await this.ensureSufficientBalance(netAmount);

      // Execute blockchain transaction
      const txHash = await this.executeUSDTTransfer(withdrawal.walletAddress, netAmount);

      // Update withdrawal record
      await this.updateWithdrawal(withdrawalId, {
        status: 'PROCESSING',
        transactionHash: txHash,
        fee,
        netAmount,
        processedAt: new Date(),
      });

      // Debit user's wallet
      await WalletService.debitUserWallet(
        withdrawal.userId,
        withdrawal.amount,
        withdrawal.pocketType,
        withdrawalId
      );

      console.log(`Withdrawal processed: ${withdrawalId} - TX: ${txHash}`);
    } catch (error) {
      // Update withdrawal status to failed
      await this.updateWithdrawal(withdrawalId, {
        status: 'FAILED',
        errorMessage: error.message,
        processedAt: new Date(),
      });

      throw error;
    }
  }

  private static async executeUSDTTransfer(toAddress: string, amount: number): Promise<string> {
    const usdtContract = new ethers.Contract(
      process.env.USDT_CONTRACT_ADDRESS!,
      [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
      ],
      this.payoutWallet
    );

    // Convert amount to wei
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);

    // Estimate gas
    const gasLimit = await usdtContract.estimateGas.transfer(toAddress, amountWei);
    const gasPrice = await this.provider.getGasPrice();

    // Execute transfer
    const tx = await usdtContract.transfer(toAddress, amountWei, {
      gasLimit: gasLimit.mul(120).div(100), // Add 20% buffer
      gasPrice: gasPrice.mul(110).div(100), // Add 10% to gas price
    });

    // Wait for confirmation
    const receipt = await tx.wait(1);

    if (receipt.status !== 1) {
      throw new Error('Transfer transaction failed');
    }

    return tx.hash;
  }

  private static calculateWithdrawalAmounts(amount: number): {
    netAmount: number;
    fee: number;
  } {
    const feePercentage = parseFloat(process.env.WITHDRAWAL_FEE_PERCENTAGE || '2'); // 2% default
    const fee = amount * (feePercentage / 100);
    const netAmount = amount - fee;

    return { netAmount, fee };
  }

  private static async ensureSufficientBalance(amount: number): Promise<void> {
    const balance = await WalletService.getUSDTBalance(this.payoutWallet.address);
    const balanceNumber = parseFloat(ethers.utils.formatUnits(balance, 18));

    if (balanceNumber < amount) {
      throw new Error(
        `Insufficient payout wallet balance. Required: ${amount}, Available: ${balanceNumber}`
      );
    }
  }
}
```

#### 5. Gas Management Service

```typescript
class GasManagementService {
  private static provider: ethers.providers.JsonRpcProvider;

  static async estimateOptimalGasPrice(): Promise<ethers.BigNumber> {
    // Get current gas price from network
    const currentGasPrice = await this.provider.getGasPrice();

    // Add 10% buffer for faster confirmation
    return currentGasPrice.mul(110).div(100);
  }

  static async ensureGasBalance(walletAddress: string): Promise<void> {
    const balance = await this.provider.getBalance(walletAddress);
    const minBalance = ethers.utils.parseEther('0.01'); // 0.01 BNB minimum

    if (balance.lt(minBalance)) {
      // Auto-refill from gas management wallet
      await this.refillGasBalance(walletAddress);
    }
  }

  private static async refillGasBalance(walletAddress: string): Promise<void> {
    const gasWallet = new ethers.Wallet(process.env.GAS_MANAGEMENT_PRIVATE_KEY!, this.provider);

    const refillAmount = ethers.utils.parseEther('0.02'); // Refill with 0.02 BNB

    const tx = await gasWallet.sendTransaction({
      to: walletAddress,
      value: refillAmount,
      gasLimit: 21000,
    });

    await tx.wait(1);
    console.log(`Gas balance refilled for ${walletAddress}: ${tx.hash}`);
  }
}
```

### Security Considerations

#### 1. Private Key Management

```typescript
class KeyManagementService {
  private static encryptionKey: string;

  static async encryptPrivateKey(privateKey: string): Promise<string> {
    const cipher = crypto.createCipher('aes256', this.encryptionKey);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  static async decryptPrivateKey(encryptedKey: string): Promise<string> {
    const decipher = crypto.createDecipher('aes256', this.encryptionKey);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static validateWalletAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }
}
```

#### 2. Rate Limiting & Circuit Breaker

```typescript
class BlockchainRateLimiter {
  private static requestCounts = new Map<string, number>();
  private static readonly MAX_REQUESTS_PER_MINUTE = 60;

  static async checkRateLimit(operation: string): Promise<boolean> {
    const key = `${operation}_${Math.floor(Date.now() / 60000)}`;
    const current = this.requestCounts.get(key) || 0;

    if (current >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded for blockchain operations');
    }

    this.requestCounts.set(key, current + 1);
    return true;
  }
}
```

## 💼 Business Logic Implementation

### Monthly Income Distribution Service

#### Automated Monthly Processing

```typescript
class MonthlyIncomeService {
  static async processMonthlyIncomes(): Promise<void> {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    console.log(`Processing monthly incomes for ${currentYear}-${currentMonth}`);

    // Get all active deposits
    const activeDeposits = await this.getActiveDeposits();

    const processPromises = activeDeposits.map((deposit) =>
      this.processDepositMonthlyIncome(deposit, currentMonth, currentYear)
    );

    await Promise.all(processPromises);

    console.log(`Processed ${activeDeposits.length} monthly income distributions`);
  }

  private static async processDepositMonthlyIncome(
    deposit: Deposit,
    month: number,
    year: number
  ): Promise<void> {
    try {
      // Check if already processed for this month
      const existingIncome = await this.getMonthlyIncome(deposit.depositId, month, year);
      if (existingIncome && existingIncome.processed) {
        return;
      }

      // Calculate 8% of deposit amount
      const monthlyAmount = deposit.amount * 0.08;

      // Create monthly income record
      const incomeRecord = {
        depositId: deposit.depositId,
        month: `${year}-${month.toString().padStart(2, '0')}`,
        userId: deposit.userId,
        amount: monthlyAmount,
        year,
        monthNum: month,
        processed: true,
        processedAt: new Date().toISOString(),
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      // Credit user's income pocket
      await Promise.all([
        dynamoDB.putItem({
          TableName: 'YieldCycle-MonthlyIncome',
          Item: incomeRecord,
        }),
        WalletService.creditIncomePocket(deposit.userId, monthlyAmount, deposit.depositId),
      ]);

      // Update deposit remaining months
      await this.updateDepositRemainingMonths(deposit.depositId);

      console.log(`Monthly income processed: ${deposit.depositId} - ${monthlyAmount} USDT`);
    } catch (error) {
      console.error(`Error processing monthly income for deposit ${deposit.depositId}:`, error);
    }
  }

  private static async updateDepositRemainingMonths(depositId: string): Promise<void> {
    // Get current deposit to calculate return amount
    const deposit = await DepositService.getDepositById(depositId);
    const monthlyAmount = deposit.amount * 0.08;

    const updateExpression =
      'ADD remainingMonths :decrement, totalReturns :amount SET UpdatedAt = :timestamp';

    const expressionAttributeValues = {
      ':decrement': -1,
      ':amount': monthlyAmount,
      ':timestamp': new Date().toISOString(),
    };

    await dynamoDB.updateItem({
      TableName: 'YieldCycle-Deposits',
      Key: { depositId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    // Check if deposit is completed (0 remaining months)
    if (deposit.remainingMonths <= 1) {
      await this.completeDeposit(depositId);
    }
  }

  private static async completeDeposit(depositId: string): Promise<void> {
    await DepositService.updateDepositStatus(depositId, DepositStatus.COMPLETED);
    console.log(`Deposit completed: ${depositId}`);
  }
}
```

### Earnings Limit Management

```typescript
class EarningsLimitService {
  static async checkEarningEligibility(userId: string): Promise<boolean> {
    const [totalDeposits, totalEarnings] = await Promise.all([
      this.getUserTotalDeposits(userId),
      this.getUserTotalEarnings(userId),
    ]);

    // Maximum earnings is 200% of total deposits
    const maxEarnings = totalDeposits * 2;

    return totalEarnings < maxEarnings;
  }

  static async calculateRemainingEarningCapacity(userId: string): Promise<number> {
    const [totalDeposits, totalEarnings] = await Promise.all([
      this.getUserTotalDeposits(userId),
      this.getUserTotalEarnings(userId),
    ]);

    const maxEarnings = totalDeposits * 2;
    const remainingCapacity = Math.max(0, maxEarnings - totalEarnings);

    return remainingCapacity;
  }

  static async updateUserEarningStatus(userId: string): Promise<void> {
    const canEarn = await this.checkEarningEligibility(userId);

    if (!canEarn) {
      // Move user to dormant state for future earnings
      await UserService.updateUserStatus(userId, UserStatus.EARNING_LIMIT_REACHED);

      // Stop all future monthly incomes for this user
      await this.pauseUserMonthlyIncomes(userId);

      // Stop commission eligibility
      await this.pauseCommissionEligibility(userId);
    }
  }
}
```

## 🔒 Security Implementation

### Data Encryption & Protection

```typescript
class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  static encrypt(text: string, key?: string): EncryptedData {
    const encryptionKey = key ? Buffer.from(key, 'hex') : this.getDefaultKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipherGCM(this.ALGORITHM, encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  static decrypt(encryptedData: EncryptedData, key?: string): string {
    const encryptionKey = key ? Buffer.from(key, 'hex') : this.getDefaultKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');

    const decipher = crypto.createDecipherGCM(this.ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private static getDefaultKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Encryption key not configured');
    }
    return Buffer.from(key, 'hex');
  }
}
```

### Audit Trail Implementation

```typescript
class AuditService {
  static async logUserAction(
    userId: string,
    action: string,
    details: any,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const auditRecord = {
      logId: uuidv4(),
      userId,
      action,
      resource: details.resource || 'UNKNOWN',
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      success: true,
      metadata: details,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    await dynamoDB.putItem({
      TableName: 'YieldCycle-AuditLogs',
      Item: auditRecord,
    });
  }

  static async logSecurityEvent(
    type: SecurityEventType,
    details: any,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<void> {
    const securityRecord = {
      logId: uuidv4(),
      action: `SECURITY_${type}`,
      resource: 'SECURITY',
      ipAddress: details.ipAddress || 'UNKNOWN',
      userAgent: details.userAgent || 'SYSTEM',
      timestamp: new Date().toISOString(),
      success: false,
      errorMessage: details.error || 'Security event detected',
      metadata: {
        type,
        severity,
        details,
        investigated: false,
      },
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    await dynamoDB.putItem({
      TableName: 'YieldCycle-AuditLogs',
      Item: securityRecord,
    });

    // Alert for high severity events
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      await NotificationService.sendSecurityAlert(securityRecord);
    }
  }
}
```

### Input Validation & Sanitization

```typescript
class ValidationService {
  static sanitizeUserInput(input: any): any {
    if (typeof input === 'string') {
      return input.trim().replace(/[<>]/g, '');
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeUserInput(value);
      }
      return sanitized;
    }

    return input;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validateWalletAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static validateAmount(amount: string | number): boolean {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return !isNaN(numAmount) && numAmount > 0 && numAmount <= 1000000;
  }
}
```

## ⚡ Performance Considerations

### Caching Strategy

```typescript
class CacheService {
  private static redis: Redis;
  private static readonly TTL = {
    USER_PROFILE: 300, // 5 minutes
    WALLET_BALANCE: 60, // 1 minute
    TEAM_STATS: 900, // 15 minutes
    DEPOSIT_LIMITS: 1800, // 30 minutes
    COMMISSION_RATES: 3600, // 1 hour
  };

  static async initialize(): Promise<void> {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  // Specific cache methods
  static async getUserProfile(userId: string): Promise<User | null> {
    return await this.get(`user:profile:${userId}`);
  }

  static async setUserProfile(userId: string, profile: User): Promise<void> {
    await this.set(`user:profile:${userId}`, profile, this.TTL.USER_PROFILE);
  }

  static async getWalletBalances(userId: string): Promise<WalletBalances | null> {
    return await this.get(`wallet:balances:${userId}`);
  }

  static async setWalletBalances(userId: string, balances: WalletBalances): Promise<void> {
    await this.set(`wallet:balances:${userId}`, balances, this.TTL.WALLET_BALANCE);
  }
}
```

### Database Query Optimization

```typescript
class QueryOptimizationService {
  // Batch operations for better performance
  static async batchGetUsers(userIds: string[]): Promise<User[]> {
    const batchSize = 100; // DynamoDB batch limit
    const batches: string[][] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      batches.push(userIds.slice(i, i + batchSize));
    }

    const allUsers: User[] = [];

    for (const batch of batches) {
      const batchRequests = batch.map((userId) => ({
        userId,
      }));

      const result = await dynamoDB.batchGetItems({
        TableName: 'YieldCycle-Users',
        Keys: batchRequests,
      });
      allUsers.push(...result.Items);
    }

    return allUsers;
  }

  // Optimized pagination
  static async getPaginatedResults<T>(
    queryParams: any,
    lastEvaluatedKey?: any,
    limit: number = 50
  ): Promise<PaginatedResult<T>> {
    const params = {
      ...queryParams,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await dynamoDB.query(params);

    return {
      items: result.Items,
      lastEvaluatedKey: result.LastEvaluatedKey,
      hasMore: !!result.LastEvaluatedKey,
    };
  }

  // Parallel data fetching
  static async getUserDashboardData(userId: string): Promise<UserDashboard> {
    const [userProfile, walletBalances, recentDeposits, teamStats, recentCommissions] =
      await Promise.all([
        UserService.getUserProfile(userId),
        WalletService.getUserBalances(userId),
        DepositService.getRecentDeposits(userId, 10),
        TeamStatsService.getTeamStatistics(userId),
        CommissionService.getRecentCommissions(userId, 10),
      ]);

    return {
      userProfile,
      walletBalances,
      recentDeposits,
      teamStats,
      recentCommissions,
    };
  }
}
```

### Background Job Processing

```typescript
class JobScheduler {
  private static jobs: NodeCron.ScheduledTask[] = [];

  static initialize(): void {
    // Monthly income processing - 1st of each month at 00:00
    this.scheduleJob('0 0 1 * *', MonthlyIncomeService.processMonthlyIncomes);

    // Note: Blockchain sync is manual only - users trigger sync after deposits

    // Commission distribution - Every hour
    this.scheduleJob('0 * * * *', CommissionService.processQueuedDistributions);

    // Cache cleanup - Every 4 hours
    this.scheduleJob('0 */4 * * *', CacheService.cleanup);

    // Audit log archive - Daily at 02:00
    this.scheduleJob('0 2 * * *', AuditService.archiveOldLogs);
  }

  private static scheduleJob(schedule: string, task: () => Promise<void>): void {
    const job = cron.schedule(
      schedule,
      async () => {
        try {
          console.log(`Starting scheduled job: ${task.name}`);
          await task();
          console.log(`Completed scheduled job: ${task.name}`);
        } catch (error) {
          console.error(`Error in scheduled job ${task.name}:`, error);
        }
      },
      { scheduled: false }
    );

    this.jobs.push(job);
  }

  static startAll(): void {
    this.jobs.forEach((job) => job.start());
    console.log(`Started ${this.jobs.length} scheduled jobs`);
  }

  static stopAll(): void {
    this.jobs.forEach((job) => job.stop());
    console.log('Stopped all scheduled jobs');
  }
}
```

## 🚀 Deployment Architecture

### AWS Lambda Serverless Setup

```typescript
// serverless.yml configuration
const serverlessConfig = {
  service: 'yield-cycle-backend',
  frameworkVersion: '3',
  provider: {
    name: 'aws',
    runtime: 'nodejs18.x',
    region: '${env:AWS_REGION, "us-east-1"}',
    stage: '${env:STAGE, "dev"}',
    environment: {
      JWT_SECRET: '${env:JWT_SECRET}',
      ENCRYPTION_KEY: '${env:ENCRYPTION_KEY}',
      BSC_RPC_URL: '${env:BSC_RPC_URL}',
      MASTER_MNEMONIC: '${env:MASTER_MNEMONIC}',
      USDT_CONTRACT_ADDRESS: '${env:USDT_CONTRACT_ADDRESS}',
      USERS_TABLE: 'YieldCycle-Users-${self:provider.stage}',
      DEPOSITS_TABLE: 'YieldCycle-Deposits-${self:provider.stage}',
      WALLET_POCKETS_TABLE: 'YieldCycle-WalletPockets-${self:provider.stage}',
      WALLET_TRANSACTIONS_TABLE: 'YieldCycle-WalletTransactions-${self:provider.stage}',
      REFERRAL_NETWORK_TABLE: 'YieldCycle-ReferralNetwork-${self:provider.stage}',
      COMMISSION_DISTRIBUTIONS_TABLE: 'YieldCycle-CommissionDistributions-${self:provider.stage}',
      COMMISSION_ALLOCATIONS_TABLE: 'YieldCycle-CommissionAllocations-${self:provider.stage}',
      MONTHLY_INCOME_TABLE: 'YieldCycle-MonthlyIncome-${self:provider.stage}',
      OTP_TABLE: 'YieldCycle-OTP-${self:provider.stage}',
      SESSIONS_TABLE: 'YieldCycle-Sessions-${self:provider.stage}',
      AUDIT_LOGS_TABLE: 'YieldCycle-AuditLogs-${self:provider.stage}',
    },
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
        ],
        Resource: [
          'arn:aws:dynamodb:${self:provider.region}:*:table/YieldCycle-*-${self:provider.stage}',
          'arn:aws:dynamodb:${self:provider.region}:*:table/YieldCycle-*-${self:provider.stage}/index/*',
        ],
      },
    ],
  },
  functions: {
    api: {
      handler: 'src/lambda.handler',
      events: [
        {
          http: {
            method: 'ANY',
            path: '/{proxy+}',
            cors: true,
          },
        },
      ],
      timeout: 30,
      memorySize: 1024,
    },
    scheduler: {
      handler: 'src/scheduler.handler',
      events: [
        {
          schedule: 'cron(0 0 1 * ? *)', // Monthly processing
        },
      ],
      timeout: 300,
      memorySize: 2048,
    },
  },
  resources: {
    Resources: {
      UsersTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.USERS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'email', AttributeType: 'S' },
            { AttributeName: 'referralCode', AttributeType: 'S' },
            { AttributeName: 'status', AttributeType: 'S' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'email-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'email', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'referralCode-userId-gsi',
              KeySchema: [
                { AttributeName: 'referralCode', KeyType: 'HASH' },
                { AttributeName: 'userId', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'status-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'status', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      DepositsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.DEPOSITS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'depositId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'status', AttributeType: 'S' },
            { AttributeName: 'depositAddress', AttributeType: 'S' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'depositId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'userId-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'status-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'status', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'depositAddress-userId-gsi',
              KeySchema: [
                { AttributeName: 'depositAddress', KeyType: 'HASH' },
                { AttributeName: 'userId', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      WalletPocketsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.WALLET_POCKETS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'pocketType', AttributeType: 'S' },
            { AttributeName: 'balance', AttributeType: 'N' },
          ],
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'pocketType', KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'pocketType-balance-gsi',
              KeySchema: [
                { AttributeName: 'pocketType', KeyType: 'HASH' },
                { AttributeName: 'balance', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      WalletTransactionsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.WALLET_TRANSACTIONS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'transactionId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'type', AttributeType: 'S' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'transactionId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'userId-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'type-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'type', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      ReferralNetworkTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.REFERRAL_NETWORK_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'parentUserId', AttributeType: 'S' },
            { AttributeName: 'level', AttributeType: 'N' },
            { AttributeName: 'totalTeamVolume', AttributeType: 'N' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'parentUserId-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'parentUserId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'level-teamVolume-gsi',
              KeySchema: [
                { AttributeName: 'level', KeyType: 'HASH' },
                { AttributeName: 'totalTeamVolume', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      CommissionDistributionsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.COMMISSION_DISTRIBUTIONS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'distributionId', AttributeType: 'S' },
            { AttributeName: 'triggerUserId', AttributeType: 'S' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'distributionId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'triggerUserId-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'triggerUserId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      CommissionAllocationsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.COMMISSION_ALLOCATIONS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'distributionId', AttributeType: 'S' },
            { AttributeName: 'recipientUserId', AttributeType: 'S' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'distributionId', KeyType: 'HASH' },
            { AttributeName: 'recipientUserId', KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'recipientUserId-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'recipientUserId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      MonthlyIncomeTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.MONTHLY_INCOME_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'depositId', AttributeType: 'S' },
            { AttributeName: 'month', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'depositId', KeyType: 'HASH' },
            { AttributeName: 'month', KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'userId-month-gsi',
              KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' },
                { AttributeName: 'month', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },

      OTPTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.OTP_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'email', AttributeType: 'S' },
            { AttributeName: 'otpId', AttributeType: 'S' },
            { AttributeName: 'code', AttributeType: 'S' },
            { AttributeName: 'type', AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' },
            { AttributeName: 'otpId', KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'code-type-gsi',
              KeySchema: [
                { AttributeName: 'code', KeyType: 'HASH' },
                { AttributeName: 'type', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
          TimeToLiveSpecification: {
            AttributeName: 'TTL',
            Enabled: true,
          },
        },
      },

      SessionsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.SESSIONS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'sessionId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'CreatedAt', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'sessionId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'userId-createdAt-gsi',
              KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
          TimeToLiveSpecification: {
            AttributeName: 'TTL',
            Enabled: true,
          },
        },
      },

      AuditLogsTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:provider.environment.AUDIT_LOGS_TABLE}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'logId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'action', AttributeType: 'S' },
            { AttributeName: 'timestamp', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'logId', KeyType: 'HASH' }],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'userId-timestamp-gsi',
              KeySchema: [
                { AttributeName: 'userId', KeyType: 'HASH' },
                { AttributeName: 'timestamp', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
            {
              IndexName: 'action-timestamp-gsi',
              KeySchema: [
                { AttributeName: 'action', KeyType: 'HASH' },
                { AttributeName: 'timestamp', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        },
      },
    },
  },
};
```

### Environment Configuration

```typescript
// Environment variables configuration
interface EnvironmentConfig {
  // Application
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: string;
  API_VERSION: string;

  // Database Tables
  USERS_TABLE: string;
  DEPOSITS_TABLE: string;
  WALLET_POCKETS_TABLE: string;
  WALLET_TRANSACTIONS_TABLE: string;
  REFERRAL_NETWORK_TABLE: string;
  COMMISSION_DISTRIBUTIONS_TABLE: string;
  COMMISSION_ALLOCATIONS_TABLE: string;
  MONTHLY_INCOME_TABLE: string;
  OTP_TABLE: string;
  SESSIONS_TABLE: string;
  AUDIT_LOGS_TABLE: string;
  DYNAMODB_REGION: string;

  // Authentication
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ENCRYPTION_KEY: string;

  // Blockchain
  BSC_RPC_URL: string;
  MASTER_MNEMONIC: string;
  USDT_CONTRACT_ADDRESS: string;
  PAYOUT_WALLET_PRIVATE_KEY: string;
  GAS_MANAGEMENT_PRIVATE_KEY: string;

  // External Services
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_PASSWORD: string;

  // Email
  AWS_SES_REGION: string;
  FROM_EMAIL: string;

  // Security
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_WINDOW: string;
  RATE_LIMIT_MAX: string;

  // Business Logic
  WITHDRAWAL_FEE_PERCENTAGE: string;
  MAX_DEPOSIT_LIMIT: string;
  MIN_DEPOSIT_AMOUNT: string;
}

class ConfigService {
  private static config: EnvironmentConfig;

  static initialize(): void {
    this.config = {
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      PORT: process.env.PORT || '3000',
      API_VERSION: process.env.API_VERSION || 'v1',

      USERS_TABLE: process.env.USERS_TABLE!,
      DEPOSITS_TABLE: process.env.DEPOSITS_TABLE!,
      WALLET_POCKETS_TABLE: process.env.WALLET_POCKETS_TABLE!,
      WALLET_TRANSACTIONS_TABLE: process.env.WALLET_TRANSACTIONS_TABLE!,
      REFERRAL_NETWORK_TABLE: process.env.REFERRAL_NETWORK_TABLE!,
      COMMISSION_DISTRIBUTIONS_TABLE: process.env.COMMISSION_DISTRIBUTIONS_TABLE!,
      COMMISSION_ALLOCATIONS_TABLE: process.env.COMMISSION_ALLOCATIONS_TABLE!,
      MONTHLY_INCOME_TABLE: process.env.MONTHLY_INCOME_TABLE!,
      OTP_TABLE: process.env.OTP_TABLE!,
      SESSIONS_TABLE: process.env.SESSIONS_TABLE!,
      AUDIT_LOGS_TABLE: process.env.AUDIT_LOGS_TABLE!,
      DYNAMODB_REGION: process.env.DYNAMODB_REGION || 'us-east-1',

      JWT_SECRET: process.env.JWT_SECRET!,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,

      BSC_RPC_URL: process.env.BSC_RPC_URL!,
      MASTER_MNEMONIC: process.env.MASTER_MNEMONIC!,
      USDT_CONTRACT_ADDRESS: process.env.USDT_CONTRACT_ADDRESS!,
      PAYOUT_WALLET_PRIVATE_KEY: process.env.PAYOUT_WALLET_PRIVATE_KEY!,
      GAS_MANAGEMENT_PRIVATE_KEY: process.env.GAS_MANAGEMENT_PRIVATE_KEY!,

      REDIS_HOST: process.env.REDIS_HOST!,
      REDIS_PORT: process.env.REDIS_PORT || '6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD!,

      AWS_SES_REGION: process.env.AWS_SES_REGION || 'us-east-1',
      FROM_EMAIL: process.env.FROM_EMAIL!,

      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
      RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || '15',
      RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || '100',

      WITHDRAWAL_FEE_PERCENTAGE: process.env.WITHDRAWAL_FEE_PERCENTAGE || '2',
      MAX_DEPOSIT_LIMIT: process.env.MAX_DEPOSIT_LIMIT || '10000',
      MIN_DEPOSIT_AMOUNT: process.env.MIN_DEPOSIT_AMOUNT || '100',
    };

    this.validateConfig();
  }

  private static validateConfig(): void {
    const required = [
      'JWT_SECRET',
      'USERS_TABLE',
      'DEPOSITS_TABLE',
      'WALLET_POCKETS_TABLE',
      'WALLET_TRANSACTIONS_TABLE',
      'REFERRAL_NETWORK_TABLE',
      'COMMISSION_DISTRIBUTIONS_TABLE',
      'COMMISSION_ALLOCATIONS_TABLE',
      'MONTHLY_INCOME_TABLE',
      'OTP_TABLE',
      'SESSIONS_TABLE',
      'AUDIT_LOGS_TABLE',
      'BSC_RPC_URL',
      'MASTER_MNEMONIC',
      'USDT_CONTRACT_ADDRESS',
    ];

    for (const key of required) {
      if (!this.config[key as keyof EnvironmentConfig]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
  }

  static get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] {
    return this.config[key];
  }
}
```

### Monitoring & Logging

```typescript
class MonitoringService {
  private static logger: winston.Logger;

  static initialize(): void {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ],
    });

    // Add CloudWatch transport for production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new CloudWatchTransport({
          logGroupName: '/aws/lambda/yield-cycle-backend',
          logStreamName: () => `${new Date().toISOString().split('T')[0]}-instance`,
          awsRegion: process.env.AWS_REGION,
        })
      );
    }
  }

  static logInfo(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  static logError(message: string, error?: Error, meta?: any): void {
    this.logger.error(message, { error: error?.stack, ...meta });
  }

  static logWarning(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  // Performance monitoring
  static startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.logInfo(`Operation completed: ${operation}`, { duration });
    };
  }
}
```

---

## 📁 Project Structure

### MVC Architecture Overview

The project follows a clean MVC (Model-View-Controller) architecture with clear separation of concerns, ensuring maintainable, scalable, and testable code.

```
yield-cycle-backend/
├── src/
│   ├── controllers/           # HTTP request/response handling
│   │   ├── auth/
│   │   │   ├── AuthController.ts          # Registration & login
│   │   │   ├── OTPController.ts           # OTP verification
│   │   │   └── SessionController.ts       # Session management
│   │   ├── user/
│   │   │   ├── ProfileController.ts       # User profile operations
│   │   │   └── AdminController.ts         # Admin user management
│   │   ├── deposit/
│   │   │   ├── DepositController.ts       # Deposit operations
│   │   │   └── BlockchainController.ts    # Blockchain sync
│   │   ├── wallet/
│   │   │   ├── WalletController.ts        # Wallet balance & pockets
│   │   │   ├── TransactionController.ts   # Transaction history
│   │   │   └── WithdrawalController.ts    # Withdrawal requests
│   │   ├── referral/
│   │   │   ├── ReferralController.ts      # Referral operations
│   │   │   └── TeamController.ts          # Team stats & tree
│   │   ├── commission/
│   │   │   └── CommissionController.ts    # Commission history & stats
│   │   └── dashboard/
│   │       ├── UserDashboardController.ts # User dashboard
│   │       └── AdminDashboardController.ts # Admin dashboard
│   │
│   ├── services/              # Business logic layer
│   │   ├── auth/
│   │   │   ├── AuthService.ts             # Core authentication
│   │   │   ├── OTPService.ts              # OTP generation & validation
│   │   │   ├── SessionService.ts          # Session management
│   │   │   └── PasswordService.ts         # Password hashing & validation
│   │   ├── user/
│   │   │   ├── UserService.ts             # User management
│   │   │   └── UserLimitService.ts        # Deposit limits management
│   │   ├── deposit/
│   │   │   ├── DepositService.ts          # Deposit processing
│   │   │   └── DepositValidationService.ts # Limit validation & status
│   │   ├── blockchain/
│   │   │   ├── BlockchainService.ts       # BSC integration
│   │   │   ├── WalletGenerationService.ts # HD wallet generation
│   │   │   └── TransactionSyncService.ts  # Transaction monitoring
│   │   ├── wallet/
│   │   │   ├── WalletService.ts           # Core wallet operations
│   │   │   ├── PocketService.ts           # 4-pocket management
│   │   │   ├── TransactionService.ts      # Transaction recording
│   │   │   └── WithdrawalService.ts       # Withdrawal processing
│   │   ├── referral/
│   │   │   ├── ReferralTreeService.ts     # MLM tree management
│   │   │   ├── GenealogyService.ts        # Ancestor tracking
│   │   │   └── TeamStatsService.ts        # Team analytics
│   │   ├── commission/
│   │   │   ├── CommissionCalculationService.ts # Commission calculation
│   │   │   ├── CommissionDistributionService.ts # Distribution logic
│   │   │   └── CommissionTrackingService.ts # History & analytics
│   │   ├── income/
│   │   │   ├── MonthlyIncomeService.ts    # 8% monthly returns
│   │   │   └── EarningsLimitService.ts    # 200% cap tracking
│   │   ├── notification/
│   │   │   └── EmailService.ts            # Email communications
│   │   └── cache/
│   │       └── CacheService.ts            # Application caching
│   │
│   ├── repositories/          # Data access layer
│   │   ├── UserRepository.ts
│   │   ├── DepositRepository.ts
│   │   ├── WalletRepository.ts
│   │   ├── ReferralRepository.ts
│   │   ├── CommissionRepository.ts
│   │   ├── IncomeRepository.ts
│   │   ├── OTPRepository.ts
│   │   ├── SessionRepository.ts
│   │   └── AuditRepository.ts
│   │
│   ├── models/                # Entity definitions and interfaces
│   │   ├── User.ts
│   │   ├── Deposit.ts
│   │   ├── WalletPocket.ts
│   │   ├── Transaction.ts
│   │   ├── ReferralNode.ts
│   │   ├── Commission.ts
│   │   ├── MonthlyIncome.ts
│   │   ├── OTP.ts
│   │   ├── Session.ts
│   │   └── AuditLog.ts
│   │
│   ├── types/                 # TypeScript type definitions
│   │   ├── requests/
│   │   │   ├── auth/
│   │   │   │   ├── RegisterRequest.ts
│   │   │   │   ├── LoginRequest.ts
│   │   │   │   ├── OTPRequest.ts
│   │   │   │   └── SessionRequest.ts
│   │   │   ├── user/
│   │   │   │   ├── ProfileRequest.ts
│   │   │   │   └── AdminRequest.ts
│   │   │   ├── deposit/
│   │   │   │   ├── DepositRequest.ts
│   │   │   │   └── SyncRequest.ts
│   │   │   ├── wallet/
│   │   │   │   ├── WalletRequest.ts
│   │   │   │   ├── TransactionRequest.ts
│   │   │   │   └── WithdrawalRequest.ts
│   │   │   ├── referral/
│   │   │   │   ├── ReferralRequest.ts
│   │   │   │   └── TeamRequest.ts
│   │   │   └── dashboard/
│   │   │       ├── UserDashboardRequest.ts
│   │   │       └── AdminDashboardRequest.ts
│   │   ├── responses/
│   │   │   ├── auth/
│   │   │   │   ├── AuthResponse.ts
│   │   │   │   ├── LoginResponse.ts
│   │   │   │   └── TokenResponse.ts
│   │   │   ├── user/
│   │   │   │   ├── ProfileResponse.ts
│   │   │   │   └── UserStatsResponse.ts
│   │   │   ├── deposit/
│   │   │   │   ├── DepositResponse.ts
│   │   │   │   └── DepositHistoryResponse.ts
│   │   │   ├── wallet/
│   │   │   │   ├── WalletBalanceResponse.ts
│   │   │   │   └── TransactionHistoryResponse.ts
│   │   │   ├── referral/
│   │   │   │   ├── ReferralResponse.ts
│   │   │   │   └── TeamStatsResponse.ts
│   │   │   ├── commission/
│   │   │   │   └── CommissionResponse.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── UserDashboardResponse.ts
│   │   │   │   └── AdminDashboardResponse.ts
│   │   │   └── common/
│   │   │       ├── ErrorResponse.ts
│   │   │       ├── SuccessResponse.ts
│   │   │       └── PaginatedResponse.ts
│   │   ├── enums.ts
│   │   ├── interfaces.ts
│   │   └── common.ts
│   │
│   ├── routes/                # API route definitions
│   │   ├── v1/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── deposits.ts
│   │   │   ├── wallet.ts
│   │   │   ├── referrals.ts
│   │   │   ├── commissions.ts
│   │   │   └── dashboard.ts
│   │   └── index.ts
│   │
│   ├── middleware/             # Middleware functions
│   │   ├── authentication.ts
│   │   ├── authorization.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts
│   │   ├── cors.ts
│   │   └── logger.ts
│   │
│   ├── database/              # Database connection and operations
│   │   ├── connection.ts
│   │   └── config.ts
│   │
│   ├── utils/                 # Utility functions
│   │   ├── encryption.ts
│   │   ├── validation.ts
│   │   ├── blockchain.ts
│   │   ├── calculations.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   │
│   ├── config/                # Configuration management
│   │   ├── database.ts
│   │   ├── auth.ts
│   │   ├── blockchain.ts
│   │   ├── email.ts
│   │   └── index.ts
│   │
│   ├── jobs/                  # Background jobs and schedulers
│   │   ├── monthlyIncome.ts
│   │   ├── commissionProcessor.ts
│   │   └── scheduler.ts
│   │
│   └── lambda/                # AWS Lambda handlers
│       ├── api.ts
│       └── scheduler.ts
│
├── dist/                      # Compiled JavaScript (build output)
├── logs/                      # Application logs
├── node_modules/              # Dependencies
│
├── package.json               # Project dependencies and scripts
├── package-lock.json          # Dependency lock file
├── tsconfig.json              # TypeScript configuration
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
├── .gitignore                 # Git ignore rules
├── .env.example               # Environment variables template
├── README.md                  # Project documentation
└── serverless.yml             # Serverless Framework configuration
```

### 📋 File Responsibility Matrix

> **Note on Architecture Decisions:**
>
> - **Event Handlers/Emitters**: Removed as they're not needed for this use case. Direct service-to-service communication is more appropriate for our synchronous operations (deposit processing, commission distribution). Event-driven architecture would add unnecessary complexity.
> - **Repository Pattern**: Implemented as separate folder like controllers/services for better organization and maintainability.
> - **Types**: Focused on request/response structures and custom business types. Entity structures remain in models folder.
> - **Database**: Direct DynamoDB operations without complex query builders to keep it simple and efficient.

#### Controllers Layer

HTTP request/response handling organized by domain to prevent bulky files:

```typescript
// auth/AuthController.ts - Core authentication flows
export class AuthController {
  static async register(req, res); // User registration
  static async login(req, res); // User login
  static async logout(req, res); // Session termination
}

// auth/OTPController.ts - OTP specific operations
export class OTPController {
  static async sendOTP(req, res); // Send OTP to email
  static async verifyOTP(req, res); // Verify OTP code
  static async resendOTP(req, res); // Resend OTP if expired
}

// auth/SessionController.ts - Session management
export class SessionController {
  static async refreshToken(req, res); // JWT token refresh
  static async validateSession(req, res); // Session validation
  static async revokeSession(req, res); // Revoke specific session
}

// user/ProfileController.ts - User profile operations
export class ProfileController {
  static async getProfile(req, res); // Get user profile data
  static async updateProfile(req, res); // Update user information
  static async changePassword(req, res); // Password change
}

// user/AdminController.ts - Admin user management
export class AdminController {
  static async getAllUsers(req, res); // Get all users list
  static async getUserStats(req, res); // Individual user analytics
  static async updateLimits(req, res); // Update user deposit limits
  static async suspendUser(req, res); // Suspend/activate user
}

// deposit/DepositController.ts - Deposit operations
export class DepositController {
  static async getDepositAddress(req, res); // Get unique BSC address
  static async getDepositHistory(req, res); // User's deposit history
  static async getDepositStats(req, res); // Deposit analytics
}

// deposit/BlockchainController.ts - Manual blockchain sync operations
export class BlockchainController {
  static async syncDeposits(req, res); // User-triggered deposit sync
  static async validateTransaction(req, res); // Validate specific tx
  static async getSyncHistory(req, res); // User's sync history
}

// wallet/WalletController.ts - Core wallet operations
export class WalletController {
  static async getWalletBalance(req, res); // Get 4-pocket balances
  static async getPocketHistory(req, res); // Individual pocket history
}

// wallet/TransactionController.ts - Transaction management
export class TransactionController {
  static async getTransactionHistory(req, res); // All transactions
  static async getTransactionDetails(req, res); // Single transaction
}

// wallet/WithdrawalController.ts - Withdrawal operations
export class WithdrawalController {
  static async requestWithdrawal(req, res); // Post-25-month withdrawal
  static async getWithdrawalHistory(req, res); // Withdrawal history
  static async approveWithdrawal(req, res); // Admin: Approve withdrawal
}

// referral/ReferralController.ts - Referral operations
export class ReferralController {
  static async getReferralCode(req, res); // Get unique referral code
  static async getReferralTree(req, res); // Get MLM network tree
  static async getDirectReferrals(req, res); // Direct referrals only
}

// referral/TeamController.ts - Team management
export class TeamController {
  static async getTeamStats(req, res); // Team performance stats
  static async getTeamStructure(req, res); // Complete team hierarchy
  static async getTeamEarnings(req, res); // Team earnings breakdown
}

// commission/CommissionController.ts - Commission operations
export class CommissionController {
  static async getCommissionHistory(req, res); // Commission earning history
  static async getCommissionStats(req, res); // Commission analytics
  static async getCommissionBreakdown(req, res); // Level-wise breakdown
}

// dashboard/UserDashboardController.ts - User dashboard
export class UserDashboardController {
  static async getDashboardData(req, res); // Complete user dashboard
  static async getQuickStats(req, res); // Quick overview stats
}

// dashboard/AdminDashboardController.ts - Admin dashboard
export class AdminDashboardController {
  static async getAdminDashboard(req, res); // Complete admin dashboard
  static async getSystemMetrics(req, res); // System-wide metrics
  static async getPlatformStats(req, res); // Platform analytics
}
```

#### Services Layer

Business logic organized by domain to prevent complexity and maintain single responsibility:

```typescript
// auth/AuthService.ts - Core authentication logic
- User registration with email verification
- Login with credential validation
- Password strength validation and hashing
- Account activation and deactivation

// auth/OTPService.ts - OTP management
- OTP generation with configurable expiry (5 min)
- Email delivery integration
- Validation and attempt tracking (max 3 attempts)
- Automatic cleanup of expired OTPs

// auth/SessionService.ts - Session management
- JWT token generation and validation
- Session creation and tracking
- Token refresh logic
- Session revocation and cleanup

// auth/PasswordService.ts - Password security
- Password hashing with bcrypt (12 rounds)
- Password strength validation
- Password reset functionality
- Security policy enforcement

// user/UserService.ts - User management
- User profile management and updates
- User search and filtering
- Account status management
- Basic user analytics

// user/UserLimitService.ts - Deposit limits
- Individual user deposit limit management
- Limit validation and enforcement
- Admin limit override functionality
- Limit history tracking

// deposit/DepositService.ts - Core deposit processing
- USDT deposit recording and validation
- Deposit status management (active/dormant)
- Deposit history and analytics
- User notification triggers

// deposit/DepositValidationService.ts - Validation logic
- Deposit limit checks
- Active vs dormant classification
- Business rule enforcement
- Validation error handling

// blockchain/BlockchainService.ts - BSC integration
- BSC network connectivity
- USDT contract interaction
- Balance checking and monitoring
- Error handling and retries

// blockchain/WalletGenerationService.ts - HD wallet management
- Master wallet management
- HD address derivation (BIP44)
- Address generation per user
- Private key security

// blockchain/TransactionSyncService.ts - Manual transaction sync
- Real-time transaction monitoring
- Transaction validation and confirmation
- Deposit processing triggers
- Manual transaction sync on user request

// wallet/WalletService.ts - Core wallet operations
- 4-pocket wallet initialization
- Balance aggregation and display
- Wallet status management
- Cross-pocket operations

// wallet/PocketService.ts - Individual pocket management
- Deposit pocket: Total USDT deposited
- Income pocket: 8% monthly earnings
- Commission pocket: MLM commission earnings
- Total pocket: Combined earnings display

// wallet/TransactionService.ts - Transaction recording
- Transaction logging and history
- Transaction categorization
- Balance update triggers
- Transaction validation

// wallet/WithdrawalService.ts - Withdrawal processing
- 25-month tenure validation
- Withdrawal eligibility checks
- Withdrawal request processing
- Admin approval workflow

// referral/ReferralTreeService.ts - MLM tree management
- Tree construction and maintenance
- Parent-child relationship management
- Tree traversal and queries
- Tree integrity validation

// referral/GenealogyService.ts - Ancestor tracking
- 5-level ancestor path caching
- Efficient upline lookups
- Commission eligibility validation
- Path optimization

// referral/TeamStatsService.ts - Team analytics
- Team size calculations
- Team earnings aggregation
- Performance metrics
- Growth analytics

// commission/CommissionCalculationService.ts - Commission math
- 5-level commission calculation (10%, 5%, 3%, 1%, 1%)
- Commission amount determination
- Level-based distribution logic
- Edge case handling

// commission/CommissionDistributionService.ts - Distribution engine
- Instant commission distribution
- Batch processing for efficiency
- Distribution failure handling
- Rollback mechanisms

// commission/CommissionTrackingService.ts - History & analytics
- Commission history tracking
- Earnings progress monitoring (200% cap)
- Commission analytics and reporting
- Performance insights

// income/MonthlyIncomeService.ts - 8% monthly returns
- Automated monthly income processing
- Active deposit identification
- 8% calculation and distribution
- Tenure completion tracking

// income/EarningsLimitService.ts - 200% cap management
- Total earnings tracking
- 200% limit enforcement
- Earnings progression monitoring
- Limit reached notifications

// notification/EmailService.ts - Email communications
- OTP delivery emails
- Transaction notifications
- System alerts
- Email template management

// cache/CacheService.ts - Application caching
- User session caching
- Frequently accessed data caching
- Cache invalidation strategies
- Performance optimization
```

#### Repositories Layer

Direct data access with DynamoDB operations (separate folder for organization):

```typescript
// UserRepository.ts
- createUser(userData) - Insert new user record with validation
- getUserById(userId) - Retrieve user by primary key
- getUserByEmail(email) - Retrieve user by email (GSI)
- updateUserProfile(userId, updates) - Update user information
- updateUserLimits(userId, limits) - Admin: Update deposit limits
- getUserByReferralCode(code) - Find user by referral code

// DepositRepository.ts
- createDeposit(depositData) - Record new blockchain deposit
- getDepositsByUser(userId) - Get all user deposits with pagination
- getDepositByTransaction(txHash) - Find deposit by blockchain transaction
- updateDepositStatus(depositId, status) - Update active/dormant status
- getActiveDeposits(userId) - Get only earning deposits
- getDepositStats(userId) - Calculate deposit analytics

// WalletRepository.ts
- initializeWalletPockets(userId) - Create 3 initial pockets (all zero)
- updatePocketBalance(userId, pocket, amount) - Update specific pocket
- getWalletBalances(userId) - Get all 3 pocket balances
- recordWalletTransaction(transaction) - Log wallet transaction
- getTransactionHistory(userId) - Get wallet transaction history

// ReferralRepository.ts
- createReferralNode(nodeData) - Add user to MLM tree structure
- getReferralAncestors(userId, levels) - Get 5-level upline efficiently
- getReferralDescendants(userId) - Get downline tree with depth
- updateGenealogyCache(userId, ancestors) - Update cached ancestor paths
- getTeamStats(userId) - Calculate team statistics and performance

// CommissionRepository.ts
- createCommissionDistribution(batchData) - Record commission distribution batch
- createCommissionAllocation(allocation) - Individual commission record
- getCommissionHistory(userId) - User's commission earning history
- getCommissionStats(userId) - Commission analytics and totals
- getCommissionsByPeriod(userId, period) - Time-based commission queries

// IncomeRepository.ts
- createMonthlyIncome(incomeData) - Record 8% monthly income
- getIncomeHistory(userId) - User's monthly income history
- getIncomeStats(userId) - Income analytics and progression
- updateEarningsProgress(userId, progress) - Track toward 200% limit
- getIncomeByPeriod(userId, period) - Period-based income queries

// OTPRepository.ts
- createOTP(otpData) - Generate and store OTP with TTL
- validateOTP(email, code) - Verify OTP and mark as used
- cleanupExpiredOTPs() - Remove expired OTP records (TTL handles this)
- getOTPAttempts(email) - Track failed attempts for rate limiting

// SessionRepository.ts
- createSession(sessionData) - Store JWT session with expiry
- getSession(sessionId) - Retrieve active session
- updateSessionToken(sessionId, token) - Update access token
- invalidateSession(sessionId) - Remove session record
- cleanupExpiredSessions() - Remove expired sessions

// AuditRepository.ts
- createAuditLog(logData) - Record system audit events
- getAuditLogs(filters) - Query audit logs with filtering
- getSecurityEvents(userId) - User-specific security events
```

#### Types Layer

Request/response structures organized for better maintainability:

```typescript
// types/requests/auth/ - Authentication request types
- RegisterRequest.ts - User registration data structure
- LoginRequest.ts - Login credentials structure
- OTPRequest.ts - OTP verification request
- SessionRequest.ts - Token refresh and session management

// types/requests/user/ - User management requests
- ProfileRequest.ts - Profile update request structure
- AdminRequest.ts - Admin user management requests

// types/requests/deposit/ - Deposit operation requests
- DepositRequest.ts - Deposit operation data
- SyncRequest.ts - Blockchain sync request parameters

// types/requests/wallet/ - Wallet operation requests
- WalletRequest.ts - Wallet query and operation requests
- TransactionRequest.ts - Transaction history filters
- WithdrawalRequest.ts - Withdrawal request structure

// types/requests/referral/ - Referral system requests
- ReferralRequest.ts - Referral code and tree requests
- TeamRequest.ts - Team statistics and query requests

// types/requests/dashboard/ - Dashboard data requests
- UserDashboardRequest.ts - User dashboard query parameters
- AdminDashboardRequest.ts - Admin dashboard filters

// types/responses/auth/ - Authentication responses
- AuthResponse.ts - Basic authentication response
- LoginResponse.ts - Complete login response with tokens
- TokenResponse.ts - Token refresh response structure

// types/responses/user/ - User data responses
- ProfileResponse.ts - User profile data structure
- UserStatsResponse.ts - User analytics and statistics

// types/responses/deposit/ - Deposit data responses
- DepositResponse.ts - Individual deposit data
- DepositHistoryResponse.ts - Paginated deposit history

// types/responses/wallet/ - Wallet data responses
- WalletBalanceResponse.ts - 4-pocket balance structure
- TransactionHistoryResponse.ts - Paginated transaction history

// types/responses/referral/ - Referral data responses
- ReferralResponse.ts - Referral tree and code data
- TeamStatsResponse.ts - Team performance analytics

// types/responses/commission/ - Commission data responses
- CommissionResponse.ts - Commission history and statistics

// types/responses/dashboard/ - Dashboard responses
- UserDashboardResponse.ts - Complete user dashboard data
- AdminDashboardResponse.ts - Admin dashboard with metrics

// types/responses/common/ - Shared response types
- ErrorResponse.ts - Standardized error response structure
- SuccessResponse.ts - Success response with optional data
- PaginatedResponse.ts - Pagination wrapper for lists

// types/enums.ts - Application enumerations
- UserRole: ADMIN, DEPOSITOR
- DepositStatus: PENDING, ACTIVE, DORMANT, COMPLETED
- TransactionType: DEPOSIT, INCOME, COMMISSION, WITHDRAWAL
- WalletPocket: ACTIVE_DEPOSITS, INCOME, COMMISSION, TOTAL_EARNINGS
- CommissionLevel: LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5
- IncomeStatus: PENDING, DISTRIBUTED, COMPLETED
- AuditEventType: LOGIN, DEPOSIT, COMMISSION, WITHDRAWAL

// types/interfaces.ts - Business logic interfaces
- MLMTreeNode: Referral tree node structure
- CommissionCalculation: Commission calculation data
- EarningsProgress: 200% cap tracking interface
- BlockchainTransaction: Transaction validation interface

// types/common.ts - Utility types
- PaginationOptions: Page size, offset, sorting
- FilterOptions: Date ranges, status filters
- SortingOptions: Field-based sorting preferences
- ApiResponse<T>: Generic API response wrapper
```

#### Models Layer

Core entity definitions and database schema interfaces:

```typescript
// User.ts - User account entity with authentication data
// Deposit.ts - Investment deposit entity with blockchain transaction info
// WalletPocket.ts - 3-pocket wallet structure (Active Deposits, Income, Commission, Total Earnings)
// Transaction.ts - Wallet transaction record entity
// ReferralNode.ts - MLM tree node with genealogy path
// Commission.ts - Commission distribution and allocation entities
// MonthlyIncome.ts - 8% monthly income record entity
// OTP.ts - OTP management entity with TTL
// Session.ts - JWT session entity with expiry
// AuditLog.ts - System audit and security event entity
```

> **Enhanced Structure Benefits:**
>
> ✅ **Prevents Bulky Files**: Controllers and services split by logical domains  
> ✅ **Single Responsibility**: Each file has a focused, specific purpose  
> ✅ **Easy Navigation**: Clear folder structure for quick file location  
> ✅ **Maintainability**: Changes isolated to specific functionality areas  
> ✅ **Team Collaboration**: Multiple developers can work on different domains  
> ✅ **Code Reusability**: Granular services can be easily imported where needed  
> ✅ **Testing**: Individual components can be unit tested in isolation  
> ✅ **Scalability**: New features can be added without affecting existing structure

### 🔧 Configuration Management

#### Core Configuration Structure

```typescript
// config/index.ts
export const config = {
  server: {
    port: process.env.PORT || 3000,
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  },

  // Database configuration
  database: {
    region: process.env.DYNAMODB_REGION || 'us-east-1',
    tables: {
      users: 'YieldCycle-Users',
      deposits: 'YieldCycle-Deposits',
      walletPockets: 'YieldCycle-WalletPockets',
      walletTransactions: 'YieldCycle-WalletTransactions',
      referralNetwork: 'YieldCycle-ReferralNetwork',
      commissionDistributions: 'YieldCycle-CommissionDistributions',
      commissionAllocations: 'YieldCycle-CommissionAllocations',
      monthlyIncome: 'YieldCycle-MonthlyIncome',
      otp: 'YieldCycle-OTP',
      sessions: 'YieldCycle-Sessions',
      auditLogs: 'YieldCycle-AuditLogs',
    },
  },

  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    otpExpiry: 5 * 60, // 5 minutes
    otpLength: 6,
  },

  // Blockchain configuration
  blockchain: {
    bscRpcUrl: process.env.BSC_RPC_URL,
    masterMnemonic: process.env.MASTER_MNEMONIC,
    usdtContract: process.env.USDT_CONTRACT_ADDRESS,
    derivationPath: "m/44'/60'/0'/0/",
  },

  // Email configuration
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.FROM_EMAIL || 'noreply@yieldcycle.com',
  },

  // Business rules
  business: {
    monthlyReturnRate: 0.08, // 8%
    totalReturnCap: 2.0, // 200%
    investmentTenure: 25, // months
    commissionLevels: [0.1, 0.05, 0.03, 0.01, 0.01], // 10%, 5%, 3%, 1%, 1%
    defaultDepositLimit: 10000, // USDT
  },
};
```

### 📊 Basic Logging & Monitoring

#### Simple Winston Logger

```typescript
// middleware/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/app.log',
    }),
    ...(process.env.NODE_ENV !== 'production'
      ? [
          new winston.transports.Console({
            format: winston.format.simple(),
          }),
        ]
      : []),
  ],
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });

  next();
};
```

#### Basic Health Check

```typescript
// routes/health.ts
export const healthCheck = async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    const dbStatus = await checkDatabaseHealth();

    // Check blockchain connectivity
    const blockchainStatus = await checkBlockchainHealth();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        blockchain: blockchainStatus,
      },
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};
```

### 🚀 Core Implementation Focus

#### Essential Utilities

```typescript
// utils/encryption.ts - Core encryption functions
export const encrypt = (data: string): string
export const decrypt = (encryptedData: string): string
export const hashPassword = (password: string): string
export const comparePassword = (password: string, hash: string): boolean

// utils/validation.ts - Input validation
export const validateEmail = (email: string): boolean
export const validatePassword = (password: string): boolean
export const validateAmount = (amount: number): boolean
export const sanitizeInput = (input: any): any

// utils/blockchain.ts - Blockchain utilities
export const generateWallet = (mnemonic: string, index: number): Wallet
export const validateTransaction = (txHash: string): boolean
export const getUSDTBalance = (address: string): Promise<number>

// utils/calculations.ts - Business calculations
export const calculateCommissions = (amount: number): number[]
export const calculateMonthlyIncome = (deposit: number): number
export const calculateEarningsProgress = (totalEarnings: number, totalDeposits: number): number

// utils/constants.ts - Application constants
export const COMMISSION_RATES = [0.10, 0.05, 0.03, 0.01, 0.01]
export const MONTHLY_RETURN_RATE = 0.08
export const TOTAL_RETURN_CAP = 2.0
export const INVESTMENT_TENURE = 25
```

#### Background Jobs

```typescript
// jobs/monthlyIncome.ts - Automated 8% monthly income distribution
export const processMonthlyIncome = async () => {
  // Get all active deposits
  // Calculate 8% for each user
  // Update income pockets
  // Send notifications
};

// jobs/blockchainSync.ts - Manual blockchain sync (removed - no longer needed)
// Users trigger sync manually via API endpoint
  // Monitor pending deposits
  // Validate transactions
  // Process deposits and commissions
};

// jobs/commissionProcessor.ts - Commission distribution
export const processCommissions = async (depositId: string) => {
  // Get referral chain
  // Calculate 5-level commissions
  // Update commission pockets
  // Record distribution history
};

// jobs/scheduler.ts - Job scheduling
export const scheduleJobs = () => {
  // Monthly income: 1st of every month
  // Manual sync only - users trigger when needed
  // Cleanup: Daily
};
```

### 📦 Essential Package.json

```json
{
  "name": "yield-cycle-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon src/lambda/api.ts",
    "build": "tsc",
    "start": "node dist/lambda/api.js",
    "deploy": "serverless deploy",
    "lint": "eslint src/**/*.ts --fix"
  },
  "dependencies": {
    "express": "^4.18.2",
    "serverless-http": "^3.2.0",
    "aws-sdk": "^2.1340.0",
    "ethers": "^6.7.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.10.1",
    "nodemailer": "^6.9.4",
    "winston": "^3.10.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.5.0",
    "@types/express": "^4.17.17",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/bcryptjs": "^2.4.2",
    "typescript": "^5.1.6",
    "nodemon": "^3.0.1",
    "eslint": "^8.47.0",
    "serverless": "^3.33.0",
    "serverless-offline": "^12.0.4"
  }
}
```

---

## 📋 Core Implementation Checklist

### Phase 1: Foundation (Week 1-2)

- [ ] Project setup with simplified structure
- [ ] DynamoDB tables creation and configuration
- [ ] Basic Express API with serverless framework
- [ ] Authentication system (JWT + OTP)
- [ ] User registration and login endpoints

### Phase 2: Blockchain Integration (Week 3)

- [ ] BSC wallet generation and HD derivation
- [ ] USDT contract integration
- [ ] Deposit address generation per user
- [ ] Transaction monitoring and validation
- [ ] Deposit processing and recording

### Phase 3: Core Business Logic (Week 4-5)

- [ ] 4-pocket wallet system implementation
- [ ] MLM referral tree construction
- [ ] 5-level commission calculation and distribution
- [ ] Monthly income processing (8% returns)
- [ ] Earnings limit tracking (200% cap)

### Phase 4: User Features (Week 6)

- [ ] Dashboard APIs (user and admin)
- [ ] Wallet balance and transaction history
- [ ] Referral code generation and team view
- [ ] Commission and income history
- [ ] Basic withdrawal request system

### Phase 5: Background Processing (Week 7)

- [ ] Automated monthly income distribution
- [x] Manual blockchain sync endpoint
- [ ] Commission processing automation
- [ ] Email notifications system

### Phase 6: Polish & Deploy (Week 8)

- [ ] Error handling and validation
- [ ] Basic logging and monitoring
- [ ] Security middleware implementation
- [ ] Production deployment and testing
- [ ] Documentation and handover

---

> **Architecture Summary:**  
> **Focus**: Core yield cycle functionality with clean, maintainable code  
> **Complexity**: Production-ready but not over-engineered  
> **Structure**: Clear separation with repositories pattern  
> **Database**: Direct DynamoDB operations, no complex query builders  
> **Events**: Direct service calls, no event emitters (unnecessary complexity)  
> **Types**: Request/response focused, entities in models

**Technical Specification Version**: 2.0 (Simplified)  
**Last Updated**: [Current Date]  
**Status**: Core-Focused Implementation Ready
