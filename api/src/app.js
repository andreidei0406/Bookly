import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import config from './config/index.js';
import logger from './config/logger.js';
import { globalLimiter } from './middleware/rateLimiter.middleware.js';
import errorHandler from './middleware/errorHandler.middleware.js';
import routes from './routes/index.js';
import prisma from './utils/prisma.js';
import ApiError from './utils/apiError.js';
import passport from './config/passport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);

/** HTTP request logging */
app.use(pinoHttp({ logger }));

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

/** Security headers (CSP and HSTS disabled to allow HTTP localhost access and Angular assets) */
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: false,
}));

/** CORS */
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

/** Cookie parsing */
app.use(cookieParser());

/** Body parsing */
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health check (before rate limiter — K8s probes must not be throttled)
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

/** Global rate limiter - only applied to API routes */
app.use('/api', globalLimiter);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.use(passport.initialize());
app.use('/api/v1', routes);

// ---------------------------------------------------------------------------
// Static frontend serving (production Angular SPA)
// ---------------------------------------------------------------------------

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback — any route not matching API or static files serves index.html
app.use((req, res, next) => {
  // Skip API and health routes (they're already handled above)
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next(new ApiError(404, 'Route not found'));
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---------------------------------------------------------------------------
// Global error handler (must be last)
// ---------------------------------------------------------------------------

app.use(errorHandler);

export default app;

