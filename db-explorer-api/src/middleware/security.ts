// Security middleware for the DB Explorer platform

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { Request, Response, NextFunction } from 'express';
import { getFrontendUrl } from '../utils/environment.js';

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: message || {
      success: false,
      error: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General rate limit - 1000 requests per 15 minutes
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000,
  'Too many requests from this IP, please try again later'
);

// Strict rate limit for auth endpoints - 5 requests per 15 minutes
// This prevents brute force attacks on login/password reset endpoints
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5,
  'Too many authentication attempts, please try again later'
);

// API rate limit - 200 requests per 15 minutes for general API calls
export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  200,
  'API rate limit exceeded, please try again later'
);

// File upload rate limit - 50 uploads per hour
export const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  50,
  'Too many file uploads, please try again later'
);

// Search rate limit - 100 searches per 5 minutes
export const searchRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  100,
  'Too many search requests, please try again later'
);

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow cross-origin requests for API
});

// Compression middleware
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
});

// Morgan logging configuration
export const loggingMiddleware = morgan('combined', {
  skip: (req, res) => {
    // Skip logging for health checks and static assets
    return req.url === '/health' || req.url?.startsWith('/static') || false;
  },
});

// Custom logging middleware for API calls
export const apiLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip} - User: ${req.user?.id || 'anonymous'}`);
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    const success = body?.success !== false;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - Success: ${success}`);
    
    return originalJson.call(this, body);
  };
  
  next();
};

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] Error in ${req.method} ${req.url}:`, err);
  
  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let statusCode = 500;
  let message = 'Internal server error';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not found';
  } else if (err.status) {
    statusCode = err.status;
    message = err.message;
  }
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(isDevelopment && { details: err.message, stack: err.stack }),
  });
};

const parseAllowedOrigins = (): string[] => {
  const origins: string[] = [];
  
  // Parse comma-separated URLs from environment variables
  const envUrls = [
    process.env.ALLOWED_ORIGINS,
    getFrontendUrl(),
    process.env.ADMIN_URL,
  ];
  
  envUrls.forEach(urlString => {
    if (urlString) {
      const urls = urlString.split(',').map(url => url.trim()).filter(Boolean);
      origins.push(...urls);
    }
  });
  
  if (origins.length === 0 && process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001'
    );
  }
  
  return [...new Set(origins)];
};

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = parseAllowedOrigins();
    
    console.log('CORS: Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

// Request validation middleware
export const validateContentType = (contentTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method?.toUpperCase();

    // Skip validation for methods that do not have bodies by convention
    if (method === 'GET' || method === 'DELETE' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    // Only enforce Content-Type when there is actually a request body
    const contentTypeHeader = req.get('Content-Type');
    const contentLengthHeader = req.get('Content-Length');

    const hasBodyByLength = contentLengthHeader !== undefined && contentLengthHeader !== null && Number.parseInt(String(contentLengthHeader), 10) > 0;
    const hasParsedBody = typeof req.body === 'string' || (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0);
    const hasBody = hasBodyByLength || hasParsedBody;

    if (!hasBody) {
      // Allow requests with no body (e.g., POST /logout) without requiring Content-Type
      return next();
    }

    if (!contentTypeHeader || !contentTypes.some(type => contentTypeHeader.includes(type))) {
      return res.status(400).json({
        success: false,
        error: `Content-Type must be one of: ${contentTypes.join(', ')}`,
      });
    }

    next();
  };
};

// Body size validation middleware
export const validateBodySize = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('Content-Length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        success: false,
        error: `Request body too large. Maximum size: ${maxSize} bytes`,
      });
    }
    
    next();
  };
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    if (!allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied from this IP address',
      });
    }
    
    next();
  };
};

// Maintenance mode middleware
export const maintenanceMode = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Allow health checks during maintenance
    if (req.url === '/health') {
      return next();
    }
    
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable for maintenance',
      message: 'Please try again later',
    });
  }
  
  next();
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
};