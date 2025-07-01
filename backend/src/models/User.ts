/**
 * User Entity Model
 * 
 * Core domain entity representing a user in the yield cycle platform
 * Clean, production-ready implementation using existing utilities
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { UserRole, UserStatus } from '../types/enums';
import { EmailValidator, UserValidator } from '../utils/validation';
import { ValidationUtils } from '../utils/calculations';
import { StringUtils } from '../utils/helpers';
import { AddressUtils } from '../utils/blockchain';

/**
 * User profile value object
 */
export class UserProfile {
  public readonly firstName?: string;
  public readonly lastName?: string;
  public readonly phoneNumber?: string;
  public readonly country?: string;
  public readonly timezone?: string;

  constructor(
    firstName?: string,
    lastName?: string,
    phoneNumber?: string,
    country?: string,
    timezone?: string
  ) {
    this.firstName = firstName?.trim();
    this.lastName = lastName?.trim();
    this.phoneNumber = phoneNumber?.trim();
    this.country = country?.trim();
    this.timezone = timezone?.trim();
  }

  getFullName(): string {
    const name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
    return name || 'Unknown User';
  }

  isEmpty(): boolean {
    return !this.firstName && !this.lastName && !this.phoneNumber && !this.country;
  }

  toJSON(): any {
    return {
      firstName: this.firstName,
      lastName: this.lastName,
      phoneNumber: this.phoneNumber,
      country: this.country,
      timezone: this.timezone,
      fullName: this.getFullName(),
    };
  }
}

/**
 * User domain entity
 */
export class User extends BaseModel {
  public readonly id: string;
  private _email: string;
  private _passwordHash: string;
  private _role: UserRole;
  private _status: UserStatus;
  private _referralCode: string;
  private _referredBy?: string;
  private _isEmailVerified: boolean;
  private _profile: UserProfile;
  private _depositAddress?: string;
  private _earningsLimit: number;
  private _totalEarnings: number;
  private _lastLoginAt?: Date;

  constructor(
    email: string,
    passwordHash: string,
    role: UserRole = UserRole.DEPOSITOR,
    status: UserStatus = UserStatus.PENDING_VERIFICATION,
    referralCode?: string,
    referredBy?: string,
    isEmailVerified: boolean = false,
    profile?: UserProfile,
    depositAddress?: string,
    earningsLimit: number = 20000,
    totalEarnings: number = 0,
    lastLoginAt?: Date,
    userId?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.id = userId || this.generateId();
    this._email = email;
    this._passwordHash = passwordHash;
    this._role = role;
    this._status = status;
    this._referralCode = referralCode || this.generateReferralCode();
    this._referredBy = referredBy;
    this._isEmailVerified = isEmailVerified;
    this._profile = profile || new UserProfile();
    this._depositAddress = depositAddress;
    this._earningsLimit = earningsLimit;
    this._totalEarnings = totalEarnings;
    this._lastLoginAt = lastLoginAt;

    this.validate();
  }

