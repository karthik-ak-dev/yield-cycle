import { WithdrawalStatusType } from '../config/constants';

// Withdrawal model interface
export interface Withdrawal {
  withdrawalId: string;     // Primary Key (UUID)
  userId: string;           // User making the withdrawal
  amount: number;           // Withdrawal amount in USDT
  feeAmount: number;        // Fee charged (5% of amount)
  netAmount: number;        // Amount after fee (amount - feeAmount)
  toAddress: string;        // User's wallet address for transfer
  transactionHash?: string; // Blockchain transaction hash
  status: WithdrawalStatusType; // Withdrawal status
  requestedAt: string;      // ISO timestamp when withdrawal was requested
  processedAt?: string;     // ISO timestamp when withdrawal was processed
  createdAt: string;        // ISO timestamp when record was created
  updatedAt: string;        // ISO timestamp when record was last updated
}

// Withdrawal creation input
export interface CreateWithdrawalInput {
  userId: string;
  amount: number;
  toAddress: string;
}

// Withdrawal response
export interface WithdrawalResponse {
  withdrawalId: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  status: WithdrawalStatusType;
  requestedAt: string;
  processedAt?: string;
  transactionHash?: string;
}

// Withdrawal validation result
export interface WithdrawalValidation {
  isValid: boolean;
  errors: string[];
  availableBalance?: number;
  minAmount?: number;
  maxAmount?: number;
} 