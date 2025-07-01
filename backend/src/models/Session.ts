/**
 * Session Entity Model
 * 
 * 🔐 JWT + Session Hybrid Authentication System
 * 
 * PURPOSE:
 * This model implements a secure hybrid authentication approach that combines
 * the performance benefits of JWT tokens with the security control of database sessions.
 * Perfect for financial platforms that need immediate session revocation capabilities.
 * 
 * HOW IT WORKS WITH OTHER COMPONENTS:
 * 1. Session.createSession() → Uses JWTUtils to generate real JWT tokens (not random strings)
 * 2. Auth decorators → Use JWTUtils.verifyAccessToken() + Session DB check for validation
 * 3. Security control → Sessions can be revoked immediately, making JWTs invalid
 * 
 * INTEGRATION FLOW:
 * Login → Session.createSession() → JWT tokens generated → Stored in DB
 * API Request → JWT validated + Session DB checked → Access granted/denied
 * Logout → Session.revoke() → JWT becomes invalid immediately
 * 
 * SECURITY BENEFITS:
 * ✅ Performance: JWT validation is fast (no DB hit for signature check)
 * ✅ Security: Session DB check allows immediate revocation
 * ✅ Device Management: Track and manage user sessions across devices
 * ✅ Audit Trail: Complete session lifecycle tracking
 * ✅ Financial Grade: Appropriate security for platforms handling user funds
 * 
 * SYNC WITH AUTH DECORATORS:
 * - Session generates JWTs with sessionId reference
 * - Auth decorators validate JWT + check session.isActive()
 * - Both use SessionStatus enum for consistent state management
 * 
 * @see JWTUtils - For JWT token operations
 * @see auth-decorators.ts - For request validation using this session
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { SessionStatus, UserRole } from '../types/enums';
import { TimeUtils } from '../utils/helpers';
import { JWTUtils } from '../utils/jwt';

/**
 * Session Domain Entity
 * 
 * Represents an authenticated user session with JWT tokens.
 * Integrates with JWTUtils for token generation and auth decorators for validation.
 * 
 * KEY FEATURES:
 * - Generates real JWT access/refresh tokens (not random strings)
 * - Tracks session lifecycle and device information
 * - Supports immediate revocation for security
 * - Compatible with auth decorator validation flow
 */
export class Session extends BaseModel {
  public readonly id: string;
  private _userId: string;
  private _accessToken: string;
  private _refreshToken: string;
  private _status: SessionStatus;
  private _expiresAt: Date;
  private _refreshExpiresAt: Date;
  private _ipAddress?: string;
  private _userAgent?: string;
  private _deviceInfo?: string;
  private _lastAccessedAt: Date;
  private _isRevoked: boolean;
  private _revokedAt?: Date;
  private _revokedReason?: string;

  constructor(
    userId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
    refreshExpiresAt: Date,
    status: SessionStatus = SessionStatus.ACTIVE,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string,
    lastAccessedAt?: Date,
    isRevoked: boolean = false,
    revokedAt?: Date,
    revokedReason?: string,
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.id = id || this.generateId();
    this._userId = userId;
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._status = status;
    this._expiresAt = expiresAt;
    this._refreshExpiresAt = refreshExpiresAt;
    this._ipAddress = ipAddress;
    this._userAgent = userAgent;
    this._deviceInfo = deviceInfo;
    this._lastAccessedAt = lastAccessedAt || new Date();
    this._isRevoked = isRevoked;
    this._revokedAt = revokedAt;
    this._revokedReason = revokedReason;

    this.validate();
  }

