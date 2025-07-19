import app from './app';

// Server configuration
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Test database connection (when imports are fixed)
    // const dbConnected = await DatabaseConfig.getInstance().testConnection();
    // if (!dbConnected) {
    //   throw new Error('Database connection failed');
    // }
    
    // Test blockchain connection (when imports are fixed)
    // const blockchainConnected = await blockchainConfig.testConnection();
    // if (!blockchainConnected) {
    //   console.warn('Blockchain connection failed - some features may not work');
    // }

    console.log('🔗 Database connection: Pending (implementation needed)');
    console.log('⛓️  Blockchain connection: Pending (implementation needed)');

    // Start HTTP server
    app.listen(PORT, HOST, () => {
      console.log(`
🚀 Yield Cycle Backend Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Server URL: http://${HOST}:${PORT}
🏥 Health Check: http://${HOST}:${PORT}/health
📊 API Status: http://${HOST}:${PORT}/api/status
📚 API Base: http://${HOST}:${PORT}/api/v1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle startup errors
startServer().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
}); 