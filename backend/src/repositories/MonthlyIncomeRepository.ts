/**
 * MonthlyIncomeRepository - Data Access Layer for MonthlyIncome entities
 * 
 * Focused repository for 8% monthly income distribution system:
 * - Batch processing of monthly distributions (25 months × 8% = 200% total)
 * - User-specific income tracking and status management
 * - Month-based income distribution audit trail
 * - Integration with deposit lifecycle and wallet pocket updates
 * 
 * Essential operations for automated monthly income processing.
 */

import { DynamoDB } from 'aws-sdk';
import { MonthlyIncome } from '../models/MonthlyIncome';
import { TransactionStatus } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated monthly income result structure
 */
export interface PaginatedMonthlyIncomeResult {
  incomes: MonthlyIncome[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Monthly income distribution summary for admin monitoring
 */
export interface MonthlyIncomeDistributionSummary {
  month: string;
  totalUsers: number;
  totalDistributed: number;
  totalPending: number;
  totalFailed: number;
  averageIncomePerUser: number;
  completionRate: number;
  batchId: string;
}

/**
 * User monthly income summary for dashboard
 */
export interface UserMonthlyIncomeSummary {
  userId: string;
  totalIncomes: number;
  totalDistributed: number;
  totalPending: number;
  averageMonthlyIncome: number;
  lastIncomeDate?: string;
  monthsRemaining: number;
  projectedTotalIncome: number;
}

/**
 * Monthly Income Repository - Essential Income Distribution Management
 */
export class MonthlyIncomeRepository {
  private static readonly MONTHLY_INCOME_TABLE = TABLE_NAMES.MONTHLY_INCOME;

  /**
   * Create a new monthly income record (batch processing)
   */
  static async createMonthlyIncome(income: MonthlyIncome): Promise<MonthlyIncome> {
    try {
      const item = income.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(incomeId)',
      };

      await dynamoDB.put(params).promise();
      return income;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Monthly income with ID ${income.incomeId} already exists`);
      }
      throw new Error(`Failed to create monthly income: ${error.message}`);
    }
  }

  /**
   * Batch create multiple monthly income records (monthly distribution job)
   */
  static async batchCreateMonthlyIncomes(incomes: MonthlyIncome[]): Promise<MonthlyIncome[]> {
    try {
      if (!incomes || incomes.length === 0) {
        return [];
      }

      // DynamoDB batch write limit is 25 items
      const batchSize = 25;
      const batches: MonthlyIncome[][] = [];

      for (let i = 0; i < incomes.length; i += batchSize) {
        batches.push(incomes.slice(i, i + batchSize));
      }

      const results: MonthlyIncome[] = [];

      for (const batch of batches) {
        const writeRequests = batch.map(income => ({
          PutRequest: {
            Item: income.toDynamoItem(),
          },
        }));

        const params: DynamoDB.DocumentClient.BatchWriteItemInput = {
          RequestItems: {
            [this.MONTHLY_INCOME_TABLE]: writeRequests,
          },
        };

        await dynamoDB.batchWrite(params).promise();
        results.push(...batch);
      }

      return results;
    } catch (error: any) {
      throw new Error(`Failed to batch create monthly incomes: ${error.message}`);
    }
  }

  /**
   * Get monthly income by ID (status tracking, processing)
   */
  static async getMonthlyIncomeById(incomeId: string): Promise<MonthlyIncome | null> {
    try {
      if (!incomeId || typeof incomeId !== 'string') {
        throw new Error('Income ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        Key: { incomeId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return MonthlyIncome.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get monthly income by ID: ${error.message}`);
    }
  }

