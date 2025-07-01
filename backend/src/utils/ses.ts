/**
 * 📧 AWS SES Utility
 * 
 * PURPOSE:
 * Low-level AWS SES integration utility for sending transactional emails.
 * Provides abstraction over AWS SES API with proper error handling, 
 * retry mechanism, and development environment support.
 * 
 * FEATURES:
 * - AWS SES integration with proper configuration
 * - Development environment mocking
 * - Retry mechanism with exponential backoff
 * - Email template rendering for OTP emails
 * - Comprehensive error handling and logging
 * 
 * USAGE:
 * Used by EmailService for actual email delivery.
 * Handles technical aspects while EmailService manages business logic.
 */

import AWS from 'aws-sdk';
import { emailConfig, DEV_EMAIL_CONFIG, EMAIL_SUBJECTS } from '../config/email';
import { logger } from './logger';
import { EmailValidator } from './validation';
import { TimeUtils } from './helpers';

/**
 * 📬 Email Interfaces
 */
export interface EmailMessage {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: number;
}

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface TemplateData {
  [key: string]: any;
}



/**
 * 🚀 SES Utility Class
 */
export class SESUtil {
  private static sesClient: AWS.SES | null = null;

  /**
   * 🔧 Initialize SES Client
   */
  private static initializeSES(): AWS.SES {
    if (!this.sesClient) {
      AWS.config.update({
        region: emailConfig.aws.region,
        accessKeyId: emailConfig.aws.accessKeyId,
        secretAccessKey: emailConfig.aws.secretAccessKey,
      });

      this.sesClient = new AWS.SES({
        apiVersion: '2010-12-01',
        region: emailConfig.aws.region,
      });
    }

    return this.sesClient;
  }

