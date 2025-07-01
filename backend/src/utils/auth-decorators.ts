import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/enums';
import { SessionService } from '../services/auth/SessionService';
import { JWTUtils } from './jwt';

/**
 * 🔐 Role-Based Authentication & Authorization Decorators for Yield Cycle Platform
 * 
 * 🎯 JWT + Session Hybrid Authentication System - Main Validation Entry Point
 * 
 * PURPOSE:
 * This file provides TypeScript decorators that implement the complete hybrid authentication
 * system for our blockchain-based investment platform. It integrates JWT performance with
 * session security to provide financial-grade authentication.
 * 
 * CRITICAL INTEGRATIONS:
 * 1. 🔗 JWTUtils Integration: Uses JWTUtils.verifyAccessToken() for JWT validation
 * 2. 🔗 Session Integration: Validates sessions created by Session.createSession()
 * 3. 🔗 SessionService Integration: Checks session state in database
 * 
 * HYBRID AUTHENTICATION FLOW:
 * 1. Client login → Session.createSession() → JWT tokens generated → Stored in DB
 * 2. API request → @Auth() decorator → JWT validated + Session checked → Access granted
 * 3. User logout → Session.revoke() → JWT becomes invalid immediately
 * 
 * HOW DECORATORS WORK:
 * 1. @AdminOnly() wraps your controller method
 * 2. Before your method runs, authenticate() function executes:
 *    a. Extracts JWT from Authorization header
 *    b. JWTUtils.verifyAccessToken() validates JWT signature/expiry
 *    c. SessionService checks if session (from JWT) is still active
 *    d. Both validations must pass
 * 3. If valid: req.user populated, your method executes
 * 4. If invalid: 401 error returned immediately
 * 
 * JWT TOKEN STRUCTURE (from JWTUtils):
 * { userId, email, role: "ADMIN"|"DEPOSITOR", sessionId, iat, exp, iss, aud }
 * The sessionId is CRITICAL - it links to Session table for security validation
 * 
 * AVAILABLE DECORATORS:
 * @Auth() - Any authenticated user (ADMIN or DEPOSITOR)
 * @AdminOnly() - Only users with ADMIN role
 * @DepositorOnly() - Only users with DEPOSITOR role
 * @AuthRole([UserRole.ADMIN, UserRole.DEPOSITOR]) - Specific roles allowed
 * @AuthOwner('userId') - User can only access their own data (or admin can access any)
 * @Public() - No authentication required (marker for documentation)
 * @RateLimit(requests, milliseconds) - Limit requests per time window
 * 
 * USAGE IN CONTROLLERS:
 * ```typescript
 * @AdminOnly()
 * static async getDashboard(req: Request, res: Response) {
 *   // req.user automatically contains: { userId, email, role, sessionId }
 *   // Only admin users can reach this point
 *   // Session was validated in database before reaching here
 * }
 * ```
 * 
 * ROUTE REGISTRATION:
 * ```typescript
 * router.get('/admin/dashboard', AdminController.getDashboard);
 * // No middleware chains needed - decorators handle everything
 * ```
 * 
 * SECURITY BENEFITS:
 * ✅ JWT performance (fast validation without DB hits)
 * ✅ Session security (immediate revocation capability)
 * ✅ Role-based authorization (ADMIN/DEPOSITOR access control)
 * ✅ Resource ownership (users can only access their own data)
 * ✅ Rate limiting (prevent abuse and DDoS)
 * ✅ Device tracking (session management across devices)
 * 
 * @see JWTUtils - JWT token operations
 * @see Session.createSession() - Token generation
 * @see SessionService - Session database operations
 */



/**
 * Authenticated User Object
 * This is attached to req.user after successful authentication
 */
interface AuthenticatedUser {
  userId: string;      // Unique user identifier
  email: string;       // User's email address
  role: UserRole;      // User's role (ADMIN/DEPOSITOR)
  sessionId: string;   // Current session identifier
}

/**
 * 🔐 Core Authentication Function - JWT + Session Hybrid Validation
 * 
 * CRITICAL INTEGRATION POINT: This function implements the complete hybrid authentication!
 * It validates BOTH JWT tokens (performance) AND session database state (security).
 * 
 * INTEGRATION WITH OTHER COMPONENTS:
 * 1. Uses JWTUtils.verifyAccessToken() to validate JWT signature/expiry
 * 2. Extracts sessionId from JWT payload  
 * 3. Uses SessionService to check if session is still active in database
 * 4. Both validations must pass for authentication to succeed
 * 
 * WHY HYBRID APPROACH:
 * - JWT validation is fast (no DB hit for signature/expiry check)
 * - Session validation enables immediate revocation (logout, security events)
 * - Perfect for financial platforms requiring both performance and security
 * 
 * AUTHENTICATION FLOW:
 * 1. Client sends: Authorization: Bearer <JWT_from_Session.createSession()>
 * 2. Extract JWT token from header
 * 3. JWTUtils.verifyAccessToken() → Validate signature, expiry, issuer, audience
 * 4. Extract sessionId from JWT payload
 * 5. SessionService.getSession() → Check if session still active in DB
 * 6. Both validations pass → Authentication successful
 * 
 * SECURITY BENEFITS:
 * ✅ Fast JWT validation (performance)
 * ✅ Immediate session revocation (security)
 * ✅ Device tracking and management
 * ✅ Comprehensive audit trails
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @returns AuthenticatedUser object or null if authentication fails
 */
