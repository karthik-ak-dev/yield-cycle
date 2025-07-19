// Note: ethers import commented due to previous import issues
// import { ethers } from 'ethers';
import { HDWalletData } from '../models/Wallet';

// HD Wallet derivation configuration
const BIP44_PATH_PREFIX = "m/44'/60'/0'/0/"; // BIP44 path for Ethereum/BSC
const MAX_DERIVATION_INDEX = 2147483647; // Maximum safe derivation index

// Derive wallet from master seed using BIP44 path
export const deriveWalletFromMaster = async (
  masterSeed: string,
  derivationIndex: number
): Promise<HDWalletData> => {
  try {
    if (derivationIndex < 0 || derivationIndex > MAX_DERIVATION_INDEX) {
      throw new Error('Invalid derivation index');
    }

    const derivationPath = `${BIP44_PATH_PREFIX}${derivationIndex}`;

    // TODO: Uncomment when ethers import is fixed
    // const masterWallet = ethers.Wallet.fromMnemonic(masterSeed, derivationPath);
    
    // Temporary mock implementation (replace with actual implementation)
    const mockWalletData: HDWalletData = {
      address: `0x${derivationIndex.toString(16).padStart(40, '0')}`,
      privateKey: `0x${'1'.repeat(64)}`,
      derivationPath,
      derivationIndex
    };

    return mockWalletData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`HD wallet derivation failed: ${errorMessage}`);
  }
};

// Derive wallet from master private key
export const deriveWalletFromPrivateKey = async (
  masterPrivateKey: string,
  derivationIndex: number
): Promise<HDWalletData> => {
  try {
    if (derivationIndex < 0 || derivationIndex > MAX_DERIVATION_INDEX) {
      throw new Error('Invalid derivation index');
    }

    const derivationPath = `${BIP44_PATH_PREFIX}${derivationIndex}`;

    // TODO: Uncomment when ethers import is fixed
    // const hdNode = ethers.utils.HDNode.fromSeed(Buffer.from(masterPrivateKey, 'hex'));
    // const derivedNode = hdNode.derivePath(derivationPath);
    // const wallet = new ethers.Wallet(derivedNode.privateKey);

    // Temporary mock implementation
    const mockWalletData: HDWalletData = {
      address: `0x${derivationIndex.toString(16).padStart(40, '0')}`,
      privateKey: `0x${'2'.repeat(64)}`,
      derivationPath,
      derivationIndex
    };

    return mockWalletData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`HD wallet derivation from private key failed: ${errorMessage}`);
  }
};

// Generate next available derivation index
export const getNextDerivationIndex = async (): Promise<number> => {
  try {
    // In a real implementation, this would query the database to find the next available index
    // For now, return a random index (this should be replaced with actual logic)
    return Math.floor(Math.random() * 10000);
  } catch (error) {
    throw new Error('Failed to get next derivation index');
  }
};

// Validate BIP44 derivation path
export const validateDerivationPath = (path: string): boolean => {
  const bip44Regex = /^m\/44'\/60'\/0'\/0\/\d+$/;
  return bip44Regex.test(path);
};

// Extract derivation index from path
export const extractDerivationIndex = (path: string): number => {
  if (!validateDerivationPath(path)) {
    throw new Error('Invalid derivation path');
  }
  
  const parts = path.split('/');
  return parseInt(parts[parts.length - 1]);
};

// Generate deterministic address from seed and index (for verification)
export const generateDeterministicAddress = (
  seed: string,
  derivationIndex: number
): string => {
  try {
    // This is a simplified implementation
    // In production, use proper HD wallet derivation
    const combined = `${seed}-${derivationIndex}`;
    const hash = require('crypto').createHash('sha256').update(combined).digest('hex');
    return `0x${hash.substring(0, 40)}`;
  } catch (error) {
    throw new Error('Address generation failed');
  }
};

// Validate Ethereum/BSC address format
export const isValidAddress = (address: string): boolean => {
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
};

// Validate private key format
export const isValidPrivateKey = (privateKey: string): boolean => {
  const privateKeyRegex = /^0x[a-fA-F0-9]{64}$/;
  return privateKeyRegex.test(privateKey);
};

// Get wallet info from address (for debugging)
export const getWalletInfo = (walletData: HDWalletData): {
  address: string;
  derivationPath: string;
  derivationIndex: number;
  isValidAddress: boolean;
  isValidPrivateKey: boolean;
} => {
  return {
    address: walletData.address,
    derivationPath: walletData.derivationPath,
    derivationIndex: walletData.derivationIndex,
    isValidAddress: isValidAddress(walletData.address),
    isValidPrivateKey: isValidPrivateKey(walletData.privateKey)
  };
}; 