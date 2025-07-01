/**
 * SessionRepository - Essential Data Access Layer for Session entities
 * 
 * Streamlined repository focused on actual platform authentication requirements:
 * - JWT session management (create, retrieve, refresh, revoke)
 * - User session tracking and security
 * - Session cleanup and expiry handling
 * - Essential authentication operations only
 */

import { DynamoDB } from 'aws-sdk';
import { Session } from '../models/Session';
import { SessionStatus } from '../types/enums';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated session result structure
 */
export interface PaginatedSessionResult {
  sessions: Session[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Streamlined Session Repository - Only Essential Methods
 */
export class SessionRepository {
  private static readonly TABLE_NAME = TABLE_NAMES.SESSIONS;

  /**
   * Create a new session (login, registration completion)
   */
  static async createSession(session: Session): Promise<Session> {
    try {
      const item = session.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(sessionId)',
      };

      await dynamoDB.put(params).promise();
      return session;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Session with ID ${session.id} already exists`);
      }
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  /**
   * Get session by ID (authentication middleware, token validation)
   */
  static async getSessionById(sessionId: string): Promise<Session | null> {
    try {
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Session ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.TABLE_NAME,
        Key: { sessionId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return Session.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get session by ID: ${error.message}`);
    }
  }

  /**
   * Update session access token (token refresh flow)
   */
  static async updateSessionAccessToken(
    sessionId: string, 
    accessToken: string, 
    expiresAt: Date
  ): Promise<Session> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { sessionId },
        UpdateExpression: 'SET accessToken = :accessToken, expiresAt = :expiresAt, lastAccessedAt = :lastAccessedAt, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':accessToken': accessToken,
          ':expiresAt': expiresAt.toISOString(),
          ':lastAccessedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(sessionId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Session.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      throw new Error(`Failed to update session access token: ${error.message}`);
    }
  }

  /**
   * Update last access time (activity tracking)
   */
  static async updateLastAccess(sessionId: string): Promise<void> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { sessionId },
        UpdateExpression: 'SET lastAccessedAt = :lastAccessedAt, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastAccessedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(sessionId)',
      };

      await dynamoDB.update(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      throw new Error(`Failed to update last access: ${error.message}`);
    }
  }

  /**
   * Revoke session (logout, security revocation)
   */
  static async revokeSession(sessionId: string, reason: string = 'User logout'): Promise<Session> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { sessionId },
        UpdateExpression: 'SET #status = :status, isRevoked = :isRevoked, revokedAt = :revokedAt, revokedReason = :revokedReason, UpdatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': SessionStatus.REVOKED,
          ':isRevoked': true,
          ':revokedAt': new Date().toISOString(),
          ':revokedReason': reason,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(sessionId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Session.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      throw new Error(`Failed to revoke session: ${error.message}`);
    }
  }

  /**
   * Get all sessions for a user (session management, security)
   */
  static async getUserSessions(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedSessionResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.SESSIONS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const sessions = result.Items?.map(item => Session.fromPersistence(item)) || [];

      return {
        sessions,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
  }

  /**
   * Get active sessions for a user (security, concurrent session limits)
   */
  static async getUserActiveSessions(userId: string): Promise<Session[]> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.SESSIONS_USER_ID_CREATED_AT,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: '#status = :status AND isRevoked = :isRevoked',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':status': SessionStatus.ACTIVE,
          ':isRevoked': false,
        },
      };

      const result = await dynamoDB.query(params).promise();
      
      const sessions = result.Items?.map(item => Session.fromPersistence(item)) || [];
      
      // Filter out expired sessions on the client side
      return sessions.filter(session => session.isActive());
    } catch (error: any) {
      throw new Error(`Failed to get active user sessions: ${error.message}`);
    }
  }

  /**
   * Revoke all sessions for a user (security, password change, admin action)
   */
  static async revokeAllUserSessions(userId: string, reason: string = 'Security action'): Promise<number> {
    try {
      // First get all active sessions for the user
      const activeSessions = await this.getUserActiveSessions(userId);
      
      if (activeSessions.length === 0) {
        return 0;
      }

      // Revoke each session
      const revokePromises = activeSessions.map(session => 
        this.revokeSession(session.id, reason)
      );

      await Promise.all(revokePromises);
      return activeSessions.length;
    } catch (error: any) {
      throw new Error(`Failed to revoke all user sessions: ${error.message}`);
    }
  }

  /**
   * Delete expired sessions (cleanup job)
   */
  static async deleteExpiredSessions(): Promise<number> {
    try {
      // DynamoDB TTL should handle this automatically, but this provides manual cleanup
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TABLE_NAME,
        FilterExpression: 'refreshExpiresAt < :now',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
        },
        ProjectionExpression: 'sessionId',
      };

      const result = await dynamoDB.scan(params).promise();
      const expiredSessions = result.Items || [];

      if (expiredSessions.length === 0) {
        return 0;
      }

      // Delete expired sessions in batches
      const batchSize = 25; // DynamoDB batch limit
      let deletedCount = 0;

      for (let i = 0; i < expiredSessions.length; i += batchSize) {
        const batch = expiredSessions.slice(i, i + batchSize);
        
        const deleteRequests = batch.map(item => ({
          DeleteRequest: {
            Key: { sessionId: item.sessionId },
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
      throw new Error(`Failed to delete expired sessions: ${error.message}`);
    }
  }

  /**
   * Get session by refresh token (token refresh validation)
   */
  static async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    try {
      // Note: This requires a scan since we don't have a GSI on refreshToken
      // In production, consider adding a GSI if this query is frequent
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TABLE_NAME,
        FilterExpression: 'refreshToken = :refreshToken',
        ExpressionAttributeValues: {
          ':refreshToken': refreshToken,
        },
        Limit: 1,
      };

      const result = await dynamoDB.scan(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return Session.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get session by refresh token: ${error.message}`);
    }
  }

  /**
   * Update device information (security tracking)
   */
  static async updateDeviceInfo(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string
  ): Promise<Session> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeValues: { [key: string]: any } = {
        ':lastAccessedAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
      };

      updateExpressions.push('lastAccessedAt = :lastAccessedAt');
      updateExpressions.push('UpdatedAt = :updatedAt');

      if (ipAddress) {
        updateExpressions.push('ipAddress = :ipAddress');
        expressionAttributeValues[':ipAddress'] = ipAddress;
      }

      if (userAgent) {
        updateExpressions.push('userAgent = :userAgent');
        expressionAttributeValues[':userAgent'] = userAgent;
      }

      if (deviceInfo) {
        updateExpressions.push('deviceInfo = :deviceInfo');
        expressionAttributeValues[':deviceInfo'] = deviceInfo;
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { sessionId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(sessionId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return Session.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      throw new Error(`Failed to update device info: ${error.message}`);
    }
  }
}

/**
 * STREAMLINED IMPLEMENTATION - ESSENTIAL METHODS ONLY:
 * ===================================================
 * 
 * JWT SESSION MANAGEMENT:
 * - createSession() - Create new authenticated session
 * - getSessionById() - Retrieve session for token validation
 * - updateSessionAccessToken() - Token refresh flow
 * - revokeSession() - Single session logout/revocation
 * - updateLastAccess() - Activity tracking
 * 
 * USER SESSION MANAGEMENT:
 * - getUserSessions() - All sessions for a user (with pagination)
 * - getUserActiveSessions() - Active sessions only
 * - revokeAllUserSessions() - Security action (password change, etc.)
 * 
 * SECURITY & MAINTENANCE:
 * - getSessionByRefreshToken() - Refresh token validation
 * - updateDeviceInfo() - Security tracking and device management
 * - deleteExpiredSessions() - Cleanup job for expired sessions
 * 
 * REMOVED OVER-ENGINEERED FEATURES:
 * - Complex session analytics and reporting
 * - Session statistics and aggregations
 * - Advanced filtering and searching
 * - Session migration and backup operations
 * - Custom session policies and rules
 * 
 * This streamlined version focuses on actual authentication endpoints and
 * security requirements from TECHNICAL.md, providing essential session
 * management for the JWT-based authentication system.
 */
