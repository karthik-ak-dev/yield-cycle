/**
 * Blockchain Utility Functions
 * 
 * Purpose:
 * - Simple blockchain-related utility functions
 * - Address format validation and conversion
 * - USDT amount calculations and formatting
 * - Transaction hash utilities
 * - BSC network helpers
 * 
 * Note: This is NOT business logic - just pure utility functions
 * Business logic belongs in services (e.g., BlockchainService, WalletGenerationService)
 */

import { BLOCKCHAIN, BUSINESS_RULES } from './constants';

/**
 * Blockchain address utilities
 */
export class AddressUtils {
  /**
   * Validate Ethereum/BSC address format
   * 
   * @param address - Address to validate
   * @returns True if valid format
   */
  static isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  }

  /**
   * Normalize address to lowercase
   * 
   * @param address - Address to normalize
   * @returns Normalized address or null if invalid
   */
  static normalize(address: string): string | null {
    if (!this.isValidAddress(address)) return null;
    return address.trim().toLowerCase();
  }

  /**
   * Check if two addresses are the same
   * 
   * @param address1 - First address
   * @param address2 - Second address
   * @returns True if addresses are the same
   */
  static areEqual(address1: string, address2: string): boolean {
    const norm1 = this.normalize(address1);
    const norm2 = this.normalize(address2);
    return norm1 !== null && norm2 !== null && norm1 === norm2;
  }

  /**
   * Shorten address for display (0x1234...5678)
   * 
   * @param address - Address to shorten
   * @param startChars - Characters to show at start (default: 6)
   * @param endChars - Characters to show at end (default: 4)
   * @returns Shortened address
   */
  static shorten(address: string, startChars: number = 6, endChars: number = 4): string {
    if (!this.isValidAddress(address)) return '';
    
    const normalized = address.toLowerCase();
    if (normalized.length <= startChars + endChars) return normalized;
    
    return `${normalized.slice(0, startChars)}...${normalized.slice(-endChars)}`;
  }
}

/**
 * Transaction hash utilities
 */
export class TransactionUtils {
  /**
   * Validate transaction hash format
   * 
   * @param hash - Transaction hash to validate
   * @returns True if valid format
   */
  static isValidHash(hash: string): boolean {
    if (!hash || typeof hash !== 'string') return false;
    return /^0x[a-fA-F0-9]{64}$/.test(hash.trim());
  }

  /**
   * Normalize transaction hash to lowercase
   * 
   * @param hash - Hash to normalize
   * @returns Normalized hash or null if invalid
   */
  static normalize(hash: string): string | null {
    if (!this.isValidHash(hash)) return null;
    return hash.trim().toLowerCase();
  }

  /**
   * Shorten transaction hash for display
   * 
   * @param hash - Hash to shorten
   * @param startChars - Characters to show at start (default: 8)
   * @param endChars - Characters to show at end (default: 8)
   * @returns Shortened hash
   */
  static shorten(hash: string, startChars: number = 8, endChars: number = 8): string {
    if (!this.isValidHash(hash)) return '';
    
    const normalized = hash.toLowerCase();
    if (normalized.length <= startChars + endChars) return normalized;
    
    return `${normalized.slice(0, startChars)}...${normalized.slice(-endChars)}`;
  }

  /**
   * Generate BSC explorer URL for transaction
   * 
   * @param hash - Transaction hash
   * @param isTestnet - Whether to use testnet explorer (default: false)
   * @returns Explorer URL
   */
  static getExplorerUrl(hash: string, isTestnet: boolean = false): string {
    if (!this.isValidHash(hash)) return '';
    
    const baseUrl = isTestnet 
      ? 'https://testnet.bscscan.com'
      : 'https://bscscan.com';
    
    return `${baseUrl}/tx/${hash}`;
  }
}

/**
 * USDT amount utilities
 */
