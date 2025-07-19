// Note: bcryptjs import commented due to previous import issues
// import bcrypt from 'bcryptjs';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Password hashing configuration (commented until bcrypt is implemented)
// const SALT_ROUNDS = 12;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

// Hash password using bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  try {
    // TODO: Uncomment when bcrypt import is fixed
    // return await bcrypt.hash(password, SALT_ROUNDS);
    
    // Temporary fallback using crypto (not recommended for production)
    return createHash('sha256').update(password + 'salt').digest('hex');
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

// Verify password against hash
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    // TODO: Uncomment when bcrypt import is fixed
    // return await bcrypt.compare(password, hash);
    
    // Temporary fallback using crypto
    const hashedInput = createHash('sha256').update(password + 'salt').digest('hex');
    return hashedInput === hash;
  } catch (error) {
    throw new Error('Password verification failed');
  }
};

// Generate secure random string
export const generateSecureRandom = (length: number = 32): string => {
  return randomBytes(length).toString('hex');
};

// Generate referral code
export const generateReferralCode = (length: number = 8): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  
  return result;
};

// Encrypt sensitive data (like private keys)
export const encryptData = (data: string): { encrypted: string; iv: string; tag: string } => {
  try {
    const iv = randomBytes(16);
    const key = createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    throw new Error('Data encryption failed');
  }
};

// Decrypt sensitive data
export const decryptData = (encryptedData: { encrypted: string; iv: string; tag: string }): string => {
  try {
    const key = createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(encryptedData.iv, 'hex'));
    
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Data decryption failed');
  }
};

// Hash data for integrity checking
export const hashData = (data: string): string => {
  return createHash('sha256').update(data).digest('hex');
};

// Generate UUID-like string
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Validate password strength
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}; 