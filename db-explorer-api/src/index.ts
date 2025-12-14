import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import http from 'http';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import fileRoutes from './routes/files.js';
import connectionRoutes from './routes/connections.js';
import invitationRoutes from './routes/invitations.js';
import chatSessionRoutes from './routes/chatSessions.js';
import jobRoutes from './routes/jobs.js';
import notificationRoutes from './routes/notifications.js';

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
import { jobService } from './services/JobService.js';
import { webSocketService } from './services/WebSocketService.js';
import { registerAllWorkers } from './workers/index.js';

// Load environment variables from single .env file
dotenv.config();

const environment = process.env.NODE_ENV || 'development';
console.log(`Loading environment: ${environment}`);

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
app.use('/api/chat-sessions', apiRateLimit, chatSessionRoutes);
app.use('/api/jobs', apiRateLimit, jobRoutes);
app.use('/api/notifications', apiRateLimit, notificationRoutes);

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

// Create HTTP server (needed for Socket.IO)
const server = http.createServer(app);

// Initialize services
async function initializeServices() {
  try {
    console.log('🔧 Initializing services...');

    // Initialize Job Service (pg-boss)
    console.log('📦 Initializing job queue...');
    await jobService.initialize();
    console.log('✅ Job queue initialized');

    // Register job workers
    console.log('👷 Registering job workers...');
    await registerAllWorkers();
    console.log('✅ Job workers registered');

    // Initialize WebSocket Service
    console.log('🔌 Initializing WebSocket service...');
    webSocketService.initialize(server);
    console.log('✅ WebSocket service initialized');

    // Start schema training scheduler
    // Default: Every Sunday at 2:00 AM
    // Can be overridden with SCHEMA_TRAINING_CRON env variable
    const cronExpression = process.env.SCHEMA_TRAINING_CRON || '0 2 * * 0';
    schemaTrainingScheduler.start(cronExpression);
    console.log(`📅 Schema training scheduler started (cron: ${cronExpression})`);

    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Check if running in serverless environment (Vercel)
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Start server only if not in serverless environment
if (!isServerless) {
  server.listen(PORT, async () => {
    const env = process.env.NODE_ENV || 'development';

    let baseUrl;
    if (env === 'production') {
      baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${PORT}`;
    } else {
      baseUrl = `http://localhost:${PORT}`;
    }

    console.log(`🚀 DB Explorer API Server is running on port ${PORT}`);
    console.log(`📊 Environment: ${env}`);
    console.log(`🌐 Health check: ${baseUrl}/health`);
    console.log(`📖 API Base URL: ${baseUrl}/api`);
    console.log(`🔌 WebSocket URL: ${baseUrl}`);

    // Initialize services after server starts
    await initializeServices();
  });
} else {
  // In serverless mode, initialize services without starting HTTP server
  // Note: WebSocket and some long-running services may not work in serverless
  console.log('🔧 Running in serverless mode (Vercel)');
  try {
    await jobService.initialize();
    await registerAllWorkers();
    console.log('✅ Services initialized for serverless mode');
  } catch (error) {
    console.error('⚠️ Some services may not be available in serverless mode:', error);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  try {
    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed');
    });

    // Stop schema training scheduler
    console.log('Stopping schema training scheduler...');
    schemaTrainingScheduler.stop();

    // Stop job service (wait for active jobs to complete)
    console.log('Stopping job service...');
    await jobService.stop();

    // Close WebSocket connections
    console.log('Closing WebSocket connections...');
    await webSocketService.close();

    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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
