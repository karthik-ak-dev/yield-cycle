/**
 * TransactionRepository - Data Access Layer for Transaction entities
 * 
 * Focused repository for wallet transaction management:
 * - Complete transaction audit trail for compliance
 * - Blockchain transaction linking for deposits/withdrawals
 * - Status tracking (PENDING → COMPLETED/FAILED)
 * - Transaction history and filtering
 * 
 * Essential transaction operations for financial tracking and audit.
 */

import { DynamoDB } from 'aws-sdk';
import { Transaction } from '../models/Transaction';
import { TransactionType, TransactionStatus, PocketType } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated transaction result structure
 */
export interface PaginatedTransactionResult {
  transactions: Transaction[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Transaction Repository - Essential Transaction Management
 */
export class TransactionRepository {
  private static readonly TRANSACTIONS_TABLE = TABLE_NAMES.WALLET_TRANSACTIONS;

  /**
   * Create a new transaction (all wallet operations)
   */
  static async createTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      const item = transaction.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.TRANSACTIONS_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(transactionId)',
      };

      await dynamoDB.put(params).promise();
      return transaction;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Transaction with ID ${transaction.id} already exists`);
      }
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  }

  /**
   * Get transaction by ID (transaction details, status tracking)
   */
  static async getTransactionById(transactionId: string): Promise<Transaction | null> {
    try {
      if (!transactionId || typeof transactionId !== 'string') {
        throw new Error('Transaction ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.TRANSACTIONS_TABLE,
        Key: { transactionId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return Transaction.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get transaction by ID: ${error.message}`);
    }
  }

  /**
   * Get user transactions (transaction history endpoint)
   */
  static async getUserTransactions(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: any,
    pocketType?: PocketType,
    transactionType?: TransactionType
  ): Promise<PaginatedTransactionResult> {
    try {
      let filterExpression = '';
      const expressionAttributeValues: { [key: string]: any } = {
        ':userId': userId,
      };

      if (pocketType) {
        filterExpression += 'toPocket = :pocketType';
        expressionAttributeValues[':pocketType'] = pocketType;
      }

      if (transactionType) {
        if (filterExpression) filterExpression += ' AND ';
        filterExpression += '#type = :transactionType';
        expressionAttributeValues[':transactionType'] = transactionType;
      }

      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TRANSACTIONS_TABLE,
        IndexName: GSI_NAMES.WALLET_TRANSACTIONS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      if (filterExpression) {
        params.FilterExpression = filterExpression;
      }

      if (transactionType) {
        params.ExpressionAttributeNames = { '#type': 'type' };
      }

      const result = await dynamoDB.query(params).promise();
      
      const transactions = result.Items?.map(item => Transaction.fromPersistence(item)) || [];

      return {
        transactions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user transactions: ${error.message}`);
    }
  }

  /**
   * Get transactions by type (admin monitoring, reporting)
   */
  static async getTransactionsByType(
    transactionType: TransactionType,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedTransactionResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TRANSACTIONS_TABLE,
        IndexName: GSI_NAMES.WALLET_TRANSACTIONS_TYPE_CREATED_AT,
        KeyConditionExpression: '#type = :transactionType',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':transactionType': transactionType,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const transactions = result.Items?.map(item => Transaction.fromPersistence(item)) || [];

      return {
        transactions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get transactions by type: ${error.message}`);
    }
  }

  /**
   * Update transaction status (confirmation, failure, completion)
   */
  static async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    blockchainTxHash?: string,
    blockNumber?: number,
    failureReason?: string
  ): Promise<Transaction> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeValues: { [key: string]: any } = {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      };
      const expressionAttributeNames: { [key: string]: string } = {
        '#status': 'status',
      };

      updateExpressions.push('#status = :status');
      updateExpressions.push('UpdatedAt = :updatedAt');

      if (status === TransactionStatus.COMPLETED) {
        updateExpressions.push('processedAt = :processedAt');
        expressionAttributeValues[':processedAt'] = new Date().toISOString();
      }

      if (blockchainTxHash) {
        updateExpressions.push('blockchainTxHash = :blockchainTxHash');
        expressionAttributeValues[':blockchainTxHash'] = blockchainTxHash;
      }

      if (blockNumber) {
        updateExpressions.push('blockNumber = :blockNumber');
        expressionAttributeValues[':blockNumber'] = blockNumber;
      }

      if (status === TransactionStatus.FAILED && failureReason) {
        updateExpressions.push('failureReason = :failureReason');
        expressionAttributeValues[':failureReason'] = failureReason;
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TRANSACTIONS_TABLE,
        Key: { transactionId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(transactionId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Transaction.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Transaction with ID ${transactionId} not found`);
      }
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }

  /**
   * Get pending transactions (processing jobs, blockchain confirmation)
   */
  static async getPendingTransactions(
    transactionType?: TransactionType,
    limit: number = 100
  ): Promise<Transaction[]> {
    try {
      let params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput;

      if (transactionType) {
        params = {
          TableName: this.TRANSACTIONS_TABLE,
          IndexName: GSI_NAMES.WALLET_TRANSACTIONS_TYPE_CREATED_AT,
          KeyConditionExpression: '#type = :transactionType',
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#type': 'type',
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':transactionType': transactionType,
            ':status': TransactionStatus.PENDING,
          },
          Limit: limit,
        };
      } else {
        params = {
          TableName: this.TRANSACTIONS_TABLE,
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': TransactionStatus.PENDING,
          },
          Limit: limit,
        };
      }

      const result = transactionType 
        ? await dynamoDB.query(params as DynamoDB.DocumentClient.QueryInput).promise()
        : await dynamoDB.scan(params as DynamoDB.DocumentClient.ScanInput).promise();
      
      return result.Items?.map(item => Transaction.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get pending transactions: ${error.message}`);
    }
  }

  /**
   * Batch get transactions by IDs (reporting, commission calculations)
   */
  static async batchGetTransactions(transactionIds: string[]): Promise<Transaction[]> {
    try {
      if (!transactionIds || transactionIds.length === 0) {
        return [];
      }

      // DynamoDB batch get limit is 100 items
      const batchSize = 100;
      const batches: string[][] = [];

      for (let i = 0; i < transactionIds.length; i += batchSize) {
        batches.push(transactionIds.slice(i, i + batchSize));
      }

      const allTransactions: Transaction[] = [];

      for (const batch of batches) {
        const keys = batch.map(transactionId => ({ transactionId }));

        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [this.TRANSACTIONS_TABLE]: {
              Keys: keys,
            },
          },
        };

        const result = await dynamoDB.batchGet(params).promise();
        const items = result.Responses?.[this.TRANSACTIONS_TABLE] || [];
        
        const transactions = items.map(item => Transaction.fromPersistence(item));
        allTransactions.push(...transactions);
      }

      return allTransactions;
    } catch (error: any) {
      throw new Error(`Failed to batch get transactions: ${error.message}`);
    }
  }

  /**
   * Get transactions by status (admin monitoring)
   */
  static async getTransactionsByStatus(
    status: TransactionStatus,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedTransactionResult> {
    try {
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TRANSACTIONS_TABLE,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.scan(params).promise();
      
      const transactions = result.Items?.map(item => Transaction.fromPersistence(item)) || [];

      return {
        transactions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get transactions by status: ${error.message}`);
    }
  }

  /**
   * Get transactions by blockchain hash (blockchain sync, verification)
   */
  static async getTransactionByBlockchainHash(blockchainTxHash: string): Promise<Transaction | null> {
    try {
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TRANSACTIONS_TABLE,
        FilterExpression: 'blockchainTxHash = :blockchainTxHash',
        ExpressionAttributeValues: {
          ':blockchainTxHash': blockchainTxHash,
        },
        Limit: 1,
      };

      const result = await dynamoDB.scan(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return Transaction.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get transaction by blockchain hash: ${error.message}`);
    }
  }

  /**
   * Get user transaction summary (dashboard stats)
   */
  static async getUserTransactionSummary(userId: string): Promise<{
    totalTransactions: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalIncome: number;
    totalCommissions: number;
    pendingTransactions: number;
  }> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TRANSACTIONS_TABLE,
        IndexName: GSI_NAMES.WALLET_TRANSACTIONS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      };

      const result = await dynamoDB.query(params).promise();
      const transactions = result.Items?.map(item => Transaction.fromPersistence(item)) || [];

      const summary = {
        totalTransactions: transactions.length,
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalIncome: 0,
        totalCommissions: 0,
        pendingTransactions: 0,
      };

      for (const transaction of transactions) {
        if (transaction.isPending()) {
          summary.pendingTransactions++;
        }

        if (transaction.isDeposit() && transaction.isCompleted()) {
          summary.totalDeposits += transaction.amount;
        }

        if (transaction.isWithdrawal() && transaction.isCompleted()) {
          summary.totalWithdrawals += transaction.amount;
        }

        if (transaction.isMonthlyIncome() && transaction.isCompleted()) {
          summary.totalIncome += transaction.amount;
        }

        if (transaction.isCommission() && transaction.isCompleted()) {
          summary.totalCommissions += transaction.amount;
        }
      }

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get user transaction summary: ${error.message}`);
    }
  }
}

/**
 * TRANSACTION REPOSITORY - ESSENTIAL METHODS:
 * ===========================================
 * 
 * TRANSACTION MANAGEMENT:
 * - createTransaction() - Record all wallet transactions
 * - getTransactionById() - Transaction details and status
 * - getUserTransactions() - Transaction history with filtering
 * - getTransactionsByType() - Admin monitoring by type
 * - updateTransactionStatus() - Status updates and blockchain info
 * - getPendingTransactions() - Processing jobs and confirmations
 * - batchGetTransactions() - Bulk operations for reporting
 * 
 * ADDITIONAL OPERATIONS:
 * - getTransactionsByStatus() - Admin monitoring by status
 * - getTransactionByBlockchainHash() - Blockchain verification
 * - getUserTransactionSummary() - Dashboard statistics
 * 
 * SUPPORTED ENDPOINTS:
 * - GET /api/v1/wallet/transactions → getUserTransactions() with filtering
 * - POST /api/v1/wallet/withdraw → createTransaction()
 * - Deposit processing → createTransaction() + updateTransactionStatus()
 * - Monthly income distribution → createTransaction()
 * - Commission distribution → createTransaction()
 * 
 * TRANSACTION TYPES SUPPORTED:
 * - ACTIVE_DEPOSIT_CREDIT: USDT deposits from blockchain
 * - ACTIVE_DEPOSIT_DEBIT: When deposits complete 25-month cycle
 * - MONTHLY_INCOME: 8% monthly earnings to INCOME pocket
 * - COMMISSION_L1-L5: MLM commission levels to COMMISSION pocket
 * - WITHDRAWAL: Post-25-month withdrawals from INCOME/COMMISSION
 * 
 * BUSINESS OPERATIONS:
 * - Deposit confirmation: Create and update transaction status
 * - Monthly income: Create monthly income transactions
 * - Commission distribution: Create commission transactions
 * - Withdrawal processing: Create withdrawal transactions
 * - Blockchain sync: Update transaction blockchain info
 * - Admin monitoring: Get transactions by status/type
 * 
 * STATUS TRACKING:
 * - PENDING: Initial state, awaiting processing
 * - COMPLETED: Successfully processed
 * - FAILED: Processing failed with reason
 * - CANCELLED: Cancelled by user or system
 */ 