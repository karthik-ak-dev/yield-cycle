/**
 * General Helper Utilities
 * 
 * Purpose:
 * - Common utility functions used across the application
 * - String manipulation and generation
 * - Data transformation helpers
 * - Random generation utilities
 * - General purpose helper functions
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * String manipulation utilities
 */
export class StringUtils {
  /**
   * Generate a random string of specified length
   * 
   * @param length - Length of the string
   * @param charset - Character set to use (default: alphanumeric)
   * @returns Random string
   */
  static randomString(
    length: number, 
    charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  ): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * Generate uppercase alphanumeric string (for referral codes)
   * 
   * @param length - Length of the code (default: 8)
   * @returns Random uppercase alphanumeric string
   */
  static generateCode(length: number = 8): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return this.randomString(length, charset);
  }

  /**
   * Generate numeric string (for OTP)
   * 
   * @param length - Length of the numeric string (default: 6)
   * @returns Random numeric string
   */
  static generateNumericCode(length: number = 6): string {
    const charset = '0123456789';
    return this.randomString(length, charset);
  }

  /**
   * Capitalize first letter of a string
   * 
   * @param str - String to capitalize
   * @returns Capitalized string
   */
  static capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Convert string to title case
   * 
   * @param str - String to convert
   * @returns Title case string
   */
  static toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => this.capitalize(word))
      .join(' ');
  }

  /**
   * Truncate string with ellipsis
   * 
   * @param str - String to truncate
   * @param maxLength - Maximum length
   * @param suffix - Suffix to add (default: '...')
   * @returns Truncated string
   */
  static truncate(str: string, maxLength: number, suffix: string = '...'): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Generate a slug from string (URL-friendly)
   * 
   * @param str - String to convert to slug
   * @returns URL-friendly slug
   */
  static toSlug(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Check if string is empty or only whitespace
   * 
   * @param str - String to check
   * @returns True if empty or whitespace
   */
  static isEmpty(str?: string): boolean {
    return !str || str.trim().length === 0;
  }

  /**
   * Mask sensitive information (email, phone, etc.)
   * 
   * @param str - String to mask
   * @param visibleStart - Characters to show at start (default: 2)
   * @param visibleEnd - Characters to show at end (default: 2)
   * @param maskChar - Character to use for masking (default: '*')
   * @returns Masked string
   */
  static mask(str: string, visibleStart: number = 2, visibleEnd: number = 2, maskChar: string = '*'): string {
    if (str.length <= visibleStart + visibleEnd) {
      return maskChar.repeat(str.length);
    }
    
    const start = str.substring(0, visibleStart);
    const end = str.substring(str.length - visibleEnd);
    const middle = maskChar.repeat(str.length - visibleStart - visibleEnd);
    
    return start + middle + end;
  }
}

/**
 * ID and token generation utilities
 */
export class IdUtils {
  /**
   * Generate UUID v4
   * 
   * @returns UUID v4 string
   */
  static generateUUID(): string {
    return uuidv4();
  }

  /**
   * Generate short ID (for display purposes)
   * 
   * @param length - Length of the ID (default: 8)
   * @returns Short ID string
   */
  static generateShortId(length: number = 8): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return StringUtils.randomString(length, charset);
  }

  /**
   * Generate secure random token
   * 
   * @param length - Length of the token in bytes (default: 32)
   * @returns Hex-encoded random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate referral code (8-character uppercase alphanumeric)
   * 
   * @returns Referral code
   */
  static generateReferralCode(): string {
    return StringUtils.generateCode(8);
  }

  /**
   * Generate OTP code (6-digit numeric)
   * 
   * @returns OTP code
   */
  static generateOTP(): string {
    return StringUtils.generateNumericCode(6);
  }
}

/**
 * Array and object manipulation utilities
 */
export class DataUtils {
  /**
   * Check if value is null or undefined
   * 
   * @param value - Value to check
   * @returns True if null or undefined
   */
  static isNullOrUndefined(value: any): boolean {
    return value === null || value === undefined;
  }

