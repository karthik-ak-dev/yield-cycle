/**
 * WalletPocket Entity Model
 * 
 * 💰 4-Pocket Wallet System for Yield Cycle Platform
 * 
 * PURPOSE:
 * This model implements the core 4-pocket wallet system where users can track different
 * types of earnings and balances separately for clear financial transparency.
 * 
 * 4-POCKET SYSTEM (as per TECHNICAL.md):
 * 1. ACTIVE_DEPOSITS: Current deposits earning 8% monthly (total USDT deposited)
 * 2. INCOME: Monthly 8% earnings from active deposits
 * 3. COMMISSION: MLM referral commission earnings (5-level: 10%, 5%, 3%, 1%, 1%)
 * 4. TOTAL_EARNINGS: Calculated display pocket (INCOME + COMMISSION)
 * 
 * KEY FEATURES:
 * - Simple balance tracking per pocket type
 * - Total earnings aggregation and display
 * - Transaction timestamp tracking
 * - Clean business operations without unnecessary complexity
 * 
 * BUSINESS RULES:
 * - Active deposits track total USDT invested
 * - Income pocket receives 8% monthly from active deposits
 * - Commission pocket receives MLM earnings from referral tree
 * - Total earnings = Income + Commission (for 200% cap tracking)
 * 
 * UTILITY INTEGRATIONS:
 * - AmountValidator: For deposit/withdrawal amount validation
 * - ValidationUtils: For numeric validation and business rules
 * - MathUtils: For precision calculations and rounding
 * 
 * REMOVED COMPLEXITY:
 * ❌ Frozen amounts (not in our business model)
 * ❌ Complex transfer operations (handled at service level)
 * ❌ Unnecessary wallet operations (keep it simple)
 * 
 * @see TECHNICAL.md - 4-pocket wallet system specification
 * @see TransactionService - For wallet operations and history
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { PocketType } from '../types/enums';
import { AmountValidator } from '../utils/validation';
import { ValidationUtils, MathUtils } from '../utils/calculations';

/**
 * WalletPocket Domain Entity
 * 
 * Represents one of the 4 wallet pockets in our yield cycle platform.
 * Each pocket tracks specific types of funds with clear business purpose.
 * 
 * POCKET TYPES:
 * - ACTIVE_DEPOSITS: Total USDT deposited and earning
 * - INCOME: 8% monthly earnings from deposits
 * - COMMISSION: MLM commission from referral network
 * - TOTAL_EARNINGS: Calculated sum (Income + Commission)
 */
export class WalletPocket extends BaseModel {
  public readonly id: string;
  private _userId: string;
  private _type: PocketType;
  private _balance: number;
  private _totalEarnings: number; // Lifetime earnings for this pocket
  private _currency: string;
  private _lastTransactionAt?: Date;

