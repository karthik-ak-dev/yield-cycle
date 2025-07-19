import { 
  INVESTMENT_CONFIG, 
  COMMISSION_CONFIG, 
  TIME_CONSTANTS,
  BLOCKCHAIN_CONFIG 
} from '../config/constants';

// Date and time helpers
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
};

export const formatMonth = (date: Date | string): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM format
};

export const addMonths = (date: Date | string, months: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const addDays = (date: Date | string, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const getDaysDifference = (date1: Date | string, date2: Date | string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / TIME_CONSTANTS.ONE_DAY);
};

export const getMonthsDifference = (date1: Date | string, date2: Date | string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
};

// Commission calculation helpers
export const calculateCommissionAmount = (depositAmount: number, level: number): number => {
  if (level < 1 || level > COMMISSION_CONFIG.MAX_LEVELS) {
    return 0;
  }
  
  const rate = COMMISSION_CONFIG.RATES[level - 1];
  return Math.round(depositAmount * rate * 100) / 100; // Round to 2 decimal places
};

export const calculateTotalCommission = (depositAmount: number): number => {
  return Math.round(depositAmount * COMMISSION_CONFIG.TOTAL_COMMISSION_RATE * 100) / 100;
};

// Monthly earnings helpers
export const calculateNextEarningDate = (depositDate: Date | string, earningMonth: number): Date => {
  return addMonths(depositDate, earningMonth);
};

export const calculateEarningMonth = (depositDate: Date | string, currentDate?: Date | string): number => {
  const current = currentDate ? new Date(currentDate) : new Date();
  return getMonthsDifference(depositDate, current) + 1;
};

export const isEligibleForEarning = (depositDate: Date | string, earningMonth: number): boolean => {
  return earningMonth <= INVESTMENT_CONFIG.EARNING_MONTHS;
};

// Amount formatting helpers
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return amount.toFixed(decimals);
};

export const formatUSDT = (amount: number): string => {
  return `${formatCurrency(amount)} USDT`;
};

// USDT amount conversion (considering decimals)
export const parseUSDTAmount = (amount: string): number => {
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) {
    throw new Error('Invalid USDT amount');
  }
  return parsed;
};

export const formatUSDTForBlockchain = (amount: number): string => {
  // Convert to wei (considering USDT has 18 decimals on BSC)
  const wei = Math.floor(amount * Math.pow(10, BLOCKCHAIN_CONFIG.USDT_DECIMALS));
  return wei.toString();
};

export const parseUSDTFromBlockchain = (weiAmount: string): number => {
  const wei = parseFloat(weiAmount);
  return wei / Math.pow(10, BLOCKCHAIN_CONFIG.USDT_DECIMALS);
};

// Pagination helpers
export const calculatePagination = (page: number, limit: number, totalItems: number) => {
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    page,
    limit,
    offset,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null
  };
};

// API response helpers
export const createSuccessResponse = (data: any, message: string = 'Success') => {
  return {
    success: true,
    message,
    data,
    timestamp: getCurrentTimestamp()
  };
};

export const createErrorResponse = (message: string, code: string = 'ERROR') => {
  return {
    success: false,
    message,
    code,
    timestamp: getCurrentTimestamp()
  };
};

export const createPaginatedResponse = (
  items: any[],
  pagination: any,
  message: string = 'Data retrieved successfully'
) => {
  return {
    success: true,
    message,
    data: {
      items,
      pagination
    },
    timestamp: getCurrentTimestamp()
  };
};

// Validation helpers
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidAmount = (amount: number, min: number = 0, max?: number): boolean => {
  if (isNaN(amount) || amount < min) {
    return false;
  }
  
  if (max !== undefined && amount > max) {
    return false;
  }
  
  return true;
};

// Array helpers
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const unique = <T>(array: T[]): T[] => {
  return [...new Set(array)];
};

// Object helpers
export const omit = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
};

export const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

// Sleep helper for testing and development
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Random helpers
export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randomFloat = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
}; 