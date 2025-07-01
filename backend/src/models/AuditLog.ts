/**
 * AuditLog Entity Model
 * 
 * Essential audit trail system for Yield Cycle platform regulatory compliance.
 * Tracks critical user actions, financial transactions, and admin operations
 * for legal requirements and dispute resolution.
 * 
 * Business Context:
 * - Financial platform compliance (USDT deposits/withdrawals)
 * - MLM commission distribution transparency
 * - User action tracking for dispute resolution
 * - Admin action logging for security
 * - Basic audit trail: who, what, when, where
 * 
 * Phase 1 Focus:
 * - Essential events only: LOGIN, DEPOSIT, COMMISSION, ADMIN_ACTION
 * - Simple structure without complex risk scoring
 * - Regulatory compliance without over-engineering
 */

import { BaseModel, ModelValidationError } from './BaseModel';
import { AuditEventType } from '../types/enums';
import { ValidationUtils } from '../utils/calculations';

/**
 * AuditLog domain entity for compliance and transparency
 */
export class AuditLog extends BaseModel {
  public readonly auditId: string;
  private _userId?: string;
  private _eventType: AuditEventType;
  private _action: string;
  private _resourceType: string;
  private _resourceId?: string;
  private _details?: Record<string, any>;
  private _ipAddress?: string;

  constructor(
    eventType: AuditEventType,
    action: string,
    resourceType: string,
    userId?: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    auditId?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(createdAt, updatedAt);

    this.auditId = auditId || this.generateId();
    this._userId = userId;
    this._eventType = eventType;
    this._action = action;
    this._resourceType = resourceType;
    this._resourceId = resourceId;
    this._details = details;
    this._ipAddress = ipAddress;

    this.validate();
  }

  // Getters
  get userId(): string | undefined { return this._userId; }
  get eventType(): AuditEventType { return this._eventType; }
  get action(): string { return this._action; }
  get resourceType(): string { return this._resourceType; }
  get resourceId(): string | undefined { return this._resourceId; }
  get details(): Record<string, any> | undefined { return this._details; }
  get ipAddress(): string | undefined { return this._ipAddress; }

  /**
   * Factory method to reconstruct from persistence
   */
  static fromPersistence(data: any): AuditLog {
    return new AuditLog(
      data.eventType,
      data.action,
      data.resourceType,
      data.userId,
      data.resourceId,
      data.details,
      data.ipAddress,
      data.auditId,
      new Date(data.CreatedAt || data.createdAt),
      new Date(data.UpdatedAt || data.updatedAt)
    );
  }