  /**
   * Get user monthly incomes (user dashboard, income history)
   */
  static async getUserMonthlyIncomes(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: any,
    status?: TransactionStatus
  ): Promise<PaginatedMonthlyIncomeResult> {
    try {
      let filterExpression = '';
      const expressionAttributeValues: { [key: string]: any } = {
        ':userId': userId,
      };

      if (status) {
        filterExpression = '#status = :status';
        expressionAttributeValues[':status'] = status;
      }

      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        IndexName: GSI_NAMES.MONTHLY_INCOME_USER_ID_MONTH,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      if (filterExpression) {
        params.FilterExpression = filterExpression;
        params.ExpressionAttributeNames = { '#status': 'status' };
      }

      const result = await dynamoDB.query(params).promise();
      
      const incomes = result.Items?.map(item => MonthlyIncome.fromPersistence(item)) || [];

      return {
        incomes,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user monthly incomes: ${error.message}`);
    }
  }

  /**
   * Get monthly incomes by month (batch processing, monthly reports)
   */
  static async getMonthlyIncomesByMonth(
    month: string,
    limit: number = 100,
    lastEvaluatedKey?: any,
    status?: TransactionStatus
  ): Promise<PaginatedMonthlyIncomeResult> {
    try {
      let filterExpression = 'month = :month';
      const expressionAttributeValues: { [key: string]: any } = {
        ':month': month,
      };

      if (status) {
        filterExpression += ' AND #status = :status';
        expressionAttributeValues[':status'] = status;
      }

      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      if (status) {
        params.ExpressionAttributeNames = { '#status': 'status' };
      }

      const result = await dynamoDB.scan(params).promise();
      
      const incomes = result.Items?.map(item => MonthlyIncome.fromPersistence(item)) || [];

      return {
        incomes,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get monthly incomes by month: ${error.message}`);
    }
  }

  /**
   * Get monthly incomes by batch ID (batch processing monitoring)
   */
  static async getMonthlyIncomesByBatch(
    batchId: string,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedMonthlyIncomeResult> {
    try {
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        FilterExpression: 'batchId = :batchId',
        ExpressionAttributeValues: {
          ':batchId': batchId,
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.scan(params).promise();
      
      const incomes = result.Items?.map(item => MonthlyIncome.fromPersistence(item)) || [];

      return {
        incomes,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get monthly incomes by batch: ${error.message}`);
    }
  }

  /**
   * Update monthly income status (processing workflow)
   */
  static async updateMonthlyIncomeStatus(
    incomeId: string,
    status: TransactionStatus,
    failureReason?: string
  ): Promise<MonthlyIncome> {
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

      if (status === TransactionStatus.COMPLETED || status === TransactionStatus.FAILED) {
        updateExpressions.push('processedAt = :processedAt');
        expressionAttributeValues[':processedAt'] = new Date().toISOString();
      }

      if (status === TransactionStatus.FAILED && failureReason) {
        updateExpressions.push('failureReason = :failureReason');
        expressionAttributeValues[':failureReason'] = failureReason;
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        Key: { incomeId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(incomeId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return MonthlyIncome.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Monthly income with ID ${incomeId} not found`);
      }
      throw new Error(`Failed to update monthly income status: ${error.message}`);
    }
  }

  /**
   * Get pending monthly incomes (processing jobs, batch monitoring)
   */
  static async getPendingMonthlyIncomes(
    batchId?: string,
    limit: number = 100
  ): Promise<MonthlyIncome[]> {
    try {
      let filterExpression = '#status = :status';
      const expressionAttributeValues: { [key: string]: any } = {
        ':status': TransactionStatus.PENDING,
      };

      if (batchId) {
        filterExpression += ' AND batchId = :batchId';
        expressionAttributeValues[':batchId'] = batchId;
      }

      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
      };

      const result = await dynamoDB.scan(params).promise();
      
      return result.Items?.map(item => MonthlyIncome.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get pending monthly incomes: ${error.message}`);
    }
  }

  /**
   * Get failed monthly incomes (retry processing, error monitoring)
   */
  static async getFailedMonthlyIncomes(
    month?: string,
    limit: number = 100
  ): Promise<MonthlyIncome[]> {
    try {
      let filterExpression = '#status = :status';
      const expressionAttributeValues: { [key: string]: any } = {
        ':status': TransactionStatus.FAILED,
      };

      if (month) {
        filterExpression += ' AND month = :month';
        expressionAttributeValues[':month'] = month;
      }

      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: limit,
      };

      const result = await dynamoDB.scan(params).promise();
      
      return result.Items?.map(item => MonthlyIncome.fromPersistence(item)) || [];
    } catch (error: any) {
      throw new Error(`Failed to get failed monthly incomes: ${error.message}`);
    }
  }

  /**
   * Check if user has income for specific month (duplicate prevention)
   */
  static async hasUserIncomeForMonth(userId: string, month: string): Promise<boolean> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        IndexName: GSI_NAMES.MONTHLY_INCOME_USER_ID_MONTH,
        KeyConditionExpression: 'userId = :userId AND month = :month',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':month': month,
        },
        Limit: 1,
      };

      const result = await dynamoDB.query(params).promise();
      return (result.Items?.length || 0) > 0;
    } catch (error: any) {
      throw new Error(`Failed to check user income for month: ${error.message}`);
    }
  }

  /**
   * Get monthly income distribution summary (admin dashboard)
   */
  static async getMonthlyDistributionSummary(month: string): Promise<MonthlyIncomeDistributionSummary> {
    try {
      const { incomes } = await this.getMonthlyIncomesByMonth(month, 1000);
      
      const summary: MonthlyIncomeDistributionSummary = {
        month,
        totalUsers: incomes.length,
        totalDistributed: 0,
        totalPending: 0,
        totalFailed: 0,
        averageIncomePerUser: 0,
        completionRate: 0,
        batchId: incomes[0]?.batchId || '',
      };

      for (const income of incomes) {
        if (income.isCompleted()) {
          summary.totalDistributed += income.incomeAmount;
        } else if (income.isPending() || income.isProcessing()) {
          summary.totalPending += income.incomeAmount;
        } else if (income.isFailed()) {
          summary.totalFailed += income.incomeAmount;
        }
      }

      if (summary.totalUsers > 0) {
        summary.averageIncomePerUser = summary.totalDistributed / summary.totalUsers;
        const completedCount = incomes.filter(income => income.isCompleted()).length;
        summary.completionRate = (completedCount / summary.totalUsers) * 100;
      }

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get monthly distribution summary: ${error.message}`);
    }
  }

