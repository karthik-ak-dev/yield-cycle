/**
 * Commission Entity Model
 * 
 * Represents referral commission earnings in the 5-level MLM system.
 * Handles commission calculation, distribution tracking, and payment processing
 * for the Yield Cycle investment platform.
 * 
 * Business Context:
 * - 5-level referral commission structure: 10%, 5%, 3%, 1%, 1%
 * - Commissions earned from downline USDT deposits
 * - Commission lifecycle: PENDING → PROCESSED → PAID
 * - Batch processing for efficient distribution
 * - Complete audit trail for regulatory compliance
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { CommissionType, CommissionStatus } from '../types/enums';
import { ValidationUtils, MathUtils, DateUtils } from '../utils/calculations';

/**
 * Commission domain entity for MLM referral tracking
 */
export class Commission extends BaseModel {
  public readonly commissionId: string;
  private _userId: string;
  private _sourceUserId: string;
  private _sourceDepositId: string;
  private _type: CommissionType;
  private _level: number;
  private _amount: number;
  private _rate: number;
  private _sourceAmount: number;
  private _status: CommissionStatus;
  private _distributionBatchId?: string;
  private _processedAt?: Date;
  private _paidAt?: Date;

  constructor(
    userId: string,
    sourceUserId: string,
    sourceDepositId: string,
    type: CommissionType,
    level: number,
    amount: number,
    rate: number,
    sourceAmount: number,
    status: CommissionStatus = CommissionStatus.PENDING,
    distributionBatchId?: string,
    processedAt?: Date,
    paidAt?: Date,
    commissionId?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.commissionId = commissionId || this.generateId();
    this._userId = userId;
    this._sourceUserId = sourceUserId;
    this._sourceDepositId = sourceDepositId;
    this._type = type;
    this._level = level;
    this._amount = amount;
    this._rate = rate;
    this._sourceAmount = sourceAmount;
    this._status = status;
    this._distributionBatchId = distributionBatchId;
    this._processedAt = processedAt;
    this._paidAt = paidAt;

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get sourceUserId(): string { return this._sourceUserId; }
  get sourceDepositId(): string { return this._sourceDepositId; }
  get type(): CommissionType { return this._type; }
  get level(): number { return this._level; }
  get amount(): number { return this._amount; }
  get rate(): number { return this._rate; }
  get sourceAmount(): number { return this._sourceAmount; }
  get status(): CommissionStatus { return this._status; }
  get distributionBatchId(): string | undefined { return this._distributionBatchId; }
  get processedAt(): Date | undefined { return this._processedAt; }
  get paidAt(): Date | undefined { return this._paidAt; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): Commission {
    return new Commission(
      data.userId,
      data.sourceUserId,
      data.sourceDepositId,
      data.type,
      data.level,
      data.amount,
      data.rate,
      data.sourceAmount,
      data.status,
      data.distributionBatchId,
      data.processedAt ? new Date(data.processedAt) : undefined,
      data.paidAt ? new Date(data.paidAt) : undefined,
      data.commissionId,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * Factory method to create referral commission
   */
  static createReferralCommission(
    userId: string,
    sourceUserId: string,
    sourceDepositId: string,
    level: number,
    sourceAmount: number
  ): Commission {
    if (!ValidationUtils.isPositiveInteger(level) || level < 1 || level > 5) {
      throw new ModelValidationError('Commission level must be between 1 and 5', 'level');
    }

    const rates = [0.10, 0.05, 0.03, 0.01, 0.01]; // MLM commission structure
    const rate = rates[level - 1];
    const amount = MathUtils.round(sourceAmount * rate);

    return new Commission(
      userId,
      sourceUserId,
      sourceDepositId,
      CommissionType.REFERRAL,
      level,
      amount,
      rate,
      sourceAmount
    );
  }

  /**
   * Factory method for bulk referral commission creation
   */
  static createBulkReferralCommissions(
    sourceUserId: string,
    sourceDepositId: string,
    sourceAmount: number,
    genealogy: { userId: string; level: number }[]
  ): Commission[] {
    return genealogy.map(ancestor => 
      this.createReferralCommission(
        ancestor.userId,
        sourceUserId,
        sourceDepositId,
        ancestor.level,
        sourceAmount
      )
    );
  }

  /**
   * Processes the commission (marks as processed)
   */
  process(distributionBatchId: string): void {
    if (!distributionBatchId || typeof distributionBatchId !== 'string') {
      throw new ModelValidationError('Distribution batch ID is required', 'distributionBatchId');
    }

    if (this._status !== CommissionStatus.PENDING) {
      throw new ModelValidationError('Only pending commissions can be processed', 'status');
    }

    this._status = CommissionStatus.PROCESSED;
    this._distributionBatchId = distributionBatchId;
    this._processedAt = new Date();
    this.touch();
  }

  /**
   * Marks commission as paid
   */
  markAsPaid(): void {
    if (this._status !== CommissionStatus.PROCESSED) {
      throw new ModelValidationError('Commission must be processed before payment', 'status');
    }

    this._status = CommissionStatus.PAID;
    this._paidAt = new Date();
    this.touch();
  }

  /**
   * Cancels the commission
   */
  cancel(): void {
    if (this._status === CommissionStatus.PAID) {
      throw new ModelValidationError('Paid commissions cannot be cancelled', 'status');
    }

    this._status = CommissionStatus.CANCELLED;
    this.touch();
  }

  /**
   * Reverses a processed commission back to pending
   */
  reverse(): void {
    if (this._status !== CommissionStatus.PROCESSED) {
      throw new ModelValidationError('Only processed commissions can be reversed', 'status');
    }

    this._status = CommissionStatus.PENDING;
    this._distributionBatchId = undefined;
    this._processedAt = undefined;
    this.touch();
  }

  /**
   * Domain query methods
   */
  isPending(): boolean { return this._status === CommissionStatus.PENDING; }
  isProcessed(): boolean { return this._status === CommissionStatus.PROCESSED; }
  isPaid(): boolean { return this._status === CommissionStatus.PAID; }
  isCancelled(): boolean { return this._status === CommissionStatus.CANCELLED; }
  
  isEligibleForProcessing(): boolean {
    return this._status === CommissionStatus.PENDING;
  }

  isEligibleForPayment(): boolean {
    return this._status === CommissionStatus.PROCESSED;
  }

  isForUser(userId: string): boolean {
    return this._userId === userId;
  }

  isFromSource(sourceUserId: string): boolean {
    return this._sourceUserId === sourceUserId;
  }

  isFromDeposit(depositId: string): boolean {
    return this._sourceDepositId === depositId;
  }

  isLevel1Commission(): boolean {
    return this._level === 1;
  }

  isLevel2Commission(): boolean {
    return this._level === 2;
  }

  isHighLevelCommission(): boolean {
    return this._level >= 3;
  }

  /**
   * Business logic methods
   */
  getCommissionAgeInDays(): number {
    return DateUtils.daysBetween(this.createdAt, new Date());
  }

  getProcessingDelayInDays(): number {
    if (!this._processedAt) return 0;
    return DateUtils.daysBetween(this.createdAt, this._processedAt);
  }

  getPaymentDelayInDays(): number {
    if (!this._paidAt) return 0;
    return DateUtils.daysBetween(this.createdAt, this._paidAt);
  }

  isOverdue(): boolean {
    // Business rule: commissions overdue after 30 days
    return this.getCommissionAgeInDays() > 30 && !this.isPaid();
  }

  validateCommissionRate(): boolean {
    const expectedRates = [0.10, 0.05, 0.03, 0.01, 0.01];
    const expectedRate = expectedRates[this._level - 1] || 0;
    return MathUtils.isApproximatelyEqual(this._rate, expectedRate);
  }

  getExpectedAmount(): number {
    const expectedRates = [0.10, 0.05, 0.03, 0.01, 0.01];
    const expectedRate = expectedRates[this._level - 1] || 0;
    return MathUtils.round(this._sourceAmount * expectedRate);
  }

  isAmountCorrect(): boolean {
    const expected = this.getExpectedAmount();
    return MathUtils.isApproximatelyEqual(this._amount, expected);
  }

  getCommissionEffectiveRate(): number {
    return this._sourceAmount > 0 ? this._amount / this._sourceAmount : 0;
  }

  getLevelDisplayName(): string {
    const levelNames = ['Direct', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
    return levelNames[this._level - 1] || `Level ${this._level}`;
  }

  getFormattedAmount(): string {
    return `${this._amount.toFixed(6)} USDT`;
  }

  getFormattedSourceAmount(): string {
    return `${this._sourceAmount.toFixed(6)} USDT`;
  }

  getFormattedRate(): string {
    return `${(this._rate * 100).toFixed(1)}%`;
  }

  getStatusDisplayName(): string {
    switch (this._status) {
      case CommissionStatus.PENDING: return 'Pending';
      case CommissionStatus.PROCESSED: return 'Processed';
      case CommissionStatus.PAID: return 'Paid';
      case CommissionStatus.CANCELLED: return 'Cancelled';
      default: return this._status;
    }
  }

  getFullDisplayName(): string {
    return `${this.getLevelDisplayName()} Commission (${this.getFormattedRate()})`;
  }

  /**
   * Commission analytics and reporting
   */
  getCommissionMetrics(): {
    amount: number;
    rate: number;
    sourceAmount: number;
    level: number;
    ageInDays: number;
    processingDelay: number;
    paymentDelay: number;
    isOverdue: boolean;
    isAmountCorrect: boolean;
  } {
    return {
      amount: this._amount,
      rate: this._rate,
      sourceAmount: this._sourceAmount,
      level: this._level,
      ageInDays: this.getCommissionAgeInDays(),
      processingDelay: this.getProcessingDelayInDays(),
      paymentDelay: this.getPaymentDelayInDays(),
      isOverdue: this.isOverdue(),
      isAmountCorrect: this.isAmountCorrect(),
    };
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    // User validation
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!this._sourceUserId || typeof this._sourceUserId !== 'string') {
      throw new ModelValidationError('Source user ID is required', 'sourceUserId');
    }

    if (this._userId === this._sourceUserId) {
      throw new ModelValidationError('User cannot earn commission from themselves', 'sourceUserId');
    }

    // Deposit validation
    if (!this._sourceDepositId || typeof this._sourceDepositId !== 'string') {
      throw new ModelValidationError('Source deposit ID is required', 'sourceDepositId');
    }

    // Type validation - only REFERRAL supported currently
    if (this._type !== CommissionType.REFERRAL) {
      throw new ModelValidationError('Only referral commissions are currently supported', 'type');
    }

    if (!Object.values(CommissionStatus).includes(this._status)) {
      throw new ModelValidationError('Invalid commission status', 'status');
    }

    // Level validation (1-5 for referral commissions)
    if (!ValidationUtils.isPositiveInteger(this._level) || this._level < 1 || this._level > 5) {
      throw new ModelValidationError('Commission level must be between 1 and 5', 'level');
    }

    // Amount validation
    if (!ValidationUtils.isPositiveNumber(this._amount)) {
      throw new ModelValidationError('Commission amount must be positive', 'amount');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._rate) || this._rate > 1) {
      throw new ModelValidationError('Commission rate must be between 0 and 1', 'rate');
    }

    if (!ValidationUtils.isPositiveNumber(this._sourceAmount)) {
      throw new ModelValidationError('Source amount must be positive', 'sourceAmount');
    }

    if (this._amount > this._sourceAmount) {
      throw new ModelValidationError('Commission amount cannot exceed source amount', 'amount');
    }

    // Status-specific validations
    if (this._status === CommissionStatus.PAID && !this._paidAt) {
      throw new ModelValidationError('Paid commissions must have payment date', 'paidAt');
    }

    if (this._status === CommissionStatus.PROCESSED && !this._processedAt) {
      throw new ModelValidationError('Processed commissions must have processing date', 'processedAt');
    }

    if (this._status === CommissionStatus.PROCESSED && !this._distributionBatchId) {
      throw new ModelValidationError('Processed commissions must have distribution batch ID', 'distributionBatchId');
    }
  }

  /**
   * Primary JSON serialization for API responses
   */
  toJSON(): any {
    return {
      // Core fields
      commissionId: this.commissionId,
      userId: this._userId,
      sourceUserId: this._sourceUserId,
      sourceDepositId: this._sourceDepositId,
      type: this._type,
      level: this._level,
      amount: this._amount,
      rate: this._rate,
      sourceAmount: this._sourceAmount,
      status: this._status,
      distributionBatchId: this._distributionBatchId,
      
      // Timestamps
      processedAt: this._processedAt?.toISOString(),
      paidAt: this._paidAt?.toISOString(),
      
      // Calculated fields
      expectedAmount: this.getExpectedAmount(),
      commissionEffectiveRate: this.getCommissionEffectiveRate(),
      
      // Analytics
      commissionAgeInDays: this.getCommissionAgeInDays(),
      processingDelayInDays: this.getProcessingDelayInDays(),
      paymentDelayInDays: this.getPaymentDelayInDays(),
      isOverdue: this.isOverdue(),
      
      // Formatted display
      formattedAmount: this.getFormattedAmount(),
      formattedSourceAmount: this.getFormattedSourceAmount(),
      formattedRate: this.getFormattedRate(),
      statusDisplayName: this.getStatusDisplayName(),
      levelDisplayName: this.getLevelDisplayName(),
      fullDisplayName: this.getFullDisplayName(),
      
      // Status checks
      isPending: this.isPending(),
      isProcessed: this.isProcessed(),
      isPaid: this.isPaid(),
      isCancelled: this.isCancelled(),
      isEligibleForProcessing: this.isEligibleForProcessing(),
      isEligibleForPayment: this.isEligibleForPayment(),
      
      // Validation
      isAmountCorrect: this.isAmountCorrect(),
      validateCommissionRate: this.validateCommissionRate(),
      
      // Level checks
      isLevel1Commission: this.isLevel1Commission(),
      isLevel2Commission: this.isLevel2Commission(),
      isHighLevelCommission: this.isHighLevelCommission(),
      
      ...this.getCommonJSON(),
    };
  }

  /**
   * Summary JSON for dashboards and reports
   */
  toSummaryJSON(): any {
    return {
      commissionId: this.commissionId,
      userId: this._userId,
      level: this._level,
      amount: this._amount,
      status: this._status,
      formattedAmount: this.getFormattedAmount(),
      statusDisplayName: this.getStatusDisplayName(),
      fullDisplayName: this.getFullDisplayName(),
      isOverdue: this.isOverdue(),
      createdAt: this.createdAt.toISOString(),
      paidAt: this._paidAt?.toISOString(),
    };
  }

  /**
   * DynamoDB serialization
   */
  toDynamoItem(): any {
    return {
      commissionId: this.commissionId,
      userId: this._userId,
      sourceUserId: this._sourceUserId,
      sourceDepositId: this._sourceDepositId,
      type: this._type,
      level: this._level,
      amount: this._amount,
      rate: this._rate,
      sourceAmount: this._sourceAmount,
      status: this._status,
      distributionBatchId: this._distributionBatchId,
      processedAt: this._processedAt?.toISOString(),
      paidAt: this._paidAt?.toISOString(),
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * EXAMPLE DYNAMODB ITEMS - How Commission data is stored
   * 
   * Table: YieldCycle-Commissions
   * Primary Key: commissionId (String)
   * GSI: userId-CreatedAt-gsi (for user commission history)
   * GSI: sourceUserId-CreatedAt-gsi (for commission source tracking)
   * GSI: status-CreatedAt-gsi (for processing workflows)
   * 
   * EXAMPLE 1: Level 1 Referral Commission (Pending)
   * ================================================
   * {
   *   "commissionId": "comm-001-level1",
   *   "userId": "user-002-level1",
   *   "sourceUserId": "user-003-level2",
   *   "sourceDepositId": "dep-003-10000",
   *   "type": "REFERRAL",
   *   "level": 1,
   *   "amount": 1000.0,
   *   "rate": 0.10,
   *   "sourceAmount": 10000.0,
   *   "status": "PENDING",
   *   "distributionBatchId": null,
   *   "processedAt": null,
   *   "paidAt": null,
   *   "CreatedAt": "2024-03-20T14:30:00.000Z",
   *   "UpdatedAt": "2024-03-20T14:30:00.000Z"
   * }
   * 
   * EXAMPLE 2: Level 3 Referral Commission (Processed)
   * ==================================================
   * {
   *   "commissionId": "comm-002-level3",
   *   "userId": "user-001-root",
   *   "sourceUserId": "user-003-level2",
   *   "sourceDepositId": "dep-003-10000",
   *   "type": "REFERRAL",
   *   "level": 3,
   *   "amount": 300.0,
   *   "rate": 0.03,
   *   "sourceAmount": 10000.0,
   *   "status": "PROCESSED",
   *   "distributionBatchId": "batch-2024-03-20-001",
   *   "processedAt": "2024-03-21T09:00:00.000Z",
   *   "paidAt": null,
   *   "CreatedAt": "2024-03-20T14:30:00.000Z",
   *   "UpdatedAt": "2024-03-21T09:00:00.000Z"
   * }
   * 
   * EXAMPLE 3: Level 5 Referral Commission (Paid)
   * =============================================
   * {
   *   "commissionId": "comm-003-level5",
   *   "userId": "user-001-root",
   *   "sourceUserId": "user-010-level10",
   *   "sourceDepositId": "dep-010-25000",
   *   "type": "REFERRAL",
   *   "level": 5,
   *   "amount": 250.0,
   *   "rate": 0.01,
   *   "sourceAmount": 25000.0,
   *   "status": "PAID",
   *   "distributionBatchId": "batch-2024-03-19-002",
   *   "processedAt": "2024-03-20T09:00:00.000Z",
   *   "paidAt": "2024-03-20T15:30:00.000Z",
   *   "CreatedAt": "2024-03-19T16:45:00.000Z",
   *   "UpdatedAt": "2024-03-20T15:30:00.000Z"
   * }
   * 
   * KEY FEATURES IN DYNAMODB STRUCTURE:
   * ===================================
   * 
   * 1. REFERRAL COMMISSION LIFECYCLE:
   *    - status: PENDING → PROCESSED → PAID
   *    - processedAt: When commission was calculated and approved
   *    - paidAt: When commission was credited to user wallet
   *    - distributionBatchId: Links to batch processing for audit
   * 
   * 2. 5-LEVEL MLM COMMISSION STRUCTURE:
   *    - level: 1-5 for referral commissions (10%, 5%, 3%, 1%, 1%)
   *    - rate: Actual commission rate applied (0.10, 0.05, 0.03, 0.01, 0.01)
   *    - amount: Final commission amount in USDT
   *    - sourceAmount: Original deposit amount that generated commission
   * 
   * 3. COMMISSION TRACEABILITY:
   *    - sourceUserId: Who made the deposit triggering commission
   *    - sourceDepositId: Specific deposit that generated commission
   *    - userId: Who receives the commission
   *    - type: Always "REFERRAL" for current platform requirements
   * 
   * 4. GLOBAL SECONDARY INDEXES:
   *    - userId-CreatedAt-gsi: User commission history queries
   *    - sourceUserId-CreatedAt-gsi: Track commissions generated by user
   *    - status-CreatedAt-gsi: Processing workflow queries
   *    - distributionBatchId-gsi: Batch processing and audit trails
   */
}