async function authenticate(req: Request, res: Response): Promise<AuthenticatedUser | null> {
  try {
    // Step 1: Extract JWT token from Authorization header
    // Expected format: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Get token after "Bearer "

    if (!token) {
      res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
      return null;
    }

    // Step 2: 🔗 JWT VALIDATION - Use JWTUtils for token verification
    // This validates signature, expiry, issuer, audience
    const decoded = JWTUtils.verifyAccessToken(token);
    if (!decoded) {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
      return null;
    }

    // Step 3: 🔗 SESSION VALIDATION - Check database for session state
    // This enables immediate revocation and security control
    // Uses sessionId from JWT payload to lookup session
    const session = await SessionService.getSession(decoded.userId, decoded.sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired session' 
      });
      return null;
    }

    // Step 4: 🎯 Authentication successful - Both JWT and session are valid
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };
  } catch (error) {
    // JWT verification or session lookup failed
    res.status(401).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
    return null;
  }
}

/**
 * Role Validation Helper
 * 
 * Checks if a user's role is in the list of allowed roles
 * @param userRole - The user's current role (ADMIN or DEPOSITOR)
 * @param allowedRoles - Array of roles that are permitted
 * @returns true if user has one of the allowed roles
 */
function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Resource Ownership Validation
 * 
 * Determines if a user can access a specific resource based on ownership rules:
 * - Admins can access any resource (full platform access)
 * - Depositors can only access their own resources (userId must match)
 * 
 * @param user - The authenticated user object
 * @param req - Express request object containing route parameters
 * @param resourceParam - Name of the parameter containing the resource owner ID (default: 'userId')
 * @returns true if user can access the resource
 * 
 * Example: For route /users/:userId/profile
 * - Admin can access any userId
 * - Depositor can only access if req.params.userId === user.userId
 */
function isOwnerOrAdmin(user: AuthenticatedUser, req: Request, resourceParam: string): boolean {
  const requestedUserId = req.params[resourceParam];
  
  // Admins can access any resource (superuser privileges)
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Depositors can only access their own resources
  return requestedUserId === user.userId;
}

/**
 * @Auth() - Basic Authentication Decorator
 * 
 * PURPOSE: Requires any authenticated user (ADMIN or DEPOSITOR)
 * USE CASE: Routes that any logged-in user can access
 * 
 * FLOW:
 * 1. Validates JWT token from Authorization header
 * 2. Verifies session is active in database
 * 3. Attaches user object to req.user
 * 4. Calls your controller method
 * 
 * USAGE:
 * @Auth()
 * static async getMyProfile(req: Request, res: Response) {
 *   const user = req.user; // Available after authentication
 *   // Both ADMIN and DEPOSITOR can access this
 * }
 * 
 * ROUTE: router.get('/profile', UserController.getMyProfile);
 */
export function Auth() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        // Step 1: Authenticate the user
        const user = await authenticate(req, res);
        if (!user) {
          return; // Response already sent by authenticate() function
        }

        // Step 2: Attach user info to request object for use in controller
        (req as any).user = user;

        // Step 3: Call the original controller method
        return method.call(this, req, res, next);
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: 'Authentication failed' 
        });
      }
    };

    return descriptor;
  };
}

/**
 * @AdminOnly() - Admin-Only Access Decorator
 * 
 * PURPOSE: Restricts access to ADMIN role only
 * USE CASE: Platform management, user administration, system settings
 * 
 * FLOW:
 * 1. Validates JWT token and session
 * 2. Checks if user.role === 'ADMIN'
 * 3. Returns 403 error if user is not admin
 * 4. Calls controller method if user is admin
 * 
 * USAGE:
 * @AdminOnly()
 * static async getDashboard(req: Request, res: Response) {
 *   // Only ADMIN users can reach this point
 *   // req.user.role is guaranteed to be 'ADMIN'
 * }
 * 
 * ROUTE: router.get('/admin/dashboard', AdminController.getDashboard);
 * 
 * YIELD CYCLE USE CASES:
 * - View all users and their deposits
 * - Approve/reject withdrawal requests
 * - Modify platform settings
 * - Access system metrics and reports
 */
