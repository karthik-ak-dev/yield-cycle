/**
 * MonthlyIncome Entity Model
 * 
 * 💰 8% Monthly Income Distribution System for Yield Cycle Platform
 * 
 * PURPOSE:
 * This model represents the monthly income distribution process where users earn 8% monthly
 * returns on their active deposits. Manages batch processing of income calculations and distributions.
 * 
 * MONTHLY INCOME SYSTEM (as per TECHNICAL.md):
 * - Users earn 8% monthly on active deposits for 25 months
 * - Total return: 25 × 8% = 200% over the earning period
 * - Income distributed monthly to user's INCOME wallet pocket
 * - Batch processing for efficient distribution to all eligible users
 * - Complete audit trail for regulatory compliance
 * 
 * KEY FEATURES:
 * - Batch processing of monthly distributions
 * - Precise 8% calculation using active deposits
 * - Transaction status tracking (PENDING → PROCESSING → COMPLETED)
 * - Deposit-level tracking for transparency
 * - Failure handling and retry capabilities
 * 
 * BUSINESS RULES:
 * - Only active deposits (not DORMANT or COMPLETED) earn income
 * - Income calculated as 8% of total active deposits per user
 * - Distributions processed monthly in batches
 * - Complete transaction audit for each distribution
 * - Integration with Transaction and WalletPocket systems
 * 
 * UTILITY INTEGRATIONS:
 * - ValidationUtils: For numeric validation and business rules
 * - MathUtils: For precise 8% calculations and rounding
 * - DateValidator: For month format validation (YYYY-MM)
 * 
 * INTEGRATION POINTS:
 * - DepositService: Active deposit calculation
 * - TransactionService: MONTHLY_INCOME transaction creation
 * - WalletPocketService: INCOME pocket credit
 * - UserService: Earnings limit tracking
 * 
 * @see TECHNICAL.md - Monthly income distribution specifications
 * @see Deposit - For active deposit status tracking
 * @see Transaction - For MONTHLY_INCOME transaction records
 * @see WalletPocket - For INCOME pocket balance updates
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { TransactionStatus } from '../types/enums';
import { ValidationUtils, MathUtils } from '../utils/calculations';
import { DateValidator } from '../utils/validation';

/**
 * MonthlyIncome domain entity for 8% monthly return distributions
 */
export class MonthlyIncome extends BaseModel {
  public readonly incomeId: string;
  private _userId: string;
  private _month: string; // Format: YYYY-MM (e.g., "2024-01")
  private _totalActiveDeposits: number;
  private _incomeAmount: number;
  private _status: TransactionStatus;
  private _processedAt?: Date;
  private _failureReason?: string;
  private _batchId: string;
  private _depositIds: string[];

