/**
 * DepositRepository - Essential Data Access Layer for Deposit entities
 * 
 * Streamlined repository focused on actual platform deposit requirements:
 * - USDT deposit lifecycle management (PENDING → CONFIRMED → ACTIVE → COMPLETED)
 * - Blockchain transaction synchronization and validation
 * - User deposit history and status tracking
 * - Essential deposit operations only
 */

import { DynamoDB } from 'aws-sdk';
import { Deposit } from '../models/Deposit';
import { DepositStatus } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated deposit result structure
 */
export interface PaginatedDepositResult {
  deposits: Deposit[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Deposit summary for user dashboard
 */
export interface DepositSummary {
  totalDeposits: number;
  activeDeposits: number;
  dormantDeposits: number;
  completedDeposits: number;
  totalEarnings: number;
  monthlyIncome: number;
}

/**
 * Streamlined Deposit Repository - Only Essential Methods
 */
export class DepositRepository {
  private static readonly TABLE_NAME = TABLE_NAMES.DEPOSITS;

  /**
   * Create a new deposit (blockchain transaction detected)
   */
  static async createDeposit(deposit: Deposit): Promise<Deposit> {
    try {
      const item = deposit.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(depositId)',
      };

      await dynamoDB.put(params).promise();
      return deposit;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Deposit with ID ${deposit.id} already exists`);
      }
      throw new Error(`Failed to create deposit: ${error.message}`);
    }
  }

  /**
   * Get deposit by ID (detailed view, payment history)
   */
  static async getDepositById(depositId: string): Promise<Deposit | null> {
    try {
      if (!depositId || typeof depositId !== 'string') {
        throw new Error('Deposit ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.TABLE_NAME,
        Key: { depositId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return Deposit.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get deposit by ID: ${error.message}`);
    }
  }

