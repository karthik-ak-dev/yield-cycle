/**
 * WalletPocketRepository - Data Access Layer for WalletPocket entities
 * 
 * Focused repository for 4-pocket wallet system management:
 * - ACTIVE_DEPOSITS: Total USDT deposited and earning
 * - INCOME: 8% monthly earnings from deposits
 * - COMMISSION: MLM commission from referral network
 * - TOTAL_EARNINGS: Calculated sum (Income + Commission)
 * 
 * Essential pocket operations for balance tracking and wallet management.
 */

import { DynamoDB } from 'aws-sdk';
import { WalletPocket } from '../models/WalletPocket';
import { PocketType } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES } from '../database/config';

/**
 * Wallet balance summary for dashboard
 */
export interface WalletBalanceSummary {
  totalBalance: number;
  totalEarnings: number;
  pockets: {
    [PocketType.ACTIVE_DEPOSITS]: {
      balance: number;
      totalEarnings: number;
      lastUpdated?: string;
    };
    [PocketType.INCOME]: {
      balance: number;
      totalEarnings: number;
      lastUpdated?: string;
    };
    [PocketType.COMMISSION]: {
      balance: number;
      totalEarnings: number;
      lastUpdated?: string;
    };
    [PocketType.TOTAL_EARNINGS]: {
      balance: number;
      totalEarnings: number;
      lastUpdated?: string;
    };
  };
}

/**
 * WalletPocket Repository - Essential Pocket Management
 */
export class WalletPocketRepository {
  private static readonly POCKETS_TABLE = TABLE_NAMES.WALLET_POCKETS;

  /**
   * Create a new wallet pocket (user registration, pocket initialization)
   */
  static async createPocket(pocket: WalletPocket): Promise<WalletPocket> {
    try {
      const item = pocket.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.POCKETS_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pocketId)',
      };

