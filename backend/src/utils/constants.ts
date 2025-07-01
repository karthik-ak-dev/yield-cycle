/**
 * Application Constants
 * 
 * Purpose:
 * - Centralized constants for the Yield Cycle platform
 * - Business rule constants
 * - Error messages and status codes
 * - Configuration values
 * - Static values used across the application
 */

/**
 * Business Rules Constants
 */
export const BUSINESS_RULES = {
  // Investment Terms
  MONTHLY_RETURN_RATE: 0.08,        // 8% monthly return
  TOTAL_RETURN_CAP: 2.0,            // 200% total return cap
  INVESTMENT_TENURE_MONTHS: 25,     // 25 months investment period
  
  // Commission Structure (MLM 5-levels)
  COMMISSION_RATES: [0.10, 0.05, 0.03, 0.01, 0.01], // 10%, 5%, 3%, 1%, 1%
  MAX_COMMISSION_LEVELS: 5,
  
  // Deposit Limits
  MIN_DEPOSIT_AMOUNT: 100,          // Minimum 100 USDT
  MAX_DEPOSIT_AMOUNT: 50000,        // Maximum 50,000 USDT
  DEFAULT_USER_DEPOSIT_LIMIT: 10000, // Default limit per user
  
  // Referral Code
  REFERRAL_CODE_LENGTH: 8,          // 8-character referral codes
  
  // Blockchain
  BSC_CONFIRMATION_BLOCKS: 12,      // BSC confirmation requirement
  USDT_DECIMALS: 18,               // USDT token decimals
} as const;

/**
 * Authentication Constants
 */
export const AUTH = {
  // JWT Configuration
  ACCESS_TOKEN_EXPIRY: '15m',       // 15 minutes
  REFRESH_TOKEN_EXPIRY: '7d',       // 7 days
  JWT_ALGORITHM: 'HS256',
  
  // OTP Configuration
  OTP_LENGTH: 6,                    // 6-digit OTP
  OTP_EXPIRY_MINUTES: 5,           // 5 minutes OTP validity
  MAX_OTP_ATTEMPTS: 3,             // Maximum failed attempts
  
  // Password Requirements
  MIN_PASSWORD_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  
  // Session Management
  MAX_SESSIONS_PER_USER: 5,        // Maximum concurrent sessions
  SESSION_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
} as const;

/**
 * Rate Limiting Constants
 */
export const RATE_LIMITS = {
  // General API limits
  GENERAL_REQUESTS_PER_15_MIN: 100,
  
  // Authentication specific
  LOGIN_ATTEMPTS_PER_15_MIN: 5,
  OTP_REQUESTS_PER_MINUTE: 3,
  REGISTRATION_ATTEMPTS_PER_HOUR: 3,
  
  // Platform operations
  DEPOSIT_SYNC_PER_MINUTE: 3,
  WITHDRAWAL_REQUESTS_PER_5_MIN: 5,
  PASSWORD_RESET_PER_HOUR: 2,
  
  // Admin operations
  ADMIN_ACTIONS_PER_MINUTE: 20,
} as const;

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  // Authentication Errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_SUSPENDED: 'Account has been suspended',
  EMAIL_NOT_VERIFIED: 'Email address not verified',
  SESSION_EXPIRED: 'Session has expired, please login again',
  INVALID_TOKEN: 'Invalid or expired token',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  
  // OTP Errors
  INVALID_OTP: 'Invalid or expired OTP',
  OTP_MAX_ATTEMPTS: 'Maximum OTP attempts exceeded',
  OTP_ALREADY_USED: 'OTP has already been used',
  
  // Validation Errors
  INVALID_EMAIL: 'Invalid email address format',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_AMOUNT: 'Invalid amount specified',
  
  // Business Logic Errors
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  DEPOSIT_LIMIT_EXCEEDED: 'Deposit limit exceeded',
  EARNINGS_LIMIT_REACHED: 'Maximum earnings limit reached (200%)',
  INVALID_REFERRAL_CODE: 'Invalid referral code',
  
  // Blockchain Errors
  INVALID_TRANSACTION: 'Invalid blockchain transaction',
  TRANSACTION_NOT_CONFIRMED: 'Transaction not confirmed on blockchain',
  INVALID_WALLET_ADDRESS: 'Invalid wallet address format',
  
  // General Errors
  USER_NOT_FOUND: 'User not found',
  RESOURCE_NOT_FOUND: 'Resource not found',
  DUPLICATE_ENTRY: 'Resource already exists',
  INTERNAL_SERVER_ERROR: 'Internal server error occurred',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded, please try again later',
} as const;

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTRATION_SUCCESS: 'Registration successful',
  EMAIL_VERIFIED: 'Email verified successfully',
  
  // OTP
  OTP_SENT: 'OTP sent to your email address',
  OTP_VERIFIED: 'OTP verified successfully',
  
  // Profile
  PROFILE_UPDATED: 'Profile updated successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  
  // Deposits
  DEPOSIT_PROCESSED: 'Deposit processed successfully',
  DEPOSITS_SYNCED: 'Deposits synchronized successfully',
  
  // Withdrawals
  WITHDRAWAL_REQUESTED: 'Withdrawal request submitted',
  WITHDRAWAL_APPROVED: 'Withdrawal approved and processed',
  
  // General
  OPERATION_SUCCESS: 'Operation completed successfully',
} as const;

