/**
 * 🔐 OTP Service
 *
 * PURPOSE:
 * Handles all OTP-related operations for the Yield Cycle platform including
 * OTP generation, validation, lifecycle management, and security controls.
 *
 * CORE FUNCTIONALITIES:
 * - OTP generation for registration, login, and password reset flows
 * - OTP validation with security checks (expiry, attempts, usage)
 * - OTP lifecycle management (resend, cleanup, invalidation)
 * - Security features: attempt limiting, expiry handling, single-use enforcement
 *
 * INTEGRATION WITH UTILS:
 * - StringUtils: For secure OTP code generation
 * - TimeUtils: For expiry calculations and TTL management
 * - EmailService: For OTP delivery to users
 *
 * SECURITY FEATURES:
 * - 6-digit numeric codes for user-friendliness
 * - 5-minute default expiry for security
 * - 3 attempt limit to prevent brute force attacks
 * - Single-use enforcement
 * - Automatic cleanup via DynamoDB TTL
 *
 * BUSINESS RULES:
 * - Only one active OTP per user per type at a time
 * - OTPs expire after 5 minutes (configurable)
 * - Maximum 3 failed attempts before OTP becomes invalid
 * - OTPs are single-use only
 */

import { OTP } from '../../models/OTP';
import { OTPRepository } from '../../repositories/OTPRepository';
import { EmailService } from '../notification/EmailService';
import { OTPType } from '../../types/enums';
import { logger } from '../../utils/logger';

/**
 * OTP Service Result Types
 */
export interface OTPGenerationResult {
  success: boolean;
  otpId?: string;
  expiresIn: number;
  error?: string;
}

export interface OTPValidationResult {
  isValid: boolean;
  error?: string;
  remainingAttempts?: number;
}

export interface OTPResendResult {
  success: boolean;
  otpId?: string;
  expiresIn: number;
  error?: string;
}

export class OTPService {
  /**
   * 🔑 Generate OTP for Authentication Flow
   *
   * BUSINESS LOGIC:
   * Creates a new OTP for the specified user and type, invalidates any existing
   * OTPs for the same user/type combination, and sends the OTP via email.
   *
   * SECURITY FEATURES:
   * - Invalidates existing OTPs to ensure only one active OTP per user/type
   * - Uses secure random code generation
   * - Sets appropriate expiry time
   * - Sends OTP via secure email delivery
   *
   * USAGE (in AuthController):
   * ```typescript
   * const result = await OTPService.generateOTP(userId, OTPType.REGISTRATION);
   * if (result.success) {
   *   // OTP sent successfully
   * }
   * ```
   *
   * @param userId - User ID for OTP generation
   * @param type - OTP type (REGISTRATION, LOGIN, PASSWORD_RESET)
   * @param ttlMinutes - Time to live in minutes (default: 5)
   * @returns Promise<OTPGenerationResult> - Generation result with OTP details
   */
  static async generateOTP(
    userId: string,
    type: OTPType,
    ttlMinutes: number = 5
  ): Promise<OTPGenerationResult> {
    try {
      // Validate inputs
      if (!userId || !type) {
        throw new Error('User ID and OTP type are required');
      }

      // Invalidate any existing OTPs for this user and type
      await OTPRepository.invalidatePendingOTPs(userId, type);

      // Create new OTP using the OTP model factory method
      const otp = OTP.createOTP(userId, type, ttlMinutes);

      // Save OTP to database
      await OTPRepository.createOTP(otp);

      // Send OTP via email
      const emailResult = await EmailService.sendOTPEmail(userId, otp.code, type);

      if (!emailResult.success) {
        // If email fails, return error (OTP will be cleaned up by TTL)
        throw new Error(`Failed to send OTP email: ${emailResult.error}`);
      }

      logger.info('OTP generated successfully', {
        userId,
        type,
        otpId: otp.id,
        expiresIn: ttlMinutes,
      });

      return {
        success: true,
        otpId: otp.id,
        expiresIn: ttlMinutes * 60, // Convert to seconds
      };
    } catch (error) {
      logger.error('OTP generation failed', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        expiresIn: 0,
        error: error instanceof Error ? error.message : 'OTP generation failed',
      };
    }
  }