      await dynamoDB.put(params).promise();
      return pocket;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Pocket with ID ${pocket.id} already exists`);
      }
      throw new Error(`Failed to create wallet pocket: ${error.message}`);
    }
  }

  /**
   * Get wallet pocket by user and type (balance retrieval, transactions)
   */
  static async getUserPocket(userId: string, pocketType: PocketType): Promise<WalletPocket | null> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.POCKETS_TABLE,
        Key: { 
          userId, 
          pocketType 
        },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return WalletPocket.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get user pocket: ${error.message}`);
    }
  }

  /**
   * Get all wallet pockets for a user (wallet balances endpoint)
   */
  static async getUserPockets(userId: string): Promise<WalletPocket[]> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.POCKETS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      };

      const result = await dynamoDB.query(params).promise();
      
      return result.Items?.map(item => WalletPocket.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get user pockets: ${error.message}`);
    }
  }

  /**
   * Update pocket balance (credit/debit operations)
   */
  static async updatePocketBalance(
    userId: string,
    pocketType: PocketType,
    balanceChange: number,
    earningsChange: number = 0
  ): Promise<WalletPocket> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeValues: { [key: string]: any } = {
        ':updatedAt': new Date().toISOString(),
        ':lastTransactionAt': new Date().toISOString(),
      };

      if (balanceChange !== 0) {
        updateExpressions.push('balance = balance + :balanceChange');
        expressionAttributeValues[':balanceChange'] = balanceChange;
      }

      if (earningsChange !== 0) {
        updateExpressions.push('totalEarnings = totalEarnings + :earningsChange');
        expressionAttributeValues[':earningsChange'] = earningsChange;
      }

      updateExpressions.push('lastTransactionAt = :lastTransactionAt');
      updateExpressions.push('UpdatedAt = :updatedAt');

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.POCKETS_TABLE,
        Key: { userId, pocketType },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return WalletPocket.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Pocket not found for user ${userId} and type ${pocketType}`);
      }
      throw new Error(`Failed to update pocket balance: ${error.message}`);
    }
  }

  /**
   * Get wallet balance summary (dashboard endpoint)
   */
  static async getWalletBalanceSummary(userId: string): Promise<WalletBalanceSummary> {
    try {
      const pockets = await this.getUserPockets(userId);
      
      const summary: WalletBalanceSummary = {
        totalBalance: 0,
        totalEarnings: 0,
        pockets: {
          [PocketType.ACTIVE_DEPOSITS]: { balance: 0, totalEarnings: 0 },
          [PocketType.INCOME]: { balance: 0, totalEarnings: 0 },
          [PocketType.COMMISSION]: { balance: 0, totalEarnings: 0 },
          [PocketType.TOTAL_EARNINGS]: { balance: 0, totalEarnings: 0 },
        },
      };

      for (const pocket of pockets) {
        summary.totalBalance += pocket.balance;
        summary.totalEarnings += pocket.totalEarnings;
        
        summary.pockets[pocket.type] = {
          balance: pocket.balance,
          totalEarnings: pocket.totalEarnings,
          lastUpdated: pocket.lastTransactionAt?.toISOString(),
        };
      }

      // Calculate TOTAL_EARNINGS as sum of INCOME + COMMISSION
      summary.pockets[PocketType.TOTAL_EARNINGS].balance = 
        summary.pockets[PocketType.INCOME].balance + 
        summary.pockets[PocketType.COMMISSION].balance;

      summary.pockets[PocketType.TOTAL_EARNINGS].totalEarnings = 
        summary.pockets[PocketType.INCOME].totalEarnings + 
        summary.pockets[PocketType.COMMISSION].totalEarnings;

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get wallet balance summary: ${error.message}`);
    }
  }

  /**
   * Initialize user wallet with all 4 pockets (user registration)
   */
  static async initializeUserWallet(userId: string): Promise<WalletPocket[]> {
    try {
      const pocketTypes = [
        PocketType.ACTIVE_DEPOSITS,
        PocketType.INCOME,
        PocketType.COMMISSION,
        PocketType.TOTAL_EARNINGS,
      ];

      const pockets: WalletPocket[] = [];
      
      for (const pocketType of pocketTypes) {
        const pocket = WalletPocket.createPocket(userId, pocketType);
        await this.createPocket(pocket);
        pockets.push(pocket);
      }

      return pockets;
    } catch (error: any) {
      throw new Error(`Failed to initialize user wallet: ${error.message}`);
    }
  }
}

/**
 * WALLET POCKET REPOSITORY - ESSENTIAL METHODS:
 * =============================================
 * 
 * POCKET MANAGEMENT:
 * - createPocket() - Create individual wallet pocket
 * - getUserPocket() - Get specific pocket by type
 * - getUserPockets() - Get all 4 pockets for user
 * - updatePocketBalance() - Credit/debit operations
 * - getWalletBalanceSummary() - Dashboard balance overview
 * - initializeUserWallet() - Create all 4 pockets for new user
 * 
 * SUPPORTED ENDPOINTS:
 * - GET /api/v1/wallet/balances → getWalletBalanceSummary()
 * - User registration → initializeUserWallet()
 * - Deposit processing → updatePocketBalance(ACTIVE_DEPOSITS)
 * - Monthly income → updatePocketBalance(INCOME)
 * - Commission distribution → updatePocketBalance(COMMISSION)
 * 
 * 4-POCKET SYSTEM:
 * - ACTIVE_DEPOSITS: Total USDT deposited and earning
 * - INCOME: 8% monthly earnings from deposits  
 * - COMMISSION: MLM commission from referral network
 * - TOTAL_EARNINGS: Calculated sum (Income + Commission)
 * 
 * BUSINESS OPERATIONS:
 * - User registration: Initialize all 4 pockets with zero balance
 * - Deposit confirmation: Credit to ACTIVE_DEPOSITS pocket
 * - Monthly income: Credit to INCOME pocket (8% of active deposits)
 * - Commission earnings: Credit to COMMISSION pocket (MLM percentages)
 * - Dashboard display: Summary of all pocket balances
 */ 