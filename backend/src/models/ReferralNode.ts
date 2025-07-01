/**
 * ReferralNode Entity Model
 * 
 * 🌳 Multi-Level Marketing (MLM) Referral Tree System for Yield Cycle Platform
 * 
 * PURPOSE:
 * This model represents a node in the 5-level MLM referral tree where users earn commissions
 * from their downline deposits. Manages tree structure, genealogy caching, and commission eligibility.
 * 
 * MLM REFERRAL SYSTEM (as per TECHNICAL.md):
 * - 5-level commission structure: Level 1 (10%), Level 2 (5%), Level 3 (3%), Level 4 (1%), Level 5 (1%)
 * - Materialized path pattern for efficient tree traversal
 * - Genealogy caching for instant commission distribution
 * - Team statistics tracking for performance analytics
 * - Direct referral management for network building
 * 
 * KEY FEATURES:
 * - Hybrid tree structure (materialized path + genealogy cache)
 * - 5-level ancestor caching for instant commission lookup
 * - Team volume and earnings tracking
 * - Direct referral management
 * - Commission eligibility validation
 * - Tree integrity and validation
 * 
 * BUSINESS RULES:
 * - Maximum 5 levels of commission earning depth
 * - Each user gets unique referral code for network building
 * - Commission rates: 10%, 5%, 3%, 1%, 1% for levels 1-5
 * - Team statistics include all descendants (not just direct)
 * - Root nodes (level 0) are initial users without upline
 * - Path format: "/" for root, "/parent/" for level 1, "/root/parent/user/" for deeper levels
 * 
 * UTILITY INTEGRATIONS:
 * - ValidationUtils: For numeric validation and business rules
 * - MathUtils: For precise volume and commission calculations
 * - StringUtils: For path manipulation and validation
 * 
 * INTEGRATION POINTS:
 * - User: Each user has exactly one ReferralNode
 * - Commission: Genealogy used for commission distribution
 * - Deposit: Team volume updated on new deposits
 * - Transaction: Commission tracking and distribution
 * 
 * @see TECHNICAL.md - MLM referral system specifications
 * @see User - For referral code generation and user relationships
 * @see Commission - For 5-level commission distribution
 * @see Transaction - For commission transaction records
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { ValidationUtils, MathUtils } from '../utils/calculations';

/**
 * Genealogy cache value object for instant 5-level ancestor lookups
 * 
 * Enables O(1) commission distribution by caching the 5-level upline hierarchy.
 * This eliminates the need for recursive tree traversal during commission calculations.
 */
export class Genealogy {
  public readonly level1?: string; // Direct parent (10% commission)
  public readonly level2?: string; // Grandparent (5% commission)
  public readonly level3?: string; // Great-grandparent (3% commission)
  public readonly level4?: string; // Level 4 ancestor (1% commission)
  public readonly level5?: string; // Level 5 ancestor (1% commission)

  constructor(
    level1?: string,
    level2?: string,
    level3?: string,
    level4?: string,
    level5?: string
  ) {
    this.level1 = level1;
    this.level2 = level2;
    this.level3 = level3;
    this.level4 = level4;
    this.level5 = level5;
  }

  /**
   * Gets all ancestors as array (filtered for non-null values)
   */
  getAllAncestors(): string[] {
    return [this.level1, this.level2, this.level3, this.level4, this.level5]
      .filter((id): id is string => id !== undefined);
  }

  /**
   * Gets ancestor at specific level (1-5)
   */
  getAncestorAtLevel(level: number): string | undefined {
    switch (level) {
      case 1: return this.level1;
      case 2: return this.level2;
      case 3: return this.level3;
      case 4: return this.level4;
      case 5: return this.level5;
      default: return undefined;
    }
  }

  /**
   * Checks if user is ancestor at any level
   */
  hasAncestor(userId: string): boolean {
    return this.getAllAncestors().includes(userId);
  }

  /**
   * Gets the commission level at which user is ancestor (1-5), or null if not ancestor
   * Used for determining commission percentage during distribution
   */
  getAncestorLevel(userId: string): number | null {
    for (let level = 1; level <= 5; level++) {
      if (this.getAncestorAtLevel(level) === userId) {
        return level;
      }
    }
    return null;
  }

