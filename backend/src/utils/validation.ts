/**
 * Validation Utilities
 * 
 * Purpose:
 * - Input validation and sanitization
 * - Business rule validation
 * - Data format validation
 * - Type checking utilities
 * - Common validation patterns for the Yield Cycle platform
 */

import { REGEX, BUSINESS_RULES, AUTH } from './constants';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: any;
}

/**
 * Email validation utilities
 */
export class EmailValidator {
  /**
   * Validate email format
   * 
   * @param email - Email to validate
   * @returns Validation result
   */
  static validate(email: string): ValidationResult {
    if (!email || typeof email !== 'string') {
      return { isValid: false, error: 'Email is required' };
    }

    const trimmed = email.trim().toLowerCase();
    
    if (!REGEX.EMAIL.test(trimmed)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Check if email domain is allowed
   * 
   * @param email - Email to check
   * @param allowedDomains - List of allowed domains (optional)
   * @returns True if domain is allowed
   */
  static isDomainAllowed(email: string, allowedDomains?: string[]): boolean {
    if (!allowedDomains || allowedDomains.length === 0) return true;
    
    const domain = email.split('@')[1]?.toLowerCase();
    return allowedDomains.includes(domain);
  }
}

/**
 * Password validation utilities
 */
export class PasswordValidator {
  /**
   * Validate password strength
   * 
   * @param password - Password to validate
   * @returns Validation result
   */
  static validate(password: string): ValidationResult {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'Password is required' };
    }

    if (password.length < AUTH.MIN_PASSWORD_LENGTH) {
      return { 
        isValid: false, 
        error: `Password must be at least ${AUTH.MIN_PASSWORD_LENGTH} characters long` 
      };
    }

    if (!AUTH.PASSWORD_REGEX.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
      };
    }

    return { isValid: true };
  }

  /**
   * Check password strength level
   * 
   * @param password - Password to check
   * @returns Strength level (weak, medium, strong)
   */
  static getStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (!password) return 'weak';

    let score = 0;
    
    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    // Additional complexity
    if (password.length >= 16) score++;
    if (/[!@#$%^&*(),.?":{}|<>]{2,}/.test(password)) score++;

    if (score <= 3) return 'weak';
    if (score <= 5) return 'medium';
    return 'strong';
  }

  /**
   * Validate password confirmation
   * 
   * @param password - Original password
   * @param confirmation - Password confirmation
   * @returns Validation result
   */
  static validateConfirmation(password: string, confirmation: string): ValidationResult {
    if (password !== confirmation) {
      return { isValid: false, error: 'Passwords do not match' };
    }
    return { isValid: true };
  }
}

/**
 * Amount validation utilities
 */
export class AmountValidator {
  /**
   * Validate deposit amount
   * 
   * @param amount - Amount to validate
   * @returns Validation result
   */
  static validateDeposit(amount: number): ValidationResult {
    if (!this.isValidNumber(amount)) {
      return { isValid: false, error: 'Invalid amount format' };
    }

    if (amount < BUSINESS_RULES.MIN_DEPOSIT_AMOUNT) {
      return { 
        isValid: false, 
        error: `Minimum deposit amount is ${BUSINESS_RULES.MIN_DEPOSIT_AMOUNT} USDT` 
      };
    }

    if (amount > BUSINESS_RULES.MAX_DEPOSIT_AMOUNT) {
      return { 
        isValid: false, 
        error: `Maximum deposit amount is ${BUSINESS_RULES.MAX_DEPOSIT_AMOUNT} USDT` 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate withdrawal amount
   * 
   * @param amount - Amount to validate
   * @param availableBalance - Available balance
   * @returns Validation result
   */
  static validateWithdrawal(amount: number, availableBalance: number): ValidationResult {
    if (!this.isValidNumber(amount)) {
      return { isValid: false, error: 'Invalid amount format' };
    }

    if (amount <= 0) {
      return { isValid: false, error: 'Amount must be greater than zero' };
    }

    if (amount > availableBalance) {
      return { isValid: false, error: 'Insufficient balance' };
    }

    return { isValid: true };
  }

  /**
   * Check if value is a valid positive number
   * 
   * @param value - Value to check
   * @returns True if valid positive number
   */
  private static isValidNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value) && value >= 0;
  }
}

/**
 * Blockchain validation utilities
 */
export class BlockchainValidator {
  /**
   * Validate wallet address format
   * 
   * @param address - Wallet address to validate
   * @returns Validation result
   */
  static validateAddress(address: string): ValidationResult {
    if (!address || typeof address !== 'string') {
      return { isValid: false, error: 'Wallet address is required' };
    }

    const trimmed = address.trim();
    
    if (!REGEX.WALLET_ADDRESS.test(trimmed)) {
      return { isValid: false, error: 'Invalid wallet address format' };
    }

    return { isValid: true, sanitized: trimmed.toLowerCase() };
  }