export class USDTUtils {
  /**
   * Convert Wei to USDT (handle 18 decimals)
   * 
   * @param weiAmount - Amount in Wei
   * @returns Amount in USDT
   */
  static fromWei(weiAmount: string | number): number {
    const wei = typeof weiAmount === 'string' ? weiAmount : weiAmount.toString();
    const divisor = Math.pow(10, BUSINESS_RULES.USDT_DECIMALS);
    return parseFloat(wei) / divisor;
  }

  /**
   * Convert USDT to Wei (handle 18 decimals)
   * 
   * @param usdtAmount - Amount in USDT
   * @returns Amount in Wei as string
   */
  static toWei(usdtAmount: number): string {
    const multiplier = Math.pow(10, BUSINESS_RULES.USDT_DECIMALS);
    const wei = Math.floor(usdtAmount * multiplier);
    return wei.toString();
  }

  /**
   * Format USDT amount for display
   * 
   * @param amount - USDT amount
   * @param decimals - Decimal places (default: 2)
   * @param includeSymbol - Include USDT symbol (default: true)
   * @returns Formatted amount string
   */
  static format(amount: number, decimals: number = 2, includeSymbol: boolean = true): string {
    const formatted = amount.toFixed(decimals);
    return includeSymbol ? `${formatted} USDT` : formatted;
  }

  /**
   * Validate USDT amount is within platform limits
   * 
   * @param amount - Amount to validate
   * @returns True if within limits
   */
  static isValidDepositAmount(amount: number): boolean {
    return amount >= BUSINESS_RULES.MIN_DEPOSIT_AMOUNT && 
           amount <= BUSINESS_RULES.MAX_DEPOSIT_AMOUNT;
  }

  /**
   * Round USDT amount to safe precision
   * 
   * @param amount - Amount to round
   * @param decimals - Decimal places (default: 6)
   * @returns Rounded amount
   */
  static round(amount: number, decimals: number = 6): number {
    const factor = Math.pow(10, decimals);
    return Math.round((amount + Number.EPSILON) * factor) / factor;
  }
}

/**
 * HD Wallet derivation utilities
 */
export class WalletUtils {
  /**
   * Generate HD wallet derivation path for user
   * 
   * @param index - Wallet index
   * @returns Derivation path string
   */
  static getDerivationPath(index: number): string {
    if (index < 0 || index > BLOCKCHAIN.MAX_WALLET_INDEX) {
      throw new Error(`Invalid wallet index: ${index}`);
    }
    return `${BLOCKCHAIN.DERIVATION_PATH}${index}`;
  }

  /**
   * Extract index from derivation path
   * 
   * @param path - Derivation path
   * @returns Wallet index or null if invalid
   */
  static extractIndex(path: string): number | null {
    const regex = new RegExp(`^${BLOCKCHAIN.DERIVATION_PATH.replace(/'/g, "\\'")}(\\d+)$`);
    const match = path.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Validate derivation path format
   * 
   * @param path - Path to validate
   * @returns True if valid
   */
  static isValidPath(path: string): boolean {
    const index = this.extractIndex(path);
    return index !== null && index >= 0 && index <= BLOCKCHAIN.MAX_WALLET_INDEX;
  }
}

/**
 * Gas calculation utilities
 */
export class GasUtils {
  /**
   * Calculate gas price with buffer
   * 
   * @param baseGasPrice - Base gas price in Gwei
   * @param multiplier - Price multiplier (default: from constants)
   * @returns Gas price with buffer
   */
  static calculateGasPrice(baseGasPrice: number, multiplier: number = BLOCKCHAIN.GAS_PRICE_MULTIPLIER): number {
    return Math.ceil(baseGasPrice * multiplier);
  }

  /**
   * Estimate gas cost in BNB
   * 
   * @param gasLimit - Gas limit
   * @param gasPriceGwei - Gas price in Gwei
   * @returns Estimated cost in BNB
   */
  static estimateCostBNB(gasLimit: number, gasPriceGwei: number): number {
    const gasCostWei = gasLimit * gasPriceGwei * 1e9; // Convert Gwei to Wei
    return gasCostWei / 1e18; // Convert Wei to BNB
  }

