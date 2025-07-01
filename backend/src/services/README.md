# 🏗️ **SERVICES LAYER - COMPREHENSIVE IMPLEMENTATION GUIDE**

## 📋 **Overview**

The Services Layer implements the **business logic** for the Yield Cycle platform. This layer orchestrates between Controllers (HTTP layer) and Repositories (data layer), ensuring clean separation of concerns and maintainable code architecture.

### **Architecture Pattern**

- **Class-based services** with static methods
- **Single Responsibility Principle** - each service handles one domain
- **Repository Pattern Integration** - services use repositories for data access
- **Utility Integration** - leverage existing utils for common operations
- **Comprehensive Error Handling** - proper error propagation and logging

---

## 🗂️ **SERVICE DIRECTORY STRUCTURE**

```
services/
├── auth/                    # Authentication & Authorization
│   ├── AuthService.ts       # Registration/Login orchestration
│   ├── PasswordService.ts   # Password security & reset flows
│   ├── OTPService.ts        # OTP lifecycle management
│   └── SessionService.ts    # JWT & session management
├── user/                    # User Management
│   ├── UserService.ts       # Profile operations & user CRUD
│   └── UserLimitService.ts  # Deposit limits & earning caps
├── notification/            # Communication Services
│   └── EmailService.ts      # Email notifications & templates
├── wallet/                  # Wallet Operations
│   ├── WalletService.ts     # 4-pocket wallet management
│   ├── TransactionService.ts # Transaction recording & history
│   └── WithdrawalService.ts # Withdrawal processing
├── deposit/                 # Deposit Management
│   ├── DepositService.ts    # Deposit processing & lifecycle
│   └── DepositValidationService.ts # Business rule validation
├── income/                  # Income Distribution
│   ├── MonthlyIncomeService.ts # 8% monthly distribution
│   └── EarningsLimitService.ts # 200% cap enforcement
├── referral/                # MLM System
│   ├── ReferralTreeService.ts # Tree management & genealogy
│   └── TeamStatsService.ts  # Team analytics & performance
├── commission/              # Commission System
│   ├── CommissionCalculationService.ts # 5-level calculation
│   └── CommissionDistributionService.ts # Distribution engine
├── blockchain/              # Blockchain Integration
│   ├── BlockchainService.ts # BSC network operations
│   ├── WalletGenerationService.ts # HD wallet generation
│   └── TransactionSyncService.ts # Manual sync operations
└── cache/                   # Caching Layer
    └── CacheService.ts      # Application-level caching
```

---

## 🎯 **PHASE 1: AUTHENTICATION FOUNDATION**

### **`notification/EmailService.ts`** - ✅ IMPLEMENTED - Essential Email Operations

**Purpose**: Critical email communications required by ALL authentication services

**✅ COMPLETED**: This service has been implemented and is now being used by PasswordService.

#### **Core Responsibilities** (Required for Authentication Flows)

```typescript
class EmailService {
  // OTP Email Delivery (CRITICAL - Required for all auth flows)
  static sendOTPEmail(email: string, otpCode: string, type: OTPType): Promise<EmailResult>;

  // Password Reset Emails (CRITICAL - Used by PasswordService.initiatePasswordReset())
  static sendPasswordResetOTP(email: string, otpCode: string): Promise<EmailResult>;
}
```

#### **Dependencies**

- **Utils**: SESUtil for AWS SES integration, EmailValidator for validation
- **Config**: AWS SES configuration from `config/email.ts`
- **Templates**: OTP email templates for authentication flows (no code duplication)

#### **Implementation Priority**

```typescript
// 🚨 BLOCKING IMPLEMENTATION - PasswordService.ts already uses these:
await EmailService.sendPasswordResetOTP(email, otp.code);

// ✅ IMPLEMENTATION COMPLETE - OTPService.ts now uses these:
await EmailService.sendOTPEmail(email, otpCode, OTPType.REGISTRATION);
await EmailService.sendOTPEmail(email, otpCode, OTPType.LOGIN);
```

---

