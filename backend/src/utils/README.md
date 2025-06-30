# YieldCycle Logger

**Clean, class-based logging utility** - Generic logger without business domain logic.

## Features

- **Class-Based Design**: Clean OOP approach with dependency injection
- **Factory Pattern**: Easy creation of specialized logger instances
- **Structured Logging**: JSON for production (CloudWatch), pretty console for development
- **Context Management**: Track correlation IDs, user IDs, and operations
- **Performance Monitoring**: Simple timing and metrics
- **Express Middleware**: Automatic request logging
- **Generic Design**: No business domain knowledge built-in
- **Configurable**: Flexible configuration through constructor injection

## Architecture

### Class-Based Structure

```
WinstonConfig          → Handles Winston configuration
YieldCycleLogger       → Main logger class with dependency injection
LoggerFactory          → Factory for creating different logger types
MiddlewareFactory      → Factory for Express middleware
```

## Usage

### Basic Usage

```typescript
import { yieldCycleLogger } from "@/utils/logger";

// Set context
yieldCycleLogger.setUser("user123", "session456");
yieldCycleLogger.setOperation("api_operation");

// Basic logging
yieldCycleLogger.info("Operation started");
yieldCycleLogger.warn("Warning message", { additionalData: "value" });
yieldCycleLogger.error("Error occurred", new Error("Something failed"));
```

### Factory Pattern Usage

```typescript
import { LoggerFactory } from "@/utils/logger";

// Create default logger
const logger = LoggerFactory.createDefault();

// Create production logger
const prodLogger = LoggerFactory.createForProduction("my-service");

// Create test logger (silent)
const testLogger = LoggerFactory.createForTesting();

// Create with custom config
const customLogger = LoggerFactory.createWithConfig({
  environment: "staging",
  logLevel: "warn",
  serviceName: "staging-api",
  enableColors: false,
});
```

### Dependency Injection

```typescript
import { YieldCycleLogger, WinstonConfig } from "@/utils/logger";

// Create custom Winston config
const customConfig = new WinstonConfig({
  environment: "custom",
  logLevel: "debug",
  serviceName: "custom-service",
});

// Inject config into logger
const logger = new YieldCycleLogger({
  winstonConfig: customConfig,
});

// Or use in a service class
export class UserService {
  constructor(private logger: YieldCycleLogger) {}

  async createUser(userData: any) {
    this.logger.setOperation("user_creation");
    this.logger.info("Creating user", { userData });
    // ... business logic
  }
}
```

### Express Middleware

```typescript
import express from "express";
import { MiddlewareFactory, LoggerFactory } from "@/utils/logger";

const app = express();
const logger = LoggerFactory.createForProduction();

// Add logger middleware
app.use(MiddlewareFactory.createLoggerMiddleware(logger));
```

### Structured Logging

```typescript
// Log with specific type/category
yieldCycleLogger.logWithType("BUSINESS_EVENT", "User made deposit", {
  userId: "user123",
  amount: "1000.00",
  status: "confirmed",
});

// Log user actions
yieldCycleLogger.logUserAction("deposit_initiated", {
  amount: "1000.00",
  walletAddress: "0x123...abc",
});

// Log system events
yieldCycleLogger.logSystemEvent("service_started", {
  service: "payment_processor",
  version: "1.0.0",
});
```

### Performance Monitoring

```typescript
// Manual timing
const timer = yieldCycleLogger.startTimer("database_query");
// ... perform operation
timer(); // Automatically logs performance

// Direct performance logging
yieldCycleLogger.logPerformance({
  operation: "api_call",
  duration: 150,
  success: true,
  statusCode: 200,
  additionalData: { endpoint: "/api/users" },
});
```

## Business Logic Integration

Since the logger is generic, business logic is implemented in your application layer:

```typescript
// In your service/controller layer
export class DepositService {
  constructor(private logger: YieldCycleLogger) {}

  async processDeposit(userId: string, amount: string) {
    this.logger.setUser(userId);
    this.logger.setOperation("deposit_processing");

    try {
      this.logger.logUserAction("deposit_initiated", { amount });

      // ... business logic

      this.logger.logWithType("FINANCIAL_AUDIT", "Deposit completed", {
        auditType: "DEPOSIT",
        userId,
        amount,
        currency: "USDT",
        status: "completed",
        compliance: true,
        timestamp: new Date().toISOString(),
      });

      this.logger.info("Deposit processed successfully");
    } catch (error) {
      this.logger.error("Deposit processing failed", error);
      throw error;
    }
  }
}

// Dependency injection setup
const logger = LoggerFactory.createForProduction("deposit-service");
const depositService = new DepositService(logger);
```

