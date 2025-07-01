/**
 * ReferralRepository - Data Access Layer for ReferralNode entities
 * 
 * Focused repository for 5-level MLM referral tree system:
 * - Materialized path + genealogy caching for optimal performance
 * - 5-level commission structure (10%, 5%, 3%, 1%, 1%)
 * - Efficient tree traversal and commission distribution
 * - Team statistics and network analytics
 * - Direct referral management and genealogy operations
 * 
 * Essential operations for MLM network management and commission processing.
 */

import { DynamoDB } from 'aws-sdk';
import { ReferralNode } from '../models/ReferralNode';
import { dynamoDB } from '../database/connection';
import { TABLE_NAMES, GSI_NAMES } from '../database/config';

/**
 * Paginated referral result structure
 */
export interface PaginatedReferralResult {
  referrals: ReferralNode[];
  lastEvaluatedKey?: any;
  hasMore: boolean;
}

/**
 * Team statistics summary for network analytics
 */
export interface TeamStatisticsSummary {
  totalNodes: number;
  totalVolume: number;
  totalCommissionEarned: number;
  averageVolumePerNode: number;
  levelDistribution: {
    level0: number; // Root nodes
    level1: number; // Direct referrals
    level2: number; // Level 2 team
    level3: number; // Level 3 team
    level4: number; // Level 4 team
    level5: number; // Level 5 team
  };
  topPerformers: Array<{
    userId: string;
    volume: number;
    commissionEarned: number;
    teamSize: number;
  }>;
}

/**
 * Network genealogy for instant commission distribution
 */
export interface NetworkGenealogy {
  userId: string;
  ancestors: {
    level1?: string; // 10% commission
    level2?: string; // 5% commission
    level3?: string; // 3% commission
    level4?: string; // 1% commission
    level5?: string; // 1% commission
  };
  commissionEligibleAncestors: string[];
}

/**
 * Tree integrity validation result
 */
export interface TreeIntegrityResult {
  isValid: boolean;
  issues: string[];
  nodesChecked: number;
  inconsistencies: Array<{
    userId: string;
    issue: string;
    severity: 'warning' | 'error';
  }>;
}

/**
 * Referral Repository - Essential MLM Tree Management
 */
export class ReferralRepository {
  private static readonly REFERRAL_NETWORK_TABLE = TABLE_NAMES.REFERRAL_NETWORK;

