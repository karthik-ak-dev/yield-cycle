import * as winston from 'winston';

/**
 * Configuration options for the logger
 */
export interface LoggerConfigOptions {
  environment?: string;
  logLevel?: string;
  serviceName?: string;
  enableColors?: boolean;
}

/**
 * Winston Logger Configuration Class
 * Encapsulates all Winston setup and configuration logic
 */
export class WinstonConfig {
  private readonly environment: string;
  private readonly logLevel: string;
  private readonly serviceName: string;
  private readonly enableColors: boolean;

  constructor(options: LoggerConfigOptions = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 
                   (this.environment === 'production' ? 'info' : 'debug');
    this.serviceName = options.serviceName || 'yieldcycle-api';
    this.enableColors = options.enableColors ?? (this.environment === 'development');
  }

  /**
   * Create production format for CloudWatch
   */
  private createProductionFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
  }

  /**
   * Create development format for console
   */
  private createDevelopmentFormat(): winston.Logform.Format {
    const baseFormat = [
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    ];

    if (this.enableColors) {
      baseFormat.unshift(winston.format.colorize());
    }

    return winston.format.combine(...baseFormat);
  }

  /**
   * Get the appropriate format based on environment
   */
  private getFormat(): winston.Logform.Format {
    return this.environment === 'development' 
      ? this.createDevelopmentFormat() 
      : this.createProductionFormat();
  }

  /**
   * Create and configure the Winston logger instance
   */
  public createLogger(): winston.Logger {
    return winston.createLogger({
      level: this.logLevel,
      format: this.getFormat(),
      defaultMeta: {
        service: this.serviceName,
        environment: this.environment,
      },
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          handleRejections: true,
        })
      ],
      exitOnError: false,
      silent: this.environment === 'test',
    });
  }

  /**
   * Create HTTP log stream for Morgan middleware
   */
  public createHttpLogStream(logger: winston.Logger): { write: (message: string) => void } {
    return {
      write: (message: string) => {
        logger.http(message.trim());
      },
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): LoggerConfigOptions {
    return {
      environment: this.environment,
      logLevel: this.logLevel,
      serviceName: this.serviceName,
      enableColors: this.enableColors,
    };
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.environment === 'development';
  }

  /**
   * Check if running in production mode
   */
  public isProduction(): boolean {
    return this.environment === 'production';
  }
}

// Create default configuration instance
const winstonConfig = new WinstonConfig();

// Export configured logger and http stream for backwards compatibility
export const logger = winstonConfig.createLogger();
export const httpLogStream = winstonConfig.createHttpLogStream(logger);

// Export default configuration instance
export default winstonConfig;