export function AdminOnly() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        // Step 1: Authenticate the user
        const user = await authenticate(req, res);
        if (!user) {
          return; // Response already sent by authenticate() function
        }

        // Step 2: Check if user has admin role
        if (user.role !== UserRole.ADMIN) {
          return res.status(403).json({ 
            success: false, 
            error: 'Admin access required' 
          });
        }

        // Step 3: User is admin - attach to request
        (req as any).user = user;

        // Step 4: Call the original controller method
        return method.call(this, req, res, next);
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: 'Authorization failed' 
        });
      }
    };

    return descriptor;
  };
}

/**
 * @DepositorOnly() - Depositor-Only Access Decorator
 * 
 * PURPOSE: Restricts access to DEPOSITOR role only
 * USE CASE: Features specific to investors/depositors
 * 
 * FLOW:
 * 1. Validates JWT token and session
 * 2. Checks if user.role === 'DEPOSITOR'
 * 3. Returns 403 error if user is not depositor
 * 4. Calls controller method if user is depositor
 * 
 * USAGE:
 * @DepositorOnly()
 * static async getDepositGuidelines(req: Request, res: Response) {
 *   // Only DEPOSITOR users can reach this point
 *   // req.user.role is guaranteed to be 'DEPOSITOR'
 * }
 * 
 * ROUTE: router.get('/deposit-guidelines', DepositController.getDepositGuidelines);
 * 
 * YIELD CYCLE USE CASES:
 * - Access deposit instructions and guidelines
 * - View referral program details
 * - Access depositor-specific educational content
 * - Special depositor-only features
 */
export function DepositorOnly() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        // Step 1: Authenticate the user
        const user = await authenticate(req, res);
        if (!user) {
          return; // Response already sent by authenticate() function
        }

        // Step 2: Check if user has depositor role
        if (user.role !== UserRole.DEPOSITOR) {
          return res.status(403).json({ 
            success: false, 
            error: 'Depositor access required' 
          });
        }

        // Step 3: User is depositor - attach to request
        (req as any).user = user;

        // Step 4: Call the original controller method
        return method.call(this, req, res, next);
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: 'Authorization failed' 
        });
      }
    };

    return descriptor;
  };
}

/**
 * @AuthRole([roles]) - Multiple Role Access Decorator
 * 
 * PURPOSE: Allows access to users with any of the specified roles
 * USE CASE: Routes that both ADMIN and DEPOSITOR can access
 * 
 * FLOW:
 * 1. Validates JWT token and session
 * 2. Checks if user.role is in the allowedRoles array
 * 3. Returns 403 error if user role is not allowed
 * 4. Calls controller method if user has valid role
 * 
 * USAGE:
 * @AuthRole([UserRole.ADMIN, UserRole.DEPOSITOR])
 * static async createDeposit(req: Request, res: Response) {
 *   // Both ADMIN and DEPOSITOR can access this
 *   // req.user.role will be either 'ADMIN' or 'DEPOSITOR'
 * }
 * 
 * ROUTE: router.post('/deposits', DepositController.createDeposit);
 * 
 * YIELD CYCLE USE CASES:
 * - Deposit creation (both roles can create deposits)
 * - General platform features available to all users
 * - Features that don't need role-specific restrictions
 * 
 * @param allowedRoles Array of UserRole values that can access this route
 */
export function AuthRole(allowedRoles: UserRole[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        // Step 1: Authenticate the user
        const user = await authenticate(req, res);
        if (!user) {
          return; // Response already sent by authenticate() function
        }

        // Step 2: Check if user has one of the required roles
        if (!hasRole(user.role, allowedRoles)) {
          return res.status(403).json({ 
            success: false, 
            error: 'Insufficient role permissions' 
          });
        }

        // Step 3: User has valid role - attach to request
        (req as any).user = user;

        // Step 4: Call the original controller method
        return method.call(this, req, res, next);
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: 'Authorization failed' 
        });
      }
    };

    return descriptor;
  };
}

/**
 * @AuthOwner('paramName') - Resource Ownership Decorator
 * 
 * PURPOSE: Ensures users can only access their own resources (or admin can access any)
 * USE CASE: User-specific data like profiles, wallets, deposits, transactions
 * 
 * FLOW:
 * 1. Validates JWT token and session
 * 2. Checks if user owns the resource OR is an admin
 * 3. Returns 403 error if user doesn't own resource and isn't admin
 * 4. Calls controller method if ownership is valid
 * 
 * OWNERSHIP RULES:
 * - ADMIN: Can access any resource (superuser privileges)
 * - DEPOSITOR: Can only access resources where req.params[resourceParam] === user.userId
 * 
 * USAGE:
 * @AuthOwner('userId')  // Checks req.params.userId
 * static async getUserProfile(req: Request, res: Response) {
 *   const requestedUserId = req.params.userId;
 *   // Depositor: Can only access if requestedUserId === req.user.userId
 *   // Admin: Can access any userId
 * }
 * 
 * ROUTE: router.get('/users/:userId/profile', UserController.getUserProfile);
 * 
 * YIELD CYCLE USE CASES:
 * - User profiles: /users/:userId/profile
 * - Wallet balances: /users/:userId/wallet
 * - Deposit history: /users/:userId/deposits
 * - Transaction history: /users/:userId/transactions
 * - Referral trees: /users/:userId/referrals
 * 
 * @param resourceParam Name of route parameter containing resource owner ID (default: 'userId')
 */