  /**
   * Get standard gas limits for different operations
   * 
   * @param operation - Operation type
   * @returns Gas limit
   */
  static getStandardGasLimit(operation: 'transfer' | 'usdt_transfer'): number {
    switch (operation) {
      case 'transfer':
        return BLOCKCHAIN.DEFAULT_GAS_LIMIT;
      case 'usdt_transfer':
        return BLOCKCHAIN.USDT_TRANSFER_GAS_LIMIT;
      default:
        return BLOCKCHAIN.DEFAULT_GAS_LIMIT;
    }
  }
}

/**
 * Block number utilities
 */
export class BlockUtils {
  /**
   * Calculate block range for scanning
   * 
   * @param startBlock - Start block number
   * @param endBlock - End block number (optional, defaults to current)
   * @returns Array of block ranges within limit
   */
  static calculateScanRanges(startBlock: number, endBlock?: number): Array<[number, number]> {
    const finalEndBlock = endBlock || startBlock + BLOCKCHAIN.BLOCK_RANGE_LIMIT;
    const ranges: Array<[number, number]> = [];
    
    let currentStart = startBlock;
    while (currentStart < finalEndBlock) {
      const currentEnd = Math.min(currentStart + BLOCKCHAIN.BLOCK_RANGE_LIMIT - 1, finalEndBlock);
      ranges.push([currentStart, currentEnd]);
      currentStart = currentEnd + 1;
    }
    
    return ranges;
  }

  /**
   * Check if block is confirmed
   * 
   * @param blockNumber - Block number to check
   * @param currentBlock - Current block number
   * @returns True if block is confirmed
   */
  static isConfirmed(blockNumber: number, currentBlock: number): boolean {
    return currentBlock - blockNumber >= BUSINESS_RULES.BSC_CONFIRMATION_BLOCKS;
  }

  /**
   * Calculate confirmations
   * 
   * @param blockNumber - Transaction block number
   * @param currentBlock - Current block number
   * @returns Number of confirmations
   */
  static getConfirmations(blockNumber: number, currentBlock: number): number {
    return Math.max(0, currentBlock - blockNumber + 1);
  }
}

/**
 * Network utilities
 */
export class NetworkUtils {
  /**
   * Check if chain ID is BSC mainnet
   * 
   * @param chainId - Chain ID to check
   * @returns True if BSC mainnet
   */
  static isBSCMainnet(chainId: number): boolean {
    return chainId === BLOCKCHAIN.BSC_CHAIN_ID;
  }

  /**
   * Check if chain ID is BSC testnet
   * 
   * @param chainId - Chain ID to check
   * @returns True if BSC testnet
   */
  static isBSCTestnet(chainId: number): boolean {
    return chainId === BLOCKCHAIN.BSC_TESTNET_CHAIN_ID;
  }

  /**
   * Check if chain ID is supported BSC network
   * 
   * @param chainId - Chain ID to check
   * @returns True if supported
   */
  static isSupportedNetwork(chainId: number): boolean {
    return this.isBSCMainnet(chainId) || this.isBSCTestnet(chainId);
  }

  /**
   * Get network name from chain ID
   * 
   * @param chainId - Chain ID
   * @returns Network name
   */
  static getNetworkName(chainId: number): string {
    if (this.isBSCMainnet(chainId)) return 'BSC Mainnet';
    if (this.isBSCTestnet(chainId)) return 'BSC Testnet';
    return 'Unknown Network';
  }

  /**
   * Get RPC URL for chain ID
   * 
   * @param chainId - Chain ID
   * @returns RPC URL or null if unsupported
   */
  static getRPCUrl(chainId: number): string | null {
    if (this.isBSCMainnet(chainId)) {
      return 'https://bsc-dataseed1.binance.org/';
    }
    if (this.isBSCTestnet(chainId)) {
      return 'https://data-seed-prebsc-1-s1.binance.org:8545/';
    }
    return null;
  }
}