  /**
   * Get nested property from object safely
   * 
   * @param obj - Object to get property from
   * @param path - Dot-separated path (e.g., 'user.profile.name')
   * @param defaultValue - Default value if property doesn't exist
   * @returns Property value or default
   */
  static getNestedProperty(obj: any, path: string, defaultValue: any = undefined): any {
    if (!obj || !path) return defaultValue;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current[key] === undefined || current[key] === null) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current;
  }

  /**
   * Deep clone an object
   * 
   * @param obj - Object to clone
   * @returns Deep cloned object
   */
     static deepClone<T>(obj: T): T {
     if (obj === null || typeof obj !== 'object') return obj;
     if (obj instanceof Date) return new Date(obj.getTime()) as any;
     if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as any;
     if (typeof obj === 'object') {
       const clonedObj: any = {};
       for (const key in obj as object) {
         if (Object.prototype.hasOwnProperty.call(obj, key)) {
           clonedObj[key] = this.deepClone((obj as any)[key]);
         }
       }
       return clonedObj;
     }
     return obj;
   }

  /**
   * Remove undefined and null values from object
   * 
   * @param obj - Object to clean
   * @returns Cleaned object
   */
  static removeNullish(obj: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  }

  /**
   * Pick specific properties from object
   * 
   * @param obj - Source object
   * @param keys - Keys to pick
   * @returns Object with only specified keys
   */
  static pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    
    return result;
  }

  /**
   * Omit specific properties from object
   * 
   * @param obj - Source object
   * @param keys - Keys to omit
   * @returns Object without specified keys
   */
  static omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };
    
    for (const key of keys) {
      delete result[key];
    }
    
    return result;
  }

  /**
   * Group array elements by a key
   * 
   * @param array - Array to group
   * @param keyFn - Function to extract grouping key
   * @returns Grouped object
   */
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};
    
    for (const item of array) {
      const key = keyFn(item);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }
    
    return grouped;
  }

  /**
   * Remove duplicates from array
   * 
   * @param array - Array with potential duplicates
   * @param keyFn - Optional function to extract comparison key
   * @returns Array without duplicates
   */
  static unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
    if (!keyFn) {
      return [...new Set(array)];
    }
    
    const seen = new Set();
    return array.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

/**
 * Date and time utilities
 */
export class TimeUtils {
  /**
   * Get current timestamp in ISO format
   * 
   * @returns ISO timestamp string
   */
  static now(): string {
    return new Date().toISOString();
  }

  /**
   * Get Unix timestamp in seconds
   * 
   * @param date - Date object (default: current date)
   * @returns Unix timestamp
   */
  static toUnixTimestamp(date: Date = new Date()): number {
    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Create date from Unix timestamp
   * 
   * @param timestamp - Unix timestamp in seconds
   * @returns Date object
   */
  static fromUnixTimestamp(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  /**
   * Format date for display
   * 
   * @param date - Date to format
   * @param format - Format type ('short', 'long', 'date', 'time')
   * @returns Formatted date string
   */
  static formatDate(date: Date, format: 'short' | 'long' | 'date' | 'time' = 'short'): string {
    const options: Intl.DateTimeFormatOptions = {};
    
    switch (format) {
      case 'short':
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        break;
      case 'long':
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      case 'date':
        options.year = 'numeric';
        options.month = '2-digit';
        options.day = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
    }
    
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Check if date is today
   * 
   * @param date - Date to check
   * @returns True if date is today
   */
  static isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Get time ago string (e.g., "2 hours ago")
   * 
   * @param date - Date to compare
   * @returns Time ago string
   */
  static timeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  /**
   * Sleep for specified milliseconds
   * 
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Environment and configuration utilities
 */
export class EnvUtils {
  /**
   * Get environment variable with default value
   * 
   * @param key - Environment variable key
   * @param defaultValue - Default value if not set
   * @returns Environment variable value or default
   */
  static get(key: string, defaultValue?: string): string | undefined {
    return process.env[key] || defaultValue;
  }

  /**
   * Get required environment variable (throws if not set)
   * 
   * @param key - Environment variable key
   * @returns Environment variable value
   * @throws Error if not set
   */
  static getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  /**
   * Check if running in development environment
   * 
   * @returns True if development environment
   */
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Check if running in production environment
   * 
   * @returns True if production environment
   */
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Check if running in test environment
   * 
   * @returns True if test environment
   */
  static isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}

/**
 * Retry mechanism utility
 */
export class RetryUtils {
  /**
   * Retry an async operation with exponential backoff
   * 
   * @param operation - Async function to retry
   * @param maxAttempts - Maximum retry attempts (default: 3)
   * @param baseDelay - Base delay in milliseconds (default: 1000)
   * @returns Promise that resolves with operation result
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Sleep for specified milliseconds
   * 
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * URL and query parameter utilities
 */
export class UrlUtils {
  /**
   * Build query string from object
   * 
   * @param params - Parameters object
   * @returns Query string
   */
  static buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    
    return searchParams.toString();
  }

  /**
   * Parse query string to object
   * 
   * @param queryString - Query string to parse
   * @returns Parsed parameters object
   */
  static parseQueryString(queryString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(queryString);
    
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }
    
    return params;
  }
}
