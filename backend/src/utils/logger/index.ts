/**
 * YieldCycle Logger - Clean, class-based logging utility
 * Generic logger without business domain logic
 */

import { WinstonConfig, LoggerConfigOptions } from './winston-config';
import { randomUUID } from 'crypto';
import * as winston from 'winston';

/**
 * Basic log context interface
 */
export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  ipAddress?: string;
  sessionId?: string;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  statusCode?: number;
  additionalData?: Record<string, any>;
}

/**
 * Logger configuration interface
 */
export interface YieldCycleLoggerOptions {
  winstonConfig?: WinstonConfig;
  loggerConfig?: LoggerConfigOptions;
}

/**
 * Clean Logger class for general-purpose logging
 * Uses dependency injection for better testability and flexibility
 */
export class YieldCycleLogger {
  private context: LogContext = {};
  private readonly winstonLogger: winston.Logger;
  private readonly winstonConfig: WinstonConfig;

  constructor(options: YieldCycleLoggerOptions = {}) {
    // Use provided config or create new one
    this.winstonConfig = options.winstonConfig || new WinstonConfig(options.loggerConfig);
    this.winstonLogger = this.winstonConfig.createLogger();
  }

  // ========== Context Management ==========

  /**
   * Set log context
   */
  public setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Set user context
   */
  public setUser(userId: string, sessionId?: string): void {
    this.setContext({ userId, sessionId });
  }

  /**
   * Set operation context with correlation ID
   */
  public setOperation(operation: string): void {
    this.setContext({ operation, correlationId: randomUUID() });
  }

  /**
   * Clear context
   */
  public clearContext(): void {
    this.context = {};
  }

  /**
   * Get current context
   */
  public getContext(): LogContext {
    return { ...this.context };
  }

  /**
   * Get logger configuration
   */
  public getLoggerConfig(): LoggerConfigOptions {
    return this.winstonConfig.getConfig();
  }

  // ========== Basic Logging Methods ==========

  /**
   * Log info message
   */
  public info(message: string, data?: Record<string, any>): void {
    this.winstonLogger.info(message, { ...this.context, ...data });
  }

  /**
   * Log warning message
   */
  public warn(message: string, data?: Record<string, any>): void {
    this.winstonLogger.warn(message, { ...this.context, ...data });
  }

  /**
   * Log error message
   */
  public error(message: string, error?: Error, data?: Record<string, any>): void {
    this.winstonLogger.error(message, {
      ...this.context,
      error: error?.message,
      stack: error?.stack,
      ...data,
    });
  }

  /**
   * Log debug message
   */
  public debug(message: string, data?: Record<string, any>): void {
    this.winstonLogger.debug(message, { ...this.context, ...data });
  }

  // ========== Performance Logging ==========

  /**
   * Log performance metrics
   */
  public logPerformance(metric: PerformanceMetric): void {
    const performanceData = {
      ...this.context,
      logType: 'PERFORMANCE',
      operation: metric.operation,
      duration: metric.duration,
      success: metric.success,
      statusCode: metric.statusCode,
      slow: metric.duration > 2000,
      timestamp: new Date().toISOString(),
      ...metric.additionalData,
    };

    if (metric.duration > 5000) {
      this.winstonLogger.warn(`Slow Operation: ${metric.operation}`, performanceData);
    } else {
      this.winstonLogger.info(`Performance: ${metric.operation}`, performanceData);
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  public startTimer(operation: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.logPerformance({
        operation,
        duration,
        success: true,
      });
    };
  }

  // ========== Structured Logging Helpers ==========

  /**
   * Log with specific type/category
   */
  public logWithType(type: string, message: string, data?: Record<string, any>): void {
    this.info(message, { logType: type, ...data });
  }

  /**
   * Log user action
   */
  public logUserAction(action: string, data?: Record<string, any>): void {
    this.info(`User Action: ${action}`, { 
      logType: 'USER_ACTION', 
      action,
      ...data 
    });
  }

  /**
   * Log system event
   */
  public logSystemEvent(event: string, data?: Record<string, any>): void {
    this.info(`System Event: ${event}`, { 
      logType: 'SYSTEM_EVENT', 
      event,
      ...data 
    });
  }

  // ========== Utility Methods ==========

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.winstonConfig.isDevelopment();
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.winstonConfig.isProduction();
  }

  /**
   * Get HTTP log stream for Morgan middleware
   */
  public getHttpLogStream(): { write: (message: string) => void } {
    return this.winstonConfig.createHttpLogStream(this.winstonLogger);
  }

  /**
   * Get underlying Winston logger (for advanced usage)
   */
  public getWinstonLogger(): winston.Logger {
    return this.winstonLogger;
  }
}

/**
 * Logger Factory Class
 * Provides factory methods for creating different types of loggers
 */
export class LoggerFactory {
  /**
   * Create a logger with default configuration
   */
  public static createDefault(): YieldCycleLogger {
    return new YieldCycleLogger();
  }

  /**
   * Create a logger with custom configuration
   */
  public static createWithConfig(config: LoggerConfigOptions): YieldCycleLogger {
    return new YieldCycleLogger({ loggerConfig: config });
  }

  /**
   * Create a logger for testing (silent mode)
   */
  public static createForTesting(): YieldCycleLogger {
    return new YieldCycleLogger({ 
      loggerConfig: { 
        environment: 'test',
        enableColors: false 
      } 
    });
  }

  /**
   * Create a logger for production
   */
  public static createForProduction(serviceName?: string): YieldCycleLogger {
    return new YieldCycleLogger({ 
      loggerConfig: { 
        environment: 'production',
        serviceName: serviceName || 'yieldcycle-api',
        logLevel: 'info'
      } 
    });
  }
}

// ========== Express Middleware Factory ==========

/**
 * Middleware Factory Class
 */
export class MiddlewareFactory {
  /**
   * Create Express middleware for request logging
   */
  public static createLoggerMiddleware(logger: YieldCycleLogger) {
    return (req: any, res: any, next: any) => {
      const correlationId = randomUUID();
      logger.setContext({
        correlationId,
        operation: `${req.method} ${req.path}`,
        ipAddress: req.ip,
      });

      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.logPerformance({
          operation: `${req.method} ${req.path}`,
          duration,
          success: res.statusCode < 400,
          statusCode: res.statusCode,
        });
      });

      next();
    };
  }
}

// ========== Exports ==========

// Create and export default logger instance
export const yieldCycleLogger = LoggerFactory.createDefault();

// Export backward compatibility items
export const logger = yieldCycleLogger.getWinstonLogger();
export const httpLogStream = yieldCycleLogger.getHttpLogStream();

// Export factory function for convenience
export const createLoggerMiddleware = MiddlewareFactory.createLoggerMiddleware;

// Export types and interfaces
export type { LoggerConfigOptions } from './winston-config';

// Default export
export default yieldCycleLogger;