  // Getters
  get userId(): string { return this._userId; }
  get accessToken(): string { return this._accessToken; }
  get refreshToken(): string { return this._refreshToken; }
  get status(): SessionStatus { return this._status; }
  get expiresAt(): Date { return this._expiresAt; }
  get refreshExpiresAt(): Date { return this._refreshExpiresAt; }
  get ipAddress(): string | undefined { return this._ipAddress; }
  get userAgent(): string | undefined { return this._userAgent; }
  get deviceInfo(): string | undefined { return this._deviceInfo; }
  get lastAccessedAt(): Date { return this._lastAccessedAt; }
  get sessionIsRevoked(): boolean { return this._isRevoked; }
  get revokedAt(): Date | undefined { return this._revokedAt; }
  get revokedReason(): string | undefined { return this._revokedReason; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): Session {
    return new Session(
      data.userId,
      data.accessToken,
      data.refreshToken,
      new Date(data.expiresAt),
      new Date(data.refreshExpiresAt),
      data.status || SessionStatus.ACTIVE,
      data.ipAddress,
      data.userAgent,
      data.deviceInfo,
      data.lastAccessedAt ? new Date(data.lastAccessedAt) : new Date(),
      data.isRevoked || false,
      data.revokedAt ? new Date(data.revokedAt) : undefined,
      data.revokedReason,
      data.sessionId || data.id,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * 🏭 Factory Method: Create New Session with JWT Tokens
   * 
   * CRITICAL: This is the main integration point with JWTUtils!
   * Creates a new session with real JWT tokens (access + refresh).
   * 
   * INTEGRATION FLOW:
   * 1. Generate unique session ID
   * 2. Use JWTUtils.createTokenPair() to generate JWT tokens with sessionId reference
   * 3. Create Session instance with JWT tokens
   * 4. Auth decorators will later validate these JWTs + check this session in DB
   * 
   * USAGE (in AuthController):
   * ```typescript
   * const session = Session.createSession(user.id, user.email, user.role, req.ip, req.userAgent);
   * await sessionRepository.save(session);
   * return { accessToken: session.accessToken, refreshToken: session.refreshToken };
   * ```
   * 
   * @param userId - User ID (goes into JWT payload)
   * @param email - User email (goes into JWT payload)  
   * @param role - User role (goes into JWT payload)
   * @param accessTokenTTL - Access token expiry in seconds (default: 15 minutes)
   * @param refreshTokenTTL - Refresh token expiry in seconds (default: 7 days)
   * @param ipAddress - Client IP for security tracking
   * @param userAgent - Client user agent for device identification
   * @param deviceInfo - Additional device information
   * @returns Session instance with JWT tokens ready for storage
   */
  static createSession(
    userId: string,
    email: string,
    role: UserRole,
    accessTokenTTL: number = 15 * 60, // 15 minutes
    refreshTokenTTL: number = 7 * 24 * 60 * 60, // 7 days
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string
  ): Session {
    const now = new Date();
    const sessionId = Session.prototype.generateId();
    
    // 🔗 INTEGRATION: Generate proper JWT tokens using JWT utility
    // The sessionId is embedded in the JWT payload for later validation
    const { accessToken, refreshToken } = JWTUtils.createTokenPair(userId, email, role, sessionId);
    
    const expiresAt = new Date(now.getTime() + accessTokenTTL * 1000);
    const refreshExpiresAt = new Date(now.getTime() + refreshTokenTTL * 1000);

    return new Session(
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      refreshExpiresAt,
      SessionStatus.ACTIVE, // Active session
      ipAddress,
      userAgent,
      deviceInfo,
      undefined, // lastAccessedAt (defaults to now)
      false, // isRevoked
      undefined, // revokedAt
      undefined, // revokedReason
      sessionId // Pass the generated session ID
    );
  }

  /**
   * Updates last accessed timestamp
   */
  updateLastAccess(): void {
    this._lastAccessedAt = new Date();
    this.touch();
  }

  /**
   * 🔄 Refresh Access Token - JWT Integration
   * 
   * Generates a new JWT access token while keeping the same refresh token.
   * This method integrates with JWTUtils to ensure tokens remain valid.
   * 
   * INTEGRATION FLOW:
   * 1. Validate refresh token is still valid
   * 2. Use JWTUtils.generateAccessToken() to create new JWT
   * 3. Update session expiry and last access time
   * 4. Auth decorators will validate the new JWT + this session
   * 
   * USAGE (in AuthController):
   * ```typescript
   * session.refreshAccessToken(user.email, user.role);
   * await sessionRepository.save(session);
   * return { accessToken: session.accessToken };
   * ```
   * 
   * @param userEmail - User email for JWT payload
   * @param userRole - User role for JWT payload  
   * @param newTTL - New access token expiry in seconds (default: 15 minutes)
   * @throws ModelValidationError if refresh token expired or session revoked
   */
  refreshAccessToken(userEmail: string, userRole: UserRole, newTTL: number = 15 * 60): void {
    if (this.isRefreshExpired()) {
      throw new ModelValidationError('Cannot refresh expired session', 'refreshToken');
    }

    if (this._isRevoked) {
      throw new ModelValidationError('Cannot refresh revoked session', 'status');
    }

    // 🔗 INTEGRATION: Generate new JWT access token with same sessionId
    this._accessToken = JWTUtils.generateAccessToken(this._userId, userEmail, userRole, this.id, newTTL);
    this._expiresAt = new Date(Date.now() + newTTL * 1000);
    this._lastAccessedAt = new Date();
    this.touch();
  }

  /**
   * Revokes the session
   */
  revoke(reason: string = 'User logout'): void {
    if (this._isRevoked) {
      throw new ModelValidationError('Session is already revoked', 'status');
    }

    this._status = SessionStatus.REVOKED;
    this._isRevoked = true;
    this._revokedAt = new Date();
    this._revokedReason = reason;
    this.touch();
  }

  /**
   * Expires the session
   */
  expire(): void {
    this._status = SessionStatus.EXPIRED;
    this.touch();
  }

  /**
   * Updates device information
   */
  updateDeviceInfo(ipAddress?: string, userAgent?: string, deviceInfo?: string): void {
    if (ipAddress) this._ipAddress = ipAddress;
    if (userAgent) this._userAgent = userAgent;
    if (deviceInfo) this._deviceInfo = deviceInfo;
    this._lastAccessedAt = new Date();
    this.touch();
  }

  /**
   * 🔍 Domain Query Methods - Auth Decorator Integration
   * 
   * These methods are used by auth decorators to validate session state.
   * Critical for the JWT + Session hybrid security model.
   */

  /**
   * Check if session is active and can be used for authentication
   * 
   * USED BY AUTH DECORATORS: This is called during request validation
   * to ensure the session referenced in the JWT is still valid.
   * 
   * @returns true if session is active, not expired, and not revoked
   */
  isActive(): boolean { 
    return this._status === SessionStatus.ACTIVE && !this.isExpired() && !this._isRevoked; 
  }

  /**
   * Validate if access token is still valid (JWT format and not expired)
   */
  isAccessTokenValid(): boolean {
    return !JWTUtils.isTokenExpired(this._accessToken);
  }

  /**
   * Validate if refresh token is still valid (JWT format and not expired)
   */
  isRefreshTokenValid(): boolean {
    return !JWTUtils.isTokenExpired(this._refreshToken);
  }
  
  isExpired(): boolean { 
    return new Date() > this._expiresAt; 
  }
  
  isRefreshExpired(): boolean { 
    return new Date() > this._refreshExpiresAt; 
  }
  
  isRevoked(): boolean { 
    return this._isRevoked; 
  }
  
  isForUser(userId: string): boolean { 
    return this._userId === userId; 
  }
  
  canRefresh(): boolean {
    return !this.isRefreshExpired() && !this._isRevoked && this._status !== SessionStatus.REVOKED;
  }

  canAccess(): boolean {
    return this.isActive();
  }

  hasDeviceInfo(): boolean {
    return !!(this._ipAddress || this._userAgent || this._deviceInfo);
  }

  /**
   * Business logic methods
   */
  getTimeUntilExpiry(): number {
    const now = new Date();
    return Math.max(0, Math.floor((this._expiresAt.getTime() - now.getTime()) / 1000));
  }

  getSessionDuration(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this.createdAt.getTime()) / 1000);
  }

