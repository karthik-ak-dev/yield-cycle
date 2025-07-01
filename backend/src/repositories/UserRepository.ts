/**
 * UserRepository - Essential Data Access Layer for User entities
 * 
 * Streamlined repository focused on actual platform requirements:
 * - Authentication support (registration, login)
 * - User profile management
 * - Admin user operations
 * - Earnings tracking for 200% cap
 * - Essential business operations only
 */

import { DynamoDB } from 'aws-sdk';
import { User } from '../models/User';
import { UserRole, UserStatus } from '../types/enums';
import { ValidationUtils } from '../utils/calculations';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated result structure
 */
export interface PaginatedUserResult {
  users: User[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Basic user statistics for admin dashboard
 */
export interface UserStatistics {
  total: number;
  active: number;
  suspended: number;
  pendingVerification: number;
  verified: number;
  admins: number;
  depositors: number;
}

/**
 * Streamlined User Repository - Only Essential Methods
 */
export class UserRepository {
  private static readonly TABLE_NAME = TABLE_NAMES.USERS;

  /**
   * Create a new user (registration flow)
   */
  static async createUser(user: User): Promise<User> {
    try {
      const item = user.toDynamoItem();

      // Check if user with email already exists
      const existingUser = await this.getUserByEmail(user.email);
      if (existingUser) {
        throw new Error(`User with email ${user.email} already exists`);
      }

      // Check if referral code already exists (should be unique)
      const existingReferralUser = await this.getUserByReferralCode(user.referralCode);
      if (existingReferralUser) {
        throw new Error(`User with referral code ${user.referralCode} already exists`);
      }

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(userId)',
      };

      await dynamoDB.put(params).promise();
      return user;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${user.id} already exists`);
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Get user by ID (profile, dashboard operations)
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return User.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get user by ID: ${error.message}`);
    }
  }

  /**
   * Get user by email (authentication - login)
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      if (!email || typeof email !== 'string') {
        throw new Error('Email is required');
      }

      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.USERS_EMAIL_CREATED_AT,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase().trim(),
        },
        Limit: 1,
      };

      const result = await dynamoDB.query(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return User.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get user by email: ${error.message}`);
    }
  }

  /**
   * Get user by referral code (registration validation, referral tree)
   */
  static async getUserByReferralCode(referralCode: string): Promise<User | null> {
    try {
      if (!referralCode || typeof referralCode !== 'string') {
        throw new Error('Referral code is required');
      }

      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.USERS_REFERRAL_CODE_USER_ID,
        KeyConditionExpression: 'referralCode = :referralCode',
        ExpressionAttributeValues: {
          ':referralCode': referralCode.toUpperCase(),
        },
        Limit: 1,
      };

      const result = await dynamoDB.query(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return User.fromPersistence(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to get user by referral code: ${error.message}`);
    }
  }

  /**
   * Update user profile (profile management endpoint)
   */
  static async updateUserProfile(
    userId: string, 
    updates: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      country?: string;
      timezone?: string;
    }
  ): Promise<User> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      // Update profile using User model methods
      user.updateProfile(
        updates.firstName,
        updates.lastName,
        updates.phoneNumber,
        updates.country,
        updates.timezone
      );

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'SET profile = :profile, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':profile': user.profile.toJSON(),
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return User.fromPersistence(result.Attributes);
    } catch (error: any) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  /**
   * Update user status (admin operations, email verification)
   */
  static async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'SET #status = :status, UpdatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return User.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw new Error(`Failed to update user status: ${error.message}`);
    }
  }

  /**
   * Verify user email (OTP verification flow)
   */
  static async verifyUserEmail(userId: string): Promise<User> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'SET isEmailVerified = :verified, #status = :status, UpdatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':verified': true,
          ':status': UserStatus.ACTIVE, // Auto-activate on email verification
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return User.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw new Error(`Failed to verify user email: ${error.message}`);
    }
  }

  /**
   * Update user password hash (password change)
   */
  static async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    try {
      if (!passwordHash || typeof passwordHash !== 'string') {
        throw new Error('Password hash is required');
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'SET passwordHash = :passwordHash, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':passwordHash': passwordHash,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
      };

      await dynamoDB.update(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw new Error(`Failed to update user password: ${error.message}`);
    }
  }

  /**
   * Record user login activity (security tracking)
   */
  static async recordUserLogin(userId: string): Promise<void> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'SET lastLoginAt = :lastLoginAt, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastLoginAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
      };

      await dynamoDB.update(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw new Error(`Failed to record user login: ${error.message}`);
    }
  }

  /**
   * Add earnings to user total (commission distribution, monthly income)
   */
  static async addUserEarnings(userId: string, amount: number): Promise<User> {
    try {
      if (!ValidationUtils.isPositiveNumber(amount)) {
        throw new Error('Earnings amount must be positive');
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'ADD totalEarnings :amount SET UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':amount': amount,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return User.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw new Error(`Failed to add user earnings: ${error.message}`);
    }
  }

  /**
   * Update user deposit address (blockchain integration)
   */
  static async updateUserDepositAddress(userId: string, depositAddress: string): Promise<User> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.TABLE_NAME,
        Key: { userId },
        UpdateExpression: 'SET depositAddress = :depositAddress, UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':depositAddress': depositAddress,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return User.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`User with ID ${userId} not found`);
      }
      throw new Error(`Failed to update user deposit address: ${error.message}`);
    }
  }

  /**
   * Get all users for admin dashboard (with pagination)
   */
  static async getAllUsers(
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedUserResult> {
    try {
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TABLE_NAME,
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.scan(params).promise();
      
      const users = result.Items?.map(item => User.fromPersistence(item)) || [];

      return {
        users,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get all users: ${error.message}`);
    }
  }

