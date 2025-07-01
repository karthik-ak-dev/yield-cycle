/**
 * Transaction Entity Model
 * 
 * 💳 Wallet Transaction System for Yield Cycle Platform
 * 
 * PURPOSE:
 * This model represents all financial transactions within the 4-pocket wallet system.
 * Records every movement of funds between pockets and external sources with complete audit trail.
 * 
 * TRANSACTION TYPES (as per TECHNICAL.md):
 * 1. ACTIVE_DEPOSIT_CREDIT: USDT deposits from blockchain to ACTIVE_DEPOSITS pocket
 * 2. MONTHLY_INCOME: 8% monthly earnings to INCOME pocket
 * 3. COMMISSION_L1-L5: MLM commission levels (10%, 5%, 3%, 1%, 1%) to COMMISSION pocket
 * 4. WITHDRAWAL: Post-25-month withdrawals from INCOME/COMMISSION pockets
 * 5. ACTIVE_DEPOSIT_DEBIT: When deposits complete 25-month cycle
 * 
 * KEY FEATURES:
 * - Complete transaction audit trail for compliance
 * - Blockchain transaction linking for deposits/withdrawals
 * - Status tracking (PENDING → COMPLETED/FAILED)
 * - Business rule enforcement for transaction types
 * - Gas fee tracking for blockchain operations
 * 
 * BUSINESS RULES:
 * - All earnings go to appropriate pockets (INCOME/COMMISSION)
 * - Withdrawals only after 25-month tenure completion
 * - Complete transaction history for 200% earnings cap tracking
 * - Blockchain confirmation required for deposits
 * 
 * UTILITY INTEGRATIONS:
 * - AmountValidator: For transaction amount validation
 * - BlockchainValidator: For transaction hash validation
 * - ValidationUtils: For business rule validation
 * - MathUtils: For precision calculations
 * - StringUtils: For reference generation
 * 
 * @see TECHNICAL.md - Wallet transaction specifications
 * @see WalletPocket - For pocket balance management
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { TransactionType, TransactionStatus, PocketType } from '../types/enums';
import { AmountValidator, BlockchainValidator } from '../utils/validation';
import { ValidationUtils, MathUtils } from '../utils/calculations';
import { IdUtils } from '../utils/helpers';

/**
 * Transaction Domain Entity
 * 
 * Represents a single financial transaction within the yield cycle platform.
 * Tracks fund movements between wallets, pockets, and blockchain with complete audit trail.
 * 
 * TRANSACTION FLOWS:
 * - Deposits: Blockchain → ACTIVE_DEPOSITS pocket
 * - Monthly Income: System → INCOME pocket (8% returns)
 * - Commissions: System → COMMISSION pocket (MLM earnings)
 * - Withdrawals: INCOME/COMMISSION pockets → Blockchain (post-25-months)
 */
export class Transaction extends BaseModel {
  public readonly id: string;
  private _userId: string;
  private _type: TransactionType;
  private _status: TransactionStatus;
  private _toPocket?: PocketType; // Target pocket for credits
  private _amount: number;
  private _currency: string;
  private _description: string;
  private _reference?: string;
  private _blockchainTxHash?: string;
  private _blockNumber?: number;
  private _gasUsed?: number;
  private _gasFee?: number;
  private _relatedId?: string; // Related deposit/commission ID
  private _metadata?: Record<string, any>;
  private _processedAt?: Date;
  private _failureReason?: string;