  getIdleTime(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this._lastAccessedAt.getTime()) / 1000);
  }



  getDeviceDisplayName(): string {
    if (this._deviceInfo) return this._deviceInfo;
    if (this._userAgent) {
      const ua = this._userAgent.toLowerCase();
      if (ua.includes('mobile')) return 'Mobile Device';
      if (ua.includes('tablet')) return 'Tablet';
      if (ua.includes('chrome')) return 'Chrome Browser';
      if (ua.includes('firefox')) return 'Firefox Browser';
      if (ua.includes('safari')) return 'Safari Browser';
      return 'Web Browser';
    }
    return 'Unknown Device';
  }

  maskAccessToken(): string {
    if (this._accessToken.length <= 8) return '*'.repeat(this._accessToken.length);
    return this._accessToken.substring(0, 4) + '...' + this._accessToken.substring(this._accessToken.length - 4);
  }

  maskRefreshToken(): string {
    if (this._refreshToken.length <= 8) return '*'.repeat(this._refreshToken.length);
    return this._refreshToken.substring(0, 4) + '...' + this._refreshToken.substring(this._refreshToken.length - 4);
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    if (!this._userId || typeof this._userId !== 'string') {
      throw new ModelValidationError('User ID is required', 'userId');
    }

    if (!this._accessToken || typeof this._accessToken !== 'string') {
      throw new ModelValidationError('Access token is required', 'accessToken');
    }

    if (!this._refreshToken || typeof this._refreshToken !== 'string') {
      throw new ModelValidationError('Refresh token is required', 'refreshToken');
    }

    if (!Object.values(SessionStatus).includes(this._status)) {
      throw new ModelValidationError('Invalid session status', 'status');
    }

    if (this._refreshExpiresAt <= this._expiresAt) {
      throw new ModelValidationError('Refresh token must expire after access token', 'refreshExpiresAt');
    }

    if (this._isRevoked && !this._revokedAt) {
      throw new ModelValidationError('Revoked sessions must have revocation date', 'revokedAt');
    }
  }

  /**
   * DynamoDB serialization with TTL
   */
  toDynamoItem(): any {
    return {
      ...this.toJSON(),
      TTL: TimeUtils.toUnixTimestamp(this._refreshExpiresAt),
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Primary JSON serialization
   */
  toJSON(): any {
    return {
      sessionId: this.id,
      userId: this._userId,
      status: this._status,
      expiresAt: this._expiresAt.toISOString(),
      refreshExpiresAt: this._refreshExpiresAt.toISOString(),
      ipAddress: this._ipAddress,
      userAgent: this._userAgent,
      deviceInfo: this._deviceInfo,
      lastAccessedAt: this._lastAccessedAt.toISOString(),
      isRevoked: this._isRevoked,
      revokedAt: this._revokedAt?.toISOString(),
      revokedReason: this._revokedReason,
      timeUntilExpiry: this.getTimeUntilExpiry(),
      sessionDuration: this.getSessionDuration(),
      idleTime: this.getIdleTime(),
      deviceDisplayName: this.getDeviceDisplayName(),
      maskedAccessToken: this.maskAccessToken(),
      maskedRefreshToken: this.maskRefreshToken(),
      isActive: this.isActive(),
      isExpired: this.isExpired(),
      isRefreshExpired: this.isRefreshExpired(),
      canRefresh: this.canRefresh(),
      canAccess: this.canAccess(),
      hasDeviceInfo: this.hasDeviceInfo(),
      ...this.getCommonJSON(),
    };
  }

  /**
   * Secure JSON for authentication responses
   */
  toAuthJSON(): any {
    return {
      sessionId: this.id,
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: this._expiresAt.toISOString(),
      refreshExpiresAt: this._refreshExpiresAt.toISOString(),
      timeUntilExpiry: this.getTimeUntilExpiry(),
    };
  }

  /**
   * Summary JSON for session management
   */
  toSummaryJSON(): any {
    return {
      sessionId: this.id,
      userId: this._userId,
      status: this._status,
      deviceDisplayName: this.getDeviceDisplayName(),
      lastAccessedAt: this._lastAccessedAt.toISOString(),
      isActive: this.isActive(),
      createdAt: this.createdAt.toISOString(),
    };
  }
} 