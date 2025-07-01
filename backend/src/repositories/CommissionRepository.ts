/**
 * CommissionRepository - Data Access Layer for Commission entities
 * 
 * Focused repository for 5-level MLM commission system:
 * - Commission distribution and tracking (10%, 5%, 3%, 1%, 1%)
 * - Commission lifecycle management (PENDING → PROCESSED → PAID)
 * - Batch processing for efficient distribution
 * - Commission analytics and reporting
 * - Payment processing and audit trail
 * 
 * Essential operations for MLM commission management and distribution processing.
 */

import { DynamoDB } from 'aws-sdk';
import { Commission } from '../models/Commission';
import { CommissionStatus } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated commission result structure
 */
export interface PaginatedCommissionResult {
  commissions: Commission[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Commission statistics summary for analytics
 */
export interface CommissionStatisticsSummary {
  totalCommissions: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  processedCount: number;
  processedAmount: number;
  paidCount: number;
  paidAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
  levelBreakdown: {
    level1: { count: number; amount: number; rate: number };
    level2: { count: number; amount: number; rate: number };
    level3: { count: number; amount: number; rate: number };
    level4: { count: number; amount: number; rate: number };
    level5: { count: number; amount: number; rate: number };
  };
  averageCommissionAmount: number;
  averageProcessingTimeInDays: number;
  overdueCount: number;
}

/**
 * Bulk commission creation data
 */
export interface BulkCommissionData {
  sourceUserId: string;
  sourceDepositId: string;
  sourceAmount: number;
  recipients: Array<{
    userId: string;
    level: number;
  }>;
  distributionBatchId?: string;
}

/**
 * Commission distribution summary
 */
export interface CommissionDistributionSummary {
  distributionBatchId: string;
  sourceUserId: string;
  sourceDepositId: string;
  sourceAmount: number;
  totalCommissionsCreated: number;
  totalCommissionAmount: number;
  commissionsByLevel: Array<{
    level: number;
    count: number;
    amount: number;
    rate: number;
  }>;
  distributedAt: Date;
}

/**
 * User commission summary for dashboard
 */
export interface UserCommissionSummary {
  userId: string;
  totalEarned: number;
  pendingAmount: number;
  paidAmount: number;
  commissionCount: number;
  averageCommission: number;
  bestLevel: number;
  recentCommissions: Commission[];
  monthlyEarnings: Array<{
    month: string;
    amount: number;
    count: number;
  }>;
}

/**
 * Commission Repository - Essential MLM Commission Management
 */
export class CommissionRepository {
  private static readonly COMMISSIONS_TABLE = TABLE_NAMES.COMMISSIONS;

  /**
   * Create a new commission record (commission distribution)
   */
  static async createCommission(commission: Commission): Promise<Commission> {
    try {
      const item = commission.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.COMMISSIONS_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(commissionId)',
      };

      await dynamoDB.put(params).promise();
      return commission;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Commission ${commission.commissionId} already exists`);
      }
      throw new Error(`Failed to create commission: ${error.message}`);
    }
  }

  /**
   * Bulk create commissions for distribution (instant MLM distribution)
   */
  static async bulkCreateCommissions(bulkData: BulkCommissionData): Promise<Commission[]> {
    try {
      if (!bulkData.recipients || bulkData.recipients.length === 0) {
        return [];
      }

      // Create commission objects using the model's factory method
      const commissions = Commission.createBulkReferralCommissions(
        bulkData.sourceUserId,
        bulkData.sourceDepositId,
        bulkData.sourceAmount,
        bulkData.recipients
      );

      // Process commissions if batch ID provided
      if (bulkData.distributionBatchId) {
        commissions.forEach(commission => 
          commission.process(bulkData.distributionBatchId!)
        );
      }

      // Use DynamoDB batch write for efficiency
      const writeRequests = commissions.map(commission => ({
        PutRequest: {
          Item: commission.toDynamoItem(),
        },
      }));

      // Process in batches of 25 (DynamoDB limit)
      const batchSize = 25;
      for (let i = 0; i < writeRequests.length; i += batchSize) {
        const batch = writeRequests.slice(i, i + batchSize);

        const params: DynamoDB.DocumentClient.BatchWriteItemInput = {
          RequestItems: {
            [this.COMMISSIONS_TABLE]: batch,
          },
        };

        await dynamoDB.batchWrite(params).promise();
      }

      return commissions;
    } catch (error: any) {
      throw new Error(`Failed to bulk create commissions: ${error.message}`);
    }
  }

  /**
   * Get commission by ID (commission details, payment processing)
   */
  static async getCommissionById(commissionId: string): Promise<Commission | null> {
    try {
      if (!commissionId || typeof commissionId !== 'string') {
        throw new Error('Commission ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.COMMISSIONS_TABLE,
        Key: { commissionId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return Commission.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get commission: ${error.message}`);
    }
  }

