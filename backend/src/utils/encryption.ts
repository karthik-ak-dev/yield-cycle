import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Encryption Service Class
 * 
 * Purpose:
 * - Password hashing and verification using bcrypt (for user passwords)
 * - Data encryption/decryption for sensitive information (AES-256-GCM)
 * - Secure token generation for OTPs and referral codes
 * - Cryptographic utilities for the yield cycle platform
 * 
 * Hashing Strategy:
 * - bcrypt: Used ONLY for user passwords (slow, salted, secure against rainbow tables)
 * - No crypto hashing: We don't need SHA-256 for passwords, bcrypt is superior
 * 
 * Security Features:
 * - bcrypt with 12 salt rounds for password hashing
 * - AES-256-GCM encryption for data protection
 * - Cryptographically secure random token generation
 * - Input validation and error handling
 */
export class EncryptionUtils {
  private static readonly SALT_ROUNDS = 12;
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly REFERRAL_CODE_LENGTH = 8;

  /**
   * Hash a password using bcrypt with 12 salt rounds
   * 
   * @param password - Plain text password to hash
   * @returns Promise<string> - Hashed password
   * @throws Error if password is empty or invalid
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.trim().length === 0) {
      throw new Error('Password cannot be empty');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Password hashing failed: ${errorMessage}`);
    }
  }

  /**
   * Verify a password against its hash
   * 
   * @param password - Plain text password to verify
   * @param hash - Hashed password to compare against
   * @returns Promise<boolean> - True if password matches, false otherwise
   * @throws Error if inputs are invalid
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      throw new Error('Password and hash are required');
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Password comparison failed: ${errorMessage}`);
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * 
   * @param data - Data to encrypt
   * @param secretKey - Encryption key (32 bytes for AES-256)
   * @returns EncryptedData - Object containing encrypted data, IV, and auth tag
   * @throws Error if encryption fails
   */
  static encrypt(data: string, secretKey?: string): EncryptedData {
    try {
      // Use provided key or generate from environment
      const key = secretKey ? Buffer.from(secretKey, 'hex') : this.getEncryptionKey();
      
      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher using createCipheriv for GCM mode
      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * 
   * @param encryptedData - Object containing encrypted data, IV, and auth tag
   * @param secretKey - Decryption key (must match encryption key)
   * @returns string - Decrypted data
   * @throws Error if decryption fails
   */
  static decrypt(encryptedData: EncryptedData, secretKey?: string): string {
    try {
      // Use provided key or generate from environment
      const key = secretKey ? Buffer.from(secretKey, 'hex') : this.getEncryptionKey();
      
      // Convert hex strings back to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      // Create decipher using createDecipheriv for GCM mode
      const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Generate a cryptographically secure random token
   * 
   * @param length - Length of token to generate (default: 32)
   * @returns string - Hex-encoded random token
   */
  static generateSecureToken(length: number = 32): string {
    const bytes = crypto.randomBytes(length);
    return bytes.toString('hex');
  }

  /**
   * Generate a 6-digit OTP for email verification
   * 
   * @returns string - 6-digit OTP
   */
  static generateOTP(): string {
    // Generate random number between 100000 and 999999
    const min = 100000;
    const max = 999999;
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    const otp = min + (randomNumber % (max - min + 1));
    
    return otp.toString();
  }

  /**
   * Generate a unique 8-character referral code
   * 
   * @returns string - 8-character alphanumeric referral code
   */
  static generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < this.REFERRAL_CODE_LENGTH; i++) {
      const randomBytes = crypto.randomBytes(1);
      const randomIndex = randomBytes[0] % chars.length;
      result += chars[randomIndex];
    }
    
    return result;
  }



  /**
   * Validate if a string is a valid hex-encoded key
   * 
   * @param key - Key to validate
   * @returns boolean - True if valid hex key
   */
  static isValidHexKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }
    
    // Check if it's a valid hex string with correct length for AES-256
    const hexRegex = /^[0-9a-fA-F]{64}$/; // 32 bytes = 64 hex characters
    return hexRegex.test(key);
  }

  /**
   * Get encryption key from environment or generate a secure one
   * 
   * @returns Buffer - 32-byte encryption key
   * @throws Error if no encryption key is configured
   */
  private static getEncryptionKey(): Buffer {
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (envKey && this.isValidHexKey(envKey)) {
      return Buffer.from(envKey, 'hex');
    }
    
    // Fallback: generate from JWT secret if available
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      return crypto.createHash('sha256').update(jwtSecret).digest();
    }
    
    throw new Error('No encryption key configured. Set ENCRYPTION_KEY environment variable.');
  }
}

/**
 * Interface for encrypted data structure
 */
export interface EncryptedData {
  encrypted: string; // Hex-encoded encrypted data
  iv: string; // Hex-encoded initialization vector
  authTag: string; // Hex-encoded authentication tag
}

/**
 * Utility functions for backward compatibility
 */
export const hashPassword = (password: string) => EncryptionUtils.hashPassword(password);
export const comparePassword = (password: string, hash: string) => EncryptionUtils.comparePassword(password, hash);
export const encrypt = (data: string, key?: string) => EncryptionUtils.encrypt(data, key);
export const decrypt = (encryptedData: EncryptedData, key?: string) => EncryptionUtils.decrypt(encryptedData, key);
export const generateOTP = () => EncryptionUtils.generateOTP();
export const generateReferralCode = () => EncryptionUtils.generateReferralCode();