  /**
   * Gets commission rate for ancestor at specific level
   */
  getCommissionRateForLevel(level: number): number {
    const commissionRates = [0.10, 0.05, 0.03, 0.01, 0.01]; // 10%, 5%, 3%, 1%, 1%
    return commissionRates[level - 1] || 0;
  }

  /**
   * Gets commission rate for specific ancestor user
   */
  getCommissionRateForUser(userId: string): number {
    const level = this.getAncestorLevel(userId);
    return level ? this.getCommissionRateForLevel(level) : 0;
  }

  toJSON(): any {
    return {
      level1: this.level1,
      level2: this.level2,
      level3: this.level3,
      level4: this.level4,
      level5: this.level5,
      ancestorCount: this.getAllAncestors().length,
    };
  }
}

/**
 * ReferralNode domain entity for MLM tree management
 */
export class ReferralNode extends BaseModel {
  public readonly nodeId: string;
  private _userId: string;
  private _parentUserId?: string;
  private _level: number;
  private _path: string;
  private _directReferrals: Set<string>;
  private _totalTeamSize: number;
  private _totalTeamVolume: number;
  private _commissionEarned: number;
  private _genealogy: Genealogy;

  constructor(
    userId: string,
    parentUserId?: string,
    level: number = 0,
    path?: string,
    directReferrals: string[] = [],
    totalTeamSize: number = 0,
    totalTeamVolume: number = 0,
    commissionEarned: number = 0,
    genealogy?: Genealogy,
    nodeId?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.nodeId = nodeId || userId; // Use userId as nodeId for referral nodes
    this._userId = userId;
    this._parentUserId = parentUserId;
    this._level = level;
    this._path = path || this.buildPath();
    this._directReferrals = new Set(directReferrals);
    this._totalTeamSize = totalTeamSize;
    this._totalTeamVolume = totalTeamVolume;
    this._commissionEarned = commissionEarned;
    this._genealogy = genealogy || new Genealogy();

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get parentUserId(): string | undefined { return this._parentUserId; }
  get level(): number { return this._level; }
  get path(): string { return this._path; }
  get directReferrals(): string[] { return Array.from(this._directReferrals); }
  get totalTeamSize(): number { return this._totalTeamSize; }
  get totalTeamVolume(): number { return this._totalTeamVolume; }
  get commissionEarned(): number { return this._commissionEarned; }
  get genealogy(): Genealogy { return this._genealogy; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): ReferralNode {
    return new ReferralNode(
      data.userId,
      data.parentUserId,
      data.level || 0,
      data.path,
      data.directReferrals || [],
      data.totalTeamSize || 0,
      data.totalTeamVolume || 0,
      data.commissionEarned || 0,
      new Genealogy(
        data.level1,
        data.level2,
        data.level3,
        data.level4,
        data.level5
      ),
      data.userId, // Using userId as ID for referral nodes
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * Factory method to create root node (users without referrer)
   */
  static createRoot(userId: string): ReferralNode {
    return new ReferralNode(userId, undefined, 0, '/', [], 0, 0, 0, new Genealogy());
  }

  /**
   * Factory method to create child node with proper genealogy
   */
  static createChild(userId: string, parentNode: ReferralNode): ReferralNode {
    if (parentNode.level >= 5) {
      throw new ModelValidationError('Cannot create child beyond level 5 MLM depth', 'level');
    }

    const childLevel = parentNode.level + 1;
    const childPath = `${parentNode.path}${userId}/`;
    const childGenealogy = this.buildChildGenealogy(parentNode);

    return new ReferralNode(
      userId,
      parentNode.userId,
      childLevel,
      childPath,
      [],
      0,
      0,
      0,
      childGenealogy
    );
  }

  /**
   * Factory method to create referral node with referral code
   */
  static createWithReferralCode(userId: string, referralCode: string, referrerNode: ReferralNode): ReferralNode {
    if (!referralCode || typeof referralCode !== 'string') {
      throw new ModelValidationError('Valid referral code is required', 'referralCode');
    }

    const newNode = this.createChild(userId, referrerNode);
    
    // Add this user as direct referral to parent
    referrerNode.addDirectReferral(userId);
    
    return newNode;
  }

  /**
   * Factory method to bulk create nodes for team import
   */
  static createBulkNodes(nodeData: {
    userId: string;
    parentUserId?: string;
    level: number;
  }[]): ReferralNode[] {
    return nodeData.map(data => {
      if (data.level === 0) {
        return this.createRoot(data.userId);
      } else {
        // For bulk creation, genealogy needs to be built separately
        return new ReferralNode(
          data.userId,
          data.parentUserId,
          data.level,
          undefined, // Path will be built in constructor
          [],
          0,
          0,
          0,
          new Genealogy() // Empty genealogy for bulk import
        );
      }
    });
  }

  /**
   * Builds genealogy for child node based on parent
   */
  private static buildChildGenealogy(parentNode: ReferralNode): Genealogy {
    return new Genealogy(
      parentNode.userId, // Direct parent becomes level1
      parentNode.genealogy.level1, // Parent's level1 becomes level2
      parentNode.genealogy.level2, // Parent's level2 becomes level3
      parentNode.genealogy.level3, // Parent's level3 becomes level4
      parentNode.genealogy.level4  // Parent's level4 becomes level5
    );
  }

  /**
   * Adds a direct referral to this node
   */
  addDirectReferral(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw new ModelValidationError('Valid user ID is required', 'userId');
    }

    if (userId === this._userId) {
      throw new ModelValidationError('User cannot refer themselves', 'userId');
    }

    this._directReferrals.add(userId);
    this._totalTeamSize += 1;
    this.touch();
  }

  /**
   * Removes a direct referral from this node
   */
  removeDirectReferral(userId: string): void {
    if (this._directReferrals.has(userId)) {
      this._directReferrals.delete(userId);
      this._totalTeamSize = Math.max(0, this._totalTeamSize - 1);
      this.touch();
    }
  }

  /**
   * Adds volume to team statistics
   */
  addTeamVolume(amount: number): void {
    if (!ValidationUtils.isPositiveNumber(amount)) {
      throw new ModelValidationError('Team volume amount must be positive', 'amount');
    }

    this._totalTeamVolume = MathUtils.round(this._totalTeamVolume + amount);
    this.touch();
  }

  /**
   * Adds commission earnings
   */
  addCommissionEarned(amount: number): void {
    if (!ValidationUtils.isPositiveNumber(amount)) {
      throw new ModelValidationError('Commission amount must be positive', 'amount');
    }

    this._commissionEarned = MathUtils.round(this._commissionEarned + amount);
    this.touch();
  }

  /**
   * Updates total team size
   */
  updateTeamSize(newSize: number): void {
    if (!ValidationUtils.isNonNegativeNumber(newSize)) {
      throw new ModelValidationError('Team size cannot be negative', 'teamSize');
    }

    this._totalTeamSize = newSize;
    this.touch();
  }

  /**
   * Domain query methods
   */
  isRoot(): boolean {
    return this._level === 0 && !this._parentUserId;
  }

  hasDirectReferrals(): boolean {
    return this._directReferrals.size > 0;
  }

  getDirectReferralCount(): number {
    return this._directReferrals.size;
  }

  isDirectReferral(userId: string): boolean {
    return this._directReferrals.has(userId);
  }

  canEarnCommissionFrom(_userId: string): boolean {
    // All nodes can earn commission from their descendants (5-level MLM)
    return true;
  }

  getCommissionLevelFor(userId: string): number | null {
    return this._genealogy.getAncestorLevel(userId);
  }

  isForUser(userId: string): boolean {
    return this._userId === userId;
  }

  /**
   * Business logic methods for yield cycle MLM platform
   */
  getAverageVolumePerMember(): number {
    if (this._totalTeamSize === 0) return 0;
    return MathUtils.round(this._totalTeamVolume / this._totalTeamSize);
  }

  getCommissionRate(): number {
    // 5-level commission rates as per TECHNICAL.md: 10%, 5%, 3%, 1%, 1%
    const commissionRates = [0.10, 0.05, 0.03, 0.01, 0.01];
    return commissionRates[this._level - 1] || 0;
  }

  isEligibleForCommissions(): boolean {
    return this._level >= 1 && this._level <= 5;
  }

  getFormattedVolume(): string {
    return `${this._totalTeamVolume.toFixed(6)} USDT`;
  }

  getFormattedCommissionEarned(): string {
    return `${this._commissionEarned.toFixed(6)} USDT`;
  }

  getPathDepth(): number {
    return this._path.split('/').filter(p => p).length;
  }

  // Additional business methods for yield cycle platform

  /**
   * Calculate potential commission from a deposit amount
   */
  calculatePotentialCommission(depositAmount: number): number {
    if (!this.isEligibleForCommissions()) return 0;
    return MathUtils.round(depositAmount * this.getCommissionRate());
  }

  /**
   * Get team performance metrics
   */
  getTeamPerformanceMetrics(): {
    totalVolume: number;
    teamSize: number;
    averageVolume: number;
    commissionEarned: number;
    commissionRate: number;
    level: number;
  } {
    return {
      totalVolume: this._totalTeamVolume,
      teamSize: this._totalTeamSize,
      averageVolume: this.getAverageVolumePerMember(),
      commissionEarned: this._commissionEarned,
      commissionRate: this.getCommissionRate(),
      level: this._level,
    };
  }

  /**
   * Check if node can accept new referrals (business rule validation)
   */
  canAcceptNewReferrals(): boolean {
    // All nodes can accept referrals in MLM system
    return true;
  }

  /**
   * Get commission level display name
   */
  getCommissionLevelName(): string {
    switch (this._level) {
      case 0: return 'Root Node';
      case 1: return 'Level 1 (10%)';
      case 2: return 'Level 2 (5%)';
      case 3: return 'Level 3 (3%)';
      case 4: return 'Level 4 (1%)';
      case 5: return 'Level 5 (1%)';
      default: return `Level ${this._level}`;
    }
  }

  /**
   * Calculate commission percentage of total team volume
   */
  getCommissionPercentageOfVolume(): number {
    if (this._totalTeamVolume === 0) return 0;
    return MathUtils.round((this._commissionEarned / this._totalTeamVolume) * 100, 2);
  }

  /**
   * Get network growth rate (estimated)
   */
  getNetworkGrowthRate(): number {
    // Simple growth calculation based on team size vs direct referrals
    if (this._directReferrals.size === 0) return 0;
    return MathUtils.round(this._totalTeamSize / this._directReferrals.size, 2);
  }

  /**
   * Check if this node is in active earning status
   */
  isActiveEarner(): boolean {
    return this.isEligibleForCommissions() && this._totalTeamVolume > 0;
  }

  /**
   * Get downline statistics summary
   */
  getDownlineStatistics(): {
    directReferrals: number;
    totalTeamSize: number;
    totalVolume: number;
    activePercentage: number;
  } {
    const activePercentage = this._totalTeamSize > 0 
      ? MathUtils.round((this._directReferrals.size / this._totalTeamSize) * 100, 2)
      : 0;

    return {
      directReferrals: this._directReferrals.size,
      totalTeamSize: this._totalTeamSize,
      totalVolume: this._totalTeamVolume,
      activePercentage,
    };
  }

  /**
   * Builds materialized path
   */
  private buildPath(): string {
    if (this.isRoot()) return '/';
    return this._parentUserId ? `/${this._parentUserId}/${this._userId}/` : `/${this._userId}/`;
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._level)) {
      throw new ModelValidationError('Level cannot be negative', 'level');
    }

    if (this._level > 5) {
      throw new ModelValidationError('Level cannot exceed 5 (MLM commission depth limit)', 'level');
    }

    if (!this._path || typeof this._path !== 'string') {
      throw new ModelValidationError('Path is required', 'path');
    }

    if (!this._path.startsWith('/')) {
      throw new ModelValidationError('Path must start with /', 'path');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._totalTeamSize)) {
      throw new ModelValidationError('Total team size cannot be negative', 'totalTeamSize');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._totalTeamVolume)) {
      throw new ModelValidationError('Total team volume cannot be negative', 'totalTeamVolume');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._commissionEarned)) {
      throw new ModelValidationError('Commission earned cannot be negative', 'commissionEarned');
    }

    // Business rule validations for yield cycle MLM platform
    if (this.isRoot() && this._parentUserId) {
      throw new ModelValidationError('Root node cannot have parent', 'parentUserId');
    }

    if (!this.isRoot() && !this._parentUserId) {
      throw new ModelValidationError('Non-root node must have parent', 'parentUserId');
    }

    if (this._parentUserId === this._userId) {
      throw new ModelValidationError('Node cannot be its own parent', 'parentUserId');
    }

    // Validate commission structure integrity
    if (this._level > 0 && this._genealogy.getAllAncestors().length === 0) {
      throw new ModelValidationError('Non-root node must have genealogy cache', 'genealogy');
    }

    // Validate path consistency
    const pathParts = this._path.split('/').filter(p => p);
    if (pathParts.length !== this._level + 1 && !this.isRoot()) {
      throw new ModelValidationError('Path depth must match level + 1', 'path');
    }

    // Validate direct referrals don't include self
    if (this._directReferrals.has(this._userId)) {
      throw new ModelValidationError('Node cannot have itself as direct referral', 'directReferrals');
    }
  }

  /**
   * Primary JSON serialization for yield cycle MLM referral node
   */
  toJSON(): any {
    return {
      nodeId: this.nodeId,
      userId: this._userId,
      parentUserId: this._parentUserId,
      level: this._level,
      path: this._path,
      
      // Direct referrals information
      directReferrals: this.directReferrals,
      directReferralCount: this.getDirectReferralCount(),
      
      // Team statistics
      totalTeamSize: this._totalTeamSize,
      totalTeamVolume: this._totalTeamVolume,
      commissionEarned: this._commissionEarned,
      
      // Genealogy and commission structure
      genealogy: this._genealogy.toJSON(),
      commissionRate: this.getCommissionRate(),
      commissionLevelName: this.getCommissionLevelName(),
      
      // Performance metrics
      averageVolumePerMember: this.getAverageVolumePerMember(),
      commissionPercentageOfVolume: this.getCommissionPercentageOfVolume(),
      networkGrowthRate: this.getNetworkGrowthRate(),
      teamPerformanceMetrics: this.getTeamPerformanceMetrics(),
      downlineStatistics: this.getDownlineStatistics(),
      
      // Display formatting
      formattedVolume: this.getFormattedVolume(),
      formattedCommissionEarned: this.getFormattedCommissionEarned(),
      
      // Tree structure information
      pathDepth: this.getPathDepth(),
      
      // Status checks
      isRoot: this.isRoot(),
      hasDirectReferrals: this.hasDirectReferrals(),
      isEligibleForCommissions: this.isEligibleForCommissions(),
      canAcceptNewReferrals: this.canAcceptNewReferrals(),
      isActiveEarner: this.isActiveEarner(),
      
      ...this.getCommonJSON(),
    };
  }

  /**
   * Summary JSON for team overview and dashboards
   */
  toSummaryJSON(): any {
    return {
      nodeId: this.nodeId,
      userId: this._userId,
      level: this._level,
      commissionLevelName: this.getCommissionLevelName(),
      directReferralCount: this.getDirectReferralCount(),
      totalTeamSize: this._totalTeamSize,
      totalTeamVolume: this._totalTeamVolume,
      commissionEarned: this._commissionEarned,
      commissionRate: this.getCommissionRate(),
      formattedVolume: this.getFormattedVolume(),
      formattedCommissionEarned: this.getFormattedCommissionEarned(),
      isRoot: this.isRoot(),
      isActiveEarner: this.isActiveEarner(),
    };
  }

  /**
   * DynamoDB serialization
   */
  toDynamoItem(): any {
    return {
      userId: this._userId, // Primary key
      nodeId: this.nodeId,
      parentUserId: this._parentUserId,
      level: this._level,
      path: this._path,
      directReferrals: Array.from(this._directReferrals),
      totalTeamSize: this._totalTeamSize,
      totalTeamVolume: this._totalTeamVolume,
      commissionEarned: this._commissionEarned,
      
      // Genealogy cache for commission distribution
      level1: this._genealogy.level1,
      level2: this._genealogy.level2,
      level3: this._genealogy.level3,
      level4: this._genealogy.level4,
      level5: this._genealogy.level5,
      
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * DYNAMODB FLOW: Level 10 User Deposit Processing
   * ===============================================
   * 
   * SCENARIO: user-010-level10 makes a $10,000 USDT deposit
   * 
   * STEP 1: GET OPERATION - Retrieve User's ReferralNode
   * ===================================================
   * 
   * DynamoDB Query:
   * GET: PK=REFERRAL_NODE#user-010-level10
   * 
   * Returns cached genealogy in single read:
   * {
   *   "level1": "user-009-level9",    // Direct parent (10% commission)
   *   "level2": "user-008-level8",    // Grandparent (5% commission)  
   *   "level3": "user-007-level7",    // Great-grandparent (3% commission)
   *   "level4": "user-006-level6",    // Level 4 ancestor (1% commission)
   *   "level5": "user-005-level5"     // Level 5 ancestor (1% commission)
   * }
   * 
   * STEP 2: COMMISSION CALCULATION
   * =============================
   * 
   * From genealogy cache, calculate:
   * - user-009-level9: $10,000 × 10% = $1,000
   * - user-008-level8: $10,000 × 5% = $500
   * - user-007-level7: $10,000 × 3% = $300
   * - user-006-level6: $10,000 × 1% = $100
   * - user-005-level5: $10,000 × 1% = $100
   * 
   * STEP 3: BATCH UPDATE OPERATIONS (All Parallel)
   * ==============================================
   * 
   * ALL 10 ANCESTORS need team statistics updates:
   * 
   * Team Volume Updates (10 nodes):
   * UPDATE: PK=REFERRAL_NODE#user-001-root
   * SET totalTeamVolume += $10000, totalTeamSize += 1
   * 
   * UPDATE: PK=REFERRAL_NODE#user-002-level2  
   * SET totalTeamVolume += $10000, totalTeamSize += 1
   * 
   * UPDATE: PK=REFERRAL_NODE#user-003-level3
   * SET totalTeamVolume += $10000, totalTeamSize += 1
   * 
   * UPDATE: PK=REFERRAL_NODE#user-004-level4
   * SET totalTeamVolume += $10000, totalTeamSize += 1
   * 
   * UPDATE: PK=REFERRAL_NODE#user-005-level5
   * SET totalTeamVolume += $10000, totalTeamSize += 1, commissionEarned += $100
   * 
   * UPDATE: PK=REFERRAL_NODE#user-006-level6
   * SET totalTeamVolume += $10000, totalTeamSize += 1, commissionEarned += $100
   * 
   * UPDATE: PK=REFERRAL_NODE#user-007-level7
   * SET totalTeamVolume += $10000, totalTeamSize += 1, commissionEarned += $300
   * 
   * UPDATE: PK=REFERRAL_NODE#user-008-level8
   * SET totalTeamVolume += $10000, totalTeamSize += 1, commissionEarned += $500
   * 
   * UPDATE: PK=REFERRAL_NODE#user-009-level9
   * SET totalTeamVolume += $10000, totalTeamSize += 1, commissionEarned += $1000
   * 
   * UPDATE: PK=REFERRAL_NODE#user-010-level10
   * SET totalPersonalVolume += $10000, personalDepositCount += 1
   * 
   * PERFORMANCE CHARACTERISTICS:
   * ===========================
   * 
   * Read Operations: 1 (get depositing user's genealogy)
   * Write Operations: 10 (all ancestors + self)
   * Total Execution Time: ~200-300ms
   * 
   * Key Efficiency Points:
   * - Single GET operation retrieves complete ancestry
   * - All 10 UPDATE operations run in parallel
   * - No recursive tree traversal needed
   * - Constant performance regardless of tree depth
   * - Genealogy cache eliminates need for multiple reads
   * 
   * Why This Scales:
   * - O(1) ancestry lookup vs O(n) tree traversal
   * - Parallel batch operations vs sequential updates
   * - Pre-computed genealogy vs runtime calculations
   * - Single transaction for atomicity
   */
}