  /**
   * Get deposit by blockchain transaction hash (sync operations)
   */
  static async getDepositByTxHash(txHash: string): Promise<Deposit | null> {
    try {
      if (!txHash || typeof txHash !== 'string') {
        throw new Error('Transaction hash is required');
      }

      // Note: This requires a scan since we don't have a GSI on transaction hash
      // In production, consider adding a GSI if this query is frequent
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TABLE_NAME,
        FilterExpression: 'blockchainTxHash = :txHash',
        ExpressionAttributeValues: {
          ':txHash': txHash,
        },
        Limit: 1,
      };

      const result = await dynamoDB.scan(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return Deposit.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get deposit by transaction hash: ${error.message}`);
    }
  }

  /**
   * Get all deposits for a user (deposit history endpoint)
   */
  static async getUserDeposits(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedDepositResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.DEPOSITS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const deposits = result.Items?.map(item => Deposit.fromPersistence(item)) || [];

      return {
        deposits,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user deposits: ${error.message}`);
    }
  }

  /**
   * Get deposits by status (admin monitoring, blockchain sync)
   */
  static async getDepositsByStatus(
    status: DepositStatus,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedDepositResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.DEPOSITS_STATUS_CREATED_AT,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const deposits = result.Items?.map(item => Deposit.fromPersistence(item)) || [];

      return {
        deposits,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get deposits by status: ${error.message}`);
    }
  }

  /**
   * Get active deposits for a user (earning calculations)
   */
  static async getUserActiveDeposits(userId: string): Promise<Deposit[]> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.DEPOSITS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#status = :status AND isActive = :isActive',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':status': DepositStatus.ACTIVE,
          ':isActive': true,
        },
      };

      const result = await dynamoDB.query(params).promise();
      
      return result.Items?.map(item => Deposit.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get user active deposits: ${error.message}`);
    }
  }

  /**
   * Update deposit confirmations (blockchain sync)
   */
  static async updateConfirmations(
    depositId: string,
    confirmations: number,
    blockNumber?: number
  ): Promise<Deposit> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeValues: { [key: string]: any } = {
        ':confirmations': confirmations,
        ':updatedAt': new Date().toISOString(),
      };

      updateExpressions.push('confirmations = :confirmations');
      updateExpressions.push('UpdatedAt = :updatedAt');

      if (blockNumber !== undefined) {
        updateExpressions.push('blockNumber = :blockNumber');
        expressionAttributeValues[':blockNumber'] = blockNumber;
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { depositId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(depositId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Deposit.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Deposit with ID ${depositId} not found`);
      }
      throw new Error(`Failed to update deposit confirmations: ${error.message}`);
    }
  }

  /**
   * Update deposit status (confirmation, activation, completion)
   */
  static async updateDepositStatus(
    depositId: string,
    status: DepositStatus,
    confirmedAt?: Date,
    failureReason?: string
  ): Promise<Deposit> {
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

      if (confirmedAt) {
        updateExpressions.push('confirmedAt = :confirmedAt');
        expressionAttributeValues[':confirmedAt'] = confirmedAt.toISOString();
      }

      if (status === DepositStatus.CONFIRMED || status === DepositStatus.ACTIVE) {
        updateExpressions.push('isActive = :isActive');
        expressionAttributeValues[':isActive'] = true;
      }

      if (status === DepositStatus.FAILED && failureReason) {
        updateExpressions.push('failureReason = :failureReason');
        updateExpressions.push('isActive = :isActive');
        expressionAttributeValues[':failureReason'] = failureReason;
        expressionAttributeValues[':isActive'] = false;
      }

      if (status === DepositStatus.COMPLETED) {
        updateExpressions.push('isActive = :isActive');
        expressionAttributeValues[':isActive'] = false;
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { depositId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(depositId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Deposit.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Deposit with ID ${depositId} not found`);
      }
      throw new Error(`Failed to update deposit status: ${error.message}`);
    }
  }

  /**
   * Record monthly income distribution for a deposit
   */
  static async recordIncomeDistribution(
    depositId: string,
    incomeAmount: number
  ): Promise<Deposit> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { depositId },
        UpdateExpression: 'ADD totalEarnings :incomeAmount, monthsActive :increment SET lastIncomeAt = :lastIncomeAt, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':incomeAmount': incomeAmount,
          ':increment': 1,
          ':lastIncomeAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
          ':isActive': true,
        },
        ConditionExpression: 'attribute_exists(depositId) AND isActive = :isActive',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Deposit.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Deposit with ID ${depositId} not found or inactive`);
      }
      throw new Error(`Failed to record income distribution: ${error.message}`);
    }
  }

  /**
   * Get deposits requiring confirmation (blockchain sync job)
   */
  static async getDepositsRequiringConfirmation(): Promise<Deposit[]> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.DEPOSITS_STATUS_CREATED_AT,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': DepositStatus.PENDING,
        },
      };

      const result = await dynamoDB.query(params).promise();
      
      return result.Items?.map(item => Deposit.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get deposits requiring confirmation: ${error.message}`);
    }
  }

  /**
   * Get deposits ready for monthly income (income distribution job)
   */
  static async getDepositsForIncomeDistribution(): Promise<Deposit[]> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.DEPOSITS_STATUS_CREATED_AT,
        KeyConditionExpression: '#status = :status',
        FilterExpression: 'isActive = :isActive AND monthsActive < :maxMonths',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': DepositStatus.ACTIVE,
          ':isActive': true,
          ':maxMonths': 25, // 25-month earning period
        },
      };

      const result = await dynamoDB.query(params).promise();
      
      return result.Items?.map(item => Deposit.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get deposits for income distribution: ${error.message}`);
    }
  }

  /**
   * Get user deposit summary (dashboard endpoint)
   */
  static async getUserDepositSummary(userId: string): Promise<DepositSummary> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.DEPOSITS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ProjectionExpression: 'amount, #status, isActive, totalEarnings, monthsActive',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
      };

      const result = await dynamoDB.query(params).promise();
      const deposits = result.Items || [];

      const summary: DepositSummary = {
        totalDeposits: 0,
        activeDeposits: 0,
        dormantDeposits: 0,
        completedDeposits: 0,
        totalEarnings: 0,
        monthlyIncome: 0,
      };

      for (const deposit of deposits) {
        summary.totalDeposits += deposit.amount || 0;
        summary.totalEarnings += deposit.totalEarnings || 0;

        if (deposit.status === DepositStatus.ACTIVE && deposit.isActive) {
          summary.activeDeposits += deposit.amount || 0;
          summary.monthlyIncome += (deposit.amount || 0) * 0.08; // 8% monthly
        } else if (deposit.status === DepositStatus.DORMANT) {
          summary.dormantDeposits += deposit.amount || 0;
        } else if (deposit.status === DepositStatus.COMPLETED) {
          summary.completedDeposits += deposit.amount || 0;
        }
      }

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get user deposit summary: ${error.message}`);
    }
  }

  /**
   * Batch get deposits by IDs (commission calculations, reporting)
   */
  static async batchGetDeposits(depositIds: string[]): Promise<Deposit[]> {
    try {
      if (!depositIds || depositIds.length === 0) {
        return [];
      }

      // DynamoDB batch get limit is 100 items
      const batchSize = 100;
      const batches: string[][] = [];

      for (let i = 0; i < depositIds.length; i += batchSize) {
        batches.push(depositIds.slice(i, i + batchSize));
      }

      const allDeposits: Deposit[] = [];

      for (const batch of batches) {
        const keys = batch.map(depositId => ({ depositId }));

        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [this.TABLE_NAME]: {
              Keys: keys,
            },
          },
        };

        const result = await dynamoDB.batchGet(params).promise();
        const items = result.Responses?.[this.TABLE_NAME] || [];
        
        const deposits = items.map(item => Deposit.fromPersistence(item));
        allDeposits.push(...deposits);
      }

      return allDeposits;
    } catch (error: any) {
      throw new Error(`Failed to batch get deposits: ${error.message}`);
    }
  }
}

