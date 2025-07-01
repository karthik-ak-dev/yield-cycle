import { EncryptionUtils } from '../../utils/encryption';
import { PasswordValidator } from '../../utils/validation';
import { AUTH, ERROR_MESSAGES } from '../../utils/constants';
import { UserRepository } from '../../repositories/UserRepository';
import { OTPRepository } from '../../repositories/OTPRepository';
import { AuditRepository } from '../../repositories/AuditRepository';
import { EmailService } from '../notification/EmailService';
import { OTP } from '../../models/OTP';
import { OTPType } from '../../types/enums';
import { AuditLog } from '../../models/AuditLog';

/**
 * 🔐 Password Service
 *
 * PURPOSE:
 * Handles all password-related operations for the Yield Cycle platform including
 * password hashing, validation, strength checking, and password reset functionality.
 *
 * CORE FUNCTIONALITIES:
 * - Password strength validation following platform security requirements
 * - Secure password hashing using bcrypt with 12 salt rounds
 * - Password verification against stored hashes
 * - Password reset workflow with OTP verification
 * - Security policy enforcement
 *
 * INTEGRATION WITH UTILS:
 * - EncryptionUtils: For secure password hashing and verification
 * - PasswordValidator: For password strength and format validation
 * - Constants: For security policies and error messages
 *
 * SECURITY FEATURES:
 * - bcrypt hashing with configurable salt rounds
 * - Password strength requirements enforcement
 * - Rate limiting through controller layer
 * - Audit logging for security events
 */