### **`auth/PasswordService.ts`** - ✅ IMPLEMENTED - Password Security Foundation

**Purpose**: Essential password operations for platform authentication

#### **Core Responsibilities** (Product Requirements Only)

```typescript
class PasswordService {
  // Password Security (Required for user registration/login)
  static hashPassword(password: string): Promise<string>;
  static verifyPassword(password: string, hash: string): Promise<boolean>;
  static validatePasswordStrength(password: string): ValidationResult;

  // Password Reset Flow (Required for user account recovery)
  static initiatePasswordReset(email: string, ipAddress?: string): Promise<ResetInitiationResult>;
  static validateResetOTP(email: string, otp: string): Promise<boolean>;
  static completePasswordReset(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<ResetCompletionResult>;

  // Password Change (Required for account security)
  static changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ChangeResult>;
}
```

#### **Dependencies**

- **Repositories**: `UserRepository`, `OTPRepository`, `AuditRepository`
- **Utils**: `EncryptionUtils`, `PasswordValidator`
- **Services**: `EmailService` ⚠️ **MISSING - BLOCKING ISSUE**

#### **Current Status**

```typescript
// ✅ RESOLVED: PasswordService now successfully uses EmailService:
await EmailService.sendPasswordResetOTP(email, otp.code);

// ✅ IMPLEMENTATION COMPLETE: EmailService with SESUtil integration, uses EmailValidator (no duplication)
```

---

### **`auth/OTPService.ts`** - OTP Core Operations

**Purpose**: Essential OTP operations for authentication flows

#### **Core Responsibilities** (Product Requirements Only)

```typescript
class OTPService {
  // OTP Generation (Required for registration/login/password reset)
  static generateOTP(email: string, type: OTPType): Promise<OTP>;

  // OTP Validation (Required for authentication flows)
  static validateOTP(email: string, code: string, type: OTPType): Promise<boolean>;

  // OTP Lifecycle (Required for user experience)
  static resendOTP(email: string, type: OTPType): Promise<ResendResult>;
  static cleanupExpiredOTPs(): Promise<number>;
}
```

#### **Dependencies**

- **Repositories**: `OTPRepository`, `AuditRepository`
- **Utils**: `EncryptionService`, `TimeUtils`
- **Services**: `EmailService`

---

### **`auth/AuthService.ts`** - Authentication Core Flows

**Purpose**: Essential authentication flows as per product requirements

#### **Core Responsibilities** (Based on TECHNICAL.md)

```typescript
class AuthService {
  // Registration Flow (Required: email + password + OTP verification)
  static initiateRegistration(request: RegisterRequest): Promise<RegistrationInitiation>;
  static completeRegistration(request: VerifyRegistrationRequest): Promise<RegistrationResult>;

  // Login Flow (Required: email + password authentication)
  static initiateLogin(request: LoginRequest): Promise<LoginInitiation>;
  static completeLogin(request: VerifyLoginRequest): Promise<LoginResult>;

  // Logout Flow (Orchestrates logout, delegates to SessionService)
  static logout(userId: string, sessionId: string): Promise<void>;
}
```

#### **Dependencies**

- **Services**: `PasswordService`, `OTPService`, `SessionService`, `UserService`
- **Repositories**: `UserRepository`, `ReferralRepository`, `WalletPocketRepository`

#### **Service Interaction Pattern**

```typescript
// ✅ CORRECT - AuthService orchestrates, SessionService handles session logic
class AuthService {
  static async logout(userId: string, sessionId: string): Promise<void> {
    // Orchestrate logout flow
    await SessionService.revokeSession(sessionId);
    await AuditRepository.logLogout(userId);
  }
}

// ✅ Authentication Middleware uses SessionService directly
export const authenticateToken = async (req, res, next) => {
  const decoded = jwt.verify(token, JWT_SECRET);

  // Use SessionService for session validation
  const isValid = await SessionService.validateSession(decoded.userId, decoded.sessionId);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  next();
};
```

---

### **`auth/SessionService.ts`** - JWT & Session Management

