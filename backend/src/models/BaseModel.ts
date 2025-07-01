/**
 * Base Model
 * 
 * Simple base class for all domain entities
 * Provides common functionality without over-abstraction
 * Uses existing utility functions to avoid code duplication
 */

import { IdUtils } from '../utils/helpers';

/**
 * Single base model class for all domain entities
 * Clean, simple, and production-ready
 */
export abstract class BaseModel {
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(createdAt?: Date, updatedAt?: Date) {
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  /**
   * Updates the updatedAt timestamp
   */
  protected touch(): void {
    this.updatedAt = new Date();
  }

  /**
   * Generates a new UUID using existing utility
   */
  protected generateId(): string {
    return IdUtils.generateUUID();
  }

  /**
   * Gets the age of the entity in days
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.createdAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Checks if the entity was created recently (within last 24 hours)
   */
  isRecent(): boolean {
    return this.getAgeInDays() < 1;
  }

  /**
   * Abstract method for validation - must be implemented by subclasses
   * Should use validation utilities from utils/validation.ts
   */
  protected abstract validate(): void;

  /**
   * Abstract method for JSON serialization - must be implemented by subclasses
   * This is the primary serialization method
   */
  abstract toJSON(): any;

  /**
   * DynamoDB serialization - defaults to toJSON with DynamoDB conventions
   * Override only when DynamoDB-specific logic is needed (TTL, etc.)
   */
  toDynamoItem(): any {
    const json = this.toJSON();
    return {
      ...json,
      CreatedAt: this.createdAt.toISOString(),
      UpdatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Common metadata for JSON responses
   */
  protected getCommonJSON(): any {
    return {
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      ageInDays: this.getAgeInDays(),
      isRecent: this.isRecent(),
    };
  }
}

/**
 * Common exceptions for model validation
 * Keep these as they're model-specific
 */
export class ModelValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ModelValidationError';
  }
}

export class InvariantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolationError';
  }
} 