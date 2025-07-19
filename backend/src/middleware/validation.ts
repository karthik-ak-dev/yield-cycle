import { Request, Response, NextFunction } from 'express';
// Note: Joi import commented due to previous import issues
// import Joi from 'joi';
import { VALIDATION_RULES } from '../config/constants';

// Validation error response (commented out until Joi is implemented)
// interface ValidationError {
//   field: string;
//   message: string;
//   value?: any;
// }

// Generic validation middleware
export const validateRequest = (schema: any, _source: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // TODO: Implement actual Joi validation when import is fixed
      // const { error, value } = schema.validate(req[source], { abortEarly: false });
      
      // if (error) {
      //   const errors: ValidationError[] = error.details.map((detail: any) => ({
      //     field: detail.path.join('.'),
      //     message: detail.message,
      //     value: detail.context?.value
      //   }));

      //   res.status(400).json({
      //     success: false,
      //     message: 'Validation failed',
      //     errors,
      //     code: 'VALIDATION_ERROR'
      //   });
      //   return;
      // }

      // req[source] = value;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Validation error',
        code: 'VALIDATION_ERROR'
      });
    }
  };
};

// Email validation
export const validateEmail = (email: string): boolean => {
  return VALIDATION_RULES.EMAIL_REGEX.test(email);
};

// Referral code validation
export const validateReferralCode = (code: string): boolean => {
  return VALIDATION_RULES.REFERRAL_CODE_REGEX.test(code);
};

// Wallet address validation
export const validateWalletAddress = (address: string): boolean => {
  return VALIDATION_RULES.WALLET_ADDRESS_REGEX.test(address);
};

// Transaction hash validation
export const validateTransactionHash = (hash: string): boolean => {
  return VALIDATION_RULES.TRANSACTION_HASH_REGEX.test(hash);
};

// Manual validation middleware for simple checks
export const validateEmailMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const email = req.body.email;
  
  if (!email) {
    res.status(400).json({
      success: false,
      message: 'Email is required',
      code: 'EMAIL_REQUIRED'
    });
    return;
  }

  if (!validateEmail(email)) {
    res.status(400).json({
      success: false,
      message: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
    return;
  }

  next();
};

// Password validation middleware
export const validatePasswordMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const password = req.body.password;
  
  if (!password) {
    res.status(400).json({
      success: false,
      message: 'Password is required',
      code: 'PASSWORD_REQUIRED'
    });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long',
      code: 'PASSWORD_TOO_SHORT'
    });
    return;
  }

  next();
};

// Referral code validation middleware
export const validateReferralCodeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const referralCode = req.body.referralCode;
  
  // Referral code is optional
  if (!referralCode) {
    next();
    return;
  }

  if (!validateReferralCode(referralCode)) {
    res.status(400).json({
      success: false,
      message: 'Invalid referral code format. Must be 6-10 uppercase letters and numbers.',
      code: 'INVALID_REFERRAL_CODE'
    });
    return;
  }

  next();
};

// Pagination validation middleware
export const validatePaginationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (page < 1) {
    res.status(400).json({
      success: false,
      message: 'Page must be greater than 0',
      code: 'INVALID_PAGE'
    });
    return;
  }

  if (limit < 1 || limit > 100) {
    res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100',
      code: 'INVALID_LIMIT'
    });
    return;
  }

  req.query.page = page.toString();
  req.query.limit = limit.toString();
  next();
}; 