**Purpose**: Complete session lifecycle and JWT operations

#### **Core Responsibilities** (All Session Operations)

```typescript
class SessionService {
  // Session Creation (Required for login flow)
  static createSession(userId: string, ipAddress: string, userAgent: string): Promise<SessionData>;
  static createSessionWithTokens(userId: string, metadata: SessionMetadata): Promise<TokenPair>;

  // Token Operations (Required for JWT-based auth)
  static generateAccessToken(userId: string, sessionId: string): Promise<string>;
  static generateRefreshToken(userId: string, sessionId: string): Promise<string>;
  static refreshAccessToken(refreshToken: string): Promise<string>;
  static validateAccessToken(token: string): Promise<TokenPayload>;

  // Session Validation (Required for authentication middleware)
  static validateSession(userId: string, sessionId: string): Promise<boolean>;
  static isSessionValid(sessionId: string): Promise<boolean>;

  // Session Management (Required for session lifecycle)
  static getSession(sessionId: string): Promise<Session | null>;
  static revokeSession(sessionId: string): Promise<void>;
  static revokeAllUserSessions(userId: string): Promise<void>;

  // Session Cleanup (Required for maintenance)
  static cleanupExpiredSessions(): Promise<number>;
}
```

---

## 🎯 **PHASE 2: CORE BUSINESS SERVICES**

### **`user/UserService.ts`** - Essential User Operations

**Purpose**: Core user management for platform operations

#### **Core Responsibilities** (Product Requirements)

```typescript
class UserService {
  // User CRUD (Required for platform functionality)
  static createUser(userData: CreateUserRequest): Promise<User>;
  static getUserById(userId: string): Promise<User | null>;
  static getUserByEmail(email: string): Promise<User | null>;
  static updateUserProfile(userId: string, updates: ProfileUpdates): Promise<User>;

  // Account Management (Required for registration flow)
  static verifyEmail(userId: string): Promise<void>;
  static updateLastLoginTime(userId: string): Promise<void>;
}
```

---

### **`deposit/DepositService.ts`** - Core Deposit Management

**Purpose**: Essential deposit operations for platform

#### **Core Responsibilities** (Based on Deposit Flow Requirements)

```typescript
class DepositService {
  // Deposit Processing (Required for user deposits)
  static processIncomingDeposit(depositData: IncomingDepositData): Promise<Deposit>;
  static validateDeposit(depositData: DepositData): Promise<ValidationResult>;
  static activateDeposit(depositId: string): Promise<void>;

  // Status Management (Required for deposit lifecycle)
  static updateDepositStatus(depositId: string, status: DepositStatus): Promise<void>;

  // User Deposit Operations (Required for user dashboard)
  static getUserDeposits(userId: string): Promise<Deposit[]>;
  static getActiveDeposits(userId: string): Promise<Deposit[]>;
}
```

---

### **`wallet/WalletService.ts`** - 3-Pocket System Management

**Purpose**: Core wallet operations as per product specification

#### **Core Responsibilities** (Based on Wallet System Requirements)

```typescript
class WalletService {
  // Wallet Initialization (Required for new users)
  static initializeUserWallet(userId: string): Promise<WalletInitResult>;
  static getWalletBalances(userId: string): Promise<WalletBalances>;

  // Pocket Operations (Required for 3-pocket system)
  static creditPocket(
    userId: string,
    pocketType: PocketType,
    amount: number,
    reference: string
  ): Promise<void>;
  static debitPocket(
    userId: string,
    pocketType: PocketType,
    amount: number,
    reference: string
  ): Promise<void>;

  // Balance Calculations (Required for dashboard)
  static calculateTotalEarnings(userId: string): Promise<number>; // INCOME + COMMISSION
}
```

---

## 🎯 **PHASE 3: REFERRAL & COMMISSION SYSTEM**

### **`referral/ReferralTreeService.ts`** - MLM Tree Management

**Purpose**: Core referral operations for commission system

#### **Core Responsibilities** (Based on Referral System Requirements)