  /**
   * ✅ Validate OTP Code
   *
   * AUTHENTICATION FLOW:
   * Validates user-provided OTP code against stored OTP with comprehensive
   * security checks including expiry, usage status, and attempt limiting.
   *
   * SECURITY CHECKS:
   * - OTP expiry validation
   * - Single-use enforcement
   * - Attempt limit enforcement
   * - Code comparison
   *
   * USAGE (in AuthController):
   * ```typescript
   * const result = await OTPService.validateOTP(userId, OTPType.REGISTRATION, userCode);
   * if (result.isValid) {
   *   // Proceed with authentication flow
   * } else {
   *   // Handle validation error
   * }
   * ```
   *
   * @param userId - User ID for OTP validation
   * @param type - OTP type to validate
   * @param code - User-provided OTP code
   * @returns Promise<OTPValidationResult> - Validation result with details
   */
  static async validateOTP(
    userId: string,
    type: OTPType,
    code: string
  ): Promise<OTPValidationResult> {
    try {
      // Validate inputs
      if (!userId || !type || !code) {
        return {
          isValid: false,
          error: 'User ID, OTP type, and code are required',
        };
      }

      // Get latest OTP for user and type
      const otp = await OTPRepository.getLatestOTPForUser(userId, type);

      if (!otp) {
        return {
          isValid: false,
          error: 'No OTP found for this user and type',
        };
      }

      // Use OTP model's verify method for comprehensive validation
      try {
        const isValid = otp.verify(code);

        if (isValid) {
          // Mark OTP as used in database
          await OTPRepository.markAsUsed(otp.id);

          logger.info('OTP validated successfully', {
            userId,
            type,
            otpId: otp.id,
          });

          return {
            isValid: true,
          };
        } else {
          // Update attempt count in database
          await OTPRepository.incrementAttempts(otp.id);

          return {
            isValid: false,
            error: 'Invalid OTP code',
            remainingAttempts: otp.getRemainingAttempts(),
          };
        }
      } catch (validationError) {
        // Handle security violations from OTP model
        if (validationError instanceof Error) {
          // Update attempt count for security violations
          await OTPRepository.incrementAttempts(otp.id);

          return {
            isValid: false,
            error: validationError.message,
            remainingAttempts: otp.getRemainingAttempts(),
          };
        }

        throw validationError;
      }
    } catch (error) {
      logger.error('OTP validation failed', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        isValid: false,
        error: 'OTP validation failed',
      };
    }
  }

  /**
   * 🔄 Resend OTP
   *
   * BUSINESS LOGIC:
   * Generates a new OTP for the user and type, invalidating any existing OTPs.
   * Used when users request a new OTP or when the previous OTP expires.
   *
   * SECURITY FEATURES:
   * - Invalidates existing OTPs to prevent multiple active OTPs
   * - Rate limiting should be handled at controller level
   * - Fresh expiry time for new OTP
   *
   * USAGE (in AuthController):
   * ```typescript
   * const result = await OTPService.resendOTP(userId, OTPType.REGISTRATION);
   * if (result.success) {
   *   // New OTP sent successfully
   * }
   * ```
   *
   * @param userId - User ID for OTP resend
   * @param type - OTP type to resend
   * @param ttlMinutes - Time to live in minutes (default: 5)
   * @returns Promise<OTPResendResult> - Resend result with OTP details
   */
  static async resendOTP(
    userId: string,
    type: OTPType,
    ttlMinutes: number = 5
  ): Promise<OTPResendResult> {
    try {
      // Validate inputs
      if (!userId || !type) {
        throw new Error('User ID and OTP type are required');
      }

      // Check if there's a recent OTP that's still valid
      const existingOTP = await OTPRepository.getLatestOTPForUser(userId, type);

      if (existingOTP && existingOTP.isValid() && !existingOTP.isExpired()) {
        const remainingTime = existingOTP.getExpiryInMinutes();

        if (remainingTime > 1) {
          return {
            success: false,
            expiresIn: 0,
            error: `Please wait ${remainingTime} minutes before requesting a new OTP`,
          };
        }
      }

      // Generate new OTP (this will invalidate existing ones)
      const result = await this.generateOTP(userId, type, ttlMinutes);

      if (result.success) {
        logger.info('OTP resent successfully', {
          userId,
          type,
          otpId: result.otpId,
        });
      }

      return result;
    } catch (error) {
      logger.error('OTP resend failed', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        expiresIn: 0,
        error: error instanceof Error ? error.message : 'OTP resend failed',
      };
    }
  }

  /**
   * 🧹 Cleanup Expired OTPs
   *
   * MAINTENANCE OPERATION:
   * Removes expired OTPs from the database. This is typically called by
   * a scheduled job or during system maintenance.
   *
   * NOTE: DynamoDB TTL handles most cleanup automatically, but this method
   * provides additional cleanup for edge cases.
   *
   * USAGE (in scheduled job):
   * ```typescript
   * const deletedCount = await OTPService.cleanupExpiredOTPs();
   * console.log(`Cleaned up ${deletedCount} expired OTPs`);
   * ```
   *
   * @returns Promise<number> - Number of OTPs deleted
   */
  static async cleanupExpiredOTPs(): Promise<number> {
    try {
      const deletedCount = await OTPRepository.deleteExpiredOTPs();

      logger.info('Expired OTPs cleaned up', {
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error('OTP cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new Error(
        `OTP cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
