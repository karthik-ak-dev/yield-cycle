import { DepositStatusType } from '../config/constants';

// Deposit model interface (one deposit per user)
export interface Deposit {
  userId: string;           // Primary Key (same as User.userId)
  amount: number;           // Fixed amount (1000 USDT)
  walletAddress: string;    // Generated BSC address for this user
  transactionHash?: string; // BSC transaction hash when deposit is made
  status: DepositStatusType; // Deposit status
  depositedAt?: string;     // ISO timestamp when transaction was initiated
  confirmedAt?: string;     // ISO timestamp when transaction was confirmed
  confirmations: number;    // Number of blockchain confirmations
  createdAt: string;        // ISO timestamp when deposit record was created
  updatedAt: string;        // ISO timestamp when record was last updated
}

// Deposit creation input
export interface CreateDepositInput {
  userId: string;
  walletAddress: string;
}

// Deposit sync input
export interface SyncDepositInput {
  userId: string;
  transactionHash?: string; // Optional if user provides tx hash
}

// Deposit response
export interface DepositResponse {
  userId: string;
  amount: number;
  walletAddress: string;
  transactionHash?: string;
  status: DepositStatusType;
  depositedAt?: string;
  confirmedAt?: string;
  confirmations: number;
  createdAt: string;
}

// Simple deposit info for user dashboard
export interface UserDepositInfo {
  hasDeposit: boolean;      // Whether user has made their deposit
  amount: number;           // Deposit amount (1000 if confirmed, 0 if not)
  status: DepositStatusType; // Current deposit status
  walletAddress: string;    // User's deposit address
} 