export function AuthOwner(resourceParam: string = 'userId') {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      try {
        // Step 1: Authenticate the user
        const user = await authenticate(req, res);
        if (!user) {
          return; // Response already sent by authenticate() function
        }

        // Step 2: Check if user owns the resource or is admin
        if (!isOwnerOrAdmin(user, req, resourceParam)) {
          return res.status(403).json({ 
            success: false, 
            error: 'Access denied to this resource' 
          });
        }

        // Step 3: Ownership validated - attach user to request
        (req as any).user = user;

        // Step 4: Call the original controller method
        return method.call(this, req, res, next);
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: 'Authorization failed' 
        });
      }
    };

    return descriptor;
  };
}

/**
 * @Public() - Public Route Decorator
 * 
 * PURPOSE: Marks routes as public (no authentication required)
 * USE CASE: Documentation and explicit marking of public endpoints
 * 
 * FLOW:
 * This decorator doesn't add any authentication logic - it's just a marker.
 * It helps document which routes are intentionally public vs missing auth.
 * 
 * USAGE:
 * @Public()
 * static async getWelcomeMessage(req: Request, res: Response) {
 *   // Anyone can access this without authentication
 *   // No req.user will be available
 * }
 * 
 * ROUTE: router.get('/welcome', HomeController.getWelcomeMessage);
 * 
 * YIELD CYCLE USE CASES:
 * - Landing page information
 * - Platform statistics (public metrics)
 * - Registration/login endpoints
 * - Password reset endpoints
 * - Health check endpoints
 */
export function Public() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    // This is just a documentation marker - no authentication logic added
    // The route functions normally without any auth checks
    return descriptor;
  };
}

/**
 * @RateLimit(requests, windowMs) - Rate Limiting Decorator
 * 
 * PURPOSE: Prevents abuse by limiting requests per time window
 * USE CASE: Protecting endpoints from spam, DDoS, or excessive usage
 * 
 * FLOW:
 * 1. Creates unique identifier for each client (IP + userId if available)
 * 2. Tracks request count in specified time window
 * 3. Returns 429 error if limit exceeded
 * 4. Calls controller method if under limit
 * 
 * USAGE:
 * @RateLimit(5, 60000)  // 5 requests per minute
 * @Auth()
 * static async syncDeposits(req: Request, res: Response) {
 *   // This endpoint can only be called 5 times per minute per user
 * }
 * 
 * ROUTE: router.post('/sync-deposits', DepositController.syncDeposits);
 * 
 * YIELD CYCLE USE CASES:
 * - Deposit sync: @RateLimit(3, 60000) - 3 syncs per minute
 * - Withdrawal requests: @RateLimit(5, 300000) - 5 withdrawals per 5 minutes
 * - Email OTP: @RateLimit(3, 180000) - 3 OTP requests per 3 minutes
 * - Login attempts: @RateLimit(10, 900000) - 10 attempts per 15 minutes
 * - Password reset: @RateLimit(2, 3600000) - 2 resets per hour
 * 
 * @param requests Maximum number of requests allowed
 * @param windowMs Time window in milliseconds
 */
export function RateLimit(requests: number, windowMs: number) {
  // In-memory storage for request counts (in production, use Redis)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (req: Request, res: Response, next: NextFunction) {
      // Step 1: Create unique identifier for this client
      // Combines IP address with userId (if authenticated) for better tracking
      const identifier = req.ip + ((req as any).user?.userId || '');
      const now = Date.now();
      const windowStart = now - windowMs;

      // Step 2: Clean up expired entries to prevent memory leaks
      for (const [key, value] of requestCounts.entries()) {
        if (value.resetTime < windowStart) {
          requestCounts.delete(key);
        }
      }

      // Step 3: Check if client has exceeded rate limit
      const current = requestCounts.get(identifier);
      if (current && current.count >= requests && current.resetTime > windowStart) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded'
        });
      }

      // Step 4: Update request count for this client
      if (current && current.resetTime > windowStart) {
        current.count++;
      } else {
        requestCounts.set(identifier, { count: 1, resetTime: now });
      }

      // Step 5: Rate limit passed - call original method
      return method.call(this, req, res, next);
    };

    return descriptor;
  };
} 