import { ethers } from 'ethers';

export class BlockchainConfig {
  private static instance: BlockchainConfig;
  private provider: ethers.providers.JsonRpcProvider;
  private masterWallet: ethers.Wallet;

  // BSC Mainnet configuration
  public static readonly NETWORK_CONFIG = {
    RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    CHAIN_ID: 56,
    BLOCK_EXPLORER: 'https://bscscan.com',
    USDT_CONTRACT: '0x55d398326f99059fF775485246999027B3197955', // BSC USDT contract
  };

  // USDT Contract ABI (minimal for balance and transfer checking)
  public static readonly USDT_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ];

  private constructor() {
    // Initialize BSC provider
    this.provider = new ethers.providers.JsonRpcProvider(
      BlockchainConfig.NETWORK_CONFIG.RPC_URL
    );

    // Initialize master wallet for HD derivation
    const masterPrivateKey = process.env.MASTER_WALLET_PRIVATE_KEY;
    if (!masterPrivateKey) {
      throw new Error('MASTER_WALLET_PRIVATE_KEY environment variable is required');
    }
    
    this.masterWallet = new ethers.Wallet(masterPrivateKey, this.provider);
  }

  public static getInstance(): BlockchainConfig {
    if (!BlockchainConfig.instance) {
      BlockchainConfig.instance = new BlockchainConfig();
    }
    return BlockchainConfig.instance;
  }

  public getProvider(): ethers.providers.JsonRpcProvider {
    return this.provider;
  }

  public getMasterWallet(): ethers.Wallet {
    return this.masterWallet;
  }

  public getUSDTContract(): ethers.Contract {
    return new ethers.Contract(
      BlockchainConfig.NETWORK_CONFIG.USDT_CONTRACT,
      BlockchainConfig.USDT_ABI,
      this.provider
    );
  }

  // Test blockchain connection
  public async testConnection(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`Connected to BSC network. Latest block: ${blockNumber}`);
      return true;
    } catch (error) {
      console.error('Blockchain connection test failed:', error);
      return false;
    }
  }

  // Get current gas price
  public async getCurrentGasPrice(): Promise<ethers.BigNumber> {
    return await this.provider.getGasPrice();
  }

  // Check if transaction is confirmed with required confirmations
  public async getTransactionConfirmations(txHash: string): Promise<number> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx || !tx.blockNumber) {
        return 0;
      }
      
      const currentBlock = await this.provider.getBlockNumber();
      return currentBlock - tx.blockNumber + 1;
    } catch (error) {
      console.error('Error getting transaction confirmations:', error);
      return 0;
    }
  }
}

export const blockchainConfig = BlockchainConfig.getInstance(); 