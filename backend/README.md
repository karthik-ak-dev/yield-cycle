# YieldCycle - Technical Implementation Guide

**Version 1.0 | Last Updated: January 2025**

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Model & Entity Hierarchy](#2-data-model--entity-hierarchy)
3. [User Access Control](#3-user-access-control)
4. [Backend Architecture (MVC)](#4-backend-architecture-mvc)
5. [Complete API Documentation](#5-complete-api-documentation)
6. [Database Schema](#6-database-schema)
7. [Core Use Cases](#7-core-use-cases)
8. [Implementation Phases](#8-implementation-phases)
9. [Production-Ready Development Guidelines](#9-production-ready-development-guidelines)
10. [Reusable LLM Implementation Prompt](#10-reusable-llm-implementation-prompt)

---

## 1. System Architecture

### 1.1 MVP System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                YIELDCYCLE MVP ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Binance API   │    │   API Gateway    │    │   App Runner    │    │   EventBridge   │
│   Integration   │◄──►│   (REST API)     │◄──►│   Application   │◄──►│   (Real-time    │
│                 │    │                  │    │                 │    │    Events)      │
│ • Wallet Valid  │    │ • Authentication │    │ • Express App   │    │ • Deposit Events│
│ • Transaction   │    │ • Rate Limiting  │    │ • MVC Pattern   │    │ • Trade Events  │
│ • Balance Check │    │ • CORS           │    │ • JWT Auth      │    │ • Yield Calc    │
│ • USDT Operations│   │ • Request/Response│   │ • Role-based    │    │ • Notifications │
└─────────────────┘    └──────────────────┘    │   Access Control│    └─────────────────┘
                                               └─────────────────┘
                                                        │
                                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              DYNAMODB MULTI-TABLE DESIGN                         │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────┤
│    Users        │     Wallets     │    Deposits     │     Trades      │ Traders │
│    Table        │     Table       │     Table       │     Table       │ Table   │
│                 │                 │                 │                 │         │
│ • userId (PK)   │ • walletId (PK) │ • depositId (PK)│ • tradeId (PK)  │•traderId│
│ • email         │ • userId (SK)   │ • userId (SK)   │ • traderId (SK) │ • userId│
│ • role, status  │ • address       │ • amount        │ • amount        │ • limits│
│ • permissions   │ • network       │ • yield rate    │ • status        │ • status│
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────┘
                                                        │
                                                        ▼
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────┤
│  Transactions   │   Trade Returns │ Yield Schedules │ Wallet Balances │   OTP   │
│     Table       │     Table       │     Table       │     Table       │ Table   │
│                 │                 │                 │                 │         │
│ • txnId (PK)    │ • returnId (PK) │ • scheduleId(PK)│ • balanceId(PK) │•otpId   │
│ • depositId(SK) │ • tradeId (SK)  │ • depositId(SK) │ • walletType(SK)│ • email │
│ • hash, amount  │ • amount        │ • yield amount  │ • balance       │ • code  │
│ • status        │ • return date   │ • payout date   │ • last updated  │ • expiry│
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW & ISOLATION                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DEPOSITORS                   TRADERS                    ADMINS                 │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐          │
│  │ Register    │            │ Register     │            │ Full Access │          │
│  │ Wallets     │            │ Request Fund │            │ Approve     │          │
│  │ Deposit     │            │ Submit Return│            │ Trades      │          │
│  │ Withdraw    │            │ Submit Return│            │ Trades      │          │
│  └─────────────┘            └─────────────┘            └─────────────┘          │
│         │                           │                           │               │
│         ▼                           ▼                           ▼               │
│  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐          │
│  │ Own Data    │            │ Own Trades  │            │ Platform    │          │
│  │ Only        │            │ Only        │            │ Overview    │          │
│  └─────────────┘            └─────────────┘            └─────────────┘          │
│                                                                                 │
│  ❌ NO CROSS-USER DATA ACCESS  ❌ LIMITED TRADE ACCESS                           │
│  ✅ PERSONAL WALLET & DEPOSITS ✅ ONLY OWN TRADE REQUESTS                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              KEY FEATURES & FLOWS                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  🔐 AUTHENTICATION FLOW:                                                        │
│  Email → Password → OTP Verification → JWT Token → Role-based Access            │
│                                                                                 │
│  💰 DEPOSIT FLOW:                                                               │
│  Wallet Association → Transfer to Custodian → Submit Transaction → Validation   │
│                                                                                 │
│  📈 TRADING FLOW:                                                               │
│  Fund Request → Admin Approval → Transfer to Trader → Trade → Return Submission │
│                                                                                 │
│  💸 WITHDRAWAL FLOW:                                                            │
│  Lock Period Complete → Request Withdrawal → Principal + Yield Transfer         │
│                                                                                 │
│  📊 REAL-TIME UPDATES:                                                          │
│  Deposit Events → Yield Calculation → Trade Status → Balance Updates            │
│                                                                                 │
│  🔒 SECURITY & COMPLIANCE:                                                      │
│  Multi-factor Auth → Wallet Validation → Transaction Verification               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TECHNICAL STACK                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Backend: Node.js 18+ | Express.js | TypeScript | JWT Authentication            │
│  Database: DynamoDB Multi-Table | Global Secondary Indexes | Local Indexes      │
│  Cloud: AWS App Runner | API Gateway | EventBridge | CloudWatch | Parameter Store│
│  Integration: Binance API | USDT Operations | Email Service | OTP Verification  │
│  Security: Role-based Access Control | Data Isolation | Audit Logging           │
│  Monitoring: Structured Logging | Performance Metrics | Error Tracking          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

**Backend:**

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with Zod validation
- **Database**: DynamoDB multi-table design
- **Authentication**: JWT with email-based OTP
- **Architecture**: MVC pattern with dependency injection
- **Deployment**: AWS App Runner with auto-scaling

**Integrations:**

- **Blockchain**: Binance API for USDT operations
- **Email**: AWS SES for OTP delivery
- **Monitoring**: CloudWatch for metrics and logging

---

## 2. Data Model & Entity Hierarchy

### 2.1 Entity Relationship

```
User (1)
├── Role: DEPOSITOR | TRADER | ADMIN
├── Authentication (1:1)
│   ├── Email Verification
│   └── OTP Management
├── Wallets (1:N) [DEPOSITOR only]
│   ├── Address Validation
│   └── Network: Binance
├── Deposits (1:N) [DEPOSITOR only]
│   ├── Transactions (1:N)
│   ├── Yield Schedules (1:N)
│   └── Withdrawal Records (1:N)
├── Trade Requests (1:N) [TRADER only]
│   ├── Fund Allocation
│   ├── Trade Returns (1:N)
│   └── Performance Tracking
└── Admin Operations (1:N) [ADMIN only]
    ├── Trader Management
    ├── Trade Approvals
    └── Platform Analytics
```

### 2.2 Core Entities

#### User

- **Purpose**: Central user identity for all platform participants
- **Roles**: DEPOSITOR, TRADER, ADMIN with distinct permissions
- **Authentication**: Email + Password + OTP verification
- **Isolation**: Role-based data access with strict boundaries
- **Security**: Multi-factor authentication with session management

#### Depositor

- **Purpose**: Users who deposit USDT to earn yield
- **Wallets**: Multiple Binance USDT wallets association
- **Deposits**: Individual deposit tracking with lock-in periods
- **Yield**: Automated yield calculation and distribution
- **Withdrawal**: Post lock-in period withdrawal with accumulated yield

#### Trader

- **Purpose**: Platform-approved trading specialists
- **Registration**: Admin-only trader onboarding
- **Fund Requests**: Request trading capital from deposit pool
- **Limits**: Maximum concurrent open fund requests (Y limit)
- **Returns**: Submit trading returns to payout wallet
- **Performance**: Track individual trade success rates

#### Admin

- **Purpose**: Platform owner with full system access
- **Trader Management**: Register and manage traders
- **Trade Oversight**: Approve/reject fund requests
- **Financial Control**: Monitor all wallets and balances
- **Analytics**: Complete platform performance visibility

#### Wallet

- **Purpose**: Binance USDT wallet association and validation
- **Validation**: Ensure wallet uniqueness across platform
- **Network**: Binance Smart Chain USDT operations
- **Association**: Link multiple wallets to single depositor
- **Security**: Address verification and ownership confirmation

#### Deposit

- **Purpose**: Individual deposit tracking and yield management
- **Amount**: Principal deposit amount in USDT
- **Lock Period**: 15-day minimum lock-in period
- **Yield Rate**: Configurable interest rate per deposit
- **Status**: PENDING → ACTIVE → MATURED → WITHDRAWN
- **Transaction**: Blockchain transaction verification

#### Trade

- **Purpose**: Individual trading operation tracking
- **Request**: Trader fund request to admin
- **Approval**: Admin approval workflow
- **Execution**: Fund transfer to trader wallet
- **Return**: Profit/loss submission to payout wallet
- **Performance**: Individual trade ROI tracking

#### Transaction

- **Purpose**: Blockchain transaction recording and verification
- **Hash**: Unique blockchain transaction identifier
- **Validation**: Automated transaction verification
- **Status**: PENDING → CONFIRMED → FAILED
- **Audit**: Complete transaction history tracking

---

## 3. User Access Control

### 3.1 User Types & Permissions

#### Depositor

```typescript
interface DepositorPermissions {
  // Wallet management
  addWallet: true;
  viewOwnWallets: true;
  removeOwnWallet: true;

  // Deposit operations
  createDeposit: true;
  viewOwnDeposits: true;
  submitTransaction: true;
  withdrawMaturedDeposits: true;

  // Limited access
  viewOwnYieldHistory: true;
  viewOwnTransactionHistory: true;

  // Restricted access
  viewOtherUserData: false;
  viewTradeOperations: false;
  viewPlatformAnalytics: false;
  adminFunctions: false;
}
```

#### Trader

```typescript
interface TraderPermissions {
  // Trade operations
  requestFunds: true;
  viewOwnTradeRequests: true;
  submitTradeReturns: true;
  viewOwnPerformance: true;

  // Limited wallet access
  viewAssignedWallet: true;

  // Restricted access
  viewOtherTraderData: false;
  viewDepositorData: false;
  approveFundRequests: false;
  viewPlatformFinancials: false;
  adminFunctions: false;
}
```

#### Admin

```typescript
interface AdminPermissions {
  // Full platform access
  viewAllData: true;
  managePlatform: true;

  // User management
  registerTraders: true;
  deactivateUsers: true;
  viewAllUsers: true;

  // Financial oversight
  approveFundRequests: true;
  viewAllWallets: true;
  viewPlatformBalances: true;

  // Trade management
  viewAllTrades: true;
  manageTradeReturns: true;

  // Analytics & reporting
  viewPlatformAnalytics: true;
  generateReports: true;
  exportData: true;

  // System configuration
  configureYieldRates: true;
  managePlatformSettings: true;
}
```

### 3.2 JWT Token Structure

```typescript
// JWT Payload
{
  "user_id": "usr_12345",
  "email": "user@example.com",
  "role": "DEPOSITOR" | "TRADER" | "ADMIN",
  "trader_id": "trader_67890", // only for trader users
  "permissions": [
    "view_own_deposits", "create_deposit", "add_wallet",
    "request_funds", "submit_returns", "view_all_data"
  ],
  "data_access_scope": "OWN_DATA" | "TRADER_DATA" | "ALL_DATA",
  "exp": 1640995200,
  "iat": 1640995200,
  "iss": "yieldcycle-api"
}
```

---

## 4. Backend Architecture (MVC)

### 4.1 Complete Project Structure

```
yield-cycle-backend/
├── src/
│   ├── api/                           # Routes Layer
│   │   ├── v1/
│   │   │   ├── index.ts
│   │   │   ├── auth.ts               # Authentication routes
│   │   │   ├── users.ts              # User management routes
│   │   │   ├── wallets.ts            # Wallet management routes
│   │   │   ├── deposits.ts           # Deposit management routes
│   │   │   ├── transactions.ts       # Transaction routes
│   │   │   ├── trades.ts             # Trade management routes
│   │   │   ├── traders.ts            # Trader management routes
│   │   │   ├── yields.ts             # Yield calculation routes
│   │   │   ├── withdrawals.ts        # Withdrawal routes
│   │   │   ├── analytics.ts          # Analytics routes
│   │   │   └── admin.ts              # Admin operations
│   │   ├── dependencies.ts           # Route dependencies
│   │   ├── middleware.ts             # Auth & CORS middleware
│   │   └── index.ts
│   ├── controllers/                   # Controllers Layer
│   │   ├── index.ts
│   │   ├── auth-controller.ts        # Authentication logic
│   │   ├── user-controller.ts        # User operations
│   │   ├── wallet-controller.ts      # Wallet operations
│   │   ├── deposit-controller.ts     # Deposit operations
│   │   ├── transaction-controller.ts # Transaction operations
│   │   ├── trade-controller.ts       # Trade operations
│   │   ├── trader-controller.ts      # Trader operations
│   │   ├── yield-controller.ts       # Yield operations
│   │   ├── withdrawal-controller.ts  # Withdrawal operations
│   │   ├── analytics-controller.ts   # Analytics operations
│   │   └── admin-controller.ts       # Admin operations
│   ├── services/                      # Business Logic Layer
│   │   ├── index.ts
│   │   ├── auth-service.ts           # Authentication business logic
│   │   ├── user-service.ts           # User business logic
│   │   ├── wallet-service.ts         # Wallet business logic
│   │   ├── deposit-service.ts        # Deposit business logic
│   │   ├── transaction-service.ts    # Transaction business logic
│   │   ├── trade-service.ts          # Trade business logic
│   │   ├── trader-service.ts         # Trader business logic
│   │   ├── yield-service.ts          # Yield calculation service
│   │   ├── withdrawal-service.ts     # Withdrawal service
│   │   ├── binance-service.ts        # Binance API integration
│   │   ├── email-service.ts          # Email service
│   │   ├── otp-service.ts            # OTP service
│   │   └── analytics-service.ts      # Analytics service
│   ├── repositories/                  # Data Access Layer
│   │   ├── index.ts
│   │   ├── base-repository.ts        # Base repository pattern
│   │   ├── user-repository.ts        # User data operations
│   │   ├── wallet-repository.ts      # Wallet data operations
│   │   ├── deposit-repository.ts     # Deposit data operations
│   │   ├── transaction-repository.ts # Transaction data operations
│   │   ├── trade-repository.ts       # Trade data operations
│   │   ├── trader-repository.ts      # Trader data operations
│   │   ├── yield-repository.ts       # Yield data operations
│   │   ├── withdrawal-repository.ts  # Withdrawal data operations
│   │   └── otp-repository.ts         # OTP data operations
│   ├── models/                        # Data Models
│   │   ├── index.ts
│   │   ├── base.ts                   # Base model classes
│   │   ├── user.ts                   # User models
│   │   ├── wallet.ts                 # Wallet models
│   │   ├── deposit.ts                # Deposit models
│   │   ├── transaction.ts            # Transaction models
│   │   ├── trade.ts                  # Trade models
│   │   ├── trader.ts                 # Trader models
│   │   ├── yield.ts                  # Yield models
│   │   ├── withdrawal.ts             # Withdrawal models
│   │   └── otp.ts                    # OTP models
│   ├── core/                          # Core Configuration
│   │   ├── index.ts
│   │   ├── config.ts                 # Application configuration
│   │   ├── security.ts               # Security utilities
│   │   ├── exceptions.ts             # Custom exceptions
│   │   ├── constants.ts              # Application constants
│   │   └── permissions.ts            # Permission definitions
│   ├── utils/                         # Comprehensive Utility Functions (52 files)
│   │   ├── README.md                 # Detailed implementation guide
│   │   ├── index.ts                  # Exports all utility functions
│   │   ├── logger/                   # Logging infrastructure (6 files)
│   │   │   ├── index.ts              # Logger exports
│   │   │   ├── winston-config.ts     # Winston configuration
│   │   │   ├── log-formatters.ts     # Log formatting utilities
│   │   │   ├── log-context.ts        # Contextual logging helpers
│   │   │   ├── audit-logger.ts       # Financial compliance audit logging
│   │   │   └── performance-logger.ts # Performance & metrics logging
│   │   ├── validators/               # Input validation schemas (13 files)
│   │   │   ├── index.ts              # Validation exports
│   │   │   ├── base-schemas.ts       # Common validation patterns
│   │   │   ├── auth-schemas.ts       # Authentication APIs (4 endpoints)
│   │   │   ├── user-schemas.ts       # User management APIs (3 endpoints)
│   │   │   ├── wallet-schemas.ts     # Wallet management APIs (3 endpoints)
│   │   │   ├── deposit-schemas.ts    # Deposit management APIs (4 endpoints)
│   │   │   ├── transaction-schemas.ts # Transaction APIs (3 endpoints)
│   │   │   ├── trade-schemas.ts      # Trade management APIs (5 endpoints)
│   │   │   ├── trader-schemas.ts     # Trader management APIs (4 endpoints)
│   │   │   ├── yield-schemas.ts      # Yield calculation APIs (3 endpoints)
│   │   │   ├── admin-schemas.ts      # Admin operation APIs (6 endpoints)
│   │   │   ├── crypto-schemas.ts     # Crypto data validation (addresses, hashes)
│   │   │   └── validation-helpers.ts # Custom validation utilities
│   │   ├── formatters/               # Data formatting utilities (10 files)
│   │   │   ├── index.ts              # Formatter exports
│   │   │   ├── api-response-formatters.ts # Standard API response formatting
│   │   │   ├── email-formatter.ts    # Email formatting utilities
│   │   │   ├── date-formatter.ts     # Date & time formatting
│   │   │   ├── currency-formatter.ts # USDT & financial formatting
│   │   │   ├── crypto-formatter.ts   # Crypto address & hash formatting
│   │   │   ├── analytics-formatter.ts # Analytics & report formatting
│   │   │   ├── trade-formatter.ts    # Trade data formatting
│   │   │   ├── privacy-formatter.ts  # Data privacy & masking
│   │   │   └── yield-formatter.ts    # Yield calculation formatting
│   │   ├── helpers/                  # Common utility functions (14 files)
│   │   │   ├── index.ts              # Helper exports
│   │   │   ├── security-helpers.ts   # Encryption & security
│   │   │   ├── data-helpers.ts       # Data manipulation
│   │   │   ├── id-generators.ts      # ID generation utilities
│   │   │   ├── auth-helpers.ts       # Authentication logic helpers
│   │   │   ├── user-helpers.ts       # User management helpers
│   │   │   ├── wallet-helpers.ts     # Wallet operation helpers
│   │   │   ├── deposit-helpers.ts    # Deposit calculation helpers
│   │   │   ├── trade-helpers.ts      # Trade operation helpers
│   │   │   ├── yield-helpers.ts      # Yield calculation helpers
│   │   │   ├── crypto-helpers.ts     # Blockchain integration helpers
│   │   │   ├── analytics-helpers.ts  # Analytics calculation helpers
│   │   │   ├── binance-helpers.ts    # Binance API integration
│   │   │   └── email-helpers.ts      # Email service helpers
│   │   └── decorators/               # Custom decorators & middleware (9 files)
│   │       ├── index.ts              # Decorator exports
│   │       ├── auth-decorators.ts    # Authentication decorators
│   │       ├── validation-decorators.ts # Request validation decorators
│   │       ├── cache-decorators.ts   # Caching decorators
│   │       ├── audit-decorators.ts   # Financial audit & logging decorators
│   │       ├── role-decorators.ts    # Role-based access decorators
│   │       ├── crypto-decorators.ts  # Crypto operation decorators
│   │       ├── rate-limit-decorators.ts # Rate limiting decorators
│   │       └── performance-decorators.ts # Performance monitoring decorators
│   └── app.ts                         # Express application entry
├── tests/                             # Test Suite
├── deployment/                        # Deployment Configuration
├── scripts/                           # Utility Scripts
├── package.json                       # Node.js project config
├── tsconfig.json                      # TypeScript configuration
├── eslint.config.js                   # ESLint configuration
└── README.md                         # This documentation
```

### 4.2 MVC Architecture Pattern

The application follows a clean MVC (Model-View-Controller) architecture pattern:

**Routes Layer**: Handle HTTP requests, authentication, and input validation  
**Controllers Layer**: Business logic coordination and permission validation  
**Services Layer**: Core business rules and cross-cutting concerns  
**Repositories Layer**: Data access abstraction and database operations  
**Models Layer**: Data structures and entity definitions

Each layer has clear responsibilities and dependencies flow downward, ensuring separation of concerns and testability.

### 4.3 Comprehensive Utils Structure

The utils directory contains a comprehensive collection of 52+ utility files organized into specific categories for maximum reusability and maintainability:

#### 4.3.1 Logger Infrastructure (6 files)

- **winston-config.ts**: Centralized logging configuration with multiple transports
- **audit-logger.ts**: Financial compliance audit logging for regulatory requirements
- **performance-logger.ts**: API response time and performance metrics logging
- **log-formatters.ts**: Standardized log formatting for structured logging
- **log-context.ts**: Request correlation and context propagation

#### 4.3.2 Validation Schemas (13 files)

- **auth-schemas.ts**: Registration, login, OTP validation schemas
- **wallet-schemas.ts**: Crypto wallet address and network validation
- **deposit-schemas.ts**: Deposit amount, transaction hash validation
- **trade-schemas.ts**: Trade request, return submission validation
- **crypto-schemas.ts**: Blockchain address, transaction hash patterns
- **admin-schemas.ts**: Administrative operation validation

#### 4.3.3 Data Formatters (10 files)

- **currency-formatter.ts**: USDT amount formatting with precision handling
- **crypto-formatter.ts**: Wallet address masking and transaction hash display
- **yield-formatter.ts**: Yield percentage and earning calculations display
- **trade-formatter.ts**: Trade ROI and performance metrics formatting
- **privacy-formatter.ts**: PII masking for security compliance

#### 4.3.4 Business Logic Helpers (14 files)

- **yield-helpers.ts**: Complex yield calculation algorithms
- **crypto-helpers.ts**: Blockchain integration and verification logic
- **binance-helpers.ts**: Binance API integration and error handling
- **trade-helpers.ts**: Trade allocation and return validation logic
- **deposit-helpers.ts**: Lock period calculations and maturity checks
- **security-helpers.ts**: Encryption, hashing, and security utilities

#### 4.3.5 Decorators & Middleware (9 files)

- **crypto-decorators.ts**: Blockchain operation monitoring decorators
- **audit-decorators.ts**: Financial transaction audit trail decorators
- **role-decorators.ts**: Multi-role access control decorators
- **rate-limit-decorators.ts**: API rate limiting with role-based limits
- **performance-decorators.ts**: Method execution time monitoring

#### 4.3.6 Benefits of This Structure

**✅ Advantages:**

- **Modular Organization**: Easy to locate and maintain specific functionality
- **Reusability**: Shared utilities across controllers, services, and repositories
- **Type Safety**: Full TypeScript support with proper interfaces
- **Testing**: Each utility can be unit tested independently
- **Performance**: Optimized implementations with caching where appropriate
- **Compliance**: Built-in audit logging and financial compliance features
- **Security**: Centralized security utilities with consistent implementation
- **Scalability**: Easy to add new utilities without affecting existing code

**Example Usage:**

```typescript
// Easy imports with organized structure
import { validateWalletAddress } from '@/utils/validators/crypto-schemas';
import { formatUSDTAmount } from '@/utils/formatters/currency-formatter';
import { calculateYield } from '@/utils/helpers/yield-helpers';
import { auditFinancialOperation } from '@/utils/decorators/audit-decorators';

// Clean, reusable code
@auditFinancialOperation('DEPOSIT_CREATION')
async createDeposit(data: DepositData) {
  const amount = formatUSDTAmount(data.amount);
  const yield = calculateYield(data.amount, data.rate, data.period);
  return { amount, expectedYield: yield };
}
```

## 5. Complete API Documentation

### 5.1 Authentication APIs

#### POST /api/v1/auth/register

**Purpose**: Register new user with email verification  
**Access**: Public  
**Usage**: User onboarding for all roles

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "DEPOSITOR"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Registration successful. OTP sent to email.",
  "data": {
    "userId": "usr_12345",
    "registrationId": "reg_xyz789",
    "otpExpiresIn": 300
  }
}
```

#### POST /api/v1/auth/verify-email

**Purpose**: Verify email with OTP to activate account  
**Access**: Public  
**Usage**: Complete registration process

**Request:**

```json
{
  "registrationId": "reg_xyz789",
  "otp": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "user": {
      "userId": "usr_12345",
      "email": "user@example.com",
      "role": "DEPOSITOR",
      "status": "ACTIVE"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST /api/v1/auth/login

**Purpose**: Initiate login with email and password  
**Access**: Public  
**Usage**: User authentication

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login OTP sent to email",
  "data": {
    "loginRequestId": "login_req_456",
    "otpExpiresIn": 300,
    "requiresOTP": true
  }
}
```

#### POST /api/v1/auth/verify-login

**Purpose**: Complete login with OTP verification  
**Access**: Public  
**Usage**: Multi-factor authentication

**Request:**

```json
{
  "loginRequestId": "login_req_456",
  "otp": "123456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": "usr_12345",
      "email": "user@example.com",
      "role": "DEPOSITOR",
      "traderId": null,
      "permissions": ["view_own_deposits", "create_deposit", "add_wallet"]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 5.2 Wallet Management APIs

#### GET /api/v1/wallets

**Purpose**: Get user's associated wallets  
**Access**: Depositor (own wallets)  
**Usage**: Wallet management dashboard

**Response:**

```json
{
  "success": true,
  "data": {
    "wallets": [
      {
        "walletId": "wallet_abc123",
        "address": "0x742d35Cc6634C0532925a3b8D5c9d88",
        "network": "BINANCE_SMART_CHAIN",
        "currency": "USDT",
        "status": "VERIFIED",
        "isDefault": true,
        "balance": 1500.5,
        "createdAt": "2025-01-15T09:00:00Z"
      }
    ],
    "totalWallets": 1
  }
}
```

#### POST /api/v1/wallets

**Purpose**: Associate new wallet with user account  
**Access**: Depositor only  
**Usage**: Add payment wallet for deposits

**Request:**

```json
{
  "address": "0x742d35Cc6634C0532925a3b8D5c9d88",
  "network": "BINANCE_SMART_CHAIN",
  "currency": "USDT",
  "isDefault": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Wallet associated successfully",
  "data": {
    "walletId": "wallet_abc123",
    "address": "0x742d35Cc6634C0532925a3b8D5c9d88",
    "status": "PENDING_VERIFICATION",
    "verificationRequired": true
  }
}
```

#### DELETE /api/v1/wallets/{walletId}

**Purpose**: Remove wallet association  
**Access**: Depositor (own wallets)  
**Usage**: Wallet management

**Response:**

```json
{
  "success": true,
  "message": "Wallet removed successfully",
  "data": {
    "walletId": "wallet_abc123",
    "removedAt": "2025-01-15T10:30:00Z"
  }
}
```

### 5.3 Deposit Management APIs

#### GET /api/v1/deposits

**Purpose**: Get user's deposit history and status  
**Access**: Depositor (own deposits), Admin (all deposits)  
**Usage**: Deposit tracking dashboard

**Response:**

```json
{
  "success": true,
  "data": {
    "deposits": [
      {
        "depositId": "dep_12345",
        "amount": 1000.0,
        "currency": "USDT",
        "yieldRate": 12.5,
        "lockPeriod": 15,
        "status": "ACTIVE",
        "maturityDate": "2025-01-30T09:00:00Z",
        "currentYield": 45.2,
        "canWithdraw": false,
        "daysRemaining": 10,
        "createdAt": "2025-01-15T09:00:00Z"
      }
    ],
    "summary": {
      "totalDeposited": 5000.0,
      "totalYieldEarned": 156.75,
      "activeDeposits": 3,
      "maturedDeposits": 2
    }
  }
}
```

#### POST /api/v1/deposits

**Purpose**: Create new deposit record  
**Access**: Depositor only  
**Usage**: Initiate deposit process

**Request:**

```json
{
  "walletId": "wallet_abc123",
  "amount": 1000.0,
  "currency": "USDT",
  "transactionHash": "0x8b5c7d4e3f2a1b9c8d7e6f5a4b3c2d1e"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Deposit created successfully",
  "data": {
    "depositId": "dep_12345",
    "amount": 1000.0,
    "yieldRate": 12.5,
    "lockPeriod": 15,
    "maturityDate": "2025-01-30T09:00:00Z",
    "status": "PENDING_VERIFICATION"
  }
}
```

### 5.4 Trade Management APIs

#### GET /api/v1/trades/requests

**Purpose**: Get trade fund requests  
**Access**: Trader (own requests), Admin (all requests)  
**Usage**: Trade request management

**Response:**

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "tradeId": "trade_67890",
        "requestedAmount": 5000.0,
        "status": "APPROVED",
        "requestDate": "2025-01-15T09:00:00Z",
        "approvedBy": "admin_12345",
        "approvedAt": "2025-01-15T10:00:00Z",
        "transferredAt": "2025-01-15T10:30:00Z",
        "returnDue": "2025-01-22T09:00:00Z",
        "currentReturn": null
      }
    ],
    "summary": {
      "openRequests": 2,
      "totalAllocated": 15000.0,
      "pendingReturns": 12000.0
    }
  }
}
```

#### POST /api/v1/trades/request

**Purpose**: Request trading funds  
**Access**: Trader only  
**Usage**: Fund allocation request

**Request:**

```json
{
  "amount": 5000.0,
  "purpose": "ARBITRAGE_TRADING",
  "expectedReturn": 5250.0,
  "duration": 7,
  "notes": "BTC/USDT arbitrage opportunity"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Fund request submitted successfully",
  "data": {
    "tradeId": "trade_67890",
    "requestedAmount": 5000.0,
    "status": "PENDING_APPROVAL",
    "requestDate": "2025-01-15T09:00:00Z"
  }
}
```

#### POST /api/v1/trades/{tradeId}/return

**Purpose**: Submit trade returns  
**Access**: Trader (own trades)  
**Usage**: Return submission after trading

**Request:**

```json
{
  "returnAmount": 5250.0,
  "transactionHash": "0x8b5c7d4e3f2a1b9c8d7e6f5a4b3c2d1e",
  "notes": "Successful arbitrage trade",
  "actualReturn": 250.0
}
```

**Response:**

```json
{
  "success": true,
  "message": "Trade return submitted successfully",
  "data": {
    "tradeId": "trade_67890",
    "returnAmount": 5250.0,
    "profit": 250.0,
    "roi": 5.0,
    "status": "RETURNED",
    "returnDate": "2025-01-20T14:30:00Z"
  }
}
```

### 5.5 Admin APIs

#### POST /api/v1/admin/traders

**Purpose**: Register new trader  
**Access**: Admin only  
**Usage**: Trader onboarding

**Request:**

```json
{
  "email": "trader@example.com",
  "firstName": "Trading",
  "lastName": "Expert",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D5c9d88",
  "maxConcurrentTrades": 3,
  "tradingLimit": 50000.0
}
```

**Response:**

```json
{
  "success": true,
  "message": "Trader registered successfully",
  "data": {
    "traderId": "trader_99999",
    "userId": "usr_99999",
    "email": "trader@example.com",
    "maxConcurrentTrades": 3,
    "tradingLimit": 50000.0,
    "status": "ACTIVE"
  }
}
```

#### POST /api/v1/admin/trades/{tradeId}/approve

**Purpose**: Approve trade fund request  
**Access**: Admin only  
**Usage**: Trade approval workflow

**Request:**

```json
{
  "approved": true,
  "notes": "Approved for experienced trader",
  "adjustedAmount": 5000.0
}
```

**Response:**

```json
{
  "success": true,
  "message": "Trade request approved",
  "data": {
    "tradeId": "trade_67890",
    "approvedAmount": 5000.0,
    "status": "APPROVED",
    "transferInitiated": true,
    "expectedTransferTime": "2025-01-15T10:30:00Z"
  }
}
```

#### GET /api/v1/admin/dashboard

**Purpose**: Get platform overview and metrics  
**Access**: Admin only  
**Usage**: Administrative dashboard

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalDeposits": 250000.0,
      "totalAllocated": 150000.0,
      "totalYieldPaid": 12500.0,
      "activeTraders": 8,
      "activeDepositors": 45
    },
    "walletBalances": {
      "custodianWallet": 100000.0,
      "payoutWallet": 15000.0,
      "pendingTransfers": 5000.0
    },
    "recentActivity": [
      {
        "type": "DEPOSIT",
        "amount": 2000.0,
        "user": "user@example.com",
        "timestamp": "2025-01-15T14:30:00Z"
      }
    ]
  }
}
```

---

## 6. Database Schema

### 6.1 DynamoDB Table Design

#### 1. Users Table

**Table Name**: `yieldcycle-users`

**Primary Key Structure:**

- **Partition Key**: `userId` (String)

**Global Secondary Indexes (GSI):**

- **email-userId-idx**: Partition Key: `email`, Sort Key: `userId`
- **role-userId-idx**: Partition Key: `role`, Sort Key: `userId`

**Item Structure:**

```json
{
  "userId": "usr_12345",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "DEPOSITOR",
  "status": "ACTIVE",
  "passwordHash": "$2b$12$...",
  "traderId": null,
  "permissions": ["view_own_deposits", "create_deposit"],
  "emailVerified": true,
  "lastLogin": "2025-01-15T08:30:00Z",
  "createdAt": "2025-01-15T09:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

#### 2. Wallets Table

**Table Name**: `yieldcycle-wallets`

**Primary Key Structure:**

- **Partition Key**: `walletId` (String)

**Global Secondary Indexes (GSI):**

- **userId-walletId-idx**: Partition Key: `userId`, Sort Key: `walletId`
- **address-walletId-idx**: Partition Key: `address`, Sort Key: `walletId`

**Item Structure:**

```json
{
  "walletId": "wallet_abc123",
  "userId": "usr_12345",
  "address": "0x742d35Cc6634C0532925a3b8D5c9d88",
  "network": "BINANCE_SMART_CHAIN",
  "currency": "USDT",
  "status": "VERIFIED",
  "isDefault": true,
  "balance": 1500.5,
  "lastBalanceUpdate": "2025-01-15T10:00:00Z",
  "createdAt": "2025-01-15T09:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

#### 3. Deposits Table

**Table Name**: `yieldcycle-deposits`

**Primary Key Structure:**

- **Partition Key**: `depositId` (String)

**Global Secondary Indexes (GSI):**

- **userId-createdAt-idx**: Partition Key: `userId`, Sort Key: `createdAt`
- **status-maturityDate-idx**: Partition Key: `status`, Sort Key: `maturityDate`

**Item Structure:**

```json
{
  "depositId": "dep_12345",
  "userId": "usr_12345",
  "walletId": "wallet_abc123",
  "amount": 1000.0,
  "currency": "USDT",
  "yieldRate": 12.5,
  "lockPeriod": 15,
  "status": "ACTIVE",
  "maturityDate": "2025-01-30T09:00:00Z",
  "currentYield": 45.2,
  "transactionHash": "0x8b5c7d4e3f2a1b9c8d7e6f5a4b3c2d1e",
  "verifiedAt": "2025-01-15T10:00:00Z",
  "createdAt": "2025-01-15T09:00:00Z",
  "updatedAt": "2025-01-15T14:30:00Z"
}
```

#### 4. Trades Table

**Table Name**: `yieldcycle-trades`

**Primary Key Structure:**

- **Partition Key**: `tradeId` (String)

**Global Secondary Indexes (GSI):**

- **traderId-requestDate-idx**: Partition Key: `traderId`, Sort Key: `requestDate`
- **status-requestDate-idx**: Partition Key: `status`, Sort Key: `requestDate`

**Item Structure:**

```json
{
  "tradeId": "trade_67890",
  "traderId": "trader_99999",
  "userId": "usr_99999",
  "requestedAmount": 5000.0,
  "approvedAmount": 5000.0,
  "status": "APPROVED",
  "purpose": "ARBITRAGE_TRADING",
  "expectedReturn": 5250.0,
  "actualReturn": null,
  "returnAmount": null,
  "duration": 7,
  "requestDate": "2025-01-15T09:00:00Z",
  "approvedBy": "admin_12345",
  "approvedAt": "2025-01-15T10:00:00Z",
  "transferredAt": "2025-01-15T10:30:00Z",
  "returnDue": "2025-01-22T09:00:00Z",
  "returnSubmittedAt": null,
  "notes": "BTC/USDT arbitrage opportunity",
  "createdAt": "2025-01-15T09:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

#### 5. Traders Table

**Table Name**: `yieldcycle-traders`

**Primary Key Structure:**

- **Partition Key**: `traderId` (String)

**Global Secondary Indexes (GSI):**

- **userId-traderId-idx**: Partition Key: `userId`, Sort Key: `traderId`
- **status-traderId-idx**: Partition Key: `status`, Sort Key: `traderId`

**Item Structure:**

```json
{
  "traderId": "trader_99999",
  "userId": "usr_99999",
  "email": "trader@example.com",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D5c9d88",
  "maxConcurrentTrades": 3,
  "currentOpenTrades": 2,
  "tradingLimit": 50000.0,
  "totalTraded": 125000.0,
  "totalReturns": 131250.0,
  "successRate": 85.5,
  "status": "ACTIVE",
  "registeredBy": "admin_12345",
  "createdAt": "2025-01-15T09:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

#### 6. Transactions Table

**Table Name**: `yieldcycle-transactions`

**Primary Key Structure:**

- **Partition Key**: `transactionId` (String)

**Global Secondary Indexes (GSI):**

- **depositId-createdAt-idx**: Partition Key: `depositId`, Sort Key: `createdAt`
- **hash-transactionId-idx**: Partition Key: `hash`, Sort Key: `transactionId`

**Item Structure:**

```json
{
  "transactionId": "txn_11111",
  "depositId": "dep_12345",
  "tradeId": null,
  "hash": "0x8b5c7d4e3f2a1b9c8d7e6f5a4b3c2d1e",
  "type": "DEPOSIT",
  "amount": 1000.0,
  "currency": "USDT",
  "fromAddress": "0x742d35Cc6634C0532925a3b8D5c9d88",
  "toAddress": "0x123456789abcdef123456789abcdef12",
  "status": "CONFIRMED",
  "blockNumber": 12345678,
  "gasUsed": 21000,
  "gasFee": 0.01,
  "confirmations": 12,
  "verifiedAt": "2025-01-15T10:00:00Z",
  "createdAt": "2025-01-15T09:30:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

#### 7. OTP Requests Table

**Table Name**: `yieldcycle-otp`

**Primary Key Structure:**

- **Partition Key**: `otpId` (String)

**Global Secondary Indexes (GSI):**

- **email-createdAt-idx**: Partition Key: `email`, Sort Key: `createdAt`

**Item Structure:**

```json
{
  "otpId": "otp_22222",
  "email": "user@example.com",
  "type": "LOGIN",
  "code": "123456",
  "status": "PENDING",
  "attempts": 0,
  "maxAttempts": 3,
  "expiresAt": "2025-01-15T10:05:00Z",
  "verifiedAt": null,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z"
}
```

---

## 7. Core Use Cases

### 7.1 Depositor User Flow

#### Registration & Wallet Setup

1. **Account Creation**: User registers with email and password
2. **Email Verification**: OTP sent to email for account activation
3. **Wallet Association**: User adds Binance USDT wallet address
4. **Wallet Verification**: System validates wallet ownership and uniqueness

#### Deposit Process

1. **Deposit Initiation**: User creates deposit record with amount
2. **Fund Transfer**: User transfers USDT to custodian wallet
3. **Transaction Submission**: User submits blockchain transaction hash
4. **Verification**: System validates transaction on Binance Smart Chain
5. **Deposit Activation**: Deposit becomes active with yield calculation

#### Yield & Withdrawal

1. **Yield Accrual**: Daily yield calculation based on deposit amount
2. **Lock Period**: 15-day minimum lock-in period tracking
3. **Withdrawal Request**: User requests principal + yield withdrawal
4. **Payout Processing**: Funds transferred from payout wallet

### 7.2 Trader User Flow

#### Registration & Onboarding

1. **Admin Registration**: Admin creates trader account with wallet
2. **Credential Setup**: Trader receives login credentials via email
3. **Profile Completion**: Trader sets up trading preferences
4. **Limit Configuration**: Admin sets concurrent trade limits

#### Trading Operations

1. **Fund Request**: Trader requests trading capital with purpose
2. **Admin Review**: Admin evaluates and approves/rejects request
3. **Fund Transfer**: Approved amount transferred to trader wallet
4. **Trading Execution**: Trader performs trading operations
5. **Return Submission**: Trader submits returns to payout wallet
6. **Performance Tracking**: System records ROI and success metrics

#### Limitations & Controls

- **Concurrent Limit**: Maximum Y open trade requests at any time
- **Trading Limit**: Maximum total allocation per trader
- **Return Requirement**: Must submit returns before new requests
- **Performance Monitoring**: Admin tracks individual trader success

### 7.3 Admin User Flow

#### Platform Oversight

1. **Dashboard Monitoring**: Real-time platform metrics and balances
2. **User Management**: View all depositors and their activities
3. **Trader Management**: Register, monitor, and manage traders
4. **Financial Control**: Monitor custodian and payout wallet balances

#### Trade Management

1. **Request Review**: Evaluate trader fund requests
2. **Risk Assessment**: Analyze trader history and performance
3. **Approval/Rejection**: Make funding decisions with notes
4. **Return Monitoring**: Track trade returns and performance
5. **Risk Management**: Adjust trader limits based on performance

#### Financial Operations

1. **Wallet Management**: Monitor all platform wallet balances
2. **Yield Configuration**: Set and adjust yield rates
3. **Payout Management**: Oversee withdrawal processing
4. **Analytics & Reporting**: Generate platform performance reports

### 7.4 Data Privacy & Security

#### User Data Isolation

```
DEPOSITOR - user1@example.com:
├── Personal Data: Own profile and settings only
├── Wallets: Only own associated wallets
├── Deposits: Only own deposit history and yields
├── Transactions: Only own transaction records
└── Restrictions: Cannot view other users' data

TRADER - trader1@example.com:
├── Personal Data: Own profile and trading settings
├── Trade Requests: Only own fund requests and returns
├── Performance: Only own trading metrics
├── Wallet: Only assigned trading wallet
└── Restrictions: Cannot view depositor data or other traders

ADMIN - admin@example.com:
├── Full Access: All platform data and operations
├── User Management: All user accounts and activities
├── Financial Data: All deposits, trades, and transactions
├── Analytics: Complete platform performance metrics
└── Controls: All administrative functions
```

---

## 8. Implementation Phases

### 8.1 Phase 1: Foundation (Weeks 1-2)

#### Backend Setup & Core Infrastructure

```bash
# Project initialization
mkdir backend
cd backend
npm init -y

# Core dependencies
npm install express typescript ts-node @types/node @types/express
npm install jsonwebtoken bcryptjs zod aws-sdk
npm install nodemailer crypto ethers
npm install -D nodemon @types/jsonwebtoken @types/bcryptjs

# Project structure creation
mkdir -p src/{api/v1,controllers,services,repositories,models,core,utils}
mkdir -p tests/{controllers,services,repositories}
mkdir -p deployment scripts
```

**Key Features:**

- Express.js server setup with TypeScript
- DynamoDB connection and configuration
- JWT authentication system
- Email service integration
- Basic error handling and logging

### 8.2 Phase 2: Authentication & User Management (Weeks 3-4)

#### User Registration & Authentication

1. **Email-based Registration**: Complete signup flow with OTP
2. **Multi-factor Authentication**: Login with email + password + OTP
3. **Role-based Access Control**: DEPOSITOR, TRADER, ADMIN permissions
4. **JWT Token Management**: Access and refresh token handling
5. **Password Management**: Secure hashing and reset functionality

**Key Components:**

- User registration with email verification
- OTP generation and validation
- Password security with bcrypt
- Role-based middleware
- Session management

### 8.3 Phase 3: Wallet & Deposit Management (Weeks 5-6)

#### Depositor Features

1. **Wallet Association**: Binance USDT wallet integration
2. **Wallet Validation**: Address verification and uniqueness checks
3. **Deposit Creation**: Deposit record creation and tracking
4. **Transaction Verification**: Blockchain transaction validation
5. **Yield Calculation**: Automated yield computation and tracking

**Key Components:**

- Binance API integration
- Blockchain transaction verification
- Deposit status tracking
- Yield calculation engine
- Lock period management

### 8.4 Phase 4: Trading Operations (Weeks 7-8)

#### Trader & Trade Management

1. **Trader Registration**: Admin-controlled trader onboarding
2. **Fund Request System**: Trader capital request workflow
3. **Trade Approval**: Admin approval/rejection system
4. **Return Processing**: Trade return submission and validation
5. **Performance Tracking**: ROI and success rate monitoring

**Key Components:**

- Trade request workflow
- Admin approval system
- Fund transfer automation
- Return validation
- Performance analytics

### 8.5 Phase 5: Admin Dashboard & Analytics (Weeks 9-10)

#### Administrative Features

1. **Platform Overview**: Real-time dashboard with key metrics
2. **User Management**: Complete user and trader administration
3. **Financial Control**: Wallet balance monitoring and management
4. **Analytics Engine**: Performance reporting and insights
5. **Risk Management**: Trader limit and performance controls

### 8.6 Phase 6: Testing & Deployment (Weeks 11-12)

#### Quality Assurance & Production Deployment

1. **Comprehensive Testing**: Unit, integration, and E2E tests
2. **Security Auditing**: Security review and penetration testing
3. **Performance Optimization**: Load testing and optimization
4. **AWS App Runner Deployment**: Production deployment setup
5. **Monitoring & Alerting**: CloudWatch integration and alerts

---

## 9. Production-Ready Development Guidelines

### 9.1 Code Quality Standards

**TypeScript Configuration:**

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**ESLint Configuration:**

```javascript
// eslint.config.js
module.exports = {
  parser: "@typescript-eslint/parser",
  extends: ["eslint:recommended", "@typescript-eslint/recommended", "prettier"],
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
  },
  env: {
    node: true,
    es2022: true,
  },
};
```

### 9.2 Security Best Practices

**Environment Configuration:**

```typescript
// Core security configuration
export const securityConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-secret-key",
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    algorithm: "HS256" as const,
  },
  bcrypt: {
    saltRounds: 12,
  },
  otp: {
    length: 6,
    expiry: 300, // 5 minutes
    maxAttempts: 3,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: true,
  },
};
```

**Input Validation with Zod:**

```typescript
import { z } from "zod";

export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: z.enum(["DEPOSITOR", "TRADER", "ADMIN"]),
});

export const WalletAddressSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  network: z.enum(["BINANCE_SMART_CHAIN"]),
  currency: z.enum(["USDT"]),
});

export const DepositSchema = z.object({
  amount: z.number().positive().max(1000000),
  walletId: z.string().uuid(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});
```

### 9.3 Database Optimization

**Repository Pattern Implementation:**

```typescript
export abstract class BaseRepository<T> {
  protected tableName: string;
  protected dynamodb: AWS.DynamoDB.DocumentClient;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.dynamodb = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  protected async queryWithPagination(
    params: AWS.DynamoDB.DocumentClient.QueryInput,
    limit = 50
  ): Promise<PaginatedResult<T>> {
    const result = await this.dynamodb
      .query({
        ...params,
        Limit: limit,
      })
      .promise();

    return {
      items: result.Items as T[],
      lastEvaluatedKey: result.LastEvaluatedKey,
      hasMore: !!result.LastEvaluatedKey,
      count: result.Count || 0,
    };
  }

  protected async batchWrite(items: T[]): Promise<void> {
    const chunks = this.chunkArray(items, 25); // DynamoDB batch limit

    for (const chunk of chunks) {
      const putRequests = chunk.map((item) => ({
        PutRequest: { Item: item },
      }));

      await this.dynamodb
        .batchWrite({
          RequestItems: {
            [this.tableName]: putRequests,
          },
        })
        .promise();
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### 9.4 Error Handling & Logging

**Custom Exception Classes:**

```typescript
export class YieldCycleError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = "INTERNAL_ERROR",
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends YieldCycleError {
  constructor(message: string, field?: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends YieldCycleError {
  constructor(message: string = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends YieldCycleError {
  constructor(message: string = "Access denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
    this.name = "AuthorizationError";
  }
}

export class WalletError extends YieldCycleError {
  constructor(message: string) {
    super(message, 422, "WALLET_ERROR");
    this.name = "WalletError";
  }
}

export class TransactionError extends YieldCycleError {
  constructor(message: string) {
    super(message, 422, "TRANSACTION_ERROR");
    this.name = "TransactionError";
  }
}
```

**Structured Logging:**

```typescript
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        service: "yieldcycle-api",
        environment: process.env.NODE_ENV || "development",
        ...meta,
      });
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});

// Audit logging for sensitive operations
export const auditLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: "logs/audit.log",
    }),
  ],
});
```

### 9.5 Testing Strategy

**Jest Configuration:**

```javascript
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.(test|spec).ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/tests/**/*",
    "!src/**/*.interface.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 10000,
};
```

**Test Categories:**

1. **Unit Tests**: Services, repositories, utilities (80% coverage)
2. **Integration Tests**: API endpoints with database operations
3. **E2E Tests**: Complete user workflows and business processes
4. **Security Tests**: Authentication, authorization, input validation
5. **Performance Tests**: Load testing and response time validation

### 9.6 Monitoring & Observability

**Health Check Implementation:**

```typescript
export class HealthCheckService {
  async checkDatabase(): Promise<HealthStatus> {
    try {
      await dynamodb
        .describeTable({
          TableName: "yieldcycle-users",
        })
        .promise();

      return { status: "healthy", responseTime: Date.now() };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        responseTime: Date.now(),
      };
    }
  }

  async checkBinanceAPI(): Promise<HealthStatus> {
    try {
      // Check Binance API connectivity
      const response = await fetch("https://api.binance.com/api/v3/ping");
      if (response.ok) {
        return { status: "healthy", responseTime: Date.now() };
      }
      throw new Error("Binance API not responding");
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        responseTime: Date.now(),
      };
    }
  }

  async getOverallHealth(): Promise<OverallHealth> {
    const [database, binance] = await Promise.all([
      this.checkDatabase(),
      this.checkBinanceAPI(),
    ]);

    const isHealthy =
      database.status === "healthy" && binance.status === "healthy";

    return {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database,
        binance,
      },
    };
  }
}
```

---

## 10. Reusable LLM Implementation Prompt

Copy and paste this prompt before any code implementation request:

```
You are implementing code for the YieldCycle crypto yield platform. Please follow these guidelines:

PROJECT CONTEXT:
- Cryptocurrency yield platform with depositor/trader/admin roles
- Email-based authentication with OTP verification
- USDT-only operations on Binance Smart Chain
- Multi-tenant architecture with strict role-based access control
- Real-time deposit/withdrawal tracking with yield calculations
- Node.js 18+ backend with TypeScript, Express.js, DynamoDB, AWS App Runner

MANDATORY REFERENCES (FOLLOW EXACTLY):
- Project Structure: Use the exact folder structure defined in section 4.1
- API Endpoints: Follow exact API patterns, request/response formats from section 5
- DynamoDB Schema: Use exact table structures, indexes, item formats from section 6
- Database Queries: Follow query patterns and index usage from section 6.1
- Authentication Flow: Implement exact email + OTP flow from section 5.1
- Entity Relationships: Follow exact data model and access rules from section 2

ARCHITECTURE PATTERNS:
- Follow MVC pattern: Routes → Controllers → Services → Repositories
- Use dependency injection for all services and repositories
- Implement proper class-based structure with clear separation of concerns
- Use Zod schemas for request/response validation
- Follow single responsibility principle

ROLE-BASED ACCESS CONTROL:
- DEPOSITOR: Own wallets, deposits, transactions only
- TRADER: Own trade requests, returns, performance only
- ADMIN: Full platform access and management capabilities
- Implement strict data isolation between roles
- Validate permissions at both API and service levels

CRYPTO & FINANCIAL OPERATIONS:
- USDT operations on Binance Smart Chain only
- Wallet address validation and uniqueness enforcement
- Transaction hash verification and blockchain confirmation
- Yield calculation based on configurable rates
- 15-day minimum lock-in period for deposits
- Automated fund transfers between custodian/payout wallets

CODE QUALITY STANDARDS:
- Use TypeScript with strict type checking throughout
- Follow TypeScript naming: PascalCase for classes, camelCase for methods
- Maximum line length: 80 characters (Prettier formatting)
- Use single quotes for strings
- Implement comprehensive JSDoc comments
- Use absolute imports, avoid circular dependencies

ERROR HANDLING & VALIDATION:
- Implement centralized error handling with custom exception classes
- Map errors to appropriate HTTP status codes (400, 401, 403, 404, 422, 500)
- Use consistent error response format across all APIs
- Implement proper input validation with meaningful error messages
- Log all errors with appropriate severity levels

SECURITY REQUIREMENTS:
- Email + Password + OTP multi-factor authentication
- Secure password hashing with bcrypt (12 rounds)
- JWT tokens with proper expiration and refresh
- Input validation and sanitization for all endpoints
- Rate limiting on authentication endpoints
- Audit logging for all financial operations

DATABASE & DATA ACCESS:
- Use simplified DynamoDB schema with direct attribute names
- Implement proper repository interfaces with dependency injection
- Use appropriate indexes for efficient queries
- Implement proper pagination for large datasets
- Use batch operations where possible for performance

BINANCE INTEGRATION:
- Wallet address validation against Binance Smart Chain
- Transaction verification using blockchain APIs
- Balance checking and transfer operations
- Network fee calculation and handling
- Error handling for blockchain operations

TESTING REQUIREMENTS:
- Implement comprehensive unit tests for all business logic
- Use Jest framework with proper mocking
- Maintain minimum 80% code coverage
- Use descriptive test names explaining scenarios
- Mock external dependencies (Binance API, email service)

LOGGING & MONITORING:
- Use structured logging with consistent format
- Include correlation IDs for request tracing
- Implement audit logging for financial operations
- Use appropriate log levels (DEBUG, INFO, WARNING, ERROR)
- Monitor API performance and error rates

PERFORMANCE & SCALABILITY:
- Use async/await for all I/O operations
- Optimize database queries and indexes
- Implement proper caching strategies
- Design for horizontal scaling with App Runner

FINANCIAL COMPLIANCE:
- Maintain complete audit trails for all transactions
- Implement proper transaction status tracking
- Record all fund movements with timestamps
- Ensure data integrity for financial operations

API DESIGN:
- Follow RESTful conventions
- Use consistent request/response formats
- Implement proper pagination and filtering
- Use appropriate HTTP methods and status codes
- Include comprehensive request/response examples

IMPLEMENTATION CHECKLIST:
□ Follow established patterns and conventions
□ Implement proper error handling and validation
□ Use centralized configuration and constants
□ Maintain role-based access control and data isolation
□ Follow API documentation format for consistency
□ Implement proper logging and audit trails
□ Ensure all code is production-ready with testing
□ Use TypeScript types and proper documentation
□ Follow security best practices for financial data
□ Optimize for performance and scalability
□ Implement proper crypto/blockchain integrations

Please implement the requested changes following these guidelines. Focus on the specific implementation requested while maintaining consistency with the established architecture and security requirements.
```

**Usage**: Copy this prompt and add your specific request at the end, such as:

- "Create the deposit service with yield calculation logic"
- "Implement the trader fund request workflow"
- "Add wallet validation and Binance integration"
- "Create the admin dashboard with platform metrics"

This comprehensive technical specification provides a complete foundation for building the YieldCycle platform with proper user management, financial operations, role-based access control, and crypto integration using Node.js, Express.js, TypeScript, and AWS services.
