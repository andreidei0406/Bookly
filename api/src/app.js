import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import config from './config/index.js';
import logger from './config/logger.js';
import { globalLimiter } from './middleware/rateLimiter.middleware.js';
import errorHandler from './middleware/errorHandler.middleware.js';
import routes from './routes/index.js';
import prisma from './utils/prisma.js';
import ApiError from './utils/apiError.js';

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

/** Security headers */
app.use(helmet());

/** CORS */
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

/** Body parsing */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/** HTTP request logging */
app.use(pinoHttp({ logger }));

/** Global rate limiter */
app.use(globalLimiter);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * @route GET /health
 * @desc Application health check — verifies database connectivity
 * @access Public
 */
app.get('/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    return next(
      new ApiError(503, 'Service unavailable — database connection failed')
    );
  }
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.use('/api/v1', routes);

// ---------------------------------------------------------------------------
// 404 handler for unknown routes
// ---------------------------------------------------------------------------

app.use((_req, _res, next) => {
  next(new ApiError(404, 'Route not found'));
});

// ---------------------------------------------------------------------------
// Global error handler (must be last)
// ---------------------------------------------------------------------------

app.use(errorHandler);

export default app;
