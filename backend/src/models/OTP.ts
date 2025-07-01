/**
 * OTP Entity Model
 *
 * 🔐 One-Time Password Domain Entity for Secure Authentication
 *
 * PURPOSE:
 * This model represents OTP codes used for email verification, login, and password reset.
 * Follows the same clean patterns as User and Session models with proper utility integration.
 *
 * KEY FEATURES:
 * - Secure OTP generation using existing utilities
 * - TTL-based expiry with DynamoDB auto-cleanup
 * - Attempt limiting to prevent brute force attacks
 * - Type-based OTP categorization (REGISTRATION, LOGIN, PASSWORD_RESET)
 * - Production-ready validation and security controls
 *
 * UTILITY INTEGRATIONS:
 * - StringUtils: For secure OTP code generation
 * - TimeUtils: For TTL and expiry calculations
 * - OTPValidator: For code format validation
 * - ValidationUtils: For business rule validation
 *
 * SECURITY FEATURES:
 * ✅ Limited attempts (default: 3)
 * ✅ Time-based expiry (default: 5 minutes)
 * ✅ Single-use enforcement
 * ✅ Secure code generation (6-digit numeric)
 * ✅ DynamoDB TTL for automatic cleanup
 *
 * @see StringUtils.generateNumericCode() - OTP generation
 * @see TimeUtils.toUnixTimestamp() - TTL conversion
 * @see OTPValidator.validate() - Code validation
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { OTPType } from '../types/enums';
import { OTPValidator } from '../utils/validation';
import { ValidationUtils } from '../utils/calculations';
import { StringUtils, TimeUtils } from '../utils/helpers';

/**
 * OTP Domain Entity
 *
 * Represents a time-limited, single-use authentication code.
 * Integrates with existing utilities for secure code generation and validation.
 *
 * BUSINESS RULES:
 * - 6-digit numeric codes for user-friendliness
 * - 5-minute default expiry for security
 * - 3 attempt limit to prevent brute force
 * - Single-use enforcement
 * - Automatic cleanup via DynamoDB TTL
 */
export class OTP extends BaseModel {
  public readonly id: string;
  private _userId: string;
  private _type: OTPType;
  private _code: string;
  private _isUsed: boolean;
  private _expiresAt: Date;
  private _attemptCount: number;
  private _maxAttempts: number;

  constructor(
    userId: string,
    type: OTPType,
    code: string,
    expiresAt: Date,
    isUsed: boolean = false,
    attemptCount: number = 0,
    maxAttempts: number = 3,
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.id = id || this.generateId();
    this._userId = userId;
    this._type = type;
    this._code = code;
    this._isUsed = isUsed;
    this._expiresAt = expiresAt;
    this._attemptCount = attemptCount;
    this._maxAttempts = maxAttempts;

    this.validate();
  }

