import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import middleware (note some imports commented due to previous issues)
// import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import { RESPONSE_MESSAGES } from './config/constants';

// Create Express application
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Yield Cycle API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      deposit: '/api/v1/deposit',
      dashboard: '/api/v1/dashboard',
      sync: '/api/v1/sync',
    },
  });
});

// API v1 routes
const API_PREFIX = '/api/v1';

// Authentication routes (placeholder)
app.use(`${API_PREFIX}/auth`, (req, res, _next) => {
  res.status(501).json({
    success: false,
    message: 'Authentication routes not implemented yet',
    code: 'NOT_IMPLEMENTED'
  });
});

// Deposit routes (placeholder)
app.use(`${API_PREFIX}/deposit`, (req, res, _next) => {
  res.status(501).json({
    success: false,
    message: 'Deposit routes not implemented yet',
    code: 'NOT_IMPLEMENTED'
  });
});

// Dashboard routes (placeholder)
app.use(`${API_PREFIX}/dashboard`, (req, res, _next) => {
  res.status(501).json({
    success: false,
    message: 'Dashboard routes not implemented yet',
    code: 'NOT_IMPLEMENTED'
  });
});

// Sync routes (placeholder)
app.use(`${API_PREFIX}/sync`, (req, res, _next) => {
  res.status(501).json({
    success: false,
    message: 'Sync routes not implemented yet',
    code: 'NOT_IMPLEMENTED'
  });
});

// TODO: Add actual route implementations
// app.use(`${API_PREFIX}/auth`, authRoutes);
// app.use(`${API_PREFIX}/deposit`, depositRoutes);
// app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
// app.use(`${API_PREFIX}/sync`, syncRoutes);

// 404 handler for unmatched routes
app.use((req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler (commented until import is fixed)
// app.use(globalErrorHandler);

// Basic error handler (temporary)
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || RESPONSE_MESSAGES.SERVER_ERROR,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app; 