  /**
   * Get user's commission history (user dashboard, commission tracking)
   */
  static async getUserCommissions(
    userId: string,
    status?: CommissionStatus,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedCommissionResult> {
         try {
       const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.COMMISSIONS_TABLE,
        IndexName: GSI_NAMES.COMMISSIONS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      // Add status filter if provided
      if (status) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues = {
          ...params.ExpressionAttributeValues,
          ':status': status,
        };
      }

      const result = await dynamoDB.query(params).promise();
      
      const commissions = result.Items?.map(item => Commission.fromPersistence(item)) || [];

      return {
        commissions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user commissions: ${error.message}`);
    }
  }

  /**
   * Get commissions by source user (track commissions generated by user)
   */
  static async getCommissionsBySource(
    sourceUserId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedCommissionResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.COMMISSIONS_TABLE,
        IndexName: GSI_NAMES.COMMISSIONS_SOURCE_USER_ID_CREATED_AT,
        KeyConditionExpression: 'sourceUserId = :sourceUserId',
        ExpressionAttributeValues: {
          ':sourceUserId': sourceUserId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const commissions = result.Items?.map(item => Commission.fromPersistence(item)) || [];

      return {
        commissions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get commissions by source: ${error.message}`);
    }
  }

  /**
   * Get commissions by status (processing workflows, payment management)
   */
  static async getCommissionsByStatus(
    status: CommissionStatus,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedCommissionResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.COMMISSIONS_TABLE,
        IndexName: GSI_NAMES.COMMISSIONS_STATUS_CREATED_AT,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
        },
        Limit: limit,
        ScanIndexForward: true, // Oldest first for processing
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const commissions = result.Items?.map(item => Commission.fromPersistence(item)) || [];

