/**
 * Repository Layer Exports
 * 
 * Centralized exports for all repository classes to enable clean imports
 * throughout the application layers.
 * 
 * USAGE:
 * ```typescript
 * import { UserRepository, WalletPocketRepository, TransactionRepository } from '../repositories';
 * ```
 */

// Core entity repositories
export { UserRepository } from './UserRepository';
export { SessionRepository } from './SessionRepository';
export { OTPRepository } from './OTPRepository';
export { DepositRepository } from './DepositRepository';
export { MonthlyIncomeRepository } from './MonthlyIncomeRepository';
export { ReferralRepository } from './ReferralRepository';
export { CommissionRepository } from './CommissionRepository';
export { AuditRepository } from './AuditRepository';

// Wallet system repositories (split from original WalletRepository)
export { WalletPocketRepository } from './WalletPocketRepository';
export { TransactionRepository } from './TransactionRepository';

// Type exports for interfaces
export type { WalletBalanceSummary } from './WalletPocketRepository';
export type { PaginatedTransactionResult } from './TransactionRepository';
export type { 
  PaginatedMonthlyIncomeResult, 
  MonthlyIncomeDistributionSummary, 
  UserMonthlyIncomeSummary 
} from './MonthlyIncomeRepository';
export type { 
  PaginatedReferralResult, 
  TeamStatisticsSummary, 
  NetworkGenealogy, 
  TreeIntegrityResult 
} from './ReferralRepository';
export type { 
  PaginatedCommissionResult, 
  CommissionStatisticsSummary, 
  BulkCommissionData, 
  CommissionDistributionSummary, 
  UserCommissionSummary 
} from './CommissionRepository';
export type { 
  PaginatedAuditResult, 
  AuditStatisticsSummary, 
  UserActivitySummary, 
  SecurityEventSummary, 
  AuditFilterOptions 
} from './AuditRepository'; 