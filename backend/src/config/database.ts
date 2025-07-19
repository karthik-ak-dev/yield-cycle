import * as AWS from 'aws-sdk';

export class DatabaseConfig {
  private static instance: DatabaseConfig;
  private documentClient: AWS.DynamoDB.DocumentClient;

  private constructor() {
    // Configure AWS SDK
    AWS.config.update({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // Create DynamoDB DocumentClient with retry configuration
    this.documentClient = new AWS.DynamoDB.DocumentClient({
      maxRetries: 3,
      retryDelayOptions: {
        customBackoff: (retryCount: number) => Math.pow(2, retryCount) * 100,
      },
    });
  }

  public static getInstance(): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig();
    }
    return DatabaseConfig.instance;
  }

  public getDocumentClient(): AWS.DynamoDB.DocumentClient {
    return this.documentClient;
  }

  // Table names configuration
  public static readonly TABLES = {
    USERS: process.env.USERS_TABLE || 'yield-cycle-users',
    DEPOSITS: process.env.DEPOSITS_TABLE || 'yield-cycle-deposits',
    WALLETS: process.env.WALLETS_TABLE || 'yield-cycle-wallets',
    MONTHLY_EARNINGS: process.env.MONTHLY_EARNINGS_TABLE || 'yield-cycle-monthly-earnings',
    COMMISSIONS: process.env.COMMISSIONS_TABLE || 'yield-cycle-commissions',
    ACHIEVEMENTS: process.env.ACHIEVEMENTS_TABLE || 'yield-cycle-achievements',
    REFERRAL_TREE: process.env.REFERRAL_TREE_TABLE || 'yield-cycle-referral-tree',
  };

  // Test database connection
  public async testConnection(): Promise<boolean> {
    try {
      await this.documentClient.scan({
        TableName: DatabaseConfig.TABLES.USERS,
        Limit: 1,
      }).promise();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

export const dbClient = DatabaseConfig.getInstance().getDocumentClient();
export const TABLES = DatabaseConfig.TABLES; 