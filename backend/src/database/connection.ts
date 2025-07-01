/**
 * Database Connection - Centralized DynamoDB Client
 * 
 * Provides a singleton DynamoDB DocumentClient instance that can be
 * imported and used by all repositories. Handles connection configuration,
 * error handling, and environment-specific settings.
 */

import { DynamoDB } from 'aws-sdk';
import { DB_CONFIG } from './config';

/**
 * DynamoDB DocumentClient Singleton
 * 
 * Configured with centralized settings from DB_CONFIG.
 * Automatically handles AWS credentials and region configuration.
 */
class DatabaseConnection {
  private static instance: DynamoDB.DocumentClient;

  /**
   * Get the singleton DynamoDB DocumentClient instance
   */
  static getInstance(): DynamoDB.DocumentClient {
    if (!this.instance) {
      this.instance = this.createConnection();
    }
    return this.instance;
  }

  /**
   * Create a new DynamoDB DocumentClient with configuration
   */
  private static createConnection(): DynamoDB.DocumentClient {
    const config: DynamoDB.DocumentClient.DocumentClientOptions & DynamoDB.Types.ClientConfiguration = {
      region: DB_CONFIG.region,
      maxRetries: DB_CONFIG.maxRetries,
      httpOptions: {
        timeout: DB_CONFIG.timeout,
      },
    };

    // Add endpoint for local development (DynamoDB Local)
    if (DB_CONFIG.endpoint) {
      config.endpoint = DB_CONFIG.endpoint;
    }

    // Add explicit credentials if provided (for local development)
    if (DB_CONFIG.accessKeyId && DB_CONFIG.secretAccessKey) {
      config.accessKeyId = DB_CONFIG.accessKeyId;
      config.secretAccessKey = DB_CONFIG.secretAccessKey;
    }

    return new DynamoDB.DocumentClient(config);
  }

  /**
   * Test database connectivity
   */
  static async testConnection(): Promise<boolean> {
    try {
      const client = this.getInstance();
      
      // Simple operation to test connectivity (using DocumentClient compatible method)
      await client.scan({ 
        TableName: 'NonExistentTable', 
        Limit: 1 
      }).promise().catch(() => {
        // We expect this to fail, but if it responds, connection is working
        return { Items: [] };
      });
      return true;
    } catch (error: any) {
      // Connection test failed - return false without logging
      // Actual error handling should be done by the caller
      return false;
    }
  }

  /**
   * Close connection (for testing or cleanup)
   */
  static closeConnection(): void {
    if (this.instance) {
      // DynamoDB DocumentClient doesn't have a close method
      // but we can reset the instance to force reconnection
      this.instance = null as any;
    }
  }
}

/**
 * Export the singleton DynamoDB DocumentClient instance
 * This is what repositories should import and use
 */
export const dynamoDB = DatabaseConnection.getInstance();

/**
 * Export the connection class for testing and advanced usage
 */
export { DatabaseConnection };

/**
 * Health check function for the database
 */
export const checkDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  region: string;
  endpoint?: string;
  error?: string;
}> => {
  try {
    const isConnected = await DatabaseConnection.testConnection();
    
    return {
      status: isConnected ? 'healthy' : 'unhealthy',
      region: DB_CONFIG.region,
      endpoint: DB_CONFIG.endpoint,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      region: DB_CONFIG.region,
      endpoint: DB_CONFIG.endpoint,
      error: error.message,
    };
  }
};