```typescript
class ReferralTreeService {
  // Tree Construction (Required for user registration with referral)
  static addUserToTree(userId: string, referrerUserId?: string): Promise<void>;

  // Tree Operations (Required for commission calculation)
  static getDirectReferrals(userId: string): Promise<User[]>;
  static getAncestors(userId: string, levels: number): Promise<User[]>; // Get 5 levels for commission

  // Team Information (Required for user dashboard)
  static getTeamMembers(userId: string): Promise<TeamMember[]>;
}
```

### **`commission/CommissionCalculationService.ts`** - 5-Level Commission Engine

**Purpose**: MLM commission calculation as per commission structure

#### **Core Responsibilities** (Based on Commission Flow Requirements)

```typescript
class CommissionCalculationService {
  // Commission Calculation (Required: 10%, 5%, 3%, 1%, 1% across 5 levels)
  static calculateCommissions(
    depositId: string,
    userId: string,
    amount: number
  ): Promise<Commission[]>;

  // Commission Distribution (Required for real-time distribution)
  static distributeCommissions(commissions: Commission[]): Promise<DistributionResult>;

  // Commission Management (Required for user dashboard)
  static getCommissionHistory(userId: string): Promise<Commission[]>;
}
```

---

### **`income/MonthlyIncomeService.ts`** - 8% Monthly Distribution

**Purpose**: Automated monthly income processing

#### **Core Responsibilities**

```typescript
class MonthlyIncomeService {
  // Monthly Processing (Automated)
  static processMonthlyIncomes(): Promise<ProcessingResult>;
  static processUserMonthlyIncome(userId: string): Promise<IncomeResult>;
  static calculateMonthlyIncome(depositId: string): Promise<number>;
  static distributeMonthlyIncome(userId: string, amount: number, depositId: string): Promise<void>;

  // Income Management
  static getIncomeHistory(userId: string, filters?: IncomeFilters): Promise<PaginatedIncome>;
  static getMonthlyIncomeStats(userId: string): Promise<IncomeStats>;
  static getProjectedIncome(userId: string): Promise<ProjectedIncome>;

  // Business Logic
  static checkIncomeEligibility(depositId: string): Promise<boolean>;
  static updateIncomeStatus(incomeId: string, status: IncomeStatus): Promise<void>;
  static processIncomeBacklog(): Promise<ProcessingResult>;

  // Analytics
  static getPlatformIncomeMetrics(): Promise<PlatformIncomeMetrics>;
  static getIncomeDistributionReport(): Promise<IncomeReport>;
}
```

---

## 🎯 **PHASE 5: MLM BUSINESS LOGIC**

### **`referral/ReferralTreeService.ts`** - MLM Tree Management

**Purpose**: Complete MLM tree operations and genealogy

#### **Core Responsibilities**

```typescript
class ReferralTreeService {
  // Tree Construction
  static addUserToTree(userId: string, referrerUserId?: string): Promise<void>;
  static buildGenealogyCache(userId: string): Promise<Genealogy>;
  static updateTreeStatistics(userId: string): Promise<void>;

  // Tree Traversal
  static getDirectReferrals(userId: string): Promise<User[]>;
  static getAncestors(userId: string, levels?: number): Promise<User[]>;
  static getDescendants(userId: string, maxDepth?: number): Promise<TreeNode[]>;
  static getTeamMembers(userId: string): Promise<TeamMember[]>;

  // Genealogy Operations
  static getGenealogy(userId: string): Promise<Genealogy>;
  static updateGenealogy(userId: string, genealogy: Genealogy): Promise<void>;
  static validateTreeIntegrity(userId: string): Promise<IntegrityResult>;

  // Tree Analytics
  static getTreeStatistics(userId: string): Promise<TreeStats>;
  static getTeamGrowthMetrics(userId: string, timeframe: string): Promise<GrowthMetrics>;
  static calculateTeamVolume(userId: string): Promise<number>;
}
```

---

### **`commission/CommissionCalculationService.ts`** - 5-Level Commission Engine

