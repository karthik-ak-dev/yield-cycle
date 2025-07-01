import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

/**
 * Winston-based Logger class with request tracing support
 * 
 * Features:
 * - Console logging for Lambda/CloudWatch compatibility
 * - Request ID tracking for request flow tracing
 * - Context-aware logging for better organization
 * - Environment-based log levels (debug in dev, info in prod)
 * - Structured JSON logging with timestamps
 */
export class Logger {
  private logger: winston.Logger;
  private requestId?: string; // Stores the current request ID for this logger instance

  /**
   * Creates a new Logger instance
   * @param context - Optional context string for better log organization (e.g., 'UserService', 'AuthController')
   */
  constructor(context?: string) {
    // Configure Winston logger with console transport only (Lambda-friendly)
    this.logger = winston.createLogger({
      // Set log level based on environment
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      
      // Configure log format: timestamp + error stack traces + JSON structure
      format: winston.format.combine(
        winston.format.timestamp(), // Add ISO timestamp
        winston.format.errors({ stack: true }), // Include full error stack traces
        winston.format.json() // Output as structured JSON
      ),
      
      // Add context to all log entries for better organization
      defaultMeta: { context },
      
      // Only console transport - logs go to CloudWatch in Lambda
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(), // Colored output for local development
            winston.format.simple() // Simple readable format
          )
        })
      ]
    });
  }

  /**
   * Sets the request ID for this logger instance
   * This ensures all logs from this logger include the same request ID
   * @param requestId - Unique identifier for the current request
   */
  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  /**
   * Private method to merge request ID with additional metadata
   * Ensures request ID is included in all log entries
   * @param meta - Additional metadata to include in log
   * @returns Merged metadata with request ID
   */
  private getMeta(meta?: any): any {
    return {
      ...meta,
      ...(this.requestId && { requestId: this.requestId }) // Only add requestId if it exists
    };
  }

  /**
   * Log an informational message
   * @param message - The message to log
   * @param meta - Optional metadata to include
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, this.getMeta(meta));
  }

  /**
   * Log an error message with optional error object
   * @param message - The error message to log
   * @param error - Optional Error object (will extract message and stack trace)
   * @param meta - Optional metadata to include
   */
  error(message: string, error?: any, meta?: any): void {
    this.logger.error(message, { 
      error: error?.message || error, // Extract error message
      stack: error?.stack, // Include stack trace if available
      ...this.getMeta(meta) // Include request ID and other metadata
    });
  }

  /**
   * Log a warning message
   * @param message - The warning message to log
   * @param meta - Optional metadata to include
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, this.getMeta(meta));
  }

  /**
   * Log a debug message (only shown in development)
   * @param message - The debug message to log
   * @param meta - Optional metadata to include
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, this.getMeta(meta));
  }

  /**
   * Log an HTTP-related message
   * @param message - The HTTP message to log
   * @param meta - Optional metadata to include
   */
  http(message: string, meta?: any): void {
    this.logger.http(message, this.getMeta(meta));
  }
}

/**
 * Singleton class to manage request context across the application
 * 
 * Purpose:
 * - Maintains a single request ID throughout the request lifecycle
 * - Allows any part of the application to access the current request ID
 * - Supports both automatic UUID generation and external request ID injection
 */
export class RequestContext {
  private static instance: RequestContext; // Singleton instance
  private requestId: string; // Current request ID

  /**
   * Private constructor - creates a new request context with a UUID
   */
  private constructor() {
    this.requestId = uuidv4(); // Generate unique request ID
  }

  /**
   * Get the singleton instance of RequestContext
   * Creates a new instance if one doesn't exist
   * @returns RequestContext instance
   */
  static getInstance(): RequestContext {
    if (!RequestContext.instance) {
      RequestContext.instance = new RequestContext();
    }
    return RequestContext.instance;
  }

  /**
   * Create a new request context (resets the singleton)
   * Called at the start of each new request
   * @returns New RequestContext instance
   */
  static createNew(): RequestContext {
    RequestContext.instance = new RequestContext();
    return RequestContext.instance;
  }

  /**
   * Get the current request ID
   * @returns Current request ID string
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Set the request ID (useful when accepting external request IDs)
   * @param requestId - Request ID to set
   */
  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }
}

// Default logger instance for general use
export const logger = new Logger();

/**
 * Utility function to get the current request ID from anywhere in the application
 * @returns Current request ID string
 */
export const getCurrentRequestId = (): string => {
  return RequestContext.getInstance().getRequestId();
};

/**
 * Utility function to create a logger instance with the current request ID
 * Use this in services to ensure all logs include the request ID
 * @param context - Context string for the logger (e.g., 'UserService')
 * @returns Logger instance with current request ID set
 */
export const createRequestLogger = (context: string): Logger => {
  const logger = new Logger(context);
  logger.setRequestId(getCurrentRequestId());
  return logger;
}; 