      return {
        commissions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get commissions by status: ${error.message}`);
    }
  }

  /**
   * Get commissions by batch ID (batch processing, audit trail)
   */
  static async getCommissionsByBatch(
    distributionBatchId: string,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedCommissionResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.COMMISSIONS_TABLE,
        IndexName: GSI_NAMES.COMMISSIONS_BATCH_ID_CREATED_AT,
        KeyConditionExpression: 'distributionBatchId = :batchId',
        ExpressionAttributeValues: {
          ':batchId': distributionBatchId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const commissions = result.Items?.map(item => Commission.fromPersistence(item)) || [];

      return {
        commissions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get commissions by batch: ${error.message}`);
    }
  }

  /**
   * Update commission status (processing workflow, payment management)
   */
  static async updateCommissionStatus(
    commissionId: string,
    status: CommissionStatus,
    distributionBatchId?: string
  ): Promise<Commission> {
    try {
      const updateExpressions: string[] = ['#status = :status', 'UpdatedAt = :updatedAt'];
      const expressionAttributeNames: { [key: string]: string } = { '#status': 'status' };
      const expressionAttributeValues: { [key: string]: any } = {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      };

      // Add batch ID if provided
      if (distributionBatchId) {
        updateExpressions.push('distributionBatchId = :batchId');
        expressionAttributeValues[':batchId'] = distributionBatchId;
      }

      // Add timestamp based on status
      if (status === CommissionStatus.PROCESSED) {
        updateExpressions.push('processedAt = :processedAt');
        expressionAttributeValues[':processedAt'] = new Date().toISOString();
      } else if (status === CommissionStatus.PAID) {
        updateExpressions.push('paidAt = :paidAt');
        expressionAttributeValues[':paidAt'] = new Date().toISOString();
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.COMMISSIONS_TABLE,
        Key: { commissionId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(commissionId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Commission.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Commission ${commissionId} not found`);
      }
      throw new Error(`Failed to update commission status: ${error.message}`);
    }
  }

  /**
   * Batch update commission statuses (efficient processing workflows)
   */
  static async batchUpdateCommissionStatuses(
    commissionIds: string[],
    status: CommissionStatus,
    distributionBatchId?: string
  ): Promise<void> {
    try {
      if (!commissionIds || commissionIds.length === 0) {
        return;
      }

      // Process updates in parallel for efficiency
      const updatePromises = commissionIds.map(commissionId => 
        this.updateCommissionStatus(commissionId, status, distributionBatchId)
      );

      await Promise.all(updatePromises);
    } catch (error: any) {
      throw new Error(`Failed to batch update commission statuses: ${error.message}`);
    }
  }

  /**
   * Get user commission summary (dashboard analytics)
   */
  static async getUserCommissionSummary(userId: string): Promise<UserCommissionSummary> {
    try {
      // Get all user commissions
      const { commissions } = await this.getUserCommissions(userId, undefined, 1000);

      // Calculate summary statistics
      const totalEarned = commissions.reduce((sum, comm) => sum + comm.amount, 0);
      const pendingAmount = commissions
        .filter(comm => comm.isPending())
        .reduce((sum, comm) => sum + comm.amount, 0);
      const paidAmount = commissions
        .filter(comm => comm.isPaid())
        .reduce((sum, comm) => sum + comm.amount, 0);

      const averageCommission = commissions.length > 0 ? totalEarned / commissions.length : 0;
      
      // Find best performing level
      const levelCounts = [0, 0, 0, 0, 0]; // For levels 1-5
      commissions.forEach(comm => {
        if (comm.level >= 1 && comm.level <= 5) {
          levelCounts[comm.level - 1]++;
        }
      });
      const bestLevel = levelCounts.indexOf(Math.max(...levelCounts)) + 1;

      // Get recent commissions (last 10)
      const recentCommissions = commissions.slice(0, 10);

      // Calculate monthly earnings (last 12 months)
      const monthlyEarnings: Array<{ month: string; amount: number; count: number }> = [];
      const now = new Date();
      
      for (let i = 0; i < 12; i++) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = month.toISOString().substring(0, 7); // YYYY-MM format
        
        const monthCommissions = commissions.filter(comm => 
          comm.createdAt.toISOString().substring(0, 7) === monthStr
        );
        
        monthlyEarnings.unshift({
          month: monthStr,
          amount: monthCommissions.reduce((sum, comm) => sum + comm.amount, 0),
          count: monthCommissions.length,
        });
      }

      return {
        userId,
        totalEarned,
        pendingAmount,
        paidAmount,
        commissionCount: commissions.length,
        averageCommission,
        bestLevel,
        recentCommissions,
        monthlyEarnings,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user commission summary: ${error.message}`);
    }
  }

  /**
   * Get commission statistics summary (admin analytics)
   */
  static async getCommissionStatisticsSummary(): Promise<CommissionStatisticsSummary> {
    try {
      // Get all commissions for comprehensive analysis
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.COMMISSIONS_TABLE,
      };

      const result = await dynamoDB.scan(params).promise();
      const allCommissions = result.Items?.map(item => Commission.fromPersistence(item)) || [];

      const summary: CommissionStatisticsSummary = {
        totalCommissions: allCommissions.length,
        totalAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        processedCount: 0,
        processedAmount: 0,
        paidCount: 0,
        paidAmount: 0,
        cancelledCount: 0,
        cancelledAmount: 0,
        levelBreakdown: {
          level1: { count: 0, amount: 0, rate: 0.10 },
          level2: { count: 0, amount: 0, rate: 0.05 },
          level3: { count: 0, amount: 0, rate: 0.03 },
          level4: { count: 0, amount: 0, rate: 0.01 },
          level5: { count: 0, amount: 0, rate: 0.01 },
        },
        averageCommissionAmount: 0,
        averageProcessingTimeInDays: 0,
        overdueCount: 0,
      };

      let totalProcessingDays = 0;
      let processedCommissionsCount = 0;

      // Analyze all commissions
      for (const commission of allCommissions) {
        summary.totalAmount += commission.amount;

        // Status breakdown
        if (commission.isPending()) {
          summary.pendingCount++;
          summary.pendingAmount += commission.amount;
        } else if (commission.isProcessed()) {
          summary.processedCount++;
          summary.processedAmount += commission.amount;
        } else if (commission.isPaid()) {
          summary.paidCount++;
          summary.paidAmount += commission.amount;
        } else if (commission.isCancelled()) {
          summary.cancelledCount++;
          summary.cancelledAmount += commission.amount;
        }

        // Level breakdown
        const levelKey = `level${commission.level}` as keyof typeof summary.levelBreakdown;
        if (summary.levelBreakdown[levelKey]) {
          summary.levelBreakdown[levelKey].count++;
          summary.levelBreakdown[levelKey].amount += commission.amount;
        }

        // Processing time tracking
        if (commission.isProcessed() || commission.isPaid()) {
          totalProcessingDays += commission.getProcessingDelayInDays();
          processedCommissionsCount++;
        }

        // Overdue tracking
        if (commission.isOverdue()) {
          summary.overdueCount++;
        }
      }

      // Calculate averages
      if (summary.totalCommissions > 0) {
        summary.averageCommissionAmount = summary.totalAmount / summary.totalCommissions;
      }
      
      if (processedCommissionsCount > 0) {
        summary.averageProcessingTimeInDays = totalProcessingDays / processedCommissionsCount;
      }

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get commission statistics summary: ${error.message}`);
    }
  }

  /**
   * Get commission distribution summary (batch audit, distribution analytics)
   */
  static async getCommissionDistributionSummary(
    distributionBatchId: string
  ): Promise<CommissionDistributionSummary> {
    try {
      const { commissions } = await this.getCommissionsByBatch(distributionBatchId, 1000);

      if (commissions.length === 0) {
        throw new Error(`No commissions found for batch ${distributionBatchId}`);
      }

      // Get source information from first commission
      const firstCommission = commissions[0];
      const sourceUserId = firstCommission.sourceUserId;
      const sourceDepositId = firstCommission.sourceDepositId;
      const sourceAmount = firstCommission.sourceAmount;

      const totalCommissionAmount = commissions.reduce((sum, comm) => sum + comm.amount, 0);

      // Group by level
      const levelMap = new Map<number, { count: number; amount: number }>();
      commissions.forEach(commission => {
        const existing = levelMap.get(commission.level) || { count: 0, amount: 0 };
        levelMap.set(commission.level, {
          count: existing.count + 1,
          amount: existing.amount + commission.amount,
        });
      });

      const commissionsByLevel = Array.from(levelMap.entries()).map(([level, data]) => ({
        level,
        count: data.count,
        amount: data.amount,
        rate: [0.10, 0.05, 0.03, 0.01, 0.01][level - 1] || 0,
      }));

      return {
        distributionBatchId,
        sourceUserId,
        sourceDepositId,
        sourceAmount,
        totalCommissionsCreated: commissions.length,
        totalCommissionAmount,
        commissionsByLevel,
        distributedAt: firstCommission.createdAt,
      };
    } catch (error: any) {
      throw new Error(`Failed to get commission distribution summary: ${error.message}`);
    }
  }

  /**
   * Get pending commissions for processing (batch processing workflows)
   */
  static async getPendingCommissions(
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedCommissionResult> {
    return this.getCommissionsByStatus(CommissionStatus.PENDING, limit, lastEvaluatedKey);
  }

  /**
   * Get processed commissions for payment (payment processing workflows)
   */
  static async getProcessedCommissions(
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedCommissionResult> {
    return this.getCommissionsByStatus(CommissionStatus.PROCESSED, limit, lastEvaluatedKey);
  }

  /**
   * Batch get commissions by IDs (bulk operations, payment processing)
   */
  static async batchGetCommissions(commissionIds: string[]): Promise<Commission[]> {
    try {
      if (!commissionIds || commissionIds.length === 0) {
        return [];
      }

      // DynamoDB batch get limit is 100 items
      const batchSize = 100;
      const batches: string[][] = [];

      for (let i = 0; i < commissionIds.length; i += batchSize) {
        batches.push(commissionIds.slice(i, i + batchSize));
      }

      const allCommissions: Commission[] = [];

      for (const batch of batches) {
        const keys = batch.map(commissionId => ({ commissionId }));

        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [this.COMMISSIONS_TABLE]: {
              Keys: keys,
            },
          },
        };

        const result = await dynamoDB.batchGet(params).promise();
        const items = result.Responses?.[this.COMMISSIONS_TABLE] || [];
        
        const commissions = items.map(item => Commission.fromPersistence(item));
        allCommissions.push(...commissions);
      }

      return allCommissions;
    } catch (error: any) {
      throw new Error(`Failed to batch get commissions: ${error.message}`);
    }
  }

  /**
   * Delete commission (admin cleanup, test data removal)
   */
  static async deleteCommission(commissionId: string): Promise<void> {
    try {
      const params: DynamoDB.DocumentClient.DeleteItemInput = {
        TableName: this.COMMISSIONS_TABLE,
        Key: { commissionId },
        ConditionExpression: 'attribute_exists(commissionId)',
      };

      await dynamoDB.delete(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Commission ${commissionId} not found`);
      }
      throw new Error(`Failed to delete commission: ${error.message}`);
    }
  }
}