  /**
   * Get users by status (admin filtering)
   */
  static async getUsersByStatus(
    status: UserStatus, 
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedUserResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.TABLE_NAME,
        IndexName: GSI_NAMES.USERS_STATUS_CREATED_AT,
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
      
      const users = result.Items?.map(item => User.fromPersistence(item)) || [];

      return {
        users,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get users by status: ${error.message}`);
    }
  }

  /**
   * Get user statistics for admin dashboard
   */
  static async getUserStatistics(): Promise<UserStatistics> {
    try {
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.TABLE_NAME,
        ProjectionExpression: '#status, #role, isEmailVerified',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#role': 'role',
        },
      };

      const result = await dynamoDB.scan(params).promise();
      const items = result.Items || [];

      const stats: UserStatistics = {
        total: items.length,
        active: 0,
        suspended: 0,
        pendingVerification: 0,
        verified: 0,
        admins: 0,
        depositors: 0,
      };

      for (const item of items) {
        // Status counts
        if (item.status === UserStatus.ACTIVE) stats.active++;
        if (item.status === UserStatus.SUSPENDED) stats.suspended++;
        if (item.status === UserStatus.PENDING_VERIFICATION) stats.pendingVerification++;

        // Role counts
        if (item.role === UserRole.ADMIN) stats.admins++;
        if (item.role === UserRole.DEPOSITOR) stats.depositors++;

        // Verification count
        if (item.isEmailVerified) stats.verified++;
      }

      return stats;
    } catch (error: any) {
      throw new Error(`Failed to get user statistics: ${error.message}`);
    }
  }

  /**
   * Batch get users by IDs (for commission distribution, team stats)
   */
  static async batchGetUsers(userIds: string[]): Promise<User[]> {
    try {
      if (!userIds || userIds.length === 0) {
        return [];
      }

      // DynamoDB batch get limit is 100 items
      const batchSize = 100;
      const batches: string[][] = [];

      for (let i = 0; i < userIds.length; i += batchSize) {
        batches.push(userIds.slice(i, i + batchSize));
      }

      const allUsers: User[] = [];

      for (const batch of batches) {
        const keys = batch.map(userId => ({ userId }));

        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [this.TABLE_NAME]: {
              Keys: keys,
            },
          },
        };

        const result = await dynamoDB.batchGet(params).promise();
        const items = result.Responses?.[this.TABLE_NAME] || [];
        
        const users = items.map(item => User.fromPersistence(item));
        allUsers.push(...users);
      }

      return allUsers;
    } catch (error: any) {
      throw new Error(`Failed to batch get users: ${error.message}`);
    }
  }
}

/**
 * STREAMLINED IMPLEMENTATION - ESSENTIAL METHODS ONLY:
 * ===================================================
 * 
 * AUTHENTICATION SUPPORT:
 * - createUser() - User registration
 * - getUserByEmail() - Login authentication
 * - getUserByReferralCode() - Referral validation
 * - verifyUserEmail() - OTP verification flow
 * - updateUserPassword() - Password management
 * - recordUserLogin() - Security tracking
 * 
 * USER PROFILE MANAGEMENT:
 * - getUserById() - Profile retrieval
 * - updateUserProfile() - Profile updates
 * - updateUserStatus() - Status management
 * - updateUserDepositAddress() - Blockchain integration
 * 
 * BUSINESS OPERATIONS:
 * - addUserEarnings() - Commission/income tracking
 * - batchGetUsers() - Bulk operations for MLM
 * 
 * ADMIN OPERATIONS:
 * - getAllUsers() - Admin user list
 * - getUsersByStatus() - Admin filtering
 * - getUserStatistics() - Dashboard metrics
 * 
 * REMOVED OVER-ENGINEERED FEATURES:
 * - Complex search with multiple criteria
 * - Client-side sorting (use database sorting)
 * - Unnecessary filter combinations
 * - Hard delete operations (not needed)
 * - getUsersWithReferrals() (use ReferralRepository)
 * - Complex update methods (use specific methods)
 * 
 * This streamlined version focuses on actual API endpoints and business
 * requirements from TECHNICAL.md, removing unnecessary complexity while
 * maintaining all essential functionality for the yield cycle platform.
 */
