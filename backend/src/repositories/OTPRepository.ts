/**
 * OTPRepository - Essential Data Access Layer for OTP entities
 * 
 * Streamlined repository focused on actual platform authentication requirements:
 * - OTP creation for registration, login, password reset
 * - OTP retrieval and verification for authentication flows
 * - Security features: attempt tracking, expiry handling
 * - Essential OTP operations only
 */

import { DynamoDB } from 'aws-sdk';
import { OTP } from '../models/OTP';
import { OTPType } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Streamlined OTP Repository - Only Essential Methods
 */
export class OTPRepository {
  private static readonly TABLE_NAME = TABLE_NAMES.OTP;

  /**
   * Create a new OTP (registration, login, password reset)
   */
  static async createOTP(otp: OTP): Promise<OTP> {
    try {
      const item = otp.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(otpId)',
      };

      await dynamoDB.put(params).promise();
      return otp;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`OTP with ID ${otp.id} already exists`);
      }
      throw new Error(`Failed to create OTP: ${error.message}`);
    }
  }

  /**
   * Get latest OTP for user and type (verification flow)
   * Returns the most recent OTP for the user/type combination
   */
  static async getLatestOTPForUser(userId: string, type: OTPType): Promise<OTP | null> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID is required');
      }

      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.OTP_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':type': type,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1,
      };

      const result = await dynamoDB.query(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return OTP.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get latest OTP for user: ${error.message}`);
    }
  }

  /**
   * Get OTP by ID (direct access)
   */
  static async getOTPById(otpId: string): Promise<OTP | null> {
    try {
      if (!otpId || typeof otpId !== 'string') {
        throw new Error('OTP ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.TABLE_NAME,
        Key: { otpId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return OTP.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get OTP by ID: ${error.message}`);
    }
  }

  /**
   * Update OTP attempt count (failed verification tracking)
   */
  static async incrementAttempts(otpId: string): Promise<OTP> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { otpId },
        UpdateExpression: 'ADD attemptCount :increment SET UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':increment': 1,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(otpId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return OTP.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`OTP with ID ${otpId} not found`);
      }
      throw new Error(`Failed to increment OTP attempts: ${error.message}`);
    }
  }

  /**
   * Mark OTP as used (successful verification)
   */
  static async markAsUsed(otpId: string): Promise<OTP> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { otpId },
        UpdateExpression: 'SET isUsed = :isUsed, usedAt = :usedAt, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isUsed': true,
          ':usedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(otpId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return OTP.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`OTP with ID ${otpId} not found`);
      }
      throw new Error(`Failed to mark OTP as used: ${error.message}`);
    }
  }

  /**
   * Invalidate all pending OTPs for user and type (security, new OTP generation)
   * Used when generating a new OTP to ensure only one valid OTP per user/type
   */
  static async invalidatePendingOTPs(userId: string, type: OTPType): Promise<number> {
    try {
      // Get all pending OTPs for user and type
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.OTP_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#type = :type AND isUsed = :isUsed',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':type': type,
          ':isUsed': false,
        },
        ProjectionExpression: 'otpId',
      };

      const result = await dynamoDB.query(params).promise();
      const pendingOTPs = result.Items || [];

      if (pendingOTPs.length === 0) {
        return 0;
      }

      // Mark all as used (invalidated)
      const updatePromises = pendingOTPs.map(item => 
        this.markAsUsed(item.otpId)
      );

      await Promise.all(updatePromises);
      return pendingOTPs.length;
    } catch (error: any) {
      throw new Error(`Failed to invalidate pending OTPs: ${error.message}`);
    }
  }

  /**
   * Get all OTPs for a user (security audit, debugging)
   */
  static async getUserOTPs(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<{ otps: OTP[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.OTP_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const otps = result.Items?.map(item => OTP.fromPersistence(item)) || [];

      return {
        otps,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user OTPs: ${error.message}`);
    }
  }

  /**
   * Delete expired OTPs (cleanup job)
   * DynamoDB TTL should handle this automatically, but provides manual cleanup
   */
  static async deleteExpiredOTPs(): Promise<number> {
    try {
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TABLE_NAME,
        FilterExpression: 'expiresAt < :now',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
        },
        ProjectionExpression: 'otpId',
      };

      const result = await dynamoDB.scan(params).promise();
      const expiredOTPs = result.Items || [];

      if (expiredOTPs.length === 0) {
        return 0;
      }

      // Delete expired OTPs in batches
      const batchSize = 25; // DynamoDB batch limit
      let deletedCount = 0;

      for (let i = 0; i < expiredOTPs.length; i += batchSize) {
        const batch = expiredOTPs.slice(i, i + batchSize);
        
        const deleteRequests = batch.map(item => ({
          DeleteRequest: {
            Key: { otpId: item.otpId },
          },
        }));

        const batchParams: DynamoDB.DocumentClient.BatchWriteItemInput = {
          RequestItems: {
            [this.TABLE_NAME]: deleteRequests,
          },
        };

        await dynamoDB.batchWrite(batchParams).promise();
        deletedCount += batch.length;
      }

      return deletedCount;
    } catch (error: any) {
      throw new Error(`Failed to delete expired OTPs: ${error.message}`);
    }
  }

  /**
   * Get OTPs by type (admin monitoring, analytics)
   */
  static async getOTPsByType(
    type: OTPType,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<{ otps: OTP[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.OTP_TYPE_CREATED_AT,
        KeyConditionExpression: '#type = :type',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':type': type,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const otps = result.Items?.map(item => OTP.fromPersistence(item)) || [];

      return {
        otps,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get OTPs by type: ${error.message}`);
    }
  }

  /**
   * Update OTP code (regeneration scenario)
   * Used when user requests a new code before the current one expires
   */
  static async updateOTPCode(otpId: string, newCode: string, newExpiresAt: Date): Promise<OTP> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { otpId },
        UpdateExpression: 'SET code = :code, expiresAt = :expiresAt, attemptCount = :attemptCount, isUsed = :isUsed, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':code': newCode,
          ':expiresAt': newExpiresAt.toISOString(),
          ':attemptCount': 0, // Reset attempts
          ':isUsed': false, // Reset usage flag
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(otpId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return OTP.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`OTP with ID ${otpId} not found`);
      }
      throw new Error(`Failed to update OTP code: ${error.message}`);
    }
  }
}

