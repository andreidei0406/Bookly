/**
 * @module middleware/rateLimiter
 * @description Rate limiting middleware for the Bookly API.
 * Provides a global limiter for all routes and a stricter
 * limiter for authentication endpoints (login, register, forgot-password).
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import ApiError from '../utils/apiError.js';

/**
 * Global rate limiter applied to all API routes.
 * Uses configuration values from config.rateLimit.
 *
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many requests, please try again later'
      )
    );
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 * 15-minute window with a maximum of 10 requests.
 *
 * @type {import('express-rate-limit').RateLimitRequestHandler}
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      ApiError.tooManyRequests(
        'Too many authentication attempts, please try again after 15 minutes'
      )
    );
  },
});
