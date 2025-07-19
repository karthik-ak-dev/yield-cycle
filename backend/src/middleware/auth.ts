import { Request, Response, NextFunction } from 'express';
// Note: AuthConfig import commented due to previous import issues
// import { AuthConfig } from '../config/auth';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        iat?: number;
        exp?: number;
      };
    }
  }
}

// Authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
      return;
    }

    // TODO: Uncomment when AuthConfig import is fixed
    // const decoded = AuthConfig.verifyToken(token);
    
    // Temporary mock verification (replace with actual implementation)
    const decoded = { userId: 'temp', email: 'temp@example.com' };
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'TOKEN_INVALID'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // TODO: Uncomment when AuthConfig import is fixed
      // const decoded = AuthConfig.verifyToken(token);
      
      // Temporary mock verification
      const decoded = { userId: 'temp', email: 'temp@example.com' };
      
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      };
    }

    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Middleware to extract user ID from token
export const extractUserId = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.userId) {
    res.status(401).json({
      success: false,
      message: 'User authentication required',
      code: 'USER_AUTH_REQUIRED'
    });
    return;
  }
  next();
};

// Middleware to check if user owns the resource
export const checkResourceOwnership = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (resourceUserId !== currentUserId) {
      res.status(403).json({
        success: false,
        message: 'Access denied to this resource',
        code: 'ACCESS_DENIED'
      });
      return;
    }

    next();
  };
}; 