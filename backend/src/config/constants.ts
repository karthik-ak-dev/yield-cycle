// System-wide constants for Yield Cycle platform

// Investment Configuration
export const INVESTMENT_CONFIG = {
  DEPOSIT_AMOUNT: 1000, // Fixed deposit amount in USDT
  MONTHLY_EARNING: 50, // Monthly passive income in USDT
  EARNING_MONTHS: 60, // Number of months to receive earnings
  TOTAL_RETURN: 3000, // Total return amount (50 * 60)
  PRINCIPAL_RETURN_MONTH: 61, // Month when principal is returned
} as const;

// Commission Configuration
export const COMMISSION_CONFIG = {
  RATES: [0.10, 0.05, 0.03, 0.01, 0.01], // 5-level commission rates: 10%, 5%, 3%, 1%, 1%
  MAX_LEVELS: 5, // Maximum commission levels
  TOTAL_COMMISSION_RATE: 0.20, // Total commission rate (20%)
} as const;

// Blockchain Configuration
export const BLOCKCHAIN_CONFIG = {
  REQUIRED_CONFIRMATIONS: 12, // Required confirmations for USDT deposits
  USDT_DECIMALS: 18, // USDT token decimals on BSC
  MIN_DEPOSIT_AMOUNT: 999, // Minimum acceptable deposit (allow small variance)
  MAX_DEPOSIT_AMOUNT: 1001, // Maximum acceptable deposit (allow small variance)
} as const;

// Withdrawal Configuration
export const WITHDRAWAL_CONFIG = {
  MIN_WITHDRAWAL_AMOUNT: 20, // Minimum withdrawal in USDT
  WITHDRAWAL_FEE_RATE: 0.05, // 5% withdrawal fee
  PROCESSING_DAY: 10, // Monthly processing day (10th of each month)
  REFUND_TIME_LIMIT: 30, // Days to request refund
  REFUND_FEE_RATE: 0.30, // 30% refund fee
} as const;

// Deposit Status Types (only one that matters for MVP)
export const DEPOSIT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;

// Withdrawal Status Types (only one that matters for MVP)
export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// System Limits (MVP only)
export const SYSTEM_LIMITS = {
  MAX_REFERRAL_CODE_LENGTH: 10,
  MIN_REFERRAL_CODE_LENGTH: 6,
  MAX_EMAIL_LENGTH: 254,
  MAX_PASSWORD_LENGTH: 128,
} as const;

// Time Constants (in milliseconds)
export const TIME_CONSTANTS = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  ONE_YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

// API Response Messages
export const RESPONSE_MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Internal server error',
  DEPOSIT_ALREADY_EXISTS: 'User has already made a deposit',
  INVALID_REFERRAL_CODE: 'Invalid referral code',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  INVALID_CREDENTIALS: 'Invalid email or password',
  DEPOSIT_NOT_FOUND: 'No pending deposits found',
  INSUFFICIENT_CONFIRMATIONS: 'Transaction requires more confirmations',
} as const;

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  REFERRAL_CODE_REGEX: /^[A-Z0-9]{6,10}$/,
  WALLET_ADDRESS_REGEX: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH_REGEX: /^0x[a-fA-F0-9]{64}$/,
} as const;

// Export only MVP status types for type safety
export type DepositStatusType = typeof DEPOSIT_STATUS[keyof typeof DEPOSIT_STATUS];
export type WithdrawalStatusType = typeof WITHDRAWAL_STATUS[keyof typeof WITHDRAWAL_STATUS]; 