// Wallet model interface for HD wallet management
export interface Wallet {
  userId: string;           // Primary Key (same as User.userId)
  address: string;          // BSC wallet address
  privateKey: string;       // Encrypted private key
  derivationPath: string;   // HD wallet derivation path (e.g., "m/44'/60'/0'/0/123")
  derivationIndex: number;  // Index used for derivation
  createdAt: string;        // ISO timestamp
}

// Wallet creation input
export interface CreateWalletInput {
  userId: string;
  derivationIndex: number;
}

// Wallet response (without private key)
export interface WalletResponse {
  userId: string;
  address: string;
  derivationPath: string;
  createdAt: string;
}

// HD Wallet data for generation
export interface HDWalletData {
  address: string;
  privateKey: string;
  derivationPath: string;
  derivationIndex: number;
}

// Wallet balance information
export interface WalletBalance {
  address: string;
  usdtBalance: string;      // USDT balance as string to avoid precision issues
  bnbBalance: string;       // BNB balance for gas fees
  lastUpdated: string;
}

// Wallet transaction data
export interface WalletTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  blockNumber: number;
  timestamp: string;
  confirmations: number;
} 