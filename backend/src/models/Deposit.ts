/**
 * Deposit Entity Model
 * 
 * 💰 USDT Deposit System for Yield Cycle Platform
 * 
 * PURPOSE:
 * This model represents USDT deposits made by users to start earning 8% monthly returns.
 * Tracks the complete deposit lifecycle from blockchain confirmation to 25-month completion.
 * 
 * DEPOSIT LIFECYCLE (as per TECHNICAL.md):
 * 1. PENDING: Blockchain transaction detected, awaiting confirmations
 * 2. CONFIRMED: Sufficient confirmations received, deposit activated
 * 3. ACTIVE: Earning 8% monthly returns (auto-activated after confirmation)
 * 4. DORMANT: User exceeded limits, no returns (if applicable)
 * 5. COMPLETED: 25 months finished, total 200% earned
 * 6. FAILED: Blockchain transaction failed
 * 
 * KEY FEATURES:
 * - Blockchain transaction tracking with confirmations
 * - 8% monthly income calculation and distribution tracking
 * - 25-month earning period management
 * - 200% total return cap enforcement
 * - User limit integration for deposit activation
 * 
 * BUSINESS RULES:
 * - Deposits earn 8% monthly for 25 months (200% total)
 * - Minimum confirmation requirement before activation
 * - Automatic deactivation after 25 months
 * - Complete audit trail for regulatory compliance
 * 
 * UTILITY INTEGRATIONS:
 * - AmountValidator: For deposit amount validation
 * - BlockchainValidator: For transaction hash and address validation
 * - ValidationUtils: For business rule validation
 * - MathUtils: For precision calculations (8% monthly, totals)
 * 
 * @see TECHNICAL.md - Deposit and earnings specifications
 * @see Transaction - For deposit transaction records
 * @see WalletPocket - For balance updates (ACTIVE_DEPOSITS pocket)
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { DepositStatus } from '../types/enums';
import { AmountValidator, BlockchainValidator } from '../utils/validation';
import { ValidationUtils, MathUtils } from '../utils/calculations';

/**
 * Deposit Domain Entity
 * 
 * Represents a single USDT deposit in the yield cycle platform.
 * Tracks the deposit from blockchain detection through 25 months of 8% earnings.
 * 
 * DEPOSIT FLOWS:
 * - User sends USDT to assigned address → PENDING
 * - Blockchain confirmations → CONFIRMED → ACTIVE
 * - Monthly income distribution for 25 months
 * - After 25 months → COMPLETED (200% total earned)
 */
export class Deposit extends BaseModel {
  public readonly id: string;
  private _userId: string;
  private _amount: number;
  private _currency: string;
  private _status: DepositStatus;
  private _blockchainTxHash: string;
  private _fromAddress: string;
  private _toAddress: string;
  private _blockNumber?: number;
  private _confirmations: number;
  private _requiredConfirmations: number;
  private _isActive: boolean;
  private _monthsActive: number;
  private _totalEarnings: number;
  private _lastIncomeAt?: Date;
  private _confirmedAt?: Date;
  private _failureReason?: string;

