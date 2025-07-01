import { Request, Response, NextFunction } from 'express';
import { Logger, RequestContext } from '../utils/logger';

/**
 * HTTP Logging Middleware Class
 * 
 * Purpose:
 * - Logs all HTTP requests and responses with request tracing
 * - Generates or accepts request IDs for request flow tracking
 * - Measures request duration and logs response status
 * - Handles error logging with request context
 * 
 * Features:
 * - Request ID generation/acceptance from headers
 * - Request timing measurement
 * - Response status and duration logging
 * - Error logging with full request context
 * - Response header injection for request ID
 */
export class HttpLogger {
  private logger: Logger;

  constructor() {
    // Create logger instance with HTTP context
    this.logger = new Logger('HTTP');
  }

  /**
   * Middleware function to log HTTP requests and responses
   * 
   * Flow:
   * 1. Extract or generate request ID
   * 2. Set request ID in logger context
   * 3. Add request ID to response headers
   * 4. Log request start
   * 5. Override response.end to log completion
   * 6. Continue to next middleware
   * 
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  logRequest(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now(); // Track request start time
    
    // Step 1: Extract or generate request ID
    // Priority: x-request-id header > x-correlation-id header > new UUID
    const requestId = req.headers['x-request-id'] as string || 
                     req.headers['x-correlation-id'] as string || 
                     RequestContext.createNew().getRequestId();
    
    // Step 2: Set request ID in logger for this request
    this.logger.setRequestId(requestId);
    
    // Step 3: Add request ID to response headers for client tracking
    res.setHeader('x-request-id', requestId);
    
    // Step 4: Log request start with context
    this.logger.info(`${req.method} ${req.path} - Request started`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });

    // Step 5: Override res.end to capture response completion
    const originalEnd = res.end;
    res.end = (chunk?: any, encoding?: any, cb?: () => void) => {
      const duration = Date.now() - start; // Calculate request duration
      const statusCode = res.statusCode;
      
      // Log response completion with timing and status
      this.logger.info(`${req.method} ${req.path} - ${statusCode} (${duration}ms)`, {
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        ip: req.ip,
        requestId
      });
      
      // Call original end method to complete response
      return originalEnd.call(res, chunk, encoding, cb);
    };
    
    // Step 6: Continue to next middleware
    next();
  }

  /**
   * Middleware function to log HTTP errors
   * 
   * Purpose:
   * - Logs errors that occur during request processing
   * - Includes full request context and error details
   * - Maintains request ID for error tracing
   * 
   * @param error - Error object that occurred
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  logError(error: Error, req: Request, res: Response, next: NextFunction): void {
    // Get current request ID from context
    const requestId = RequestContext.getInstance().getRequestId();
    
    // Log error with full request context
    this.logger.error(`${req.method} ${req.path} - ${error.message}`, error, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId
    });
    
    // Continue error handling chain
    next(error);
  }
}

// Export singleton instance and middleware functions
export const httpLogger = new HttpLogger();

/**
 * Express middleware function for request logging
 * Usage: app.use(logRequest)
 */
export const logRequest = (req: Request, res: Response, next: NextFunction) => 
  httpLogger.logRequest(req, res, next);

/**
 * Express middleware function for error logging
 * Usage: app.use(logError)
 */
export const logError = (error: Error, req: Request, res: Response, next: NextFunction) => 
  httpLogger.logError(error, req, res, next); 