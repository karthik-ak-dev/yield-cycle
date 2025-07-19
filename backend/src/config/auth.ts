import * as jwt from 'jsonwebtoken';

export class AuthConfig {
  // JWT Configuration
  public static readonly JWT_CONFIG = {
    SECRET: process.env.JWT_SECRET || 'yield-cycle-secret-key-change-in-production',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    ISSUER: 'yield-cycle-platform',
    ALGORITHM: 'HS256' as jwt.Algorithm,
  };

  // Password Configuration
  public static readonly PASSWORD_CONFIG = {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: false,
    BCRYPT_ROUNDS: 12,
  };

  // Session Configuration
  public static readonly SESSION_CONFIG = {
    MAX_CONCURRENT_SESSIONS: 3,
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
  };

  // Generate JWT token
  public static generateToken(payload: any, expiresIn?: string): string {
    return jwt.sign(payload, AuthConfig.JWT_CONFIG.SECRET, {
      expiresIn: expiresIn || AuthConfig.JWT_CONFIG.EXPIRES_IN,
      issuer: AuthConfig.JWT_CONFIG.ISSUER,
      algorithm: AuthConfig.JWT_CONFIG.ALGORITHM,
    } as jwt.SignOptions);
  }

  // Verify JWT token
  public static verifyToken(token: string): any {
    try {
      return jwt.verify(token, AuthConfig.JWT_CONFIG.SECRET, {
        issuer: AuthConfig.JWT_CONFIG.ISSUER,
        algorithms: [AuthConfig.JWT_CONFIG.ALGORITHM],
      });
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Generate refresh token
  public static generateRefreshToken(payload: any): string {
    return jwt.sign(payload, AuthConfig.JWT_CONFIG.SECRET, {
      expiresIn: AuthConfig.JWT_CONFIG.REFRESH_EXPIRES_IN,
      issuer: AuthConfig.JWT_CONFIG.ISSUER,
      algorithm: AuthConfig.JWT_CONFIG.ALGORITHM,
    } as jwt.SignOptions);
  }

  // Validate password strength
  public static validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < AuthConfig.PASSWORD_CONFIG.MIN_LENGTH) {
      errors.push(`Password must be at least ${AuthConfig.PASSWORD_CONFIG.MIN_LENGTH} characters long`);
    }

    if (AuthConfig.PASSWORD_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (AuthConfig.PASSWORD_CONFIG.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (AuthConfig.PASSWORD_CONFIG.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (AuthConfig.PASSWORD_CONFIG.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
} 