  /**
   * Create a new referral node (user registration, tree building)
   */
  static async createReferralNode(node: ReferralNode): Promise<ReferralNode> {
    try {
      const item = node.toDynamoItem();

      const params: DynamoDB.DocumentClient.PutItemInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(userId)',
      };

      await dynamoDB.put(params).promise();
      return node;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Referral node for user ${node.userId} already exists`);
      }
      throw new Error(`Failed to create referral node: ${error.message}`);
    }
  }

  /**
   * Get referral node by user ID (commission distribution, tree operations)
   */
  static async getReferralNode(userId: string): Promise<ReferralNode | null> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID is required');
      }

      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        Key: { userId },
      };

      const result = await dynamoDB.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return ReferralNode.fromPersistence(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to get referral node: ${error.message}`);
    }
  }

  /**
   * Get user's genealogy for instant commission distribution
   */
  static async getUserGenealogy(userId: string): Promise<NetworkGenealogy> {
    try {
      const node = await this.getReferralNode(userId);
      if (!node) {
        throw new Error(`Referral node not found for user ${userId}`);
      }

      const ancestors = {
        level1: node.genealogy.level1,
        level2: node.genealogy.level2,
        level3: node.genealogy.level3,
        level4: node.genealogy.level4,
        level5: node.genealogy.level5,
      };

      const commissionEligibleAncestors = node.genealogy.getAllAncestors();

      return {
        userId,
        ancestors,
        commissionEligibleAncestors,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user genealogy: ${error.message}`);
    }
  }

  /**
   * Get direct referrals of a user (network building, team management)
   */
  static async getDirectReferrals(
    userId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<PaginatedReferralResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        IndexName: GSI_NAMES.REFERRAL_PARENT_USER_ID_CREATED_AT,
        KeyConditionExpression: 'parentUserId = :parentUserId',
        ExpressionAttributeValues: {
          ':parentUserId': userId,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const referrals = result.Items?.map(item => ReferralNode.fromPersistence(item)) || [];

      return {
        referrals,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get direct referrals: ${error.message}`);
    }
  }

  /**
   * Get referral nodes by level (admin analytics, level-based reports)
   */
  static async getReferralsByLevel(
    level: number,
    limit: number = 100,
    lastEvaluatedKey?: any
  ): Promise<PaginatedReferralResult> {
    try {
      const params: DynamoDB.DocumentClient.QueryInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        IndexName: GSI_NAMES.REFERRAL_LEVEL_TEAM_VOLUME,
        KeyConditionExpression: '#level = :level',
        ExpressionAttributeNames: {
          '#level': 'level',
        },
        ExpressionAttributeValues: {
          ':level': level,
        },
        Limit: limit,
        ScanIndexForward: false, // Highest volume first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await dynamoDB.query(params).promise();
      
      const referrals = result.Items?.map(item => ReferralNode.fromPersistence(item)) || [];

      return {
        referrals,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey,
      };
    } catch (error: any) {
      throw new Error(`Failed to get referrals by level: ${error.message}`);
    }
  }

  /**
   * Update referral node statistics (team volume, commission, team size)
   */
  static async updateReferralNodeStatistics(
    userId: string,
    statistics: {
      teamVolumeChange?: number;
      teamSizeChange?: number;
      commissionChange?: number;
    }
  ): Promise<ReferralNode> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeValues: { [key: string]: any } = {
        ':updatedAt': new Date().toISOString(),
      };

      if (statistics.teamVolumeChange !== undefined && statistics.teamVolumeChange !== 0) {
        updateExpressions.push('totalTeamVolume = totalTeamVolume + :teamVolumeChange');
        expressionAttributeValues[':teamVolumeChange'] = statistics.teamVolumeChange;
      }

      if (statistics.teamSizeChange !== undefined && statistics.teamSizeChange !== 0) {
        updateExpressions.push('totalTeamSize = totalTeamSize + :teamSizeChange');
        expressionAttributeValues[':teamSizeChange'] = statistics.teamSizeChange;
      }

      if (statistics.commissionChange !== undefined && statistics.commissionChange !== 0) {
        updateExpressions.push('commissionEarned = commissionEarned + :commissionChange');
        expressionAttributeValues[':commissionChange'] = statistics.commissionChange;
      }

      updateExpressions.push('UpdatedAt = :updatedAt');

      if (updateExpressions.length === 1) {
        // Only timestamp update, no actual changes
        throw new Error('No statistics changes provided');
      }

      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return ReferralNode.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Referral node for user ${userId} not found`);
      }
      throw new Error(`Failed to update referral node statistics: ${error.message}`);
    }
  }

  /**
   * Batch update team statistics for commission distribution
   */
  static async batchUpdateTeamStatistics(
    updates: Array<{
      userId: string;
      teamVolumeChange: number;
      teamSizeChange?: number;
      commissionChange?: number;
    }>
  ): Promise<void> {
    try {
      if (!updates || updates.length === 0) {
        return;
      }

      // Process updates in parallel for efficiency
      const updatePromises = updates.map(update => 
        this.updateReferralNodeStatistics(update.userId, {
          teamVolumeChange: update.teamVolumeChange,
          teamSizeChange: update.teamSizeChange,
          commissionChange: update.commissionChange,
        })
      );

      await Promise.all(updatePromises);
    } catch (error: any) {
      throw new Error(`Failed to batch update team statistics: ${error.message}`);
    }
  }

  /**
   * Add direct referral to user's network (referral code registration)
   */
  static async addDirectReferral(parentUserId: string, newUserId: string): Promise<ReferralNode> {
    try {
      const params: DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        Key: { userId: parentUserId },
        UpdateExpression: 'ADD directReferrals :newReferral, totalTeamSize :increment SET UpdatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':newReferral': dynamoDB.createSet([newUserId]),
          ':increment': 1,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      };

      const result = await dynamoDB.update(params).promise();
      return ReferralNode.fromPersistence(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Parent referral node ${parentUserId} not found`);
      }
      throw new Error(`Failed to add direct referral: ${error.message}`);
    }
  }

  /**
   * Get all ancestor nodes for commission distribution path
   */
  static async getAncestorNodes(userId: string): Promise<ReferralNode[]> {
    try {
      const genealogy = await this.getUserGenealogy(userId);
      const ancestorIds = genealogy.commissionEligibleAncestors;

      if (ancestorIds.length === 0) {
        return [];
      }

      const ancestors = await this.batchGetReferralNodes(ancestorIds);
      
      // Sort by commission level (level1 first, then level2, etc.)
      return ancestors.sort((a, b) => {
        const levelA = genealogy.ancestors.level1 === a.userId ? 1 :
                      genealogy.ancestors.level2 === a.userId ? 2 :
                      genealogy.ancestors.level3 === a.userId ? 3 :
                      genealogy.ancestors.level4 === a.userId ? 4 :
                      genealogy.ancestors.level5 === a.userId ? 5 : 6;
        
        const levelB = genealogy.ancestors.level1 === b.userId ? 1 :
                      genealogy.ancestors.level2 === b.userId ? 2 :
                      genealogy.ancestors.level3 === b.userId ? 3 :
                      genealogy.ancestors.level4 === b.userId ? 4 :
                      genealogy.ancestors.level5 === b.userId ? 5 : 6;
        
        return levelA - levelB;
      });
    } catch (error: any) {
      throw new Error(`Failed to get ancestor nodes: ${error.message}`);
    }
  }

  /**
   * Get top performers by team volume (admin analytics, leaderboards)
   */
  static async getTopPerformers(
    limit: number = 10,
    level?: number
  ): Promise<ReferralNode[]> {
    try {
      let params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput;

      if (level !== undefined) {
        params = {
          TableName: this.REFERRAL_NETWORK_TABLE,
          IndexName: GSI_NAMES.REFERRAL_LEVEL_TEAM_VOLUME,
          KeyConditionExpression: '#level = :level',
          ExpressionAttributeNames: {
            '#level': 'level',
          },
          ExpressionAttributeValues: {
            ':level': level,
          },
          Limit: limit,
          ScanIndexForward: false, // Highest volume first
        };
      } else {
        params = {
          TableName: this.REFERRAL_NETWORK_TABLE,
          FilterExpression: 'totalTeamVolume > :minVolume',
          ExpressionAttributeValues: {
            ':minVolume': 0,
          },
          Limit: limit,
        };
      }

      const result = level !== undefined 
        ? await dynamoDB.query(params as DynamoDB.DocumentClient.QueryInput).promise()
        : await dynamoDB.scan(params as DynamoDB.DocumentClient.ScanInput).promise();

      const performers = result.Items?.map(item => ReferralNode.fromPersistence(item)) || [];
      
      // Sort by team volume if scanning (not using GSI sort)
      if (level === undefined) {
        performers.sort((a, b) => b.totalTeamVolume - a.totalTeamVolume);
      }

      return performers.slice(0, limit);
    } catch (error: any) {
      throw new Error(`Failed to get top performers: ${error.message}`);
    }
  }

  /**
   * Get team statistics summary (admin dashboard, network analytics)
   */
  static async getTeamStatisticsSummary(): Promise<TeamStatisticsSummary> {
    try {
      // Get all referral nodes for comprehensive analysis
      const params: DynamoDB.DocumentClient.ScanInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
      };

      const result = await dynamoDB.scan(params).promise();
      const allNodes = result.Items?.map(item => ReferralNode.fromPersistence(item)) || [];

      const summary: TeamStatisticsSummary = {
        totalNodes: allNodes.length,
        totalVolume: 0,
        totalCommissionEarned: 0,
        averageVolumePerNode: 0,
        levelDistribution: {
          level0: 0,
          level1: 0,
          level2: 0,
          level3: 0,
          level4: 0,
          level5: 0,
        },
        topPerformers: [],
      };

      // Analyze all nodes
      for (const node of allNodes) {
        summary.totalVolume += node.totalTeamVolume;
        summary.totalCommissionEarned += node.commissionEarned;

        // Level distribution
        switch (node.level) {
          case 0: summary.levelDistribution.level0++; break;
          case 1: summary.levelDistribution.level1++; break;
          case 2: summary.levelDistribution.level2++; break;
          case 3: summary.levelDistribution.level3++; break;
          case 4: summary.levelDistribution.level4++; break;
          case 5: summary.levelDistribution.level5++; break;
        }
      }

      if (summary.totalNodes > 0) {
        summary.averageVolumePerNode = summary.totalVolume / summary.totalNodes;
      }

      // Get top 10 performers
      const sortedPerformers = allNodes
        .filter(node => node.totalTeamVolume > 0)
        .sort((a, b) => b.totalTeamVolume - a.totalTeamVolume)
        .slice(0, 10);

      summary.topPerformers = sortedPerformers.map(node => ({
        userId: node.userId,
        volume: node.totalTeamVolume,
        commissionEarned: node.commissionEarned,
        teamSize: node.totalTeamSize,
      }));

      return summary;
    } catch (error: any) {
      throw new Error(`Failed to get team statistics summary: ${error.message}`);
    }
  }

  /**
   * Batch get referral nodes by IDs (commission distribution, analytics)
   */
  static async batchGetReferralNodes(userIds: string[]): Promise<ReferralNode[]> {
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

      const allNodes: ReferralNode[] = [];

      for (const batch of batches) {
        const keys = batch.map(userId => ({ userId }));

        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [this.REFERRAL_NETWORK_TABLE]: {
              Keys: keys,
            },
          },
        };

        const result = await dynamoDB.batchGet(params).promise();
        const items = result.Responses?.[this.REFERRAL_NETWORK_TABLE] || [];
        
        const nodes = items.map(item => ReferralNode.fromPersistence(item));
        allNodes.push(...nodes);
      }

      return allNodes;
    } catch (error: any) {
      throw new Error(`Failed to batch get referral nodes: ${error.message}`);
    }
  }

  /**
   * Get referral network tree for user (tree visualization, genealogy display)
   */
  static async getUserReferralTree(
    userId: string,
    maxDepth: number = 3
  ): Promise<{
    root: ReferralNode;
    descendants: ReferralNode[];
    ancestors: ReferralNode[];
  }> {
    try {
      const rootNode = await this.getReferralNode(userId);
      if (!rootNode) {
        throw new Error(`Referral node not found for user ${userId}`);
      }

      // Get ancestors using genealogy cache
      const ancestors = await this.getAncestorNodes(userId);

      // Get descendants using recursive direct referral queries
      const descendants = await this.getDescendants(userId, maxDepth);

      return {
        root: rootNode,
        descendants,
        ancestors,
      };
    } catch (error: any) {
      throw new Error(`Failed to get user referral tree: ${error.message}`);
    }
  }

  /**
   * Get all descendants up to maxDepth (recursive tree traversal)
   */
  private static async getDescendants(
    userId: string,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<ReferralNode[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const { referrals: directReferrals } = await this.getDirectReferrals(userId, 1000);
    const allDescendants: ReferralNode[] = [...directReferrals];

    // Recursively get descendants of direct referrals
    for (const referral of directReferrals) {
      const subDescendants = await this.getDescendants(
        referral.userId,
        maxDepth,
        currentDepth + 1
      );
      allDescendants.push(...subDescendants);
    }

    return allDescendants;
  }

  /**
   * Validate tree integrity (admin maintenance, consistency checks)
   */
  static async validateTreeIntegrity(
    userId?: string,
    fixIssues: boolean = false
  ): Promise<TreeIntegrityResult> {
    try {
      const result: TreeIntegrityResult = {
        isValid: true,
        issues: [],
        nodesChecked: 0,
        inconsistencies: [],
      };

      let nodesToCheck: ReferralNode[];

      if (userId) {
        const node = await this.getReferralNode(userId);
        nodesToCheck = node ? [node] : [];
      } else {
        // Check all nodes (expensive operation)
        const params: DynamoDB.DocumentClient.ScanInput = {
          TableName: this.REFERRAL_NETWORK_TABLE,
          Limit: 1000, // Limit for performance
        };
        const scanResult = await dynamoDB.scan(params).promise();
        nodesToCheck = scanResult.Items?.map(item => ReferralNode.fromPersistence(item)) || [];
      }

      for (const node of nodesToCheck) {
        result.nodesChecked++;

        // Check genealogy consistency
        if (node.parentUserId && node.genealogy.level1 !== node.parentUserId) {
          result.inconsistencies.push({
            userId: node.userId,
            issue: `Genealogy level1 mismatch: expected ${node.parentUserId}, found ${node.genealogy.level1}`,
            severity: 'error',
          });
          result.isValid = false;
        }

        // Check level consistency with path
        const pathDepth = node.path.split('/').filter(p => p).length - 1;
        if (pathDepth !== node.level) {
          result.inconsistencies.push({
            userId: node.userId,
            issue: `Level mismatch: path depth ${pathDepth}, node level ${node.level}`,
            severity: 'error',
          });
          result.isValid = false;
        }

        // Check if direct referrals count matches team size calculation
        if (node.directReferrals.length > node.totalTeamSize) {
          result.inconsistencies.push({
            userId: node.userId,
            issue: `Direct referrals (${node.directReferrals.length}) exceeds team size (${node.totalTeamSize})`,
            severity: 'warning',
          });
        }
      }

      result.issues = result.inconsistencies.map(inc => 
        `${inc.userId}: ${inc.issue} (${inc.severity})`
      );

      // Auto-fix issues if requested (implement specific fixes as needed)
      if (fixIssues && result.inconsistencies.length > 0) {
        // Implementation for specific fixes would go here
        result.issues.push('Auto-fix feature not implemented yet');
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to validate tree integrity: ${error.message}`);
    }
  }

  /**
   * Delete referral node (admin cleanup, test data removal)
   */
  static async deleteReferralNode(userId: string): Promise<void> {
    try {
      const params: DynamoDB.DocumentClient.DeleteItemInput = {
        TableName: this.REFERRAL_NETWORK_TABLE,
        Key: { userId },
        ConditionExpression: 'attribute_exists(userId)',
      };

      await dynamoDB.delete(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error(`Referral node for user ${userId} not found`);
      }
      throw new Error(`Failed to delete referral node: ${error.message}`);
    }
  }
}

/**
 * REFERRAL REPOSITORY - ESSENTIAL METHODS:
 * ========================================
 * 
 * TREE MANAGEMENT:
 * - createReferralNode() - Create new nodes in MLM tree
 * - getReferralNode() - Get individual node with genealogy
 * - getUserGenealogy() - Instant 5-level ancestor lookup for commissions
 * - getDirectReferrals() - Direct downline management
 * - getReferralsByLevel() - Level-based analytics and reports
 * - addDirectReferral() - Network building operations
 * 
 * STATISTICS & ANALYTICS:
 * - updateReferralNodeStatistics() - Real-time team stats updates
 * - batchUpdateTeamStatistics() - Efficient commission processing
 * - getTopPerformers() - Leaderboards and high-performer analytics
 * - getTeamStatisticsSummary() - Comprehensive network overview
 * - getUserReferralTree() - Tree visualization and genealogy display
 * 
 * COMMISSION SUPPORT:
 * - getAncestorNodes() - Commission distribution path
 * - getUserGenealogy() - Instant 5-level lookup (10%, 5%, 3%, 1%, 1%)
 * - batchGetReferralNodes() - Bulk operations for commission calculations
 * 
 * MAINTENANCE & INTEGRITY:
 * - validateTreeIntegrity() - Tree consistency validation
 * - deleteReferralNode() - Admin cleanup operations
 * 
 * SUPPORTED ENDPOINTS:
 * - GET /api/v1/users/:userId/referral-tree → getUserReferralTree()
 * - GET /api/v1/dashboard/team → getDirectReferrals() + team statistics
 * - Commission distribution → getUserGenealogy() + getAncestorNodes()
 * - Admin analytics → getTeamStatisticsSummary() + getTopPerformers()
 * 
 * 5-LEVEL MLM SYSTEM:
 * - Level 1 (Direct): 10% commission
 * - Level 2 (Grandparent): 5% commission
 * - Level 3 (Great-grandparent): 3% commission
 * - Level 4 (Level 4 ancestor): 1% commission
 * - Level 5 (Level 5 ancestor): 1% commission
 * 
 * GENEALOGY CACHING:
 * - O(1) ancestor lookup vs O(n) tree traversal
 * - Instant commission distribution calculation
 * - Pre-computed 5-level ancestry for each node
 * - Eliminates recursive queries during high-volume operations
 * 
 * TREE STRUCTURE:
 * - Materialized path for efficient tree queries
 * - Hybrid approach: path + genealogy cache
 * - Direct referrals tracking for network building
 * - Team statistics aggregation for performance metrics
 * 
 * BUSINESS OPERATIONS:
 * - User registration: Create node with proper genealogy
 * - Deposit processing: Update team statistics + distribute commissions
 * - Network analytics: Performance tracking and leaderboards
 * - Commission calculation: Instant 5-level ancestor lookup
 * - Tree visualization: Complete network genealogy display
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Single GET operation for commission ancestors
 * - Parallel batch updates for team statistics
 * - GSI indexes for level-based and volume-based queries
 * - Genealogy cache eliminates recursive tree traversal
 * - Materialized path enables efficient descendant queries
 */
