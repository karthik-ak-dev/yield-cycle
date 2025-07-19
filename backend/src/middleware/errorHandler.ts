import { Request, Response, NextFunction } from 'express';
import { RESPONSE_MESSAGES } from '../config/constants';

// Error interface
interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

// Custom error class
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Object.setPrototypeOf(this, CustomError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Database error handler
const handleDatabaseError = (error: any): CustomError => {
  if (error.code === 'ConditionalCheckFailedException') {
    return new CustomError('Resource already exists or condition not met', 409, 'RESOURCE_CONFLICT');
  }
  
  if (error.code === 'ResourceNotFoundException') {
    return new CustomError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
  }
  
  if (error.code === 'ValidationException') {
    return new CustomError('Invalid data provided', 400, 'VALIDATION_ERROR');
  }

  if (error.code === 'ThrottlingException' || error.code === 'ProvisionedThroughputExceededException') {
    return new CustomError('Service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE');
  }

  return new CustomError('Database operation failed', 500, 'DATABASE_ERROR');
};

// Blockchain error handler
const handleBlockchainError = (error: any): CustomError => {
  if (error.code === 'NETWORK_ERROR') {
    return new CustomError('Blockchain network error', 503, 'BLOCKCHAIN_NETWORK_ERROR');
  }
  
  if (error.code === 'TIMEOUT') {
    return new CustomError('Blockchain request timeout', 504, 'BLOCKCHAIN_TIMEOUT');
  }

  return new CustomError('Blockchain operation failed', 500, 'BLOCKCHAIN_ERROR');
};

// JWT error handler
const handleJWTError = (error: any): CustomError => {
  if (error.name === 'JsonWebTokenError') {
    return new CustomError('Invalid token', 401, 'INVALID_TOKEN');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new CustomError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  return new CustomError('Authentication failed', 401, 'AUTH_FAILED');
};

// Development error response
const sendErrorDev = (err: AppError, res: Response): void => {
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      stack: err.stack,
      statusCode: err.statusCode || 500,
    },
  });
};

// Production error response
const sendErrorProd = (err: AppError, res: Response): void => {
  // Operational errors: send message to client
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
    });
  } else {
    // Programming errors: don't leak error details
    console.error('ERROR:', err);
    
    res.status(500).json({
      success: false,
      message: RESPONSE_MESSAGES.SERVER_ERROR,
      code: 'INTERNAL_ERROR',
    });
  }
};

// Global error handling middleware
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error for monitoring
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = new CustomError('Validation failed', 400, 'VALIDATION_ERROR');
  } else if (err.name === 'CastError') {
    error = new CustomError('Invalid data format', 400, 'INVALID_FORMAT');
  } else if (err.code && err.code.startsWith('Dynamo')) {
    error = handleDatabaseError(err);
  } else if (err.code && (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT')) {
    error = handleBlockchainError(err);
  } else if (err.name && err.name.includes('JsonWebToken')) {
    error = handleJWTError(err);
  } else if (!err.isOperational) {
    error = new CustomError(RESPONSE_MESSAGES.SERVER_ERROR, 500, 'INTERNAL_ERROR');
  }

  // Send error response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 Not Found handler
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = new CustomError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}; 