  /**
   * Factory method to create login audit log
   */
  static createLoginAudit(
    userId: string,
    success: boolean,
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.LOGIN,
      success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      'User',
      userId,
      userId,
      { 
        success,
        timestamp: new Date().toISOString()
      },
      ipAddress
    );
  }

  /**
   * Factory method to create logout audit log
   */
  static createLogoutAudit(
    userId: string,
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.LOGOUT,
      'LOGOUT',
      'User',
      userId,
      userId,
      { 
        timestamp: new Date().toISOString()
      },
      ipAddress
    );
  }

  /**
   * Factory method to create deposit audit log
   */
  static createDepositAudit(
    userId: string,
    depositId: string,
    amount: number,
    txHash: string,
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.DEPOSIT,
      'DEPOSIT_CREATED',
      'Deposit',
      userId,
      depositId,
      { 
        amount,
        txHash,
        currency: 'USDT'
      },
      ipAddress
    );
  }

  /**
   * Factory method to create commission audit log
   */
  static createCommissionAudit(
    userId: string,
    commissionId: string,
    amount: number,
    level: number,
    sourceDepositId: string,
    sourceUserId: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.COMMISSION,
      'COMMISSION_CREATED',
      'Commission',
      userId,
      commissionId,
      { 
        amount,
        level,
        sourceDepositId,
        sourceUserId,
        commissionRate: this.getCommissionRateForLevel(level)
      }
    );
  }

  /**
   * Factory method to create withdrawal audit log
   */
  static createWithdrawalAudit(
    userId: string,
    withdrawalId: string,
    amount: number,
    walletAddress: string,
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.WITHDRAWAL,
      'WITHDRAWAL_REQUESTED',
      'Withdrawal',
      userId,
      withdrawalId,
      { 
        amount,
        walletAddress,
        currency: 'USDT'
      },
      ipAddress
    );
  }

  /**
   * Factory method to create profile update audit log
   */
  static createProfileUpdateAudit(
    userId: string,
    updatedFields: string[],
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.PROFILE_UPDATE,
      'PROFILE_UPDATED',
      'User',
      userId,
      userId,
      { 
        updatedFields,
        fieldCount: updatedFields.length
      },
      ipAddress
    );
  }

  /**
   * Factory method to create admin action audit log
   */
  static createAdminAudit(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    targetUserId?: string,
    details?: Record<string, any>,
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.ADMIN_ACTION,
      action,
      resourceType,
      adminUserId,
      resourceId,
      { 
        ...details,
        targetUserId,
        isAdminAction: true
      },
      ipAddress
    );
  }

  /**
   * Factory method to create security event audit log
   */
  static createSecurityAudit(
    userId: string | undefined,
    action: string,
    details: Record<string, any>,
    ipAddress?: string
  ): AuditLog {
    return new AuditLog(
      AuditEventType.SECURITY_EVENT,
      action,
      'Security',
      userId,
      undefined,
      details,
      ipAddress
    );
  }

  /**
   * Helper method to get commission rate for level
   */
  private static getCommissionRateForLevel(level: number): number {
    const rates = [0.10, 0.05, 0.03, 0.01, 0.01]; // 10%, 5%, 3%, 1%, 1%
    return rates[level - 1] || 0;
  }

  /**
   * Domain query methods
   */
  isForUser(userId: string): boolean { 
    return this._userId === userId; 
  }

  isForResource(resourceType: string, resourceId?: string): boolean {
    return this._resourceType === resourceType && 
           (!resourceId || this._resourceId === resourceId);
  }
  
  isLoginEvent(): boolean { 
    return this._eventType === AuditEventType.LOGIN; 
  }

  isLogoutEvent(): boolean { 
    return this._eventType === AuditEventType.LOGOUT; 
  }

  isDepositEvent(): boolean { 
    return this._eventType === AuditEventType.DEPOSIT; 
  }

  isCommissionEvent(): boolean { 
    return this._eventType === AuditEventType.COMMISSION; 
  }

  isWithdrawalEvent(): boolean { 
    return this._eventType === AuditEventType.WITHDRAWAL; 
  }

  isProfileUpdateEvent(): boolean { 
    return this._eventType === AuditEventType.PROFILE_UPDATE; 
  }

  isAdminEvent(): boolean { 
    return this._eventType === AuditEventType.ADMIN_ACTION; 
  }

  isSecurityEvent(): boolean { 
    return this._eventType === AuditEventType.SECURITY_EVENT; 
  }
  
  hasDetails(): boolean { 
    return !!(this._details && Object.keys(this._details).length > 0); 
  }

  hasIpAddress(): boolean { 
    return !!this._ipAddress; 
  }

  isSuccessfulAction(): boolean {
    return this._action.includes('SUCCESS') || 
           !this._action.includes('FAILED') && !this._action.includes('ERROR');
  }

  isFailedAction(): boolean {
    return this._action.includes('FAILED') || this._action.includes('ERROR');
  }

  /**
   * Business logic methods
   */
  getEventTypeDisplayName(): string {
    switch (this._eventType) {
      case AuditEventType.LOGIN: return 'User Login';
      case AuditEventType.LOGOUT: return 'User Logout';
      case AuditEventType.DEPOSIT: return 'Deposit Transaction';
      case AuditEventType.COMMISSION: return 'Commission Distribution';
      case AuditEventType.WITHDRAWAL: return 'Withdrawal Request';
      case AuditEventType.PROFILE_UPDATE: return 'Profile Update';
      case AuditEventType.ADMIN_ACTION: return 'Admin Action';
      case AuditEventType.SECURITY_EVENT: return 'Security Event';
      default: return this._eventType;
    }
  }

  getActionDisplayName(): string {
    return this._action.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getAgeInHours(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  getAgeInDays(): number {
    return Math.floor(this.getAgeInHours() / 24);
  }

  getFormattedTimestamp(): string {
    return this.createdAt.toISOString();
  }

  getLocationInfo(): string {
    return this._ipAddress ? `IP: ${this._ipAddress}` : 'Unknown location';
  }

  /**
   * Get summary of audit details
   */
  getDetailsSummary(): string {
    if (!this._details) return 'No details recorded';

    const summaryParts: string[] = [];
    
    if (this._details.amount) {
      summaryParts.push(`Amount: ${this._details.amount} USDT`);
    }
    
    if (this._details.level) {
      summaryParts.push(`Level: ${this._details.level}`);
    }
    
    if (this._details.txHash) {
      summaryParts.push(`TX: ${this._details.txHash.substring(0, 10)}...`);
    }
    
    if (this._details.updatedFields) {
      summaryParts.push(`Fields: ${this._details.updatedFields.join(', ')}`);
    }

    return summaryParts.length > 0 ? summaryParts.join(', ') : 'Basic action logged';
  }

  /**
   * Validation implementation using existing utilities
   */
  protected validate(): void {
    if (!Object.values(AuditEventType).includes(this._eventType)) {
      throw new ModelValidationError('Invalid audit event type', 'eventType');
    }

    if (!this._action || typeof this._action !== 'string') {
      throw new ModelValidationError('Action is required', 'action');
    }

    if (!this._resourceType || typeof this._resourceType !== 'string') {
      throw new ModelValidationError('Resource type is required', 'resourceType');
    }

    // Validate action format
    if (!/^[A-Z_]+$/.test(this._action)) {
      throw new ModelValidationError('Action must be uppercase with underscores', 'action');
    }

    // Validate specific event requirements
    if (this._eventType === AuditEventType.COMMISSION && this._details) {
      if (!this._details.level || !ValidationUtils.isPositiveInteger(this._details.level)) {
        throw new ModelValidationError('Commission audit must have valid level', 'details.level');
      }
      
      if (!this._details.amount || !ValidationUtils.isPositiveNumber(this._details.amount)) {
        throw new ModelValidationError('Commission audit must have valid amount', 'details.amount');
      }
    }

    if (this._eventType === AuditEventType.DEPOSIT && this._details) {
      if (!this._details.amount || !ValidationUtils.isPositiveNumber(this._details.amount)) {
        throw new ModelValidationError('Deposit audit must have valid amount', 'details.amount');
      }
      
      if (!this._details.txHash || typeof this._details.txHash !== 'string') {
        throw new ModelValidationError('Deposit audit must have transaction hash', 'details.txHash');
      }
    }
  }

  /**
   * Primary JSON serialization for API responses
   */
  toJSON(): any {
    return {
      // Core fields
      auditId: this.auditId,
      userId: this._userId,
      eventType: this._eventType,
      action: this._action,
      resourceType: this._resourceType,
      resourceId: this._resourceId,
      details: this._details,
      ipAddress: this._ipAddress,
      
      // Display fields
      eventTypeDisplayName: this.getEventTypeDisplayName(),
      actionDisplayName: this.getActionDisplayName(),
      detailsSummary: this.getDetailsSummary(),
      locationInfo: this.getLocationInfo(),
      formattedTimestamp: this.getFormattedTimestamp(),
      
      // Time analytics
      ageInHours: this.getAgeInHours(),
      ageInDays: this.getAgeInDays(),
      
      // Status checks
      hasDetails: this.hasDetails(),
      hasIpAddress: this.hasIpAddress(),
      isSuccessfulAction: this.isSuccessfulAction(),
      isFailedAction: this.isFailedAction(),
      
      // Event type checks
      isLoginEvent: this.isLoginEvent(),
      isLogoutEvent: this.isLogoutEvent(),
      isDepositEvent: this.isDepositEvent(),
      isCommissionEvent: this.isCommissionEvent(),
      isWithdrawalEvent: this.isWithdrawalEvent(),
      isProfileUpdateEvent: this.isProfileUpdateEvent(),
      isAdminEvent: this.isAdminEvent(),
      isSecurityEvent: this.isSecurityEvent(),
      
      ...this.getCommonJSON(),
    };
  }

  /**
   * Summary JSON for audit reports and dashboards
   */
  toSummaryJSON(): any {
    return {
      auditId: this.auditId,
      userId: this._userId,
      eventType: this._eventType,
      action: this._action,
      resourceType: this._resourceType,
      eventTypeDisplayName: this.getEventTypeDisplayName(),
      actionDisplayName: this.getActionDisplayName(),
      detailsSummary: this.getDetailsSummary(),
      isSuccessfulAction: this.isSuccessfulAction(),
      createdAt: this.createdAt.toISOString(),
    };
  }

  /**
   * Security JSON for security monitoring (minimal PII)
   */
  toSecurityJSON(): any {
    return {
      auditId: this.auditId,
      eventType: this._eventType,
      action: this._action,
      resourceType: this._resourceType,
      ipAddress: this._ipAddress,
      isSuccessfulAction: this.isSuccessfulAction(),
      isFailedAction: this.isFailedAction(),
      timestamp: this.createdAt.toISOString(),
    };
  }

  /**
   * DynamoDB serialization
   */
  toDynamoItem(): any {
    return {
      auditId: this.auditId,
      userId: this._userId,
      eventType: this._eventType,
      action: this._action,
      resourceType: this._resourceType,
      resourceId: this._resourceId,
      details: this._details,
      ipAddress: this._ipAddress,
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * EXAMPLE DYNAMODB ITEMS - How AuditLog data is stored
   * 
   * Table: YieldCycle-AuditLogs
   * Primary Key: auditId (String)
   * GSI: userId-CreatedAt-gsi (for user audit history)
   * GSI: eventType-CreatedAt-gsi (for event type queries)
   * GSI: resourceType-resourceId-gsi (for resource tracking)
   * 
   * EXAMPLE 1: User Login Success
   * ============================
   * {
   *   "auditId": "audit-001-login",
   *   "userId": "user-123",
   *   "eventType": "LOGIN",
   *   "action": "LOGIN_SUCCESS",
   *   "resourceType": "User",
   *   "resourceId": "user-123",
   *   "details": {
   *     "success": true,
   *     "timestamp": "2024-03-20T14:30:00.000Z"
   *   },
   *   "ipAddress": "192.168.1.100",
   *   "CreatedAt": "2024-03-20T14:30:00.000Z",
   *   "UpdatedAt": "2024-03-20T14:30:00.000Z"
   * }
   * 
   * EXAMPLE 2: Deposit Creation
   * ==========================
   * {
   *   "auditId": "audit-002-deposit",
   *   "userId": "user-123",
   *   "eventType": "DEPOSIT",
   *   "action": "DEPOSIT_CREATED",
   *   "resourceType": "Deposit",
   *   "resourceId": "dep-456",
   *   "details": {
   *     "amount": 10000.0,
   *     "txHash": "0x1234567890abcdef...",
   *     "currency": "USDT"
   *   },
   *   "ipAddress": "192.168.1.100",
   *   "CreatedAt": "2024-03-20T15:45:00.000Z",
   *   "UpdatedAt": "2024-03-20T15:45:00.000Z"
   * }
   * 
   * EXAMPLE 3: Commission Distribution
   * =================================
   * {
   *   "auditId": "audit-003-commission",
   *   "userId": "user-789",
   *   "eventType": "COMMISSION",
   *   "action": "COMMISSION_CREATED",
   *   "resourceType": "Commission",
   *   "resourceId": "comm-789",
   *   "details": {
   *     "amount": 1000.0,
   *     "level": 1,
   *     "sourceDepositId": "dep-456",
   *     "sourceUserId": "user-123",
   *     "commissionRate": 0.10
   *   },
   *   "ipAddress": null,
   *   "CreatedAt": "2024-03-20T15:46:00.000Z",
   *   "UpdatedAt": "2024-03-20T15:46:00.000Z"
   * }
   * 
   * EXAMPLE 4: Admin Action
   * ======================
   * {
   *   "auditId": "audit-004-admin",
   *   "userId": "admin-001",
   *   "eventType": "ADMIN_ACTION",
   *   "action": "USER_SUSPENDED",
   *   "resourceType": "User",
   *   "resourceId": "user-999",
   *   "details": {
   *     "targetUserId": "user-999",
   *     "reason": "Suspicious activity",
   *     "isAdminAction": true
   *   },
   *   "ipAddress": "10.0.0.1",
   *   "CreatedAt": "2024-03-20T16:00:00.000Z",
   *   "UpdatedAt": "2024-03-20T16:00:00.000Z"
   * }
   * 
   * KEY FEATURES IN DYNAMODB STRUCTURE:
   * ===================================
   * 
   * 1. ESSENTIAL AUDIT TRAIL:
   *    - auditId: Unique identifier for each audit record
   *    - userId: Who performed the action (null for system actions)
   *    - eventType: Category of audit event (LOGIN, DEPOSIT, COMMISSION, etc.)
   *    - action: Specific action taken (LOGIN_SUCCESS, DEPOSIT_CREATED, etc.)
   * 
   * 2. RESOURCE TRACKING:
   *    - resourceType: Type of resource affected (User, Deposit, Commission)
   *    - resourceId: Specific record ID that was affected
   *    - details: Context-specific information about the action
   * 
   * 3. COMPLIANCE REQUIREMENTS:
   *    - ipAddress: Basic location tracking for security
   *    - CreatedAt: Immutable timestamp for audit chronology
   *    - Complete traceability for regulatory compliance
   * 
   * 4. GLOBAL SECONDARY INDEXES:
   *    - userId-CreatedAt-gsi: User audit history and activity tracking
   *    - eventType-CreatedAt-gsi: Event type analysis and monitoring
   *    - resourceType-resourceId-gsi: Resource-specific audit trails
   */
}