**Purpose**: MLM commission calculation and distribution

#### **Core Responsibilities**

```typescript
class CommissionCalculationService {
  // Commission Calculation (5 Levels: 10%, 5%, 3%, 1%, 1%)
  static calculateCommissions(
    depositId: string,
    userId: string,
    amount: number
  ): Promise<Commission[]>;
  static distributeCommissions(commissions: Commission[]): Promise<DistributionResult>;
  static validateCommissionEligibility(userId: string, level: number): Promise<boolean>;

  // Commission Management
  static processCommissionBatch(commissions: Commission[]): Promise<BatchResult>;
  static updateCommissionStatus(commissionId: string, status: CommissionStatus): Promise<void>;
  static getCommissionHistory(
    userId: string,
    filters?: CommissionFilters
  ): Promise<PaginatedCommissions>;

  // Commission Analytics
  static getCommissionStatistics(userId: string): Promise<CommissionStats>;
  static getTotalCommissionsEarned(userId: string): Promise<number>;
  static getCommissionsByLevel(userId: string): Promise<LevelCommissions>;

  // Business Logic
  static checkEarningsEligibility(userId: string): Promise<boolean>;
  static calculateCommissionRates(): Promise<number[]>;
  static processCommissionBacklog(): Promise<ProcessingResult>;
}
```

#### **Commission Structure**

- **Level 1**: 10% (Direct referrals)
- **Level 2**: 5% (2nd generation)
- **Level 3**: 3% (3rd generation)
- **Level 4**: 1% (4th generation)
- **Level 5**: 1% (5th generation)

---

## 🎯 **PHASE 6: BLOCKCHAIN INTEGRATION**

### **`blockchain/BlockchainService.ts`** - BSC Network Operations

**Purpose**: Blockchain integration and transaction monitoring

#### **Core Responsibilities**

```typescript
class BlockchainService {
  // Network Operations
  static getNetworkInfo(): Promise<NetworkInfo>;
  static getUSDTBalance(address: string): Promise<number>;
  static validateTransaction(txHash: string): Promise<TransactionValidation>;
  static getTransactionDetails(txHash: string): Promise<TransactionDetails>;

  // Manual Sync Operations (User-triggered)
  static syncUserDeposits(userId: string): Promise<SyncResult>;
  static syncTransactionByHash(txHash: string): Promise<SyncResult>;
  static validateAndProcessDeposit(txHash: string, userId: string): Promise<ProcessResult>;

  // Monitoring
  static monitorPendingTransactions(): Promise<MonitoringResult>;
  static checkTransactionConfirmations(txHash: string): Promise<number>;
  static updateTransactionStatus(txHash: string): Promise<void>;

  // Utilities
  static estimateGasCost(operation: string): Promise<number>;
  static validateAddress(address: string): Promise<boolean>;
  static getBlockNumber(): Promise<number>;
}
```

---

## 🔧 **IMPLEMENTATION GUIDELINES**

### **Service Design Patterns**

#### **1. Class Structure**

```typescript
export class ServiceName {
  // Static methods only - no instance creation needed
  static async methodName(params): Promise<ReturnType> {
    try {
      // Implementation
      return result;
    } catch (error: any) {
      // Error handling with logging
      throw new Error(`Operation failed: ${error.message}`);
    }
  }
}
```

#### **2. Error Handling**

```typescript
// Standard error handling pattern
try {
  const result = await repository.operation();
  await AuditRepository.logSuccess(operation, userId);
  return result;
} catch (error: any) {
  await AuditRepository.logError(operation, userId, error.message);
  throw new Error(`Service operation failed: ${error.message}`);
}
```

#### **3. Repository Integration**

```typescript
// Use repositories for all data operations
const user = await UserRepository.getUserById(userId);
const result = await UserRepository.updateUser(userId, updates);
```

#### **4. Utility Integration**

```typescript
// Leverage existing utilities
const hash = await EncryptionService.hashPassword(password);
const isValid = EmailValidator.validate(email);
```