/**
 * COMMISSION REPOSITORY - ESSENTIAL METHODS:
 * =========================================
 * 
 * COMMISSION MANAGEMENT:
 * - createCommission() - Create individual commission records
 * - bulkCreateCommissions() - Instant MLM distribution (5-level commission)
 * - getCommissionById() - Get commission details for payment processing
 * - updateCommissionStatus() - Status transitions (PENDING → PROCESSED → PAID)
 * - batchUpdateCommissionStatuses() - Efficient batch processing
 * 
 * USER COMMISSION TRACKING:
 * - getUserCommissions() - User commission history with pagination
 * - getUserCommissionSummary() - Dashboard analytics and summaries
 * - getCommissionsBySource() - Track commissions generated by user deposits
 * 
 * PROCESSING WORKFLOWS:
 * - getPendingCommissions() - Get commissions ready for processing
 * - getProcessedCommissions() - Get commissions ready for payment
 * - getCommissionsByStatus() - Status-based workflow queries
 * - getCommissionsByBatch() - Batch processing and audit trails
 * 
 * ANALYTICS & REPORTING:
 * - getCommissionStatisticsSummary() - Comprehensive network analytics
 * - getCommissionDistributionSummary() - Batch distribution analytics
 * - batchGetCommissions() - Bulk operations for reports
 * 
 * SUPPORTED ENDPOINTS:
 * - GET /api/v1/commissions → getUserCommissions()
 * - GET /api/v1/commissions/summary → getUserCommissionSummary()
 * - GET /api/v1/admin/commissions/stats → getCommissionStatisticsSummary()
 * - POST /api/v1/commissions/distribute → bulkCreateCommissions()
 * - PUT /api/v1/commissions/:id/status → updateCommissionStatus()
 * 
 * 5-LEVEL MLM COMMISSION SYSTEM:
 * - Level 1 (Direct): 10% commission
 * - Level 2 (Grandparent): 5% commission
 * - Level 3 (Great-grandparent): 3% commission
 * - Level 4 (Level 4 ancestor): 1% commission
 * - Level 5 (Level 5 ancestor): 1% commission
 * 
 * COMMISSION LIFECYCLE:
 * - PENDING: Commission calculated but not yet processed
 * - PROCESSED: Commission approved and ready for payment
 * - PAID: Commission credited to user's wallet
 * - CANCELLED: Commission cancelled (user ineligible, etc.)
 * 
 * BUSINESS OPERATIONS:
 * - Deposit processing: bulkCreateCommissions() for instant distribution
 * - Payment processing: getProcessedCommissions() + batchUpdateCommissionStatuses()
 * - User dashboard: getUserCommissionSummary() + getUserCommissions()
 * - Admin analytics: getCommissionStatisticsSummary()
 * - Audit trails: getCommissionsByBatch() + getCommissionDistributionSummary()
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Batch writes for commission distribution (up to 25 at once)
 * - Parallel status updates for processing workflows
 * - GSI indexes for efficient user, status, and batch queries
 * - Paginated results for large commission histories
 * - Bulk operations for payment processing and analytics
 */
