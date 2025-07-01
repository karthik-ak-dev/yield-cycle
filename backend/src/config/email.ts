/**
 * 📧 Email Configuration
 * 
 * PURPOSE:
 * Centralized email configuration for AWS SES integration.
 * Supports both development (mock) and production environments.
 * 
 * FEATURES:
 * - AWS SES configuration with region and credentials
 * - Email templates configuration
 * - Rate limiting and retry settings
 * - Development/Production environment handling
 * 
 * USAGE:
 * Used by SESUtil and EmailService for sending transactional emails
 * including OTP verification, password reset, and platform notifications.
 */

export interface EmailConfig {
  provider: 'SES' | 'MOCK';
  aws: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  from: {
    noreply: string;
    support: string;
    admin: string;
  };
  templates: {
    baseUrl?: string;
    defaultLocale: string;
  };
  retry: {
    attempts: number;
    delay: number;
  };
}

/**
 * 🔧 Email Configuration
 */
export const emailConfig: EmailConfig = {
  // Email Provider (SES for production, MOCK for development)
  provider: (process.env.NODE_ENV === 'production' || process.env.EMAIL_PROVIDER === 'SES') ? 'SES' : 'MOCK',
  
  // AWS SES Configuration
  aws: {
    region: process.env.AWS_SES_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },
  
  // From Email Addresses
  from: {
    noreply: process.env.EMAIL_FROM_NOREPLY || 'noreply@yieldcycle.com',
    support: process.env.EMAIL_FROM_SUPPORT || 'support@yieldcycle.com',
    admin: process.env.EMAIL_FROM_ADMIN || 'admin@yieldcycle.com',
  },
  
  // Template Configuration
  templates: {
    baseUrl: process.env.EMAIL_TEMPLATE_BASE_URL,
    defaultLocale: 'en',
  },
  

  
  // Retry Configuration
  retry: {
    attempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3'),
    delay: parseInt(process.env.EMAIL_RETRY_DELAY || '1000'), // 1 second
  },
};

/**
 * 📬 Email Subject Prefixes
 */
export const EMAIL_SUBJECTS = {
  OTP_VERIFICATION: '[Yield Cycle] Verify Your Email',
  PASSWORD_RESET: '[Yield Cycle] Reset Your Password',
  LOGIN_OTP: '[Yield Cycle] Login Verification Code',
  WELCOME: '[Yield Cycle] Welcome to Yield Cycle!',
  DEPOSIT_CONFIRMATION: '[Yield Cycle] Deposit Confirmed',
  COMMISSION_NOTIFICATION: '[Yield Cycle] Commission Earned',
  WITHDRAWAL_CONFIRMATION: '[Yield Cycle] Withdrawal Processed',
  MONTHLY_INCOME: '[Yield Cycle] Monthly Income Distribution',
  ACCOUNT_SUSPENDED: '[Yield Cycle] Account Status Update',
} as const;

/**
 * 🎨 Email Template Mapping
 */
export const EMAIL_TEMPLATE_MAP = {
  OTP_VERIFICATION: 'otp-verification',
  PASSWORD_RESET: 'password-reset',
  LOGIN_OTP: 'login-otp',
  WELCOME: 'welcome',
  DEPOSIT_CONFIRMATION: 'deposit-confirmation',
  COMMISSION_NOTIFICATION: 'commission-notification',
  WITHDRAWAL_CONFIRMATION: 'withdrawal-confirmation',
  MONTHLY_INCOME: 'monthly-income',
  ACCOUNT_SUSPENDED: 'account-suspended',
} as const;

/**
 * ⚙️ Development Email Configuration
 */
export const DEV_EMAIL_CONFIG = {
  logToConsole: true,
  saveToFile: false,
  mockDelay: 500, // Simulate email sending delay
  testEmailAddress: process.env.TEST_EMAIL_ADDRESS || 'test@yieldcycle.dev',
} as const;

/**
 * 🔍 Validation
 */
export const validateEmailConfig = (): void => {
  if (emailConfig.provider === 'SES') {
    if (!emailConfig.aws.region) {
      throw new Error('AWS SES region is required when using SES provider');
    }
    
    if (process.env.NODE_ENV === 'production') {
      if (!emailConfig.aws.accessKeyId || !emailConfig.aws.secretAccessKey) {
        throw new Error('AWS SES credentials are required in production');
      }
    }
  }
  
  // Validate email addresses format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  Object.values(emailConfig.from).forEach(email => {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid from email address: ${email}`);
    }
  });
};

// Validate configuration on import
validateEmailConfig();