  // Getters
  get email(): string { return this._email; }
  get passwordHash(): string { return this._passwordHash; }
  get role(): UserRole { return this._role; }
  get status(): UserStatus { return this._status; }
  get referralCode(): string { return this._referralCode; }
  get referredBy(): string | undefined { return this._referredBy; }
  get isEmailVerified(): boolean { return this._isEmailVerified; }
  get profile(): UserProfile { return this._profile; }
  get depositAddress(): string | undefined { return this._depositAddress; }
  get earningsLimit(): number { return this._earningsLimit; }
  get totalEarnings(): number { return this._totalEarnings; }
  get lastLoginAt(): Date | undefined { return this._lastLoginAt; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): User {
    return new User(
      data.email,
      data.passwordHash,
      data.role,
      data.status,
      data.referralCode,
      data.referredBy,
      data.isEmailVerified,
      data.profile ? new UserProfile(
        data.profile.firstName,
        data.profile.lastName,
        data.profile.phoneNumber,
        data.profile.country,
        data.profile.timezone
      ) : new UserProfile(),
      data.depositAddress,
      data.earningsLimit || 20000,
      data.totalEarnings || 0,
      data.lastLoginAt ? new Date(data.lastLoginAt) : undefined,
      data.userId || data.id,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * Updates email (with validation)
   */
  changeEmail(newEmail: string): void {
    const validation = EmailValidator.validate(newEmail);
    if (!validation.isValid) {
      throw new ModelValidationError(validation.error!, 'email');
    }
    this._email = validation.sanitized!;
    this._isEmailVerified = false; // Reset verification when email changes
    this.touch();
  }

  /**
   * Updates password hash
   */
  changePasswordHash(newPasswordHash: string): void {
    if (!newPasswordHash || typeof newPasswordHash !== 'string') {
      throw new ModelValidationError('Password hash is required', 'passwordHash');
    }
    this._passwordHash = newPasswordHash;
    this.touch();
  }

  /**
   * Changes user status
   */
  changeStatus(newStatus: UserStatus): void {
    if (!Object.values(UserStatus).includes(newStatus)) {
      throw new ModelValidationError('Invalid user status', 'status');
    }
    this._status = newStatus;
    this.touch();
  }

  /**
   * Verifies user email
   */
  verifyEmail(): void {
    this._isEmailVerified = true;
    if (this._status === UserStatus.PENDING_VERIFICATION) {
      this._status = UserStatus.ACTIVE;
    }
    this.touch();
  }

  /**
   * Updates user profile
   */
  updateProfile(
    firstName?: string,
    lastName?: string,
    phoneNumber?: string,
    country?: string,
    timezone?: string
  ): void {
    this._profile = new UserProfile(
      firstName ?? this._profile.firstName,
      lastName ?? this._profile.lastName,
      phoneNumber ?? this._profile.phoneNumber,
      country ?? this._profile.country,
      timezone ?? this._profile.timezone
    );
    this.touch();
  }

  /**
   * Sets deposit address
   */
  setDepositAddress(address: string): void {
    // Use blockchain validator from utilities
    if (!AddressUtils.isValidAddress(address)) {
      throw new ModelValidationError('Invalid blockchain address format', 'depositAddress');
    }
    this._depositAddress = AddressUtils.normalize(address)!;
    this.touch();
  }

  /**
   * Updates earnings limit (admin only)
   */
  updateEarningsLimit(newLimit: number): void {
    if (!ValidationUtils.isNonNegativeNumber(newLimit)) {
      throw new ModelValidationError('Earnings limit must be non-negative', 'earningsLimit');
    }
    this._earningsLimit = newLimit;
    this.touch();
  }

  /**
   * Records login activity
   */
  recordLogin(): void {
    this._lastLoginAt = new Date();
    this.touch();
  }

  /**
   * Adds earnings to total
   */
  addEarnings(amount: number): void {
    if (!ValidationUtils.isPositiveNumber(amount)) {
      throw new ModelValidationError('Earnings amount must be positive', 'amount');
    }
    this._totalEarnings += amount;
    this.touch();
  }

  /**
   * Business logic: Check if user can earn more (200% rule)
   */
  canEarnMore(): boolean {
    const maxEarnings = this._earningsLimit * 2; // 200% rule
    return this._totalEarnings < maxEarnings;
  }

  /**
   * Business logic: Get remaining earning capacity
   */
  getRemainingEarningCapacity(): number {
    const maxEarnings = this._earningsLimit * 2;
    return Math.max(0, maxEarnings - this._totalEarnings);
  }

  /**
   * Business logic: Get earning progress percentage
   */
  getEarningProgress(): number {
    const maxEarnings = this._earningsLimit * 2;
    return Math.min(100, (this._totalEarnings / maxEarnings) * 100);
  }

  /**
   * Domain query methods
   */
  isAdmin(): boolean { return this._role === UserRole.ADMIN; }
  isDepositor(): boolean { return this._role === UserRole.DEPOSITOR; }
  isActive(): boolean { return this._status === UserStatus.ACTIVE; }
  isVerified(): boolean { return this._isEmailVerified; }
  hasReachedEarningLimit(): boolean { return !this.canEarnMore(); }

  getDisplayName(): string {
    return this._profile.getFullName() !== 'Unknown User' 
      ? this._profile.getFullName() 
      : this._email;
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    const emailValidation = EmailValidator.validate(this._email);
    if (!emailValidation.isValid) {
      throw new ModelValidationError(emailValidation.error!, 'email');
    }

    if (!this._passwordHash || typeof this._passwordHash !== 'string') {
      throw new ModelValidationError('Password hash is required', 'passwordHash');
    }

    const referralValidation = UserValidator.validateReferralCode(this._referralCode);
    if (!referralValidation.isValid) {
      throw new ModelValidationError(referralValidation.error!, 'referralCode');
    }

    if (!Object.values(UserRole).includes(this._role)) {
      throw new ModelValidationError('Invalid user role', 'role');
    }

    if (!Object.values(UserStatus).includes(this._status)) {
      throw new ModelValidationError('Invalid user status', 'status');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._earningsLimit)) {
      throw new ModelValidationError('Earnings limit cannot be negative', 'earningsLimit');
    }

    if (!ValidationUtils.isNonNegativeNumber(this._totalEarnings)) {
      throw new ModelValidationError('Total earnings cannot be negative', 'totalEarnings');
    }
  }

  /**
   * Generates unique referral code using existing utility
   */
  private generateReferralCode(): string {
    return StringUtils.generateCode(8);
  }

  /**
   * DynamoDB serialization - only add DynamoDB-specific fields
   */
  toDynamoItem(): any {
    return {
      ...this.toJSON(),
      // DynamoDB uses PascalCase for timestamps
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Primary JSON serialization method
   */
  toJSON(): any {
    return {
      userId: this.id,
      email: this._email,
      role: this._role,
      status: this._status,
      referralCode: this._referralCode,
      referredBy: this._referredBy,
      isEmailVerified: this._isEmailVerified,
      profile: this._profile.toJSON(),
      depositAddress: this._depositAddress,
      earningsLimit: this._earningsLimit,
      totalEarnings: this._totalEarnings,
      lastLoginAt: this._lastLoginAt?.toISOString(),
      displayName: this.getDisplayName(),
      canEarnMore: this.canEarnMore(),
      earningProgress: this.getEarningProgress(),
      remainingCapacity: this.getRemainingEarningCapacity(),
      ...this.getCommonJSON(),
    };
  }

  /**
   * Public API response (minimal sensitive data)
   */
  toPublicJSON(): any {
    return {
      userId: this.id,
      email: this._email,
      role: this._role,
      status: this._status,
      referralCode: this._referralCode,
      isEmailVerified: this._isEmailVerified,
      profile: {
        firstName: this._profile.firstName,
        lastName: this._profile.lastName,
        country: this._profile.country,
      },
      displayName: this.getDisplayName(),
      createdAt: this.createdAt.toISOString(),
    };
  }
}