export class PasswordService {
  /**
   * 🔍 Validate Password Strength
   *
   * BUSINESS LOGIC:
   * Validates password against platform security requirements:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   *
   * USAGE (in AuthController):
   * ```typescript
   * const validation = await PasswordService.validatePasswordStrength(password);
   * if (!validation.isValid) {
   *   return res.status(400).json({ error: validation.error });
   * }
   * ```
   *
   * @param password - Password to validate
   * @returns Validation result with strength level
   */
  static async validatePasswordStrength(password: string): Promise<{
    isValid: boolean;
    error?: string;
    strength?: 'weak' | 'medium' | 'strong';
  }> {
    try {
      // Use PasswordValidator utility for validation
      const validation = PasswordValidator.validate(password);

      if (!validation.isValid) {
        return {
          isValid: false,
          error: validation.error,
        };
      }

      // Get password strength level
      const strength = PasswordValidator.getStrength(password);

      return {
        isValid: true,
        strength,
      };
    } catch (error) {
      throw new Error(
        `Password validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔐 Hash Password Securely
   *
   * SECURITY IMPLEMENTATION:
   * Uses EncryptionUtils with bcrypt and 12 salt rounds for secure password hashing.
   * Validates password strength before hashing to ensure security requirements.
   *
   * USAGE (in AuthController):
   * ```typescript
   * const hashedPassword = await PasswordService.hashPassword(password);
   * const user = User.createUser(email, hashedPassword, role);
   * ```
   *
   * @param password - Plain text password to hash
   * @returns Promise<string> - Hashed password ready for storage
   * @throws Error if password validation or hashing fails
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      // Validate password strength first
      const validation = await this.validatePasswordStrength(password);
      if (!validation.isValid) {
        throw new Error(validation.error || ERROR_MESSAGES.WEAK_PASSWORD);
      }

      // Hash password using EncryptionUtils
      return await EncryptionUtils.hashPassword(password);
    } catch (error) {
      throw new Error(
        `Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * ✅ Verify Password Against Hash
   *
   * AUTHENTICATION FLOW:
   * Verifies user-provided password against stored hash using secure comparison.
   * Used during login authentication to validate user credentials.
   *
   * USAGE (in AuthController):
   * ```typescript
   * const isValid = await PasswordService.verifyPassword(password, user.passwordHash);
   * if (!isValid) {
   *   return res.status(401).json({ error: 'Invalid credentials' });
   * }
   * ```
   *
   * @param password - Plain text password to verify
   * @param hash - Stored password hash to compare against
   * @returns Promise<boolean> - True if password matches hash
   * @throws Error if verification fails
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }

      // Use EncryptionUtils for secure password comparison
      return await EncryptionUtils.comparePassword(password, hash);
    } catch (error) {
      throw new Error(
        `Password verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔄 Change User Password
   *
   * BUSINESS LOGIC:
   * Allows authenticated users to change their password with current password verification.
   * Validates both current and new passwords before updating.
   *
   * SECURITY FEATURES:
   * - Current password verification
   * - New password strength validation
   * - Audit logging for security tracking
   *
   * USAGE (in ProfileController):
   * ```typescript
   * await passwordService.changePassword(userId, currentPassword, newPassword);
   * ```
   *
   * @param userId - User ID requesting password change
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @param ipAddress - Client IP address for audit logging
   * @returns Promise<void>
   * @throws Error if validation fails or user not found
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress: string = ''
  ): Promise<void> {
    try {
      // Get user from repository
      const user = await UserRepository.getUserById(userId);
      if (!user) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Verify current password
      const isCurrentValid = await this.verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Validate new password strength
      const validation = await this.validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        throw new Error(validation.error || ERROR_MESSAGES.WEAK_PASSWORD);
      }

      // Hash new password
      const newHashedPassword = await this.hashPassword(newPassword);

      // Update user password
      await UserRepository.updateUserPassword(userId, newHashedPassword);

      // Create audit log for password change
      const auditLog = AuditLog.createSecurityAudit(
        userId,
        'PASSWORD_CHANGED',
        { resource: 'USER_PASSWORD' },
        ipAddress
      );
      await AuditRepository.createAuditLog(auditLog);
    } catch (error) {
      throw new Error(
        `Password change failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 📧 Initiate Password Reset
   *
   * RESET WORKFLOW:
   * Initiates password reset process by generating and sending OTP to user's email.
   * Creates PASSWORD_RESET type OTP that can be used for password reset verification.
   *
   * USAGE (in AuthController):
   * ```typescript
   * await PasswordService.initiatePasswordReset(email, ipAddress);
   * ```
   *
   * @param email - User email address
   * @param ipAddress - Client IP address for audit logging
   * @returns Promise<{ otpSent: boolean; expiresIn: number }> - Reset initiation result
   * @throws Error if user not found or OTP generation fails
   */
  static async initiatePasswordReset(
    email: string,
    ipAddress: string = ''
  ): Promise<{
    otpSent: boolean;
    expiresIn: number;
  }> {
    try {
      // Find user by email
      const user = await UserRepository.getUserByEmail(email);
      if (!user) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Create password reset OTP
      const otp = OTP.createOTP(user.id, OTPType.PASSWORD_RESET, AUTH.OTP_EXPIRY_MINUTES);

      // Save OTP to repository
      await OTPRepository.createOTP(otp);

      // Send password reset OTP email
      const emailResult = await EmailService.sendPasswordResetOTP(email, otp.code);

      if (!emailResult.success) {
        throw new Error(`Failed to send password reset email: ${emailResult.error}`);
      }

      // Log password reset initiation
      const auditLog = AuditLog.createSecurityAudit(
        user.id,
        'PASSWORD_RESET_INITIATED',
        {
          resource: 'PASSWORD_RESET',
          email: email,
          messageId: emailResult.messageId,
        },
        ipAddress
      );
      await AuditRepository.createAuditLog(auditLog);

      return {
        otpSent: true,
        expiresIn: AUTH.OTP_EXPIRY_MINUTES * 60, // Convert to seconds
      };
    } catch (error) {
      throw new Error(
        `Password reset initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔓 Complete Password Reset
   *
   * RESET COMPLETION:
   * Completes password reset process by verifying OTP and setting new password.
   * Validates OTP, new password strength, and updates user password.
   *
   * SECURITY FEATURES:
   * - OTP verification and consumption
   * - New password strength validation
   * - Audit logging for completed reset
   *
   * USAGE (in AuthController):
   * ```typescript
   * await PasswordService.completePasswordReset(email, otpCode, newPassword, ipAddress);
   * ```
   *
   * @param email - User email address
   * @param otpCode - OTP code for verification
   * @param newPassword - New password to set
   * @param ipAddress - Client IP address for audit logging
   * @returns Promise<void>
   * @throws Error if OTP invalid or password validation fails
   */
  static async completePasswordReset(
    email: string,
    otpCode: string,
    newPassword: string,
    ipAddress: string = ''
  ): Promise<void> {
    try {
      // Find user by email
      const user = await UserRepository.getUserByEmail(email);
      if (!user) {
        throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // Get password reset OTP
      const otp = await OTPRepository.getLatestOTPForUser(user.id, OTPType.PASSWORD_RESET);
      if (!otp) {
        throw new Error(ERROR_MESSAGES.INVALID_OTP);
      }

      // Verify OTP
      const isOtpValid = otp.verify(otpCode);
      if (!isOtpValid) {
        // Note: OTP model handles attempt increment internally
        throw new Error(ERROR_MESSAGES.INVALID_OTP);
      }

      // Validate new password strength
      const validation = await this.validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        throw new Error(validation.error || ERROR_MESSAGES.WEAK_PASSWORD);
      }

      // Hash new password
      const newHashedPassword = await this.hashPassword(newPassword);

      // Update user password - OTP is marked as used by verify() method
      await UserRepository.updateUserPassword(user.id, newHashedPassword);

      // Log password reset completion
      const auditLog = AuditLog.createSecurityAudit(
        user.id,
        'PASSWORD_RESET_COMPLETED',
        {
          resource: 'PASSWORD_RESET',
          email: email,
        },
        ipAddress
      );
      await AuditRepository.createAuditLog(auditLog);
    } catch (error) {
      throw new Error(
        `Password reset completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 🔍 Validate Password Confirmation
   *
   * UTILITY METHOD:
   * Validates that password and confirmation match during registration or password change.
   * Simple but important validation for user experience.
   *
   * USAGE (in AuthController):
   * ```typescript
   * const isMatch = PasswordService.validatePasswordConfirmation(password, confirmPassword);
   * if (!isMatch) {
   *   return res.status(400).json({ error: 'Passwords do not match' });
   * }
   * ```
   *
   * @param password - Original password
   * @param confirmPassword - Password confirmation
   * @returns boolean - True if passwords match
   */
  static validatePasswordConfirmation(password: string, confirmPassword: string): boolean {
    if (!password || !confirmPassword) {
      return false;
    }

    const validation = PasswordValidator.validateConfirmation(password, confirmPassword);
    return validation.isValid;
  }

  /**
   * 📊 Get Password Security Requirements
   *
   * UTILITY METHOD:
   * Returns password security requirements for client-side validation and user guidance.
   * Helps provide clear feedback to users about password requirements.
   *
   * USAGE (in AuthController):
   * ```typescript
   * const requirements = PasswordService.getPasswordRequirements();
   * res.json({ requirements });
   * ```
   *
   * @returns Object containing password requirements
   */
  static getPasswordRequirements(): {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSpecialChar: boolean;
    specialChars: string;
  } {
    return {
      minLength: AUTH.MIN_PASSWORD_LENGTH,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
      specialChars: '@$!%*?&',
    };
  }
}
