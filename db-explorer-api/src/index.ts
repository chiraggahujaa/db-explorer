import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import fileRoutes from './routes/files.js';
import connectionRoutes from './routes/connections.js';
import invitationRoutes from './routes/invitations.js';

// Import middleware
import {
  helmetConfig,
  compressionMiddleware,
  loggingMiddleware,
  apiLoggingMiddleware,
  errorHandler,
  corsOptions,
  generalRateLimit,
  apiRateLimit,
  uploadRateLimit,
  authRateLimit,
  maintenanceMode,
  requestTimeout,
  validateContentType,
} from './middleware/security.js';

// Import services
import { schemaTrainingScheduler } from './services/SchemaTrainingScheduler.js';

const environment = process.env.NODE_ENV || 'development';
console.log(`Loading environment: ${environment}`);
dotenv.config({ path: `.env.${environment}` });

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmetConfig);
app.use(compressionMiddleware);
app.use(maintenanceMode);
app.use(requestTimeout());

// CORS
app.use(cors(corsOptions));

// Logging
app.use(loggingMiddleware);
app.use(apiLoggingMiddleware);

// Rate limiting
app.use(generalRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Content type validation for API routes
app.use('/api', validateContentType(['application/json', 'multipart/form-data']));

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'DB Explorer API is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// API routes with specific rate limits
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/users', apiRateLimit, userRoutes);
app.use('/api/files', uploadRateLimit, fileRoutes);
app.use('/api/connections', apiRateLimit, connectionRoutes);
app.use('/api/invitations', apiRateLimit, invitationRoutes);

// 404 handler - must be after all routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Error handling middleware - must be last
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';
  
  let baseUrl;
  if (env === 'production') {
    baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN;
  } else {
    baseUrl = `http://localhost:${PORT}`;
  }
  
  console.log(`🚀 DB Explorer API Server is running on port ${PORT}`);
  console.log(`📊 Environment: ${env}`);
  console.log(`🌐 Health check: ${baseUrl}/health`);
  console.log(`📖 API Base URL: ${baseUrl}/api`);

  // Start schema training scheduler
  // Default: Every Sunday at 2:00 AM
  // Can be overridden with SCHEMA_TRAINING_CRON env variable
  const cronExpression = process.env.SCHEMA_TRAINING_CRON || '0 2 * * 0';
  schemaTrainingScheduler.start(cronExpression);
  console.log(`📅 Schema training scheduler started (cron: ${cronExpression})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  schemaTrainingScheduler.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  schemaTrainingScheduler.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

export default app;