  constructor(
    userId: string,
    type: PocketType,
    balance: number = 0,
    totalEarnings: number = 0,
    currency: string = 'USDT',
    lastTransactionAt?: Date,
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.id = id || this.generateId();
    this._userId = userId;
    this._type = type;
    this._balance = balance;
    this._totalEarnings = totalEarnings;
    this._currency = currency;
    this._lastTransactionAt = lastTransactionAt;

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get type(): PocketType { return this._type; }
  get balance(): number { return this._balance; }
  get totalEarnings(): number { return this._totalEarnings; }
  get currency(): string { return this._currency; }
  get lastTransactionAt(): Date | undefined { return this._lastTransactionAt; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): WalletPocket {
    return new WalletPocket(
      data.userId,
      data.type,
      data.balance || 0,
      data.totalEarnings || 0,
      data.currency || 'USDT',
      data.lastTransactionAt ? new Date(data.lastTransactionAt) : undefined,
      data.pocketId || data.id,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * 🏭 Factory Method: Create New Wallet Pocket
   * 
   * Creates a new wallet pocket for a user with zero balance.
   * Each user gets 4 pockets: ACTIVE_DEPOSITS, INCOME, COMMISSION, TOTAL_EARNINGS
   * 
   * USAGE (in WalletService):
   * ```typescript
   * const depositPocket = WalletPocket.createPocket(userId, PocketType.ACTIVE_DEPOSITS);
   * const incomePocket = WalletPocket.createPocket(userId, PocketType.INCOME);
   * const commissionPocket = WalletPocket.createPocket(userId, PocketType.COMMISSION);
   * const totalPocket = WalletPocket.createPocket(userId, PocketType.TOTAL_EARNINGS);
   * ```
   * 
   * @param userId - User ID this pocket belongs to
   * @param type - Type of pocket (4 types available)
   * @param currency - Currency code (default: USDT)
   * @returns New WalletPocket instance ready for storage
   */
  static createPocket(userId: string, type: PocketType, currency: string = 'USDT'): WalletPocket {
    return new WalletPocket(userId, type, 0, 0, currency);
  }

  /**
   * 💰 Credit Amount - Add Funds to Pocket
   * 
   * UTILITY INTEGRATION: Uses AmountValidator for business rule validation.
   * Adds funds to the pocket balance and updates total earnings for tracking.
   * 
   * BUSINESS FLOWS:
   * - ACTIVE_DEPOSITS: When user deposits USDT
   * - INCOME: When 8% monthly return is distributed
   * - COMMISSION: When MLM commission is earned
   * 
   * USAGE:
   * ```typescript
   * await incomePocket.credit(depositAmount * 0.08); // 8% monthly income
   * await commissionPocket.credit(commissionAmount); // MLM earnings
   * ```
   * 
   * @param amount - Amount to add (validated for business rules)
   * @throws ModelValidationError for invalid amounts
   */
  credit(amount: number): void {
    // 🔗 UTILITY INTEGRATION: Validate amount using existing validator
    const validation = AmountValidator.validateDeposit(amount);
    if (!validation.isValid) {
      throw new ModelValidationError(validation.error!, 'amount');
    }

    this._balance = MathUtils.round(this._balance + amount);
    this._totalEarnings = MathUtils.round(this._totalEarnings + amount);
    this._lastTransactionAt = new Date();
    this.touch();
  }

  /**
   * 💸 Debit Amount - Remove Funds from Pocket
   * 
   * UTILITY INTEGRATION: Uses AmountValidator for withdrawal validation.
   * Removes funds from pocket balance (used for withdrawals after 25 months).
   * 
   * BUSINESS FLOWS:
   * - Post-25-month withdrawals from income/commission pockets
   * - Administrative balance adjustments
   * 
   * @param amount - Amount to remove (validated against available balance)
   * @throws ModelValidationError for insufficient balance or invalid amounts
   */
  debit(amount: number): void {
    // 🔗 UTILITY INTEGRATION: Validate withdrawal amount
    const validation = AmountValidator.validateWithdrawal(amount, this._balance);
    if (!validation.isValid) {
      throw new ModelValidationError(validation.error!, 'amount');
    }

    this._balance = MathUtils.round(this._balance - amount);
    this._lastTransactionAt = new Date();
    this.touch();
  }

  /**
   * 🔧 Set Balance - Admin Operation
   * 
   * Direct balance setting for administrative operations or corrections.
   * Used sparingly for system maintenance or issue resolution.
   * 
   * @param newBalance - New balance value (must be non-negative)
   * @throws ModelValidationError for negative balance
   */
  setBalance(newBalance: number): void {
    if (!ValidationUtils.isNonNegativeNumber(newBalance)) {
      throw new ModelValidationError('Balance cannot be negative', 'balance');
    }

    this._balance = MathUtils.round(newBalance);
    this._lastTransactionAt = new Date();
    this.touch();
  }

  /**
   * 🔍 Domain Query Methods - Business Logic Validation
   * 
   * These methods implement core business rules for wallet pocket operations.
   * Used by services to check pocket state before performing operations.
   */

  /**
   * Get current balance (same as total balance in simplified model)
   */
  getBalance(): number {
    return this._balance;
  }

  /**
   * Check if pocket has any balance
   */
  hasBalance(): boolean {
    return this._balance > 0;
  }

  /**
   * Check if sufficient balance for debit operation
   */
  canDebit(amount: number): boolean {
    return amount <= this._balance;
  }

  /**
   * Check if pocket belongs to specific user
   */
  isForUser(userId: string): boolean {
    return this._userId === userId;
  }

  /**
   * Check if pocket is of specific type
   */
  isOfType(type: PocketType): boolean {
    return this._type === type;
  }

  /**
   * Check if pocket is empty (no balance)
   */
  isEmpty(): boolean {
    return this._balance === 0;
  }

  /**
   * 📊 Business Logic Methods - User Experience Helpers
   * 
   * These methods provide useful information for UI/UX and business analytics.
   * Help create better user experiences with clear financial information.
   */

  /**
   * Calculate pocket balance as percentage of total wallet
   */
  getBalancePercentage(totalWalletBalance: number): number {
    if (totalWalletBalance === 0) return 0;
    return MathUtils.round((this._balance / totalWalletBalance) * 100);
  }

  /**
   * Get formatted balance for display
   */
  getFormattedBalance(): string {
    return `${this._balance.toFixed(2)} ${this._currency}`;
  }

  /**
   * Get formatted total earnings for display
   */
  getFormattedTotalEarnings(): string {
    return `${this._totalEarnings.toFixed(2)} ${this._currency}`;
  }

  /**
   * 🔒 Validation Implementation - Utility Integration
   * 
   * UTILITY USAGE:
   * - ValidationUtils.isNonNegativeNumber(): Balance validation
   * - PocketType enum: Valid pocket type validation
   * 
   * VALIDATION RULES:
   * - User ID required and valid string
   * - Pocket type must be valid enum value
   * - Balance must be non-negative
   * - Total earnings must be non-negative
   * - Currency required and valid string
   */
  protected validate(): void {
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!Object.values(PocketType).includes(this._type)) {
      throw new ModelValidationError('Invalid pocket type', 'type');
    }

    // 🔗 UTILITY INTEGRATION: Use ValidationUtils for numeric validation
    if (!ValidationUtils.isNonNegativeNumber(this._balance)) {
      throw new ModelValidationError('Balance cannot be negative', 'balance');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._totalEarnings)) {
      throw new ModelValidationError('Total earnings cannot be negative', 'totalEarnings');
    }

    if (!this._currency || typeof this._currency !== 'string') {
      throw new ModelValidationError('Currency is required', 'currency');
    }
  }

  /**
   * 📄 Primary JSON Serialization
   * 
   * Complete wallet pocket data for internal use and wallet displays.
   * Includes all relevant financial information and calculated fields for UI.
   * 
   * @returns Complete wallet pocket data
   */
  toJSON(): any {
    return {
      pocketId: this.id,
      userId: this._userId,
      type: this._type,
      balance: this._balance,
      totalEarnings: this._totalEarnings,
      currency: this._currency,
      lastTransactionAt: this._lastTransactionAt?.toISOString(),
      hasBalance: this.hasBalance(),
      isEmpty: this.isEmpty(),
      formattedBalance: this.getFormattedBalance(),
      formattedTotalEarnings: this.getFormattedTotalEarnings(),
      ...this.getCommonJSON(),
    };
  }

  /**
   * 📊 Summary JSON for Dashboard Display
   * 
   * Minimal data for wallet overview and dashboard cards.
   * Focuses on essential information for quick user understanding.
   * 
   * USAGE:
   * - Dashboard pocket cards
   * - Wallet balance overview
   * - Quick financial summary
   * 
   * @returns Minimal wallet pocket summary
   */
  toSummaryJSON(): any {
    return {
      pocketId: this.id,
      type: this._type,
      balance: this._balance,
      currency: this._currency,
      formattedBalance: this.getFormattedBalance(),
    };
  }
}