  constructor(
    userId: string,
    type: TransactionType,
    amount: number,
    currency: string = 'USDT',
    description: string = '',
    status: TransactionStatus = TransactionStatus.PENDING,
    toPocket?: PocketType,
    reference?: string,
    blockchainTxHash?: string,
    blockNumber?: number,
    gasUsed?: number,
    gasFee?: number,
    relatedId?: string,
    metadata?: Record<string, any>,
    processedAt?: Date,
    failureReason?: string,
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.id = id || this.generateId();
    this._userId = userId;
    this._type = type;
    this._status = status;
    this._toPocket = toPocket;
    this._amount = amount;
    this._currency = currency;
    this._description = description;
    this._reference = reference;
    this._blockchainTxHash = blockchainTxHash;
    this._blockNumber = blockNumber;
    this._gasUsed = gasUsed;
    this._gasFee = gasFee;
    this._relatedId = relatedId;
    this._metadata = metadata;
    this._processedAt = processedAt;
    this._failureReason = failureReason;

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get type(): TransactionType { return this._type; }
  get status(): TransactionStatus { return this._status; }
  get toPocket(): PocketType | undefined { return this._toPocket; }
  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
  get description(): string { return this._description; }
  get reference(): string | undefined { return this._reference; }
  get blockchainTxHash(): string | undefined { return this._blockchainTxHash; }
  get blockNumber(): number | undefined { return this._blockNumber; }
  get gasUsed(): number | undefined { return this._gasUsed; }
  get gasFee(): number | undefined { return this._gasFee; }
  get relatedId(): string | undefined { return this._relatedId; }
  get metadata(): Record<string, any> | undefined { return this._metadata; }
  get processedAt(): Date | undefined { return this._processedAt; }
  get failureReason(): string | undefined { return this._failureReason; }

  /**
   * 🏭 Factory Method: Reconstruct from Database
   * 
   * UTILITY INTEGRATION: Standard persistence reconstruction pattern.
   */
  static fromPersistence(data: any): Transaction {
    return new Transaction(
      data.userId,
      data.type,
      data.amount,
      data.currency || 'USDT',
      data.description || '',
      data.status || TransactionStatus.PENDING,
      data.toPocket,
      data.reference,
      data.blockchainTxHash,
      data.blockNumber,
      data.gasUsed,
      data.gasFee,
      data.relatedId,
      data.metadata,
      data.processedAt ? new Date(data.processedAt) : undefined,
      data.failureReason,
      data.transactionId || data.id,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * 🏭 Factory Method: Create Deposit Transaction
   * 
   * BUSINESS LOGIC: USDT deposits from blockchain to ACTIVE_DEPOSITS pocket.
   * This is when users send USDT to their assigned wallet address.
   * 
   * UTILITY INTEGRATION: Uses StringUtils.generateShortId() for unique reference.
   */
  static createDeposit(
    userId: string,
    amount: number,
    blockchainTxHash: string,
    description: string = 'USDT deposit from blockchain'
  ): Transaction {
    return new Transaction(
      userId,
      TransactionType.ACTIVE_DEPOSIT_CREDIT,
      amount,
      'USDT',
      description,
      TransactionStatus.PENDING,
      PocketType.ACTIVE_DEPOSITS,
      IdUtils.generateUUID().substring(0, 8),
      blockchainTxHash
    );
  }

  /**
   * 🏭 Factory Method: Create Monthly Income Transaction
   * 
   * BUSINESS LOGIC: 8% monthly earnings from active deposits to INCOME pocket.
   * Generated automatically by the monthly income job.
   * 
   * @param relatedId - The deposit ID that generated this income
   */
  static createMonthlyIncome(
    userId: string,
    amount: number,
    relatedId: string,
    description: string = '8% monthly income'
  ): Transaction {
    return new Transaction(
      userId,
      TransactionType.MONTHLY_INCOME,
      amount,
      'USDT',
      description,
      TransactionStatus.COMPLETED,
      PocketType.INCOME,
      IdUtils.generateUUID().substring(0, 8),
      undefined,
      undefined,
      undefined,
      undefined,
      relatedId,
      undefined,
      new Date()
    );
  }

  /**
   * 🏭 Factory Method: Create Commission Transaction
   * 
   * BUSINESS LOGIC: MLM commission earnings (L1-L5) to COMMISSION pocket.
   * Commission rates: L1=10%, L2=5%, L3=3%, L4=1%, L5=1%
   * 
   * @param commissionLevel - Which level commission (L1-L5)
   * @param relatedId - The deposit/transaction that triggered this commission
   */
  static createCommission(
    userId: string,
    amount: number,
    commissionLevel: 1 | 2 | 3 | 4 | 5,
    relatedId: string,
    description?: string
  ): Transaction {
    const typeMap = {
      1: TransactionType.COMMISSION_L1,
      2: TransactionType.COMMISSION_L2,
      3: TransactionType.COMMISSION_L3,
      4: TransactionType.COMMISSION_L4,
      5: TransactionType.COMMISSION_L5,
    };

    return new Transaction(
      userId,
      typeMap[commissionLevel],
      amount,
      'USDT',
      description || `Level ${commissionLevel} commission`,
      TransactionStatus.COMPLETED,
      PocketType.COMMISSION,
      IdUtils.generateUUID().substring(0, 8),
      undefined,
      undefined,
      undefined,
      undefined,
      relatedId,
      undefined,
      new Date()
    );
  }

  /**
   * 🏭 Factory Method: Create Withdrawal Transaction
   * 
   * BUSINESS LOGIC: Post-25-month withdrawals from INCOME/COMMISSION pockets.
   * Only allowed after users complete their 25-month earning cycle.
   */
  static createWithdrawal(
    userId: string,
    amount: number,
    toAddress: string,
    description?: string
  ): Transaction {
    return new Transaction(
      userId,
      TransactionType.WITHDRAWAL,
      amount,
      'USDT',
      description || `Withdrawal to ${toAddress}`,
      TransactionStatus.PENDING,
      undefined,
      IdUtils.generateUUID().substring(0, 8),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { toAddress }
    );
  }

  /**
   * Updates transaction status
   */
  updateStatus(newStatus: TransactionStatus, failureReason?: string): void {
    if (!Object.values(TransactionStatus).includes(newStatus)) {
      throw new ModelValidationError('Invalid transaction status', 'status');
    }

    this._status = newStatus;
    
    if (newStatus === TransactionStatus.COMPLETED && !this._processedAt) {
      this._processedAt = new Date();
    }
    
    if (newStatus === TransactionStatus.FAILED && failureReason) {
      this._failureReason = failureReason;
    }

    this.touch();
  }

  /**
   * Confirms transaction (blockchain confirmation)
   */
  confirm(blockchainTxHash?: string, blockNumber?: number, gasUsed?: number, gasFee?: number): void {
    if (blockchainTxHash) {
      const validation = BlockchainValidator.validateTransactionHash(blockchainTxHash);
      if (!validation.isValid) {
        throw new ModelValidationError(validation.error!, 'blockchainTxHash');
      }
      this._blockchainTxHash = validation.sanitized!;
    }

    if (blockNumber !== undefined) {
      this._blockNumber = blockNumber;
    }

    if (gasUsed !== undefined) {
      this._gasUsed = gasUsed;
    }

    if (gasFee !== undefined) {
      this._gasFee = gasFee;
    }

    this.updateStatus(TransactionStatus.COMPLETED);
  }

  /**
   * Fails transaction with reason
   */
  fail(reason: string): void {
    this.updateStatus(TransactionStatus.FAILED, reason);
  }

  /**
   * Cancels pending transaction
   */
  cancel(reason: string = 'Cancelled by user'): void {
    if (this._status !== TransactionStatus.PENDING) {
      throw new ModelValidationError('Only pending transactions can be cancelled', 'status');
    }
    
    this._status = TransactionStatus.CANCELLED;
    this._failureReason = reason;
    this.touch();
  }

  /**
   * Updates blockchain information
   */
  updateBlockchainInfo(
    txHash?: string,
    blockNumber?: number,
    gasUsed?: number,
    gasFee?: number
  ): void {
    if (txHash) {
      const validation = BlockchainValidator.validateTransactionHash(txHash);
      if (!validation.isValid) {
        throw new ModelValidationError(validation.error!, 'blockchainTxHash');
      }
      this._blockchainTxHash = validation.sanitized!;
    }

    if (blockNumber !== undefined) this._blockNumber = blockNumber;
    if (gasUsed !== undefined) this._gasUsed = gasUsed;
    if (gasFee !== undefined) this._gasFee = gasFee;

    this.touch();
  }

  /**
   * Updates metadata
   */
  updateMetadata(metadata: Record<string, any>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this.touch();
  }

  /**
   * Sets reference ID
   */
  setReference(reference: string): void {
    if (!reference || typeof reference !== 'string') {
      throw new ModelValidationError('Reference must be a non-empty string', 'reference');
    }
    this._reference = reference;
    this.touch();
  }

  /**
   * 🔍 Domain Query Methods - Business Logic Validation
   * 
   * These methods implement core business rules for transaction classification.
   * Used by services and controllers for transaction categorization and validation.
   */

  // Status queries
  isPending(): boolean { return this._status === TransactionStatus.PENDING; }
  isCompleted(): boolean { return this._status === TransactionStatus.COMPLETED; }
  isFailed(): boolean { return this._status === TransactionStatus.FAILED; }
  isCancelled(): boolean { return this._status === TransactionStatus.CANCELLED; }
  
  // Transaction type queries (aligned with our actual enum values)
  isDeposit(): boolean { return this._type === TransactionType.ACTIVE_DEPOSIT_CREDIT; }
  isWithdrawal(): boolean { return this._type === TransactionType.WITHDRAWAL; }
  isMonthlyIncome(): boolean { return this._type === TransactionType.MONTHLY_INCOME; }
  
  isCommission(): boolean { 
    return [
      TransactionType.COMMISSION_L1,
      TransactionType.COMMISSION_L2,
      TransactionType.COMMISSION_L3,
      TransactionType.COMMISSION_L4,
      TransactionType.COMMISSION_L5
    ].includes(this._type);
  }
  
  // Commission level queries
  isL1Commission(): boolean { return this._type === TransactionType.COMMISSION_L1; }
  isL2Commission(): boolean { return this._type === TransactionType.COMMISSION_L2; }
  isL3Commission(): boolean { return this._type === TransactionType.COMMISSION_L3; }
  isL4Commission(): boolean { return this._type === TransactionType.COMMISSION_L4; }
  isL5Commission(): boolean { return this._type === TransactionType.COMMISSION_L5; }
  
  // Blockchain queries
  hasBlockchainTx(): boolean { return !!this._blockchainTxHash; }
  isBlockchainConfirmed(): boolean { return this.hasBlockchainTx() && !!this._blockNumber; }
  
  // User validation
  isForUser(userId: string): boolean { return this._userId === userId; }
  
  // Business categorization
  isEarningTransaction(): boolean {
    return this.isMonthlyIncome() || this.isCommission();
  }

  isDepositDebit(): boolean {
    return this._type === TransactionType.ACTIVE_DEPOSIT_DEBIT;
  }

  /**
   * Business logic methods
   */
  getNetAmount(): number {
    return MathUtils.round(this._amount - (this._gasFee || 0));
  }

  getProcessingTimeInMinutes(): number {
    if (!this._processedAt) return 0;
    const diffMs = this._processedAt.getTime() - this.createdAt.getTime();
    return Math.round(diffMs / (60 * 1000));
  }

  getFormattedAmount(): string {
    return `${this._amount.toFixed(6)} ${this._currency}`;
  }

  getFormattedNetAmount(): string {
    return `${this.getNetAmount().toFixed(6)} ${this._currency}`;
  }

  getFormattedGasFee(): string {
    return this._gasFee ? `${this._gasFee.toFixed(6)} ${this._currency}` : '0 USDT';
  }

  getStatusDisplayName(): string {
    switch (this._status) {
      case TransactionStatus.PENDING: return 'Pending';
      case TransactionStatus.COMPLETED: return 'Completed';
      case TransactionStatus.FAILED: return 'Failed';
      case TransactionStatus.CANCELLED: return 'Cancelled';
      default: return this._status;
    }
  }

  getTypeDisplayName(): string {
    switch (this._type) {
      case TransactionType.ACTIVE_DEPOSIT_CREDIT: return 'Deposit';
      case TransactionType.ACTIVE_DEPOSIT_DEBIT: return 'Deposit Completion';
      case TransactionType.WITHDRAWAL: return 'Withdrawal';
      case TransactionType.MONTHLY_INCOME: return 'Monthly Income';
      case TransactionType.COMMISSION_L1: return 'Level 1 Commission';
      case TransactionType.COMMISSION_L2: return 'Level 2 Commission';
      case TransactionType.COMMISSION_L3: return 'Level 3 Commission';
      case TransactionType.COMMISSION_L4: return 'Level 4 Commission';
      case TransactionType.COMMISSION_L5: return 'Level 5 Commission';
      default: return this._type;
    }
  }

  getExplorerUrl(): string | null {
    if (!this._blockchainTxHash) return null;
    return `https://bscscan.com/tx/${this._blockchainTxHash}`;
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!Object.values(TransactionType).includes(this._type)) {
      throw new ModelValidationError('Invalid transaction type', 'type');
    }

    if (!Object.values(TransactionStatus).includes(this._status)) {
      throw new ModelValidationError('Invalid transaction status', 'status');
    }

    const amountValidation = AmountValidator.validateDeposit(this._amount);
    if (!amountValidation.isValid) {
      throw new ModelValidationError(amountValidation.error!, 'amount');
    }

    if (!this._currency || typeof this._currency !== 'string') {
      throw new ModelValidationError('Currency is required', 'currency');
    }

    if (this._blockchainTxHash) {
      const txValidation = BlockchainValidator.validateTransactionHash(this._blockchainTxHash);
      if (!txValidation.isValid) {
        throw new ModelValidationError(txValidation.error!, 'blockchainTxHash');
      }
    }

    if (this._blockNumber !== undefined && !ValidationUtils.isPositiveInteger(this._blockNumber)) {
      throw new ModelValidationError('Block number must be a positive integer', 'blockNumber');
    }

    if (this._gasUsed !== undefined && !ValidationUtils.isNonNegativeNumber(this._gasUsed)) {
      throw new ModelValidationError('Gas used cannot be negative', 'gasUsed');
    }

    if (this._gasFee !== undefined && !ValidationUtils.isNonNegativeNumber(this._gasFee)) {
      throw new ModelValidationError('Gas fee cannot be negative', 'gasFee');
    }

    // Business rule validations based on our actual transaction types
    if (this._type === TransactionType.WITHDRAWAL && !this._metadata?.toAddress) {
      throw new ModelValidationError('Withdrawal transactions require target address', 'metadata');
    }

    if (this.isEarningTransaction() && !this._toPocket) {
      throw new ModelValidationError('Earning transactions require target pocket', 'toPocket');
    }

    if (this._type === TransactionType.ACTIVE_DEPOSIT_CREDIT && this._toPocket !== PocketType.ACTIVE_DEPOSITS) {
      throw new ModelValidationError('Deposit credits must go to ACTIVE_DEPOSITS pocket', 'toPocket');
    }
  }

  /**
   * Primary JSON serialization
   */
  toJSON(): any {
    return {
      transactionId: this.id,
      userId: this._userId,
      type: this._type,
      status: this._status,

      toPocket: this._toPocket,
      amount: this._amount,
      currency: this._currency,
      description: this._description,
      reference: this._reference,
      blockchainTxHash: this._blockchainTxHash,
      blockNumber: this._blockNumber,
      gasUsed: this._gasUsed,
      gasFee: this._gasFee,
      netAmount: this.getNetAmount(),
      relatedId: this._relatedId,
      metadata: this._metadata,
      processedAt: this._processedAt?.toISOString(),
      failureReason: this._failureReason,
      processingTimeMinutes: this.getProcessingTimeInMinutes(),
      formattedAmount: this.getFormattedAmount(),
      formattedNetAmount: this.getFormattedNetAmount(),
      formattedGasFee: this.getFormattedGasFee(),
      statusDisplayName: this.getStatusDisplayName(),
      typeDisplayName: this.getTypeDisplayName(),
      explorerUrl: this.getExplorerUrl(),
      isPending: this.isPending(),
      isCompleted: this.isCompleted(),
      isFailed: this.isFailed(),
      hasBlockchainTx: this.hasBlockchainTx(),
      isBlockchainConfirmed: this.isBlockchainConfirmed(),
      ...this.getCommonJSON(),
    };
  }

  /**
   * Summary JSON for lists and dashboards
   */
  toSummaryJSON(): any {
    return {
      transactionId: this.id,
      type: this._type,
      status: this._status,
      amount: this._amount,
      currency: this._currency,
      description: this._description,
      formattedAmount: this.getFormattedAmount(),
      statusDisplayName: this.getStatusDisplayName(),
      typeDisplayName: this.getTypeDisplayName(),
      createdAt: this.createdAt.toISOString(),
      processedAt: this._processedAt?.toISOString(),
    };
  }

  /**
   * Minimal JSON for quick access
   */
  toMinimalJSON(): any {
    return {
      transactionId: this.id,
      type: this._type,
      status: this._status,
      amount: this._amount,
      formattedAmount: this.getFormattedAmount(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