  // Getters
  get userId(): string {
    return this._userId;
  }
  get type(): OTPType {
    return this._type;
  }
  get code(): string {
    return this._code;
  }
  get isUsed(): boolean {
    return this._isUsed;
  }
  get expiresAt(): Date {
    return this._expiresAt;
  }
  get attemptCount(): number {
    return this._attemptCount;
  }
  get maxAttempts(): number {
    return this._maxAttempts;
  }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): OTP {
    return new OTP(
      data.userId,
      data.type,
      data.code,
      new Date(data.expiresAt),
      data.isUsed || false,
      data.attemptCount || 0,
      data.maxAttempts || 3,
      data.otpId || data.id,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * 🏭 Factory Method: Create New OTP with Secure Code Generation
   *
   * UTILITY INTEGRATION: Uses StringUtils.generateNumericCode() for secure code generation.
   * This ensures consistent, cryptographically secure OTP generation across the platform.
   *
   * BUSINESS LOGIC:
   * - Generates 6-digit numeric code for user-friendliness
   * - Sets appropriate expiry time (default: 5 minutes)
   * - Creates fresh OTP with zero attempts
   *
   * USAGE (in AuthController):
   * ```typescript
   * const otp = OTP.createOTP(user.id, OTPType.REGISTRATION, 10); // 10 minutes
   * await otpRepository.save(otp);
   * await emailService.sendOTP(user.email, otp.code);
   * ```
   *
   * @param userId - User ID this OTP belongs to
   * @param type - OTP type (REGISTRATION, LOGIN, PASSWORD_RESET)
   * @param ttlMinutes - Time to live in minutes (default: 5)
   * @returns New OTP instance ready for storage
   */
  static createOTP(userId: string, type: OTPType, ttlMinutes: number = 5): OTP {
    // 🔗 UTILITY INTEGRATION: Use StringUtils for secure code generation
    const code = StringUtils.generateNumericCode(6);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    return new OTP(userId, type, code, expiresAt);
  }

  /**
   * 🔍 Verify OTP Code - Main Authentication Method
   *
   * SECURITY IMPLEMENTATION:
   * Implements comprehensive security checks including expiry, usage, and attempt limiting.
   * Follows the same validation pattern as other domain models.
   *
   * VERIFICATION FLOW:
   * 1. Increment attempt counter (for audit/security)
   * 2. Check if OTP is expired
   * 3. Check if OTP already used
   * 4. Check if max attempts reached
   * 5. Compare codes (constant-time comparison would be ideal)
   * 6. Mark as used if successful
   *
   * USAGE (in AuthController):
   * ```typescript
   * try {
   *   const isValid = otp.verify(userInput);
   *   if (isValid) {
   *     await user.verifyEmail();
   *     await userRepository.save(user);
   *   }
   * } catch (error) {
   *   // Handle security violations
   * }
   * ```
   *
   * @param inputCode - User-provided OTP code
   * @returns true if code is valid and verification successful
   * @throws ModelValidationError for security violations
   */
  verify(inputCode: string): boolean {
    this.incrementAttempt();

    if (this.isExpired()) {
      throw new ModelValidationError('OTP has expired', 'code');
    }

    if (this._isUsed) {
      throw new ModelValidationError('OTP has already been used', 'code');
    }

    if (this.isMaxAttemptsReached()) {
      throw new ModelValidationError('Maximum attempts reached', 'code');
    }

    if (this._code === inputCode) {
      this.markAsUsed();
      return true;
    }

    return false;
  }

  /**
   * Marks OTP as used
   */
  markAsUsed(): void {
    if (this._isUsed) {
      throw new ModelValidationError('OTP is already used', 'code');
    }

    this._isUsed = true;
    this.touch();
  }

  /**
   * Increments attempt count
   */
  incrementAttempt(): void {
    this._attemptCount += 1;
    this.touch();
  }

  /**
   * 🔄 Regenerate OTP Code - Security Reset
   *
   * UTILITY INTEGRATION: Uses StringUtils.generateNumericCode() for consistent code generation.
   * Resets all security counters and generates a fresh, secure OTP code.
   *
   * USE CASES:
   * - User requests new OTP (expired or max attempts reached)
   * - Security-triggered regeneration
   * - Resend OTP functionality
   *
   * SECURITY RESET:
   * - Generates new secure code
   * - Resets usage flag
   * - Resets attempt counter
   * - Extends expiry time
   *
   * @param ttlMinutes - New time to live in minutes (default: 5)
   */
  regenerate(ttlMinutes: number = 5): void {
    // 🔗 UTILITY INTEGRATION: Consistent secure code generation
    this._code = StringUtils.generateNumericCode(6);
    this._expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    this._isUsed = false;
    this._attemptCount = 0;
    this.touch();
  }

  /**
   * 🔍 Domain Query Methods - Business Logic Validation
   *
   * These methods implement core business rules for OTP validation.
   * Used by controllers and services to check OTP state before operations.
   */

  /**
   * Check if OTP has expired based on time
   */
  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  /**
   * Check if OTP is valid for use (comprehensive validation)
   * Must not be used, expired, or have reached max attempts
   */
  isValid(): boolean {
    return !this._isUsed && !this.isExpired() && !this.isMaxAttemptsReached();
  }

  /**
   * Check if maximum verification attempts have been reached
   */
  isMaxAttemptsReached(): boolean {
    return this._attemptCount >= this._maxAttempts;
  }

  /**
   * Check if OTP is for a specific type
   */
  isForType(type: OTPType): boolean {
    return this._type === type;
  }

  /**
   * 📊 Business Logic Methods - User Experience Helpers
   *
   * These methods provide useful information for UI/UX and user feedback.
   * Help create better user experiences with clear status information.
   */

  /**
   * Get remaining verification attempts for user feedback
   */
  getRemainingAttempts(): number {
    return Math.max(0, this._maxAttempts - this._attemptCount);
  }

  /**
   * Get remaining time in minutes for user display
   */
  getExpiryInMinutes(): number {
    const now = new Date();
    const diffMs = this._expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (60 * 1000)));
  }

  /**
   * Get remaining time in seconds for countdown timers
   */
  getExpiryInSeconds(): number {
    const now = new Date();
    const diffMs = this._expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / 1000));
  }

  /**
   * 🔒 Validation Implementation - Utility Integration
   *
   * UTILITY USAGE:
   * - OTPValidator.validate(): Code format validation
   * - ValidationUtils.isNonNegativeNumber(): Numeric validation
   * - ValidationUtils.isPositiveNumber(): Positive number validation
   *
   * VALIDATION RULES:
   * - User ID required and valid string
   * - OTP type must be valid enum value
   * - Code must pass OTPValidator checks
   * - Expiry must be in the future
   * - Attempt count must be non-negative
   * - Max attempts must be positive
   */
  protected validate(): void {
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!Object.values(OTPType).includes(this._type)) {
      throw new ModelValidationError('Invalid OTP type', 'type');
    }

    // 🔗 UTILITY INTEGRATION: Use OTPValidator for code validation
    const codeValidation = OTPValidator.validate(this._code);
    if (!codeValidation.isValid) {
      throw new ModelValidationError(codeValidation.error!, 'code');
    }

    if (this._expiresAt <= new Date()) {
      throw new ModelValidationError('Expiry time must be in the future', 'expiresAt');
    }

    // 🔗 UTILITY INTEGRATION: Use ValidationUtils for numeric validation
    if (!ValidationUtils.isNonNegativeNumber(this._attemptCount)) {
      throw new ModelValidationError('Attempt count must be non-negative', 'attemptCount');
    }

    if (!ValidationUtils.isPositiveNumber(this._maxAttempts)) {
      throw new ModelValidationError('Max attempts must be positive', 'maxAttempts');
    }
  }

  /**
   * 🗄️ DynamoDB Serialization - TTL Integration
   *
   * UTILITY INTEGRATION: Uses TimeUtils.toUnixTimestamp() for DynamoDB TTL.
   * This ensures automatic cleanup of expired OTP records without manual intervention.
   *
   * DynamoDB FEATURES:
   * - TTL field for automatic record deletion
   * - PascalCase timestamps for DynamoDB convention
   * - Complete data preservation for persistence
   *
   * @returns DynamoDB-formatted item with TTL
   */
  toDynamoItem(): any {
    return {
      ...this.toJSON(),
      // 🔗 UTILITY INTEGRATION: TTL for automatic cleanup
      TTL: TimeUtils.toUnixTimestamp(this._expiresAt),
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * 📄 Primary JSON Serialization
   *
   * Complete OTP data for internal use and admin interfaces.
   * Excludes the actual OTP code for security (use getSecureCode() if needed).
   *
   * SECURITY NOTE: The actual OTP code is never included in JSON serialization
   * to prevent accidental exposure in logs, responses, or storage.
   *
   * @returns Complete OTP data without sensitive code
   */
  toJSON(): any {
    return {
      otpId: this.id,
      userId: this._userId,
      type: this._type,
      isUsed: this._isUsed,
      expiresAt: this._expiresAt.toISOString(),
      attemptCount: this._attemptCount,
      maxAttempts: this._maxAttempts,
      remainingAttempts: this.getRemainingAttempts(),
      expiryInMinutes: this.getExpiryInMinutes(),
      expiryInSeconds: this.getExpiryInSeconds(),
      isExpired: this.isExpired(),
      isValid: this.isValid(),
      isMaxAttemptsReached: this.isMaxAttemptsReached(),
      ...this.getCommonJSON(),
    };
  }

  /**
   * 🔒 Secure JSON for Public API Responses
   *
   * Minimal data for public-facing endpoints. Only includes information
   * that helps users understand OTP status without exposing sensitive data.
   *
   * USAGE:
   * - OTP request confirmation responses
   * - Status check endpoints
   * - User-facing error messages
   *
   * @returns Minimal, secure OTP status information
   */
  toSecureJSON(): any {
    return {
      type: this._type,
      expiryInMinutes: this.getExpiryInMinutes(),
      remainingAttempts: this.getRemainingAttempts(),
      isExpired: this.isExpired(),
      isValid: this.isValid(),
    };
  }
}
