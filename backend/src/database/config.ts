/**
 * Database Configuration - Centralized DynamoDB Settings
 * 
 * Single source of truth for all database-related configuration.
 * Exports table names, connection settings, and DynamoDB client instance.
 */

/**
 * DynamoDB Table Configuration
 */
export const TABLE_NAMES = {
  USERS: process.env.USERS_TABLE || 'YieldCycle-Users',
  DEPOSITS: process.env.DEPOSITS_TABLE || 'YieldCycle-Deposits',
  WALLET_POCKETS: process.env.WALLET_POCKETS_TABLE || 'YieldCycle-WalletPockets',
  WALLET_TRANSACTIONS: process.env.WALLET_TRANSACTIONS_TABLE || 'YieldCycle-WalletTransactions',
  REFERRAL_NETWORK: process.env.REFERRAL_NETWORK_TABLE || 'YieldCycle-ReferralNetwork',
  COMMISSIONS: process.env.COMMISSIONS_TABLE || 'YieldCycle-Commissions',
  COMMISSION_DISTRIBUTIONS: process.env.COMMISSION_DISTRIBUTIONS_TABLE || 'YieldCycle-CommissionDistributions',
  COMMISSION_ALLOCATIONS: process.env.COMMISSION_ALLOCATIONS_TABLE || 'YieldCycle-CommissionAllocations',
  MONTHLY_INCOME: process.env.MONTHLY_INCOME_TABLE || 'YieldCycle-MonthlyIncome',
  OTP: process.env.OTP_TABLE || 'YieldCycle-OTP',
  SESSIONS: process.env.SESSIONS_TABLE || 'YieldCycle-Sessions',
  AUDIT_LOGS: process.env.AUDIT_LOGS_TABLE || 'YieldCycle-AuditLogs',
} as const;

/**
 * DynamoDB Configuration
 */
export const DB_CONFIG = {
  region: process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT, // For local development
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  maxRetries: 3,
  timeout: 5000,
} as const;

/**
 * Global Secondary Index Names
 */
export const GSI_NAMES = {
  // Users table indexes
  USERS_EMAIL_CREATED_AT: 'email-createdAt-gsi',
  USERS_REFERRAL_CODE_USER_ID: 'referralCode-userId-gsi',
  USERS_STATUS_CREATED_AT: 'status-createdAt-gsi',

  // Deposits table indexes
  DEPOSITS_USER_ID_CREATED_AT: 'userId-createdAt-gsi',
  DEPOSITS_STATUS_CREATED_AT: 'status-createdAt-gsi',
  DEPOSITS_ADDRESS_USER_ID: 'depositAddress-userId-gsi',

  // Wallet transactions indexes
  WALLET_TRANSACTIONS_USER_ID_CREATED_AT: 'userId-createdAt-gsi',
  WALLET_TRANSACTIONS_TYPE_CREATED_AT: 'type-createdAt-gsi',

  // Referral network indexes
  REFERRAL_PARENT_USER_ID_CREATED_AT: 'parentUserId-createdAt-gsi',
  REFERRAL_LEVEL_TEAM_VOLUME: 'level-teamVolume-gsi',

  // Commission indexes
  COMMISSIONS_USER_ID_CREATED_AT: 'userId-createdAt-gsi',
  COMMISSIONS_SOURCE_USER_ID_CREATED_AT: 'sourceUserId-createdAt-gsi',
  COMMISSIONS_STATUS_CREATED_AT: 'status-createdAt-gsi',
  COMMISSIONS_BATCH_ID_CREATED_AT: 'distributionBatchId-createdAt-gsi',
  
  // Commission distribution/allocation indexes
  COMMISSION_DISTRIBUTIONS_TRIGGER_USER_ID: 'triggerUserId-createdAt-gsi',
  COMMISSION_ALLOCATIONS_RECIPIENT_USER_ID: 'recipientUserId-createdAt-gsi',

  // Monthly income indexes
  MONTHLY_INCOME_USER_ID_MONTH: 'userId-month-gsi',

  // OTP indexes
  OTP_USER_ID_CREATED_AT: 'userId-createdAt-gsi',
  OTP_TYPE_CREATED_AT: 'type-createdAt-gsi',
  OTP_CODE_TYPE: 'code-type-gsi',

  // Sessions indexes
  SESSIONS_USER_ID_CREATED_AT: 'userId-createdAt-gsi',

  // Audit logs indexes
  AUDIT_LOGS_USER_ID_CREATED_AT: 'userId-createdAt-gsi',
  AUDIT_LOGS_EVENT_TYPE_CREATED_AT: 'eventType-createdAt-gsi',
  AUDIT_LOGS_RESOURCE_TYPE_RESOURCE_ID: 'resourceType-resourceId-gsi',
} as const;

/**
 * DynamoDB Operation Configuration
 */
export const DB_OPERATIONS = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  BATCH_WRITE_SIZE: 25, // DynamoDB batch write limit
  BATCH_GET_SIZE: 100,  // DynamoDB batch get limit
  DEFAULT_TIMEOUT: 5000,
  MAX_RETRIES: 3,
} as const;