### **Dependencies & Imports**

#### **Required Imports Pattern**

```typescript
// Models
import { User, OTP, Session } from '../../models';

// Repositories
import { UserRepository, OTPRepository } from '../../repositories';

// Utils
import { EncryptionService, ValidationUtils } from '../../utils';

// Types
import { UserRole, OTPType } from '../../types/enums';

// Other Services (when needed)
import { EmailService } from '../notification/EmailService';
```

### **Security & Logging**

#### **Audit Logging**

```typescript
// Log all significant operations
await AuditRepository.createAuditLog(
  AuditLog.createSecurityAudit(userId, action, metadata, ipAddress)
);
```

#### **Error Propagation**

```typescript
// Proper error propagation with context
throw new Error(`${ServiceName}.${methodName} failed: ${error.message}`);
```

---

## 📅 **UPDATED IMPLEMENTATION TIMELINE** (Correct Priority Order)

| Phase       | Services (Correct Order)          | Duration   | Dependencies                |
| ----------- | --------------------------------- | ---------- | --------------------------- |
| **Phase 1** | Email + Auth Services (4 files)   | **4 days** | Models, Repositories, Utils |
| **Phase 2** | User + Deposit Services (2 files) | **2 days** | Phase 1                     |
| **Phase 3** | Wallet + Referral (2 files)       | **3 days** | Phase 1-2                   |
| **Phase 4** | Commission Service (1 file)       | **2 days** | Phase 1-3                   |

**Total Timeline**: ~11 days for core functionality

### **Phase Details**

#### **Phase 1: Authentication Foundation (CORRECTED ORDER)**

- ✅ `notification/EmailService.ts` - **COMPLETED** with SESUtil integration
- ✅ `auth/PasswordService.ts` - **COMPLETED** with EmailService integration
- 🔄 `auth/OTPService.ts` - Core OTP operations (ready to implement)
- 🔄 `auth/AuthService.ts` - Registration/Login flows (ready to implement)

#### **Phase 2: Core Business Logic**

- 🔄 `user/UserService.ts` - Essential user operations
- 🔄 `deposit/DepositService.ts` - Deposit processing

#### **Phase 3: Financial System**

- 🔄 `wallet/WalletService.ts` - 3-pocket system
- 🔄 `referral/ReferralTreeService.ts` - MLM tree operations

#### **Phase 4: Commission Engine**

- 🔄 `commission/CommissionCalculationService.ts` - 5-level commission distribution

---

## ✅ **CORRECT IMPLEMENTATION ORDER**

**✅ COMPLETED IMPLEMENTATIONS:**

1. **✅ DONE**: `notification/EmailService.ts` - **COMPLETED** with SESUtil integration
   - AWS SES integration with development mocking
   - Email templates for OTP and password reset emails only
   - Retry mechanisms with exponential backoff
   - Comprehensive error handling (no audit logging - overkill for emails)
   - **Code reuse**: Uses EmailValidator from validation.ts (no duplication)

2. **✅ DONE**: `auth/PasswordService.ts` - **COMPLETED** with EmailService integration
   - Password strength validation and hashing
   - Password reset workflow with email notifications
   - Security audit logging for all operations

3. **✅ DONE**: `auth/OTPService.ts` - **COMPLETED** with comprehensive OTP management
   - OTP generation for registration, login, and password reset flows
   - OTP validation with security checks (expiry, attempts, usage)
   - OTP lifecycle management (resend, cleanup, invalidation)
   - Security features: attempt limiting, expiry handling, single-use enforcement
   - Integration with EmailService for OTP delivery
   - **Code reuse**: Uses OTP model validation, no duplicate utility methods

4. **🔄 FINAL**: `auth/AuthService.ts` - Main authentication orchestrator (ready to implement)

**Each service will be production-ready with:**

- ✅ Comprehensive error handling
- ✅ Audit logging integration
- ✅ Type safety with interfaces
- ✅ Repository pattern usage
- ✅ Utility function integration
- ✅ Business rule enforcement
- ✅ Security best practices