## Configuration Examples

### Development Configuration

```typescript
const devLogger = LoggerFactory.createWithConfig({
  environment: "development",
  logLevel: "debug",
  enableColors: true,
  serviceName: "dev-api",
});
```

### Production Configuration

```typescript
const prodLogger = LoggerFactory.createWithConfig({
  environment: "production",
  logLevel: "info",
  enableColors: false,
  serviceName: "prod-api",
});
```

### Custom Winston Config

```typescript
const customWinstonConfig = new WinstonConfig({
  environment: "staging",
  logLevel: "warn",
  serviceName: "staging-service",
  enableColors: false,
});

const logger = new YieldCycleLogger({
  winstonConfig: customWinstonConfig,
});
```

## Class APIs

### YieldCycleLogger

```typescript
class YieldCycleLogger {
  // Constructor
  constructor(options?: YieldCycleLoggerOptions);

  // Context Management
  setContext(context: Partial<LogContext>): void;
  setUser(userId: string, sessionId?: string): void;
  setOperation(operation: string): void;
  clearContext(): void;
  getContext(): LogContext;
  getLoggerConfig(): LoggerConfigOptions;

  // Basic Logging
  info(message: string, data?: Record<string, any>): void;
  warn(message: string, data?: Record<string, any>): void;
  error(message: string, error?: Error, data?: Record<string, any>): void;
  debug(message: string, data?: Record<string, any>): void;

  // Performance Logging
  logPerformance(metric: PerformanceMetric): void;
  startTimer(operation: string): () => void;

  // Structured Logging
  logWithType(type: string, message: string, data?: Record<string, any>): void;
  logUserAction(action: string, data?: Record<string, any>): void;
  logSystemEvent(event: string, data?: Record<string, any>): void;

  // Utility Methods
  isDevelopment(): boolean;
  isProduction(): boolean;
  getHttpLogStream(): { write: (message: string) => void };
  getWinstonLogger(): winston.Logger;
}
```

### LoggerFactory

```typescript
class LoggerFactory {
  static createDefault(): YieldCycleLogger;
  static createWithConfig(config: LoggerConfigOptions): YieldCycleLogger;
  static createForTesting(): YieldCycleLogger;
  static createForProduction(serviceName?: string): YieldCycleLogger;
}
```

### WinstonConfig

```typescript
class WinstonConfig {
  constructor(options?: LoggerConfigOptions);
  createLogger(): winston.Logger;
  createHttpLogStream(logger: winston.Logger): {
    write: (message: string) => void;
  };
  getConfig(): LoggerConfigOptions;
  isDevelopment(): boolean;
  isProduction(): boolean;
}
```

## Types

```typescript
interface LoggerConfigOptions {
  environment?: string;
  logLevel?: string;
  serviceName?: string;
  enableColors?: boolean;
}

interface YieldCycleLoggerOptions {
  winstonConfig?: WinstonConfig;
  loggerConfig?: LoggerConfigOptions;
}

interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  ipAddress?: string;
  sessionId?: string;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  statusCode?: number;
  additionalData?: Record<string, any>;
}
```

## Benefits of Class-Based Approach

1. **Dependency Injection**: Easy to inject custom configurations and mock for testing
2. **Encapsulation**: Private methods and proper state management
3. **Factory Pattern**: Convenient creation of specialized logger instances
4. **Extensibility**: Easy to extend and customize behavior
5. **Type Safety**: Full TypeScript support with proper interfaces
6. **Testability**: Easy to unit test with dependency injection
7. **Consistency**: Uniform API across all logger instances

## Environment Configuration

```bash
# Environment
NODE_ENV=development|production|test

# Log level
LOG_LEVEL=debug|info|warn|error
```

## Files

- `winston-config.ts` - WinstonConfig class for configuration
- `index.ts` - YieldCycleLogger, LoggerFactory, and MiddlewareFactory classes
