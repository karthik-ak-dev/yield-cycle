/**
 * Mathematical Calculation Utilities
 * 
 * Purpose:
 * - Pure mathematical functions for calculations
 * - Number formatting and rounding utilities
 * - Percentage calculations
 * - Currency formatting helpers
 * - Basic mathematical operations for financial calculations
 * 
 * Note: This is NOT business logic - just pure math utilities
 * Business logic belongs in services (e.g., CommissionService, IncomeService)
 */

/**
 * Mathematical calculation utilities
 */
export class MathUtils {
  /**
   * Round number to specified decimal places
   * 
   * @param value - Number to round
   * @param decimals - Number of decimal places (default: 2)
   * @returns Rounded number
   */
  static round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  /**
   * Calculate percentage of a value
   * 
   * @param value - The value to calculate percentage of
   * @param percentage - Percentage as decimal (e.g., 0.08 for 8%)
   * @returns Calculated percentage amount
   */
  static percentage(value: number, percentage: number): number {
    return this.round(value * percentage);
  }

  /**
   * Calculate percentage ratio between two numbers
   * 
   * @param part - The part value
   * @param total - The total value
   * @returns Percentage as decimal (e.g., 0.25 for 25%)
   */
  static percentageRatio(part: number, total: number): number {
    if (total === 0) return 0;
    return this.round(part / total, 4);
  }

  /**
   * Add multiple numbers with proper rounding
   * 
   * @param numbers - Array of numbers to add
   * @returns Sum rounded to 2 decimal places
   */
  static sum(numbers: number[]): number {
    const total = numbers.reduce((acc, curr) => acc + curr, 0);
    return this.round(total);
  }

  /**
   * Clamp a number between min and max values
   * 
   * @param value - Value to clamp
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns Clamped value
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Check if a number is within a range (inclusive)
   * 
   * @param value - Value to check
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns True if value is within range
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Calculate compound interest
   * 
   * @param principal - Initial amount
   * @param rate - Interest rate per period
   * @param periods - Number of periods
   * @returns Final amount after compound interest
   */
  static compoundInterest(principal: number, rate: number, periods: number): number {
    return this.round(principal * Math.pow(1 + rate, periods));
  }

  /**
   * Calculate simple interest
   * 
   * @param principal - Initial amount
   * @param rate - Interest rate per period
   * @param periods - Number of periods
   * @returns Interest amount only
   */
  static simpleInterest(principal: number, rate: number, periods: number): number {
    return this.round(principal * rate * periods);
  }

  /**
   * Safe division that handles division by zero
   * 
   * @param dividend - Number to divide
   * @param divisor - Number to divide by
   * @param defaultValue - Value to return if divisor is 0 (default: 0)
   * @returns Division result or default value
   */
  static safeDivide(dividend: number, divisor: number, defaultValue: number = 0): number {
    if (divisor === 0) return defaultValue;
    return this.round(dividend / divisor);
  }

  /**
   * Convert decimal to percentage string
   * 
   * @param decimal - Decimal value (e.g., 0.08)
   * @param decimals - Number of decimal places (default: 1)
   * @returns Percentage string (e.g., "8.0%")
   */
  static toPercentageString(decimal: number, decimals: number = 1): string {
    const percentage = decimal * 100;
    return `${percentage.toFixed(decimals)}%`;
  }

  /**
   * Check if two numbers are approximately equal (within tolerance)
   * 
   * @param a - First number
   * @param b - Second number
   * @param tolerance - Tolerance for comparison (default: 0.001)
   * @returns True if numbers are approximately equal
   */
  static isApproximatelyEqual(a: number, b: number, tolerance: number = 0.001): boolean {
    return Math.abs(a - b) < tolerance;
  }
}

/**
 * Currency formatting utilities
 */
export class CurrencyUtils {
  /**
   * Format number as currency string
   * 
   * @param amount - Amount to format
   * @param currency - Currency symbol (default: 'USDT')
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted currency string
   */
  static format(amount: number, currency: string = 'USDT', decimals: number = 2): string {
    const formatted = amount.toFixed(decimals);
    return `${formatted} ${currency}`;
  }

