/**
 * Application Enumerations
 * 
 * Purpose:
 * - Define all enum types used throughout the application
 * - Ensure type safety and consistency across the codebase
 * - Single source of truth for enum values
 */

// TODO: Needs to be removed later
/* eslint-disable */

/**
 * User roles in the yield cycle platform
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  DEPOSITOR = 'DEPOSITOR'
}

/**
 * User account status
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  EARNING_LIMIT_REACHED = 'EARNING_LIMIT_REACHED'
}

/**
 * Deposit status throughout its lifecycle
 */
export enum DepositStatus {
  PENDING = 'PENDING',     // Transaction not confirmed
  CONFIRMED = 'CONFIRMED', // Transaction confirmed
  ACTIVE = 'ACTIVE',       // Earning monthly returns (8%)
  DORMANT = 'DORMANT',     // Exceeds limits, no returns
  COMPLETED = 'COMPLETED',  // 25 months completed
  FAILED = 'FAILED'        // Transaction failed
}

/**
 * Wallet pocket types for 4-pocket system
 */
export enum PocketType {
  ACTIVE_DEPOSITS = 'ACTIVE_DEPOSITS', // Current active deposits earning 8% monthly
  INCOME = 'INCOME',                   // Monthly 8% earnings from active deposits
  COMMISSION = 'COMMISSION',           // Referral commission earnings
  TOTAL_EARNINGS = 'TOTAL_EARNINGS'    // Calculated: income + commission
}

/**
 * Transaction types for wallet operations
 */
export enum TransactionType {
  ACTIVE_DEPOSIT_CREDIT = 'ACTIVE_DEPOSIT_CREDIT', // Active deposit added
  ACTIVE_DEPOSIT_DEBIT = 'ACTIVE_DEPOSIT_DEBIT',   // Active deposit removed/expired
  MONTHLY_INCOME = 'MONTHLY_INCOME',               // 8% monthly income
  COMMISSION_L1 = 'COMMISSION_L1',                 // Level 1 commission (10%)
  COMMISSION_L2 = 'COMMISSION_L2',                 // Level 2 commission (5%)
  COMMISSION_L3 = 'COMMISSION_L3',                 // Level 3 commission (3%)
  COMMISSION_L4 = 'COMMISSION_L4',                 // Level 4 commission (1%)
  COMMISSION_L5 = 'COMMISSION_L5',                 // Level 5 commission (1%)
  WITHDRAWAL = 'WITHDRAWAL'                        // Withdrawal after 25 months
}

/**
 * Commission types for different earning categories
 */
export enum CommissionType {
  REFERRAL = 'REFERRAL',
  BONUS = 'BONUS',
  LEADERSHIP = 'LEADERSHIP'
}

/**
 * Commission distribution status
 */
export enum CommissionStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

/**
 * OTP types for different operations
 */
export enum OTPType {
  REGISTRATION = 'REGISTRATION',
  LOGIN = 'LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET'
}

/**
 * Session status for authentication
 */
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED'
}

/**
 * Transaction status for processing
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Audit event types for system monitoring
 */
export enum AuditEventType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  DEPOSIT = 'DEPOSIT',
  COMMISSION = 'COMMISSION',
  WITHDRAWAL = 'WITHDRAWAL',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SECURITY_EVENT = 'SECURITY_EVENT'
}