  /**
   * 📧 Send Email (Main Method)
   * 
   * BUSINESS LOGIC:
   * Sends email via AWS SES with proper error handling and rate limiting.
   * In development, uses mock implementation for testing.
   * 
   * USAGE:
   * ```typescript
   * const result = await SESUtil.sendEmail({
   *   to: 'user@example.com',
   *   subject: 'Welcome!',
   *   htmlBody: '<h1>Welcome</h1>',
   *   textBody: 'Welcome'
   * });
   * ```
   * 
   * @param message - Email message to send
   * @returns Promise<EmailResult> - Result with success status and message ID
   */
  static async sendEmail(message: EmailMessage): Promise<EmailResult> {
    const startTime = Date.now();
    
    try {
      // Validate email address using existing EmailValidator
      const emailValidation = EmailValidator.validate(message.to);
      if (!emailValidation.isValid) {
        throw new Error(`Invalid email address: ${emailValidation.error}`);
      }

      // Development environment - use mock
      if (emailConfig.provider === 'MOCK') {
        return await this.mockSendEmail(message);
      }

      // Production environment - use AWS SES
      return await this.sendViaSES(message);
      
    } catch (error) {
      logger.error('Email sending failed', {
        to: message.to,
        subject: message.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 🔄 Send Email with Retry Logic
   * 
   * RETRY MECHANISM:
   * Implements exponential backoff for failed email sends.
   * Useful for temporary AWS SES issues or rate limiting.
   * 
   * @param message - Email message to send
   * @returns Promise<EmailResult> - Result after all retry attempts
   */
  static async sendEmailWithRetry(message: EmailMessage): Promise<EmailResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= emailConfig.retry.attempts; attempt++) {
      try {
        const result = await this.sendEmail(message);
        
        if (result.success) {
          // Log successful send (especially if retries were needed)
          if (attempt > 1) {
            logger.info('Email sent successfully after retry', {
              to: message.to,
              attempt,
              messageId: result.messageId,
            });
          }
          return result;
        }
        
        lastError = result.error || 'Unknown error';
        
        // Don't retry on validation errors
        if (lastError.includes('Invalid email') || lastError.includes('rate limit')) {
          break;
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }

      // Wait before retry (exponential backoff)
      if (attempt < emailConfig.retry.attempts) {
        const delay = emailConfig.retry.delay * Math.pow(2, attempt - 1);
        await TimeUtils.sleep(delay);
        
        logger.warn('Email send retry', {
          to: message.to,
          attempt,
          nextRetryIn: delay,
          error: lastError,
        });
      }
    }

    // All retries failed
    logger.error('Email sending failed after all retries', {
      to: message.to,
      attempts: emailConfig.retry.attempts,
      finalError: lastError,
    });

    return {
      success: false,
      error: `Failed after ${emailConfig.retry.attempts} attempts: ${lastError}`,
      timestamp: Date.now(),
    };
  }

  /**
   * 🏭 Send via AWS SES
   * 
   * @param message - Email message to send
   * @returns Promise<EmailResult> - SES send result
   */
  private static async sendViaSES(message: EmailMessage): Promise<EmailResult> {
    const ses = this.initializeSES();
    const fromAddress = message.from || emailConfig.from.noreply;

    const params: AWS.SES.SendEmailRequest = {
      Source: fromAddress,
      Destination: {
        ToAddresses: [message.to],
      },
      Message: {
        Subject: {
          Data: message.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: message.htmlBody,
            Charset: 'UTF-8',
          },
          ...(message.textBody && {
            Text: {
              Data: message.textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    };

    try {
      const result = await ses.sendEmail(params).promise();
      
      logger.info('Email sent via SES', {
        to: message.to,
        subject: message.subject,
        messageId: result.MessageId,
        from: fromAddress,
      });

      return {
        success: true,
        messageId: result.MessageId,
        timestamp: Date.now(),
      };
      
    } catch (error) {
      throw new Error(`SES send failed: ${error instanceof Error ? error.message : 'Unknown SES error'}`);
    }
  }

  /**
   * 🧪 Mock Email Sending (Development)
   * 
   * @param message - Email message to mock
   * @returns Promise<EmailResult> - Mock result
   */
  private static async mockSendEmail(message: EmailMessage): Promise<EmailResult> {
    // Simulate email sending delay
    await TimeUtils.sleep(DEV_EMAIL_CONFIG.mockDelay);
    
    const mockMessageId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (DEV_EMAIL_CONFIG.logToConsole) {
      logger.info('📧 === MOCK EMAIL SENT ===', {
        to: message.to,
        subject: message.subject,
        from: message.from || emailConfig.from.noreply,
        messageId: mockMessageId,
        htmlBodyPreview: message.htmlBody.substring(0, 200) + '...',
        textBodyPreview: message.textBody ? message.textBody.substring(0, 200) + '...' : undefined,
      });
    }

    logger.info('Mock email sent', {
      to: message.to,
      subject: message.subject,
      messageId: mockMessageId,
      environment: 'development',
    });

    return {
      success: true,
      messageId: mockMessageId,
      timestamp: Date.now(),
    };
  }

  /**
   * 🎨 Render Email Template
   * 
   * TEMPLATE RENDERING:
   * Simple template rendering with variable substitution.
   * Replaces {{variable}} patterns with actual values.
   * 
   * @param template - Template string with {{variables}}
   * @param data - Data to substitute into template
   * @returns Rendered template string
   */
  static renderTemplate(template: string, data: TemplateData): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * 📋 Create Email Templates
   * 
   * TEMPLATE FACTORY:
   * Creates standardized email templates for OTP emails.
   * Returns both HTML and text versions for better compatibility.
   * 
   * @param type - Template type from EMAIL_SUBJECTS
   * @param data - Data to populate template
   * @returns EmailTemplate with subject, HTML, and text body
   */
  static createTemplate(type: keyof typeof EMAIL_SUBJECTS, data: TemplateData): EmailTemplate {
    const subject = EMAIL_SUBJECTS[type];
    
    switch (type) {
      case 'OTP_VERIFICATION':
        return {
          subject,
          htmlBody: this.createOTPTemplate(data),
          textBody: `Your verification code is: ${data.otpCode}. This code expires in ${data.expiryMinutes} minutes.`,
        };
        
      case 'PASSWORD_RESET':
        return {
          subject,
          htmlBody: this.createPasswordResetTemplate(data),
          textBody: `Your password reset code is: ${data.otpCode}. This code expires in ${data.expiryMinutes} minutes.`,
        };
        
      default:
        return {
          subject,
          htmlBody: `<h1>${subject}</h1><p>Default template content.</p>`,
          textBody: `${subject} - Default template content.`,
        };
    }
  }

  /**
   * 🔐 OTP Email Template
   */
  private static createOTPTemplate(data: TemplateData): string {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Verification Code</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Yield Cycle</h1>
          <p style="color: white; margin: 10px 0 0 0;">Email Verification</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Verification Code Required</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Please use the following verification code to complete your action:
          </p>
          
          <div style="background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px;">{{otpCode}}</span>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            This code will expire in <strong>{{expiryMinutes}} minutes</strong>. If you didn't request this verification, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 30px 0;">
          
          <p style="color: #999; font-size: 14px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.renderTemplate(template, data);
  }

  /**
   * 🔄 Password Reset Template
   */
  private static createPasswordResetTemplate(data: TemplateData): string {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Yield Cycle</h1>
          <p style="color: white; margin: 10px 0 0 0;">Password Reset</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e1e1e1; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
          
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password. Use the code below to set a new password:
          </p>
          
          <div style="background: #f8f9fa; border: 2px dashed #f5576c; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; color: #f5576c; letter-spacing: 4px;">{{otpCode}}</span>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            This code will expire in <strong>{{expiryMinutes}} minutes</strong>. If you didn't request a password reset, please secure your account immediately.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e1e1e1; margin: 30px 0;">
          
          <p style="color: #999; font-size: 14px;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.renderTemplate(template, data);
  }
} 