/**
 * STREAMLINED IMPLEMENTATION - ESSENTIAL METHODS ONLY:
 * ===================================================
 * 
 * OTP LIFECYCLE MANAGEMENT:
 * - createOTP() - Create new OTP for authentication flows
 * - getLatestOTPForUser() - Get most recent OTP for verification
 * - getOTPById() - Direct OTP retrieval
 * - updateOTPCode() - Regenerate OTP code
 * 
 * VERIFICATION & SECURITY:
 * - incrementAttempts() - Track failed verification attempts
 * - markAsUsed() - Mark OTP as successfully used
 * - invalidatePendingOTPs() - Security: ensure one valid OTP per user/type
 * 
 * ADMIN & MAINTENANCE:
 * - getUserOTPs() - Get all OTPs for a user (audit, debugging)
 * - getOTPsByType() - Get OTPs by type (monitoring, analytics)
 * - deleteExpiredOTPs() - Cleanup job for expired OTPs
 * 
 * AUTHENTICATION ENDPOINTS SUPPORTED:
 * - POST /api/v1/auth/register → createOTP() for REGISTRATION
 * - POST /api/v1/auth/verify-registration → getLatestOTPForUser() + markAsUsed()
 * - POST /api/v1/auth/login → createOTP() for LOGIN
 * - POST /api/v1/auth/verify-login → getLatestOTPForUser() + markAsUsed()
 * - Password reset flow → createOTP() for PASSWORD_RESET
 * 
 * REMOVED OVER-ENGINEERED FEATURES:
 * - Complex OTP analytics and reporting
 * - Advanced filtering and search capabilities
 * - OTP statistics and aggregations
 * - Bulk OTP operations beyond cleanup
 * - Custom OTP policies and rules
 * - Multi-step OTP verification workflows
 * 
 * This streamlined version focuses on actual authentication requirements
 * from TECHNICAL.md, providing essential OTP management for the email-based
 * verification system with proper security controls.
 */