  /**
   * Validate transaction hash format
   * 
   * @param hash - Transaction hash to validate
   * @returns Validation result
   */
  static validateTransactionHash(hash: string): ValidationResult {
    if (!hash || typeof hash !== 'string') {
      return { isValid: false, error: 'Transaction hash is required' };
    }

    const trimmed = hash.trim();
    
    if (!REGEX.TRANSACTION_HASH.test(trimmed)) {
      return { isValid: false, error: 'Invalid transaction hash format' };
    }

    return { isValid: true, sanitized: trimmed.toLowerCase() };
  }

  /**
   * Validate USDT amount format
   * 
   * @param amount - Amount string to validate
   * @returns Validation result
   */
  static validateUSDTAmount(amount: string): ValidationResult {
    if (!amount || typeof amount !== 'string') {
      return { isValid: false, error: 'Amount is required' };
    }

    const trimmed = amount.trim();
    
    if (!REGEX.AMOUNT.test(trimmed)) {
      return { isValid: false, error: 'Invalid amount format' };
    }

    const numericValue = parseFloat(trimmed);
    if (numericValue <= 0) {
      return { isValid: false, error: 'Amount must be greater than zero' };
    }

    return { isValid: true, sanitized: numericValue };
  }
}

/**
 * User input validation utilities
 */
export class UserValidator {
  /**
   * Validate referral code format
   * 
   * @param code - Referral code to validate
   * @returns Validation result
   */
  static validateReferralCode(code: string): ValidationResult {
    if (!code || typeof code !== 'string') {
      return { isValid: false, error: 'Referral code is required' };
    }

    const trimmed = code.trim().toUpperCase();
    
    if (!REGEX.REFERRAL_CODE.test(trimmed)) {
      return { 
        isValid: false, 
        error: `Referral code must be ${BUSINESS_RULES.REFERRAL_CODE_LENGTH} characters (letters and numbers only)` 
      };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Validate phone number format
   * 
   * @param phone - Phone number to validate
   * @returns Validation result
   */
  static validatePhoneNumber(phone: string): ValidationResult {
    if (!phone || typeof phone !== 'string') {
      return { isValid: false, error: 'Phone number is required' };
    }

    const trimmed = phone.trim();
    
    if (!REGEX.PHONE_NUMBER.test(trimmed)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }

    // Remove non-numeric characters for sanitization
    const sanitized = trimmed.replace(/[^\d+]/g, '');
    
    return { isValid: true, sanitized };
  }

  /**
   * Validate name format
   * 
   * @param name - Name to validate
   * @param minLength - Minimum length (default: 2)
   * @param maxLength - Maximum length (default: 50)
   * @returns Validation result
   */
  static validateName(name: string, minLength: number = 2, maxLength: number = 50): ValidationResult {
    if (!name || typeof name !== 'string') {
      return { isValid: false, error: 'Name is required' };
    }

    const trimmed = name.trim();
    
    if (trimmed.length < minLength) {
      return { isValid: false, error: `Name must be at least ${minLength} characters long` };
    }

    if (trimmed.length > maxLength) {
      return { isValid: false, error: `Name must not exceed ${maxLength} characters` };
    }

    // Check for valid characters (letters, spaces, hyphens, apostrophes)
    if (!/^[a-zA-Z\s\-']+$/.test(trimmed)) {
      return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }

    return { isValid: true, sanitized: trimmed };
  }
}

/**
 * OTP validation utilities
 */
export class OTPValidator {
  /**
   * Validate OTP format
   * 
   * @param otp - OTP to validate
   * @returns Validation result
   */
  static validate(otp: string): ValidationResult {
    if (!otp || typeof otp !== 'string') {
      return { isValid: false, error: 'OTP is required' };
    }

    const trimmed = otp.trim();
    
    if (trimmed.length !== AUTH.OTP_LENGTH) {
      return { isValid: false, error: `OTP must be ${AUTH.OTP_LENGTH} digits` };
    }

    if (!/^\d+$/.test(trimmed)) {
      return { isValid: false, error: 'OTP must contain only numbers' };
    }

    return { isValid: true, sanitized: trimmed };
  }
}

/**
 * Date validation utilities
 */
export class DateValidator {
  /**
   * Validate date string
   * 
   * @param dateString - Date string to validate
   * @returns Validation result
   */
  static validate(dateString: string): ValidationResult {
    if (!dateString || typeof dateString !== 'string') {
      return { isValid: false, error: 'Date is required' };
    }

    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }

    return { isValid: true, sanitized: date };
  }

  /**
   * Validate date range
   * 
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Validation result
   */
  static validateRange(startDate: Date, endDate: Date): ValidationResult {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      return { isValid: false, error: 'Invalid date objects' };
    }

    if (startDate >= endDate) {
      return { isValid: false, error: 'Start date must be before end date' };
    }

    return { isValid: true };
  }

  /**
   * Check if date is in the past
   * 
   * @param date - Date to check
   * @returns True if date is in the past
   */
  static isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if date is in the future
   * 
   * @param date - Date to check
   * @returns True if date is in the future
   */
  static isFuture(date: Date): boolean {
    return date > new Date();
  }
}

/**
 * Pagination validation utilities
 */
export class PaginationValidator {
  /**
   * Validate pagination parameters
   * 
   * @param page - Page number
   * @param limit - Items per page
   * @returns Validation result with sanitized values
   */
  static validate(page?: number, limit?: number): ValidationResult {
    const sanitizedPage = Math.max(1, Math.floor(page || 1));
    const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

    return {
      isValid: true,
      sanitized: {
        page: sanitizedPage,
        limit: sanitizedLimit,
        offset: (sanitizedPage - 1) * sanitizedLimit
      }
    };
  }
}

/**
 * File validation utilities
 */
export class FileValidator {
  /**
   * Validate file type
   * 
   * @param file - File to validate
   * @param allowedTypes - Allowed MIME types
   * @returns Validation result
   */
  static validateType(file: { mimetype: string }, allowedTypes: string[]): ValidationResult {
    if (!file || !file.mimetype) {
      return { isValid: false, error: 'Invalid file' };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return { 
        isValid: false, 
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate file size
   * 
   * @param file - File to validate
   * @param maxSize - Maximum size in bytes
   * @returns Validation result
   */
  static validateSize(file: { size: number }, maxSize: number): ValidationResult {
    if (!file || typeof file.size !== 'number') {
      return { isValid: false, error: 'Invalid file' };
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return { 
        isValid: false, 
        error: `File size too large. Maximum size: ${maxSizeMB}MB` 
      };
    }

    return { isValid: true };
  }
}

/**
 * General sanitization utilities
 */
export class SanitizationUtils {
  /**
   * Sanitize string input (trim and basic HTML escape)
   * 
   * @param input - String to sanitize
   * @returns Sanitized string
   */
  static sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Sanitize numeric input
   * 
   * @param input - Input to sanitize
   * @returns Sanitized number or null
   */
  static sanitizeNumber(input: any): number | null {
    if (typeof input === 'number' && !isNaN(input) && isFinite(input)) {
      return input;
    }
    
    if (typeof input === 'string') {
      const parsed = parseFloat(input.trim());
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
    
    return null;
  }

  /**
   * Sanitize boolean input
   * 
   * @param input - Input to sanitize
   * @returns Sanitized boolean
   */
  static sanitizeBoolean(input: any): boolean {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      const lower = input.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    if (typeof input === 'number') return input !== 0;
    return false;
  }

  /**
   * Remove SQL injection patterns (basic protection)
   * 
   * @param input - String to sanitize
   * @returns Sanitized string
   */
  static sanitizeSQL(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/['";\\]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }
}
