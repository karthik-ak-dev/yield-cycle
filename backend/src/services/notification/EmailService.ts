/**
 * 📧 Email Service
 * 
 * PURPOSE:
 * Business logic layer for email communications in the Yield Cycle platform.
 * Orchestrates email sending for authentication flows using SESUtil for actual email delivery.
 * 
 * CORE FUNCTIONALITIES:
 * - OTP email delivery for authentication flows (REGISTRATION, LOGIN, PASSWORD_RESET)
 * - Email template management and customization
 * 
 * INTEGRATION WITH UTILS:
 * - SESUtil: For actual email delivery via AWS SES or mock
 * - Constants: For email subjects and template mappings
 * - Logger: For comprehensive email operation logging
 * 
 * BUSINESS LOGIC:
 * - Validates email addresses before sending
 * - Handles different OTP types with appropriate templates
 * - Manages email sending retries and error handling
 * - Provides audit logging for email operations
 * 
 * USAGE:
 * Used by PasswordService, OTPService, and AuthService for OTP email delivery.
 */

import { SESUtil, TemplateData } from '../../utils/ses';
import { logger } from '../../utils/logger';
import { EmailValidator } from '../../utils/validation';
import { OTPType } from '../../types/enums';

/**
 * 📬 Email Service Interfaces
 */
export interface EmailServiceResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: number;
}

export interface OTPEmailData {
  otpCode: string;
  expiryMinutes: number;
  userEmail: string;
  userName?: string;
}

/**
 * 🚀 Email Service Class
 */
export class EmailService {
  /**
   * 📧 Send OTP Email (Generic)
   * 
   * BUSINESS LOGIC:
   * Sends OTP verification emails for any authentication flow.
   * Uses standardized OTP template with customizable type.
   * 
   * USAGE (in OTPService):
   * ```typescript
   * await EmailService.sendOTPEmail(email, otpCode, OTPType.REGISTRATION);
   * ```
   * 
   * @param email - Recipient email address
   * @param otpCode - OTP code to send
   * @param type - OTP type (REGISTRATION, LOGIN, PASSWORD_RESET)
   * @returns Promise<EmailServiceResult> - Email sending result
   */
  static async sendOTPEmail(
    email: string,
    otpCode: string,
    type: OTPType
  ): Promise<EmailServiceResult> {
    try {
      // Validate email address
      if (!this.isValidEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }

      // Create template data
      const templateData: TemplateData = {
        otpCode,
        expiryMinutes: 10, // Standard OTP expiry
        type: type.toLowerCase(),
      };

      // Create email template
      const template = SESUtil.createTemplate('OTP_VERIFICATION', templateData);

      // Send email
      const result = await SESUtil.sendEmailWithRetry({
        to: email,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        timestamp: result.timestamp,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('OTP email sending failed', { email, type, error: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 🔐 Send Password Reset OTP Email
   * 
   * BUSINESS LOGIC:
   * Sends password reset OTP emails with specialized template.
   * Used by PasswordService for password reset workflow.
   * 
   * USAGE (in PasswordService):
   * ```typescript
   * await EmailService.sendPasswordResetOTP(email, otpCode);
   * ```
   * 
   * @param email - Recipient email address
   * @param otpCode - Password reset OTP code
   * @returns Promise<EmailServiceResult> - Email sending result
   */
  static async sendPasswordResetOTP(
    email: string,
    otpCode: string
  ): Promise<EmailServiceResult> {
    try {
      // Validate email address
      if (!this.isValidEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }

      // Create template data
      const templateData: TemplateData = {
        otpCode,
        expiryMinutes: 15, // Password reset OTP has longer expiry
        action: 'password reset',
      };

      // Create email template
      const template = SESUtil.createTemplate('PASSWORD_RESET', templateData);

      // Send email
      const result = await SESUtil.sendEmailWithRetry({
        to: email,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        timestamp: result.timestamp,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Password reset OTP email sending failed', { email, error: errorMessage });
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * ✅ Email Validation
   * 
   * @param email - Email address to validate
   * @returns boolean - Whether email is valid
   */
  private static isValidEmail(email: string): boolean {
    const validation = EmailValidator.validate(email);
    return validation.isValid;
  }

}