/**
 * Database Table Names
 */
export const TABLES = {
  USERS: 'YieldCycle-Users',
  DEPOSITS: 'YieldCycle-Deposits',
  WALLET_POCKETS: 'YieldCycle-WalletPockets',
  WALLET_TRANSACTIONS: 'YieldCycle-WalletTransactions',
  REFERRAL_NETWORK: 'YieldCycle-ReferralNetwork',
  COMMISSION_DISTRIBUTIONS: 'YieldCycle-CommissionDistributions',
  COMMISSION_ALLOCATIONS: 'YieldCycle-CommissionAllocations',
  MONTHLY_INCOME: 'YieldCycle-MonthlyIncome',
  OTP: 'YieldCycle-OTP',
  SESSIONS: 'YieldCycle-Sessions',
  AUDIT_LOGS: 'YieldCycle-AuditLogs',
} as const;

/**
 * API Response Status Codes
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Cache Keys and TTL
 */
export const CACHE = {
  // Cache Key Prefixes
  USER_PROFILE: 'user:profile:',
  WALLET_BALANCE: 'wallet:balance:',
  TEAM_STATS: 'team:stats:',
  DEPOSIT_LIMITS: 'deposit:limits:',
  COMMISSION_RATES: 'commission:rates',
  
  // TTL Values (in seconds)
  TTL: {
    USER_PROFILE: 300,      // 5 minutes
    WALLET_BALANCE: 60,     // 1 minute
    TEAM_STATS: 900,        // 15 minutes
    DEPOSIT_LIMITS: 1800,   // 30 minutes
    COMMISSION_RATES: 3600, // 1 hour
    SHORT: 60,              // 1 minute
    MEDIUM: 300,            // 5 minutes
    LONG: 3600,             // 1 hour
  },
} as const;

/**
 * Email Templates
 */
export const EMAIL_TEMPLATES = {
  OTP_VERIFICATION: 'otp-verification',
  WELCOME: 'welcome',
  DEPOSIT_CONFIRMATION: 'deposit-confirmation',
  MONTHLY_INCOME: 'monthly-income',
  COMMISSION_EARNED: 'commission-earned',
  WITHDRAWAL_APPROVED: 'withdrawal-approved',
  ACCOUNT_SUSPENDED: 'account-suspended',
} as const;

/**
 * Blockchain Constants
 */
export const BLOCKCHAIN = {
  // BSC Network
  BSC_CHAIN_ID: 56,
  BSC_TESTNET_CHAIN_ID: 97,
  
  // Gas Settings
  DEFAULT_GAS_LIMIT: 21000,
  USDT_TRANSFER_GAS_LIMIT: 65000,
  GAS_PRICE_MULTIPLIER: 1.1, // 10% buffer
  
  // HD Wallet Derivation
  DERIVATION_PATH: "m/44'/60'/0'/0/",
  MAX_WALLET_INDEX: 1000000,
  
  // Transaction Monitoring
  BLOCK_RANGE_LIMIT: 1000,    // Maximum blocks to scan at once
  RETRY_ATTEMPTS: 3,          // Retry failed requests
  RETRY_DELAY: 1000,          // 1 second delay between retries
} as const;

/**
 * Regular Expressions
 */
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  WALLET_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  REFERRAL_CODE: /^[A-Z0-9]{8}$/,
     PHONE_NUMBER: /^\+?[\d\s\-()]+$/,
  AMOUNT: /^\d+(\.\d{1,6})?$/,
} as const;

/**
 * Pagination Defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 5,
} as const;

/**
 * File Upload Limits
 */
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024,  // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  PROFILE_PICTURE: {
    MAX_SIZE: 2 * 1024 * 1024, // 2MB
    MAX_WIDTH: 800,
    MAX_HEIGHT: 800,
  },
} as const;

/**
 * Environment Configuration
 */
export const ENV = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

/**
 * Scheduled Job Intervals
 */
export const JOBS = {
  // Cron expressions
  MONTHLY_INCOME: '0 0 1 * *',      // 1st of every month at midnight
  COMMISSION_PROCESSING: '0 * * * *', // Every hour
  CACHE_CLEANUP: '0 */4 * * *',     // Every 4 hours
  AUDIT_LOG_ARCHIVE: '0 2 * * *',   // Daily at 2 AM
  SESSION_CLEANUP: '0 1 * * *',     // Daily at 1 AM
  
  // Intervals in milliseconds
  HEALTH_CHECK: 60000,              // 1 minute
  METRICS_COLLECTION: 300000,       // 5 minutes
} as const;

/**
 * Default Values
 */
export const DEFAULTS = {
  CURRENCY: 'USDT',
  TIMEZONE: 'UTC',
  LANGUAGE: 'en',
  PAGE_SIZE: 20,
  DECIMAL_PLACES: 2,
  
  // User defaults
  USER_STATUS: 'PENDING_VERIFICATION',
  USER_ROLE: 'DEPOSITOR',
  
  // Wallet defaults
  INITIAL_BALANCE: 0,
  
  // Deposit defaults
  TENURE_MONTHS: 25,
  MONTHLY_RETURN: 0.08,
} as const;