  /**
   * Get user monthly income summary (user dashboard)
   */
  static async getUserIncomeSummary(userId: string): Promise<UserMonthlyIncomeSummary> {
    try {
      const { incomes } = await this.getUserMonthlyIncomes(userId, 1000);
      
      const summary: UserMonthlyIncomeSummary = {
        userId,
        totalIncomes: incomes.length,
        totalDistributed: 0,
        totalPending: 0,
        averageMonthlyIncome: 0,
        lastIncomeDate: undefined,
        monthsRemaining: 0,
        projectedTotalIncome: 0,
      };

      let completedIncomes = 0;
      for (const income of incomes) {
        if (income.isCompleted()) {
          summary.totalDistributed += income.incomeAmount;
          completedIncomes++;
        } else if (income.isPending() || income.isProcessing()) {
          summary.totalPending += income.incomeAmount;
        }

        if (!summary.lastIncomeDate || income.createdAt > new Date(summary.lastIncomeDate)) {
          summary.lastIncomeDate = income.createdAt.toISOString();
        }
      }

      if (completedIncomes > 0) {
        summary.averageMonthlyIncome = summary.totalDistributed / completedIncomes;
      }

      // Calculate remaining months (25 months total earning period)
      summary.monthsRemaining = Math.max(0, 25 - completedIncomes);
      summary.projectedTotalIncome = summary.totalDistributed + (summary.averageMonthlyIncome * summary.monthsRemaining);

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get user income summary: ${error.message}`);
    }
  }

  /**
   * Batch get monthly incomes by IDs (reporting, analytics)
   */
  static async batchGetMonthlyIncomes(incomeIds: string[]): Promise<MonthlyIncome[]> {
    try {
      if (!incomeIds || incomeIds.length === 0) {
        return [];
      }

      // DynamoDB batch get limit is 100 items
      const batchSize = 100;
      const batches: string[][] = [];

      for (let i = 0; i < incomeIds.length; i += batchSize) {
        batches.push(incomeIds.slice(i, i + batchSize));
      }

      const allIncomes: MonthlyIncome[] = [];

      for (const batch of batches) {
        const keys = batch.map(incomeId => ({ incomeId }));

        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [this.MONTHLY_INCOME_TABLE]: {
              Keys: keys,
            },
          },
        };

        const result = await dynamoDB.batchGet(params).promise();
        const items = result.Responses?.[this.MONTHLY_INCOME_TABLE] || [];
        
        const incomes = items.map(item => MonthlyIncome.fromPersistence(item));
        allIncomes.push(...incomes);
      }

      return allIncomes;
    } catch (error: any) {
      throw new Error(`Failed to batch get monthly incomes: ${error.message}`);
    }
  }

  /**
   * Get user's income for specific month (duplicate check, processing)
   */
  static async getUserIncomeForMonth(userId: string, month: string): Promise<MonthlyIncome | null> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        IndexName: GSI_NAMES.MONTHLY_INCOME_USER_ID_MONTH,
        KeyConditionExpression: 'userId = :userId AND month = :month',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':month': month,
        },
        Limit: 1,
      };

      const result = await dynamoDB.query(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return MonthlyIncome.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get user income for month: ${error.message}`);
    }
  }

  /**
   * Delete monthly income (admin correction, test cleanup)
   */
  static async deleteMonthlyIncome(incomeId: string): Promise<void> {
    try {
      const params: DynamoDB.DocumentClient.DeleteItemInput = {
        TableName: this.MONTHLY_INCOME_TABLE,
        Key: { incomeId },
        ConditionExpression: 'attribute_exists(incomeId)',
      };

      await dynamoDB.delete(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Monthly income with ID ${incomeId} not found`);
      }
      throw new Error(`Failed to delete monthly income: ${error.message}`);
    }
  }
}

/**
 * MONTHLY INCOME REPOSITORY - ESSENTIAL METHODS:
 * =============================================
 * 
 * INCOME MANAGEMENT:
 * - createMonthlyIncome() - Create individual income record
 * - batchCreateMonthlyIncomes() - Batch processing for monthly distributions
 * - getMonthlyIncomeById() - Individual income status and details
 * - getUserMonthlyIncomes() - User income history with filtering
 * - getMonthlyIncomesByMonth() - Month-based income reports
 * - getMonthlyIncomesByBatch() - Batch processing monitoring
 * 
 * STATUS MANAGEMENT:
 * - updateMonthlyIncomeStatus() - Status updates during processing
 * - getPendingMonthlyIncomes() - Processing jobs and queues
 * - getFailedMonthlyIncomes() - Error monitoring and retry
 * 
 * BUSINESS OPERATIONS:
 * - hasUserIncomeForMonth() - Duplicate prevention
 * - getUserIncomeForMonth() - Specific month processing
 * - getMonthlyDistributionSummary() - Admin monitoring
 * - getUserIncomeSummary() - User dashboard statistics
 * - batchGetMonthlyIncomes() - Bulk operations for analytics
 * 
 * SUPPORTED ENDPOINTS:
 * - GET /api/v1/dashboard/income → getUserMonthlyIncomes() + getUserIncomeSummary()
 * - Monthly income job → batchCreateMonthlyIncomes() + batch processing
 * - Admin monitoring → getMonthlyDistributionSummary() + getFailedMonthlyIncomes()
 * 
 * 8% MONTHLY INCOME SYSTEM:
 * - Users earn 8% monthly on active deposits for 25 months
 * - Total return: 25 × 8% = 200% over earning period
 * - Income distributed to INCOME wallet pocket
 * - Complete audit trail for regulatory compliance
 * - Batch processing for efficient monthly distributions
 * 
 * BUSINESS RULES:
 * - Only active deposits (not DORMANT or COMPLETED) earn income
 * - Income calculated as 8% of total active deposits per user
 * - Distributions processed monthly in batches
 * - Integration with Transaction and WalletPocket systems
 * - Earnings cap at 200% of total deposits
 * 
 * PROCESSING WORKFLOW:
 * 1. Monthly job creates batch records (PENDING status)
 * 2. Processing service updates status to PROCESSING
 * 3. Credit user INCOME pocket and create MONTHLY_INCOME transaction
 * 4. Update status to COMPLETED with processedAt timestamp
 * 5. Handle failures with FAILED status and failure reasons
 * 6. Admin monitoring and retry capabilities for failed distributions
 */