  constructor(
    userId: string,
    month: string,
    totalActiveDeposits: number,
    incomeAmount: number,
    batchId: string,
    depositIds: string[] = [],
    status: TransactionStatus = TransactionStatus.PENDING,
    processedAt?: Date,
    failureReason?: string,
    incomeId?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.incomeId = incomeId || this.generateId();
    this._userId = userId;
    this._month = month;
    this._totalActiveDeposits = totalActiveDeposits;
    this._incomeAmount = incomeAmount;
    this._batchId = batchId;
    this._depositIds = [...depositIds];
    this._status = status;
    this._processedAt = processedAt;
    this._failureReason = failureReason;

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get month(): string { return this._month; }
  get totalActiveDeposits(): number { return this._totalActiveDeposits; }
  get incomeAmount(): number { return this._incomeAmount; }
  get batchId(): string { return this._batchId; }
  get depositIds(): string[] { return [...this._depositIds]; }
  get status(): TransactionStatus { return this._status; }
  get processedAt(): Date | undefined { return this._processedAt; }
  get failureReason(): string | undefined { return this._failureReason; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): MonthlyIncome {
    return new MonthlyIncome(
      data.userId,
      data.month,
      data.totalActiveDeposits,
      data.incomeAmount,
      data.batchId,
      data.depositIds || [],
      data.status,
      data.processedAt ? new Date(data.processedAt) : undefined,
      data.failureReason,
      data.incomeId,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * Factory method to create monthly income record
   * Calculates 8% monthly return on total active deposits
   */
  static createMonthlyIncome(
    userId: string,
    month: string,
    totalActiveDeposits: number,
    batchId: string,
    depositIds: string[]
  ): MonthlyIncome {
    // Calculate 8% monthly income with precise rounding
    const incomeAmount = MathUtils.round(totalActiveDeposits * 0.08);
    
    return new MonthlyIncome(
      userId,
      month,
      totalActiveDeposits,
      incomeAmount,
      batchId,
      depositIds
    );
  }

  /**
   * Factory method to create bulk monthly incomes for batch processing
   */
  static createBulkMonthlyIncomes(
    userIncomeData: {
      userId: string;
      totalActiveDeposits: number;
      depositIds: string[];
    }[],
    month: string,
    batchId: string
  ): MonthlyIncome[] {
    return userIncomeData.map(userData => 
      this.createMonthlyIncome(
        userData.userId,
        month,
        userData.totalActiveDeposits,
        batchId,
        userData.depositIds
      )
    );
  }

  /**
   * Factory method to create for current month
   */
  static createForCurrentMonth(
    userId: string,
    totalActiveDeposits: number,
    batchId: string,
    depositIds: string[]
  ): MonthlyIncome {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    return this.createMonthlyIncome(
      userId,
      currentMonth,
      totalActiveDeposits,
      batchId,
      depositIds
    );
  }

  /**
   * Marks the income as processing
   */
  startProcessing(): void {
    if (this._status !== TransactionStatus.PENDING) {
      throw new ModelValidationError('Only pending income can be processed', 'status');
    }

    this._status = TransactionStatus.PROCESSING;
    this.touch();
  }

  /**
   * Marks the income as completed
   */
  complete(): void {
    if (this._status !== TransactionStatus.PROCESSING) {
      throw new ModelValidationError('Only processing income can be completed', 'status');
    }

    this._status = TransactionStatus.COMPLETED;
    this._processedAt = new Date();
    this._failureReason = undefined;
    this.touch();
  }

  /**
   * Marks the income as failed
   */
  fail(reason: string): void {
    if (this._status === TransactionStatus.COMPLETED) {
      throw new ModelValidationError('Completed income cannot be failed', 'status');
    }

    this._status = TransactionStatus.FAILED;
    this._failureReason = reason;
    this._processedAt = new Date();
    this.touch();
  }

  /**
   * Cancels the income distribution
   */
  cancel(): void {
    if (this._status === TransactionStatus.COMPLETED) {
      throw new ModelValidationError('Completed income cannot be cancelled', 'status');
    }

    this._status = TransactionStatus.CANCELLED;
    this.touch();
  }

  /**
   * Updates the income amount (before processing)
   */
  updateIncomeAmount(newAmount: number): void {
    if (!ValidationUtils.isNonNegativeNumber(newAmount)) {
      throw new ModelValidationError('Income amount must be non-negative', 'incomeAmount');
    }

    if (this._status !== TransactionStatus.PENDING) {
      throw new ModelValidationError('Cannot update amount of non-pending income', 'status');
    }

    this._incomeAmount = MathUtils.round(newAmount);
    this.touch();
  }

  /**
   * Adds deposit to the income calculation
   */
  addDeposit(depositId: string): void {
    if (!depositId || typeof depositId !== 'string') {
      throw new ModelValidationError('Valid deposit ID is required', 'depositId');
    }

    if (this._status !== TransactionStatus.PENDING) {
      throw new ModelValidationError('Cannot modify non-pending income', 'status');
    }

    if (!this._depositIds.includes(depositId)) {
      this._depositIds.push(depositId);
      this.touch();
    }
  }

  /**
   * Removes deposit from the income calculation
   */
  removeDeposit(depositId: string): void {
    if (this._status !== TransactionStatus.PENDING) {
      throw new ModelValidationError('Cannot modify non-pending income', 'status');
    }

    const index = this._depositIds.indexOf(depositId);
    if (index > -1) {
      this._depositIds.splice(index, 1);
      this.touch();
    }
  }

  /**
   * Domain query methods
   */
  isPending(): boolean { return this._status === TransactionStatus.PENDING; }
  isProcessing(): boolean { return this._status === TransactionStatus.PROCESSING; }
  isCompleted(): boolean { return this._status === TransactionStatus.COMPLETED; }
  isFailed(): boolean { return this._status === TransactionStatus.FAILED; }
  isCancelled(): boolean { return this._status === TransactionStatus.CANCELLED; }
  
  isForUser(userId: string): boolean { return this._userId === userId; }
  isForMonth(month: string): boolean { return this._month === month; }
  hasDeposits(): boolean { return this._depositIds.length > 0; }
  includesDeposit(depositId: string): boolean { return this._depositIds.includes(depositId); }

  /**
   * Business logic methods for yield cycle platform
   */
  getExpectedIncomeAmount(): number {
    // 8% monthly return calculation with precision
    return MathUtils.round(this._totalActiveDeposits * 0.08);
  }

  isAmountCorrect(): boolean {
    const expected = this.getExpectedIncomeAmount();
    return MathUtils.isApproximatelyEqual(this._incomeAmount, expected);
  }

  getIncomeRate(): number {
    return 0.08; // Fixed 8% monthly rate as per TECHNICAL.md
  }

  getMonthAsDate(): Date {
    return new Date(`${this._month}-01`);
  }

  isCurrentMonth(): boolean {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this._month === currentMonth;
  }

  getProcessingTimeInMinutes(): number {
    if (!this._processedAt) return 0;
    const diffMs = this._processedAt.getTime() - this.createdAt.getTime();
    return Math.round(diffMs / (60 * 1000));
  }

  getAffectedDepositsCount(): number {
    return this._depositIds.length;
  }

  getFormattedAmount(): string {
    return `${this._incomeAmount.toFixed(6)} USDT`;
  }

  getFormattedTotalDeposits(): string {
    return `${this._totalActiveDeposits.toFixed(6)} USDT`;
  }

  getStatusDisplayName(): string {
    switch (this._status) {
      case TransactionStatus.PENDING: return 'Pending Distribution';
      case TransactionStatus.PROCESSING: return 'Processing Income';
      case TransactionStatus.COMPLETED: return 'Income Distributed';
      case TransactionStatus.FAILED: return 'Distribution Failed';
      case TransactionStatus.CANCELLED: return 'Distribution Cancelled';
      default: return this._status;
    }
  }

  getMonthDisplayName(): string {
    const date = this.getMonthAsDate();
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  // Additional business methods for yield cycle platform
  
  /**
   * Calculates income percentage of total deposits
   */
  getIncomePercentage(): number {
    if (this._totalActiveDeposits === 0) return 0;
    return (this._incomeAmount / this._totalActiveDeposits) * 100;
  }

  /**
   * Check if this income contributes to user's earning journey
   */
  isPartOfEarningJourney(): boolean {
    return this._status === TransactionStatus.COMPLETED && this._incomeAmount > 0;
  }

  /**
   * Get month number (1-12) for analysis
   */
  getMonthNumber(): number {
    return parseInt(this._month.split('-')[1], 10);
  }

  /**
   * Get year for analysis
   */
  getYear(): number {
    return parseInt(this._month.split('-')[0], 10);
  }

  /**
   * Check if income is for a past month
   */
  isPastMonth(): boolean {
    const now = new Date();
    const incomeDate = this.getMonthAsDate();
    return incomeDate < new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Check if income is for a future month
   */
  isFutureMonth(): boolean {
    const now = new Date();
    const incomeDate = this.getMonthAsDate();
    return incomeDate > new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Calculate monthly income rate percentage (should be 8%)
   */
  getCalculatedIncomeRate(): number {
    if (this._totalActiveDeposits === 0) return 0;
    return MathUtils.round((this._incomeAmount / this._totalActiveDeposits) * 100, 2);
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!this.isValidMonthFormat(this._month)) {
      throw new ModelValidationError('Month must be in YYYY-MM format', 'month');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._totalActiveDeposits)) {
      throw new ModelValidationError('Total active deposits cannot be negative', 'totalActiveDeposits');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._incomeAmount)) {
      throw new ModelValidationError('Income amount cannot be negative', 'incomeAmount');
    }

    if (!this._batchId || typeof this._batchId !== 'string') {
      throw new ModelValidationError('Batch ID is required', 'batchId');
    }

    if (!Object.values(TransactionStatus).includes(this._status)) {
      throw new ModelValidationError('Invalid transaction status', 'status');
    }

    if (!Array.isArray(this._depositIds)) {
      throw new ModelValidationError('Deposit IDs must be an array', 'depositIds');
    }

    // Business rule validations for yield cycle platform
    if (this._status === TransactionStatus.COMPLETED && !this._processedAt) {
      throw new ModelValidationError('Completed income must have processing date', 'processedAt');
    }

    if (this._status === TransactionStatus.FAILED && !this._failureReason) {
      throw new ModelValidationError('Failed income must have failure reason', 'failureReason');
    }

    // Validate 8% income calculation
    const expectedIncome = MathUtils.round(this._totalActiveDeposits * 0.08);
    if (!MathUtils.isApproximatelyEqual(this._incomeAmount, expectedIncome)) {
      throw new ModelValidationError('Income amount must be exactly 8% of total active deposits', 'incomeAmount');
    }

    // Validate month is not in future beyond current month
    const now = new Date();
    const maxAllowedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (this._month > maxAllowedMonth) {
      throw new ModelValidationError('Cannot process income for future months', 'month');
    }
  }

  /**
   * Validates month format (YYYY-MM)
   */
  private isValidMonthFormat(month: string): boolean {
    if (!month || typeof month !== 'string') return false;
    
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) return false;
    
    // Validate that it's a real date
    const dateValidation = DateValidator.validate(`${month}-01`);
    return dateValidation.isValid;
  }

  /**
   * Primary JSON serialization for yield cycle monthly income
   */
  toJSON(): any {
    return {
      incomeId: this.incomeId,
      userId: this._userId,
      month: this._month,
      totalActiveDeposits: this._totalActiveDeposits,
      incomeAmount: this._incomeAmount,
      batchId: this._batchId,
      depositIds: this._depositIds,
      affectedDepositsCount: this.getAffectedDepositsCount(),
      status: this._status,
      processedAt: this._processedAt?.toISOString(),
      failureReason: this._failureReason,
      
      // Calculation details
      expectedIncomeAmount: this.getExpectedIncomeAmount(),
      incomeRate: this.getIncomeRate(),
      incomePercentage: this.getIncomePercentage(),
      calculatedIncomeRate: this.getCalculatedIncomeRate(),
      
      // Date analysis
      monthAsDate: this.getMonthAsDate().toISOString(),
      monthNumber: this.getMonthNumber(),
      year: this.getYear(),
      isCurrentMonth: this.isCurrentMonth(),
      isPastMonth: this.isPastMonth(),
      isFutureMonth: this.isFutureMonth(),
      
      // Processing details
      processingTimeInMinutes: this.getProcessingTimeInMinutes(),
      
      // Display formatting
      formattedAmount: this.getFormattedAmount(),
      formattedTotalDeposits: this.getFormattedTotalDeposits(),
      statusDisplayName: this.getStatusDisplayName(),
      monthDisplayName: this.getMonthDisplayName(),
      
      // Status checks
      isPending: this.isPending(),
      isProcessing: this.isProcessing(),
      isCompleted: this.isCompleted(),
      isFailed: this.isFailed(),
      isCancelled: this.isCancelled(),
      
      // Business logic checks
      hasDeposits: this.hasDeposits(),
      isAmountCorrect: this.isAmountCorrect(),
      isPartOfEarningJourney: this.isPartOfEarningJourney(),
      
      ...this.getCommonJSON(),
    };
  }

  /**
   * Summary JSON for dashboards and reports
   */
  toSummaryJSON(): any {
    return {
      incomeId: this.incomeId,
      userId: this._userId,
      month: this._month,
      incomeAmount: this._incomeAmount,
      status: this._status,
      affectedDepositsCount: this.getAffectedDepositsCount(),
      formattedAmount: this.getFormattedAmount(),
      statusDisplayName: this.getStatusDisplayName(),
      monthDisplayName: this.getMonthDisplayName(),
      incomePercentage: this.getIncomePercentage(),
      isPartOfEarningJourney: this.isPartOfEarningJourney(),
      createdAt: this.createdAt.toISOString(),
      processedAt: this._processedAt?.toISOString(),
    };
  }

  /**
   * DynamoDB serialization
   */
  toDynamoItem(): any {
    return {
      incomeId: this.incomeId,
      userId: this._userId,
      month: this._month,
      totalActiveDeposits: this._totalActiveDeposits,
      incomeAmount: this._incomeAmount,
      status: this._status,
      batchId: this._batchId,
      depositIds: this._depositIds,
      processedAt: this._processedAt?.toISOString(),
      failureReason: this._failureReason,
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }
}
