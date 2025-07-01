/**
 * JWT Utility Functions
 * 
 * 🔐 Core JWT Operations for Session + Auth Decorator Integration
 * 
 * PURPOSE:
 * This utility provides all JWT operations needed for the hybrid authentication system.
 * It works in perfect sync with Session model and auth decorators to provide secure,
 * high-performance authentication for the financial platform.
 * 
 * INTEGRATION ARCHITECTURE:
 * 1. Session.createSession() → JWTUtils.createTokenPair() → Real JWT tokens generated
 * 2. Auth decorators → JWTUtils.verifyAccessToken() → JWT validated + session checked
 * 3. Session.refreshAccessToken() → JWTUtils.generateAccessToken() → New token created
 * 
 * JWT PAYLOAD STRUCTURE:
 * Access Token: { userId, email, role, sessionId, iat, exp, iss, aud }
 * Refresh Token: { sessionId, type: 'refresh', iat, exp, iss, aud }
 * 
 * SECURITY FEATURES:
 * ✅ Proper issuer/audience validation
 * ✅ Session ID embedded for DB validation
 * ✅ Separate access/refresh token secrets
 * ✅ Production-ready error handling
 * ✅ Token introspection utilities
 * 
 * SYNC WITH OTHER COMPONENTS:
 * - Session model: Uses this for token generation
 * - Auth decorators: Use this for token validation
 * - Both components share the same JWT payload structure
 * 
 * @see Session.createSession() - Main token generation entry point
 * @see authenticate() in auth-decorators.ts - Main validation entry point
 */

import * as jwt from 'jsonwebtoken';
import { UserRole } from '../types/enums';
import { EnvUtils } from './helpers';

/**
 * JWT Payload Structure
 * 
 * 🔗 CRITICAL: This interface MUST match what auth decorators expect!
 * Any changes here must be synchronized with the authenticate() function.
 */
export interface JWTPayload {
  userId: string;      // User ID - used for session lookup
  email: string;       // User email - for audit and display
  role: UserRole;      // User role - for authorization checks
  sessionId: string;   // Session ID - CRITICAL for DB validation
  iat: number;         // Issued at timestamp
  exp: number;         // Expiration timestamp  
  iss: string;         // Issuer - validates token origin
  aud: string;         // Audience - validates token intended use
}

/**
 * Refresh Token Payload
 */
export interface RefreshTokenPayload {
  sessionId: string;
  type: 'refresh';
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * JWT Configuration
 */
const JWT_CONFIG = {
  ACCESS_TOKEN_TTL: 15 * 60, // 15 minutes
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60, // 7 days
  ISSUER: 'yield-cycle-api',
  AUDIENCE: 'yield-cycle-client',
  ALGORITHM: 'HS256' as const
};

/**
 * JWT utility class
 */
export class JWTUtils {
  private static getSecret(): string {
    return EnvUtils.getRequired('JWT_SECRET');
  }

  private static getRefreshSecret(): string {
    return EnvUtils.get('JWT_REFRESH_SECRET') || this.getSecret();
  }

  /**
   * Generate access token (JWT)
   * 
   * @param userId - User ID
   * @param email - User email
   * @param role - User role
   * @param sessionId - Session ID
   * @param expiresIn - Token expiry (default: 15 minutes)
   * @returns JWT access token
   */
  static generateAccessToken(
    userId: string,
    email: string,
    role: UserRole,
    sessionId: string,
    expiresIn: number = JWT_CONFIG.ACCESS_TOKEN_TTL
  ): string {
    const payload = {
      userId,
      email,
      role,
      sessionId,
      iss: JWT_CONFIG.ISSUER,
      aud: JWT_CONFIG.AUDIENCE
    };

    return jwt.sign(payload, this.getSecret(), {
      expiresIn,
      algorithm: JWT_CONFIG.ALGORITHM
    });
  }

  /**
   * Generate refresh token (JWT)
   * 
   * @param sessionId - Session ID
   * @param expiresIn - Token expiry (default: 7 days)
   * @returns JWT refresh token
   */
  static generateRefreshToken(
    sessionId: string,
    expiresIn: number = JWT_CONFIG.REFRESH_TOKEN_TTL
  ): string {
    const payload = {
      sessionId,
      type: 'refresh',
      iss: JWT_CONFIG.ISSUER,
      aud: JWT_CONFIG.AUDIENCE
    };

    return jwt.sign(payload, this.getRefreshSecret(), {
      expiresIn,
      algorithm: JWT_CONFIG.ALGORITHM
    });
  }