  /**
   * Format number with thousands separators
   * 
   * @param amount - Amount to format
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted number string with commas
   */
  static formatWithCommas(amount: number, decimals: number = 2): string {
    return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format as currency with thousands separators
   * 
   * @param amount - Amount to format
   * @param currency - Currency symbol (default: 'USDT')
   * @param decimals - Number of decimal places (default: 2)
   * @returns Formatted currency string with commas
   */
  static formatCurrencyWithCommas(
    amount: number, 
    currency: string = 'USDT', 
    decimals: number = 2
  ): string {
    const formatted = this.formatWithCommas(amount, decimals);
    return `${formatted} ${currency}`;
  }

  /**
   * Parse currency string to number
   * 
   * @param currencyString - Currency string to parse (e.g., "1,234.56 USDT")
   * @returns Parsed number
   */
  static parse(currencyString: string): number {
    // Remove currency symbol and commas, then parse
    const numberString = currencyString.replace(/[^\d.-]/g, '');
    return parseFloat(numberString) || 0;
  }

  /**
   * Validate currency amount
   * 
   * @param amount - Amount to validate
   * @param minAmount - Minimum allowed amount (default: 0)
   * @param maxAmount - Maximum allowed amount (default: Infinity)
   * @returns True if valid
   */
  static isValidAmount(
    amount: number, 
    minAmount: number = 0, 
    maxAmount: number = Infinity
  ): boolean {
    return !isNaN(amount) && amount >= minAmount && amount <= maxAmount;
  }
}

/**
 * Array calculation utilities
 */
export class ArrayUtils {
  /**
   * Calculate sum of array elements
   * 
   * @param numbers - Array of numbers
   * @returns Sum of all elements
   */
  static sum(numbers: number[]): number {
    return MathUtils.round(numbers.reduce((acc, curr) => acc + curr, 0));
  }

  /**
   * Calculate average of array elements
   * 
   * @param numbers - Array of numbers
   * @returns Average value
   */
  static average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return MathUtils.round(this.sum(numbers) / numbers.length);
  }

  /**
   * Find minimum value in array
   * 
   * @param numbers - Array of numbers
   * @returns Minimum value
   */
  static min(numbers: number[]): number {
    return Math.min(...numbers);
  }

  /**
   * Find maximum value in array
   * 
   * @param numbers - Array of numbers
   * @returns Maximum value
   */
  static max(numbers: number[]): number {
    return Math.max(...numbers);
  }

  /**
   * Calculate median of array elements
   * 
   * @param numbers - Array of numbers
   * @returns Median value
   */
  static median(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return MathUtils.round((sorted[middle - 1] + sorted[middle]) / 2);
    } else {
      return sorted[middle];
    }
  }

  /**
   * Group array elements by a key and sum values
   * 
   * @param items - Array of objects with numeric values
   * @param keyFn - Function to extract grouping key
   * @param valueFn - Function to extract numeric value
   * @returns Object with grouped sums
   */
  static groupAndSum<T>(
    items: T[], 
    keyFn: (item: T) => string, 
    valueFn: (item: T) => number
  ): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const item of items) {
      const key = keyFn(item);
      const value = valueFn(item);
      grouped[key] = MathUtils.round((grouped[key] || 0) + value);
    }
    
    return grouped;
  }
}

/**
 * Date calculation utilities for time-based calculations
 */
export class DateUtils {
  /**
   * Calculate months between two dates
   * 
   * @param startDate - Start date
   * @param endDate - End date (default: current date)
   * @returns Number of months elapsed
   */
  static monthsBetween(startDate: Date, endDate: Date = new Date()): number {
    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthDiff = endDate.getMonth() - startDate.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  /**
   * Add months to a date
   * 
   * @param date - Base date
   * @param months - Number of months to add
   * @returns New date with months added
   */
  static addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  /**
   * Calculate days between two dates
   * 
   * @param startDate - Start date
   * @param endDate - End date (default: current date)
   * @returns Number of days elapsed
   */
  static daysBetween(startDate: Date, endDate: Date = new Date()): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Check if date is in the past
   * 
   * @param date - Date to check
   * @returns True if date is in the past
   */
  static isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * Check if date is in the future
   * 
   * @param date - Date to check
   * @returns True if date is in the future
   */
  static isFuture(date: Date): boolean {
    return date > new Date();
  }
}

/**
 * Validation utilities for mathematical operations
 */
export class ValidationUtils {
  /**
   * Check if value is a valid number
   * 
   * @param value - Value to check
   * @returns True if valid number
   */
  static isValidNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * Check if value is a positive number
   * 
   * @param value - Value to check
   * @returns True if positive number
   */
  static isPositiveNumber(value: any): boolean {
    return this.isValidNumber(value) && value > 0;
  }

  /**
   * Check if value is a non-negative number
   * 
   * @param value - Value to check
   * @returns True if non-negative number
   */
  static isNonNegativeNumber(value: any): boolean {
    return this.isValidNumber(value) && value >= 0;
  }

  /**
   * Check if value is an integer
   * 
   * @param value - Value to check
   * @returns True if integer
   */
  static isInteger(value: any): boolean {
    return this.isValidNumber(value) && Number.isInteger(value);
  }

  /**
   * Check if value is a positive integer
   * 
   * @param value - Value to check
   * @returns True if positive integer
   */
  static isPositiveInteger(value: any): boolean {
    return this.isInteger(value) && value > 0;
  }
}