/**
 * STREAMLINED IMPLEMENTATION - ESSENTIAL METHODS ONLY:
 * ===================================================
 * 
 * DEPOSIT LIFECYCLE MANAGEMENT:
 * - createDeposit() - Create deposit from blockchain transaction
 * - getDepositById() - Detailed deposit view
 * - getDepositByTxHash() - Blockchain sync operations
 * - updateConfirmations() - Blockchain confirmation tracking
 * - updateDepositStatus() - Status transitions (PENDING → CONFIRMED → ACTIVE → COMPLETED)
 * 
 * USER DEPOSIT OPERATIONS:
 * - getUserDeposits() - Deposit history with pagination
 * - getUserActiveDeposits() - Active earning deposits only
 * - getUserDepositSummary() - Dashboard summary data
 * 
 * BUSINESS OPERATIONS:
 * - recordIncomeDistribution() - Monthly 8% income tracking
 * - getDepositsForIncomeDistribution() - Income processing job
 * - getDepositsRequiringConfirmation() - Blockchain sync job
 * 
 * ADMIN & MONITORING:
 * - getDepositsByStatus() - Status-based filtering
 * - batchGetDeposits() - Bulk operations for reporting
 * 
 * DEPOSIT ENDPOINTS SUPPORTED:
 * - GET /api/v1/deposits/address → User deposit address (external)
 * - POST /api/v1/deposits/sync → getDepositByTxHash() + updateConfirmations()
 * - GET /api/v1/deposits → getUserDeposits() with pagination
 * - GET /api/v1/deposits/:id → getDepositById() with payment history
 * - Dashboard summary → getUserDepositSummary()
 * 
 * REMOVED OVER-ENGINEERED FEATURES:
 * - Complex deposit analytics and reporting
 * - Advanced filtering beyond status and user
 * - Deposit statistics and aggregations beyond summary
 * - Complex deposit search and sorting capabilities
 * - Bulk deposit operations beyond necessary batch gets
 * - Custom deposit policies and rules engines
 * 
 * This streamlined version focuses on actual deposit management requirements
 * from TECHNICAL.md, providing essential USDT deposit lifecycle management
 * for the yield cycle platform with proper blockchain integration.
 */