  /**
   * 🔍 Verify Access Token - Auth Decorator Integration
   * 
   * CRITICAL: This is called by authenticate() function in auth decorators!
   * Validates JWT signature, expiry, issuer, and audience.
   * 
   * INTEGRATION FLOW:
   * 1. Auth decorator extracts token from Authorization header
   * 2. Calls this method to validate JWT
   * 3. If valid, extracts sessionId from payload
   * 4. Looks up session in database for additional validation
   * 5. If both JWT and session are valid, request proceeds
   * 
   * @param token - JWT access token from Authorization header
   * @returns JWTPayload with sessionId for DB lookup, or null if invalid
   */
  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.getSecret(), {
        algorithms: [JWT_CONFIG.ALGORITHM],
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token
   * 
   * @param token - Refresh token to verify
   * @returns Decoded payload or null if invalid
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.getRefreshSecret(), {
        algorithms: [JWT_CONFIG.ALGORITHM],
        issuer: JWT_CONFIG.ISSUER,
        audience: JWT_CONFIG.AUDIENCE
      }) as RefreshTokenPayload;

      // Ensure it's a refresh token
      if (decoded.type !== 'refresh') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode token without verification (for inspection)
   * 
   * @param token - JWT token to decode
   * @returns Decoded payload or null if malformed
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiry time
   * 
   * @param token - JWT token
   * @returns Expiry date or null if invalid
   */
  static getTokenExpiry(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   * 
   * @param token - JWT token
   * @returns True if expired
   */
  static isTokenExpired(token: string): boolean {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return true;
    return new Date() > expiry;
  }

  /**
   * Get time until token expires (in seconds)
   * 
   * @param token - JWT token
   * @returns Seconds until expiry, 0 if expired
   */
  static getTimeUntilExpiry(token: string): number {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return 0;
    
    const now = new Date();
    const diff = Math.floor((expiry.getTime() - now.getTime()) / 1000);
    return Math.max(0, diff);
  }

  /**
   * Extract session ID from token (without verification)
   * 
   * @param token - JWT token
   * @returns Session ID or null
   */
  static extractSessionId(token: string): string | null {
    const decoded = this.decodeToken(token);
    return decoded?.sessionId || null;
  }

  /**
   * Extract user ID from token (without verification)
   * 
   * @param token - JWT token
   * @returns User ID or null
   */
  static extractUserId(token: string): string | null {
    const decoded = this.decodeToken(token);
    return decoded?.userId || null;
  }

  /**
   * 🏭 Create Token Pair - Main Integration Point
   * 
   * CRITICAL: This is the main method used by Session.createSession()!
   * Creates both access and refresh tokens with proper sessionId embedding.
   * 
   * INTEGRATION FLOW:
   * 1. Session.createSession() calls this method
   * 2. Access token contains: userId, email, role, sessionId
   * 3. Refresh token contains: sessionId, type='refresh'
   * 4. Both tokens are stored in Session model
   * 5. Auth decorators later validate these tokens + check session DB
   * 
   * @param userId - User ID (embedded in access token for quick access)
   * @param email - User email (embedded in access token for audit)
   * @param role - User role (embedded in access token for authorization)
   * @param sessionId - Session ID (embedded in BOTH tokens for DB validation)
   * @returns Object with both JWT tokens and expiry info
   */
  static createTokenPair(
    userId: string,
    email: string,
    role: UserRole,
    sessionId: string
  ): { accessToken: string; refreshToken: string; expiresIn: number } {
    const accessToken = this.generateAccessToken(userId, email, role, sessionId);
    const refreshToken = this.generateRefreshToken(sessionId);

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_CONFIG.ACCESS_TOKEN_TTL
    };
  }

  /**
   * Get JWT configuration
   * 
   * @returns JWT configuration object
   */
  static getConfig() {
    return { ...JWT_CONFIG };
  }
} 