  constructor(
    userId: string,
    amount: number,
    blockchainTxHash: string,
    fromAddress: string,
    toAddress: string,
    currency: string = 'USDT',
    status: DepositStatus = DepositStatus.PENDING,
    blockNumber?: number,
    confirmations: number = 0,
    requiredConfirmations: number = 12,
    isActive: boolean = false,
    monthsActive: number = 0,
    totalEarnings: number = 0,
    lastIncomeAt?: Date,
    confirmedAt?: Date,
    failureReason?: string,
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.id = id || this.generateId();
    this._userId = userId;
    this._amount = amount;
    this._currency = currency;
    this._status = status;
    this._blockchainTxHash = blockchainTxHash;
    this._fromAddress = fromAddress;
    this._toAddress = toAddress;
    this._blockNumber = blockNumber;
    this._confirmations = confirmations;
    this._requiredConfirmations = requiredConfirmations;
    this._isActive = isActive;
    this._monthsActive = monthsActive;
    this._totalEarnings = totalEarnings;
    this._lastIncomeAt = lastIncomeAt;
    this._confirmedAt = confirmedAt;
    this._failureReason = failureReason;

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
  get status(): DepositStatus { return this._status; }
  get blockchainTxHash(): string { return this._blockchainTxHash; }
  get fromAddress(): string { return this._fromAddress; }
  get toAddress(): string { return this._toAddress; }
  get blockNumber(): number | undefined { return this._blockNumber; }
  get confirmations(): number { return this._confirmations; }
  get requiredConfirmations(): number { return this._requiredConfirmations; }
  get isActive(): boolean { return this._isActive; }
  get monthsActive(): number { return this._monthsActive; }
  get totalEarnings(): number { return this._totalEarnings; }
  get lastIncomeAt(): Date | undefined { return this._lastIncomeAt; }
  get confirmedAt(): Date | undefined { return this._confirmedAt; }
  get failureReason(): string | undefined { return this._failureReason; }

  /**
   * 🏭 Factory Method: Reconstruct from Database
   * 
   * UTILITY INTEGRATION: Standard persistence reconstruction pattern.
   */
  static fromPersistence(data: any): Deposit {
    return new Deposit(
      data.userId,
      data.amount,
      data.blockchainTxHash,
      data.fromAddress,
      data.toAddress,
      data.currency || 'USDT',
      data.status || DepositStatus.PENDING,
      data.blockNumber,
      data.confirmations || 0,
      data.requiredConfirmations || 12,
      data.isActive || false,
      data.monthsActive || 0,
      data.totalEarnings || 0,
      data.lastIncomeAt ? new Date(data.lastIncomeAt) : undefined,
      data.confirmedAt ? new Date(data.confirmedAt) : undefined,
      data.failureReason,
      data.depositId || data.id,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * 🏭 Factory Method: Create Deposit from Blockchain Transaction
   * 
   * BUSINESS LOGIC: When blockchain monitoring detects a USDT deposit to user's address.
   * Creates a new deposit in PENDING status awaiting blockchain confirmations.
   * 
   * UTILITY INTEGRATION: Validates addresses and transaction hash using blockchain utilities.
   * 
   * USAGE (in BlockchainService):
   * ```typescript
   * const deposit = Deposit.createFromBlockchain(
   *   userId, 
   *   amount, 
   *   txHash, 
   *   senderAddress, 
   *   userDepositAddress,
   *   blockNumber
   * );
   * await depositRepository.save(deposit);
   * ```
   * 
   * @param userId - User ID who owns this deposit
   * @param amount - USDT amount deposited
   * @param txHash - Blockchain transaction hash
   * @param fromAddress - Sender's blockchain address
   * @param toAddress - User's assigned deposit address
   * @param blockNumber - Block number (optional, may come later)
   * @returns New Deposit instance ready for storage
   */
  static createFromBlockchain(
    userId: string,
    amount: number,
    txHash: string,
    fromAddress: string,
    toAddress: string,
    blockNumber?: number
  ): Deposit {
    return new Deposit(
      userId,
      amount,
      txHash,
      fromAddress,
      toAddress,
      'USDT',
      DepositStatus.PENDING,
      blockNumber
    );
  }

  /**
   * 🔧 Update Blockchain Confirmations
   * 
   * UTILITY INTEGRATION: Uses ValidationUtils for confirmation count validation.
   * Updates confirmation count and auto-confirms when threshold reached.
   * 
   * BUSINESS LOGIC: Auto-confirmation triggers the start of earning period.
   * 
   * @param confirmations - Current confirmation count from blockchain
   * @param blockNumber - Block number (optional)
   */
  updateConfirmations(confirmations: number, blockNumber?: number): void {
    if (!ValidationUtils.isNonNegativeNumber(confirmations)) {
      throw new ModelValidationError('Confirmations must be non-negative', 'confirmations');
    }

    this._confirmations = confirmations;
    
    if (blockNumber !== undefined) {
      this._blockNumber = blockNumber;
    }

    // Auto-confirm when required confirmations reached
    if (this._confirmations >= this._requiredConfirmations && this._status === DepositStatus.PENDING) {
      this.confirm();
    }

    this.touch();
  }

  /**
   * 🎯 Confirm Deposit - Start Earning Period
   * 
   * BUSINESS LOGIC: Confirms the deposit and automatically starts earning.
   * This is when the 25-month, 8% monthly earning period begins.
   * 
   * INTEGRATION: Should trigger:
   * - Transaction creation for ACTIVE_DEPOSIT_CREDIT
   * - WalletPocket balance update for ACTIVE_DEPOSITS
   * - User earnings limit checks
   */
  confirm(): void {
    if (this._status !== DepositStatus.PENDING) {
      throw new ModelValidationError('Only pending deposits can be confirmed', 'status');
    }

    this._status = DepositStatus.CONFIRMED;
    this._confirmedAt = new Date();
    
    // Business rule: Deposits start earning immediately after confirmation
    this.activate();
  }

  /**
   * 🟢 Activate Deposit for Earning
   * 
   * BUSINESS LOGIC: Activates deposit to start earning 8% monthly.
   * Used when deposit is confirmed and user hasn't exceeded limits.
   * 
   * STATUS FLOW: CONFIRMED → ACTIVE (earning state)
   */
  activate(): void {
    if (this._status !== DepositStatus.CONFIRMED && this._status !== DepositStatus.DORMANT) {
      throw new ModelValidationError('Only confirmed or dormant deposits can be activated', 'status');
    }

    this._status = DepositStatus.ACTIVE;
    this._isActive = true;
    this.touch();
  }

  /**
   * 🔴 Deactivate Deposit (User Limit Exceeded)
   * 
   * BUSINESS LOGIC: Deactivates deposit when user exceeds earning limits.
   * Deposit goes DORMANT - no more earnings until limits reset.
   * 
   * STATUS FLOW: ACTIVE → DORMANT (no earnings)
   */
  deactivate(): void {
    this._status = DepositStatus.DORMANT;
    this._isActive = false;
    this.touch();
  }

  /**
   * ❌ Fail Deposit with Reason
   * 
   * BUSINESS LOGIC: Marks deposit as failed (blockchain transaction issues).
   * No earnings possible, permanent failure state.
   */
  fail(reason: string): void {
    this._status = DepositStatus.FAILED;
    this._failureReason = reason;
    this._isActive = false;
    this.touch();
  }

  /**
   * 💰 Record Monthly Income Distribution
   * 
   * BUSINESS LOGIC: Records 8% monthly income distribution to user.
   * Tracks earning progression and enforces 25-month limit.
   * 
   * UTILITY INTEGRATION: Uses ValidationUtils and MathUtils for calculations.
   * 
   * BUSINESS RULES:
   * - Only active deposits can earn income
   * - Income amount must be positive (validated)
   * - Auto-completion after 25 months
   * - Precise earnings tracking with MathUtils
   * 
   * INTEGRATION: Should trigger:
   * - Transaction creation for MONTHLY_INCOME
   * - WalletPocket credit to INCOME pocket
   * - User total earnings update
   * 
   * @param amount - Monthly income amount (8% of deposit)
   * @throws ModelValidationError for inactive deposits or invalid amounts
   */
  recordIncomeDistribution(amount: number): void {
    if (!this._isActive) {
      throw new ModelValidationError('Inactive deposits cannot earn income', 'isActive');
    }

    // 🔗 UTILITY INTEGRATION: Validate income amount
    if (!ValidationUtils.isPositiveNumber(amount)) {
      throw new ModelValidationError('Income amount must be positive', 'amount');
    }

    // 🔗 UTILITY INTEGRATION: Precise calculations with MathUtils
    this._totalEarnings = MathUtils.round(this._totalEarnings + amount);
    this._monthsActive += 1;
    this._lastIncomeAt = new Date();
    
    // Business rule: Complete after 25 months (200% total return)
    if (this._monthsActive >= 25) {
      this.complete();
    }

    this.touch();
  }

  /**
   * 🏁 Complete Deposit - 25 Months Finished
   * 
   * BUSINESS LOGIC: Marks deposit as completed after 25 months.
   * User has earned 200% total return (25 × 8% = 200%).
   * 
   * STATUS FLOW: ACTIVE → COMPLETED (no more earnings)
   */
  complete(): void {
    this._status = DepositStatus.COMPLETED;
    this._isActive = false;
    this.touch();
  }

  /**
   * Updates status
   */
  updateStatus(newStatus: DepositStatus, failureReason?: string): void {
    if (!Object.values(DepositStatus).includes(newStatus)) {
      throw new ModelValidationError('Invalid deposit status', 'status');
    }

    this._status = newStatus;
    
    if (newStatus === DepositStatus.FAILED && failureReason) {
      this._failureReason = failureReason;
      this._isActive = false;
    }

    if (newStatus === DepositStatus.CONFIRMED && !this._confirmedAt) {
      this._confirmedAt = new Date();
    }

    this.touch();
  }

  /**
   * 🔍 Domain Query Methods - Business Logic Validation
   * 
   * These methods implement core business rules for deposit classification.
   * Used by services and controllers for deposit state validation and business logic.
   */

  // Status queries aligned with DepositStatus enum
  isPending(): boolean { return this._status === DepositStatus.PENDING; }
  isConfirmed(): boolean { return this._status === DepositStatus.CONFIRMED; }
  isActiveStatus(): boolean { return this._status === DepositStatus.ACTIVE; }
  isDormant(): boolean { return this._status === DepositStatus.DORMANT; }
  isCompleted(): boolean { return this._status === DepositStatus.COMPLETED; }
  isFailed(): boolean { return this._status === DepositStatus.FAILED; }
  
  // Blockchain confirmation queries
  isFullyConfirmed(): boolean {
    return this._confirmations >= this._requiredConfirmations;
  }
  
  // Earning status queries
  isEarning(): boolean { return this._isActive && this.isActiveStatus(); }
  canEarn(): boolean { return this._isActive && !this.hasReachedMaturity(); }
  hasReachedMaturity(): boolean { return this._monthsActive >= 25; }
  
  // User validation
  isForUser(userId: string): boolean { return this._userId === userId; }
  
  // Business categorization
  needsConfirmation(): boolean {
    return this.isPending() && !this.isFullyConfirmed();
  }

  isInEarningPeriod(): boolean {
    return this.isActiveStatus() && this.canEarn();
  }

  /**
   * 📊 Business Logic Methods - Financial Calculations
   * 
   * UTILITY INTEGRATION: Uses MathUtils for precise financial calculations.
   * These methods provide core business calculations for the yield cycle platform.
   */

  /**
   * Calculate 8% monthly income amount
   * 
   * BUSINESS RULE: Deposits earn 8% of the principal amount monthly.
   */
  getMonthlyIncomeAmount(): number {
    return MathUtils.round(this._amount * 0.08); // 8% monthly
  }

  /**
   * Get remaining months in earning period
   */
  getRemainingMonths(): number {
    return Math.max(0, 25 - this._monthsActive);
  }

  /**
   * Calculate total projected earnings (200% rule)
   * 
   * BUSINESS RULE: Total earnings = 25 months × 8% = 200% of deposit amount.
   */
  getTotalProjectedEarnings(): number {
    return MathUtils.round(this._amount * 2); // 200% total return
  }

  /**
   * Calculate remaining earnings potential
   */
  getRemainingEarnings(): number {
    return MathUtils.round(this.getTotalProjectedEarnings() - this._totalEarnings);
  }

  /**
   * Get earning progress as percentage (for UI progress bars)
   */
  getEarningProgress(): number {
    const projected = this.getTotalProjectedEarnings();
    return projected > 0 ? MathUtils.round((this._totalEarnings / projected) * 100) : 0;
  }

  /**
   * Get blockchain confirmation progress as percentage
   */
  getConfirmationProgress(): number {
    return Math.min(100, Math.round((this._confirmations / this._requiredConfirmations) * 100));
  }

  /**
   * Get formatted deposit amount for UI display
   */
  getFormattedAmount(): string {
    return `${this._amount.toFixed(6)} ${this._currency}`;
  }

  /**
   * Get formatted total earnings for UI display
   */
  getFormattedTotalEarnings(): string {
    return `${this._totalEarnings.toFixed(6)} ${this._currency}`;
  }

  /**
   * Get formatted monthly income amount for UI display
   */
  getFormattedMonthlyIncome(): string {
    return `${this.getMonthlyIncomeAmount().toFixed(6)} ${this._currency}`;
  }

  /**
   * Get blockchain explorer URL for transaction verification
   */
  getExplorerUrl(): string {
    return `https://bscscan.com/tx/${this._blockchainTxHash}`;
  }

  /**
   * Get user-friendly status display name
   */
  getStatusDisplayName(): string {
    switch (this._status) {
      case DepositStatus.PENDING: return 'Pending Confirmation';
      case DepositStatus.CONFIRMED: return 'Confirmed';
      case DepositStatus.ACTIVE: return 'Earning';
      case DepositStatus.DORMANT: return 'Dormant';
      case DepositStatus.COMPLETED: return 'Completed';
      case DepositStatus.FAILED: return 'Failed';
      default: return this._status;
    }
  }

  /**
   * Calculate time until next monthly income distribution
   */
  getTimeToNextIncome(): string {
    if (!this._lastIncomeAt || !this._isActive) return 'N/A';
    
    const nextIncomeDate = new Date(this._lastIncomeAt);
    nextIncomeDate.setMonth(nextIncomeDate.getMonth() + 1);
    
    const now = new Date();
    const diffMs = nextIncomeDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? `${diffDays} days` : 'Due now';
  }

  /**
   * 🔒 Validation Implementation - Utility Integration
   * 
   * UTILITY USAGE:
   * - AmountValidator.validateDeposit(): Deposit amount validation
   * - BlockchainValidator.validateTransactionHash(): Transaction hash validation
   * - BlockchainValidator.validateAddress(): Address validation
   * - ValidationUtils: Numeric validation and business rules
   * 
   * VALIDATION RULES:
   * - User ID required and valid string
   * - Deposit amount must pass business validation
   * - Currency required (USDT)
   * - Status must be valid enum value
   * - Blockchain data must be valid (addresses, transaction hash)
   * - Numeric fields must be within valid ranges
   * - Business constraints (confirmations, months, etc.)
   */
  protected validate(): void {
    // Basic field validation
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    // 🔗 UTILITY INTEGRATION: Validate deposit amount
    const amountValidation = AmountValidator.validateDeposit(this._amount);
    if (!amountValidation.isValid) {
      throw new ModelValidationError(amountValidation.error!, 'amount');
    }

    if (!this._currency || typeof this._currency !== 'string') {
      throw new ModelValidationError('Currency is required', 'currency');
    }

    if (!Object.values(DepositStatus).includes(this._status)) {
      throw new ModelValidationError('Invalid deposit status', 'status');
    }

    // 🔗 UTILITY INTEGRATION: Validate blockchain transaction hash
    const txValidation = BlockchainValidator.validateTransactionHash(this._blockchainTxHash);
    if (!txValidation.isValid) {
      throw new ModelValidationError(txValidation.error!, 'blockchainTxHash');
    }

    // 🔗 UTILITY INTEGRATION: Validate blockchain addresses
    const fromAddressValidation = BlockchainValidator.validateAddress(this._fromAddress);
    if (!fromAddressValidation.isValid) {
      throw new ModelValidationError(fromAddressValidation.error!, 'fromAddress');
    }

    const toAddressValidation = BlockchainValidator.validateAddress(this._toAddress);
    if (!toAddressValidation.isValid) {
      throw new ModelValidationError(toAddressValidation.error!, 'toAddress');
    }

    // 🔗 UTILITY INTEGRATION: Numeric validation
    if (!ValidationUtils.isNonNegativeNumber(this._confirmations)) {
      throw new ModelValidationError('Confirmations cannot be negative', 'confirmations');
    }

    if (!ValidationUtils.isPositiveNumber(this._requiredConfirmations)) {
      throw new ModelValidationError('Required confirmations must be positive', 'requiredConfirmations');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._monthsActive)) {
      throw new ModelValidationError('Months active cannot be negative', 'monthsActive');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._totalEarnings)) {
      throw new ModelValidationError('Total earnings cannot be negative', 'totalEarnings');
    }

    if (this._blockNumber !== undefined && !ValidationUtils.isPositiveInteger(this._blockNumber)) {
      throw new ModelValidationError('Block number must be a positive integer', 'blockNumber');
    }

    // Business rule validations
    if (this._monthsActive > 25) {
      throw new ModelValidationError('Months active cannot exceed 25', 'monthsActive');
    }

    if (this._totalEarnings > this.getTotalProjectedEarnings()) {
      throw new ModelValidationError('Total earnings cannot exceed projected maximum', 'totalEarnings');
    }
  }

  /**
   * 📄 Primary JSON Serialization - Complete Data
   * 
   * UTILITY INTEGRATION: Uses business logic methods for enriched data.
   * Provides complete deposit information for APIs and detailed views.
   * 
   * @returns Complete deposit data with calculated fields
   */
  toJSON(): any {
    return {
      depositId: this.id,
      userId: this._userId,
      amount: this._amount,
      currency: this._currency,
      status: this._status,
      blockchainTxHash: this._blockchainTxHash,
      fromAddress: this._fromAddress,
      toAddress: this._toAddress,
      blockNumber: this._blockNumber,
      confirmations: this._confirmations,
      requiredConfirmations: this._requiredConfirmations,
      isActive: this._isActive,
      monthsActive: this._monthsActive,
      totalEarnings: this._totalEarnings,
      lastIncomeAt: this._lastIncomeAt?.toISOString(),
      confirmedAt: this._confirmedAt?.toISOString(),
      failureReason: this._failureReason,
      // 🔗 UTILITY INTEGRATION: Enriched data using business methods
      monthlyIncomeAmount: this.getMonthlyIncomeAmount(),
      remainingMonths: this.getRemainingMonths(),
      totalProjectedEarnings: this.getTotalProjectedEarnings(),
      remainingEarnings: this.getRemainingEarnings(),
      earningProgress: this.getEarningProgress(),
      confirmationProgress: this.getConfirmationProgress(),
      formattedAmount: this.getFormattedAmount(),
      formattedTotalEarnings: this.getFormattedTotalEarnings(),
      formattedMonthlyIncome: this.getFormattedMonthlyIncome(),
      statusDisplayName: this.getStatusDisplayName(),
      explorerUrl: this.getExplorerUrl(),
      timeToNextIncome: this.getTimeToNextIncome(),
      // Domain query results for frontend use
      isPending: this.isPending(),
      isConfirmed: this.isConfirmed(),
      isActiveStatus: this.isActiveStatus(),
      isDormant: this.isDormant(),
      isCompleted: this.isCompleted(),
      isFailed: this.isFailed(),
      isEarning: this.isEarning(),
      canEarn: this.canEarn(),
      hasReachedMaturity: this.hasReachedMaturity(),
      needsConfirmation: this.needsConfirmation(),
      isInEarningPeriod: this.isInEarningPeriod(),
      ...this.getCommonJSON(),
    };
  }

  /**
   * 📊 Summary JSON - Dashboard & List Views
   * 
   * Minimal deposit information for dashboard cards and list displays.
   * Focuses on essential data for user overview and quick status checks.
   * 
   * USAGE:
   * - Dashboard deposit cards
   * - Deposit history lists
   * - Portfolio overview
   * 
   * @returns Minimal deposit summary
   */
  toSummaryJSON(): any {
    return {
      depositId: this.id,
      amount: this._amount,
      currency: this._currency,
      status: this._status,
      isActive: this._isActive,
      monthsActive: this._monthsActive,
      totalEarnings: this._totalEarnings,
      formattedAmount: this.getFormattedAmount(),
      statusDisplayName: this.getStatusDisplayName(),
      earningProgress: this.getEarningProgress(),
      timeToNextIncome: this.getTimeToNextIncome(),
      createdAt: this.createdAt.toISOString(),
    };
  }

  /**
   * 🔍 Minimal JSON - Quick Reference
   * 
   * Essential deposit data for quick lookups and references.
   * Used for API responses where minimal data is preferred.
   * 
   * @returns Essential deposit information
   */
  toMinimalJSON(): any {
    return {
      depositId: this.id,
      amount: this._amount,
      status: this._status,
      monthsActive: this._monthsActive,
      formattedAmount: this.getFormattedAmount(),
      statusDisplayName: this.getStatusDisplayName(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
