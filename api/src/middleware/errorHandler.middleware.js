/**
 * @module middleware/errorHandler
 * @description Global error handling middleware for the Bookly API.
 * Normalizes errors from various sources (ApiError, Prisma, JWT, Zod)
 * into a consistent JSON response format.
 */

import { Prisma } from '../prisma/client/client.ts';
import { ZodError } from 'zod';
import ApiError from '../utils/apiError.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Extract the field name from a Prisma unique constraint violation.
 *
 * @param {import('@prisma/client').Prisma.PrismaClientKnownRequestError} error
 * @returns {string} Human-readable field description
 */
const extractPrismaUniqueField = (error) => {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.join(', ');
  }
  if (typeof target === 'string') {
    return target;
  }
  return 'unknown field';
};

/**
 * Format Zod validation issues into a structured error array.
 *
 * @param {ZodError} zodError
 * @returns {Array<{field: string, message: string}>}
 */
const formatZodIssues = (zodError) => zodError.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

/**
 * Global Express error handler middleware.
 * Must be registered as the last middleware in the Express app (4-param signature).
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = undefined;

  // --- ApiError (our custom error class) ---
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors || undefined;
  }

  // --- Prisma known request errors ---
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        const field = extractPrismaUniqueField(err);
        message = `A record with this ${field} already exists`;
        break;
      }
      case 'P2025': {
        statusCode = 404;
        message = err.meta?.cause || 'Record not found';
        break;
      }
      default: {
        statusCode = 400;
        message = `Database error: ${err.message}`;
        break;
      }
    }
  }

  // --- Prisma validation errors ---
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided to the database';
  }

  // --- JWT errors ---
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired';
  }

  // --- Zod validation errors ---
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = formatZodIssues(err);
  }

  // --- Log the error ---
  const logPayload = {
    statusCode,
    message,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    ...(req.user && { userId: req.user.id }),
  };

  if (statusCode >= 500) {
    logger.error({ ...logPayload, err }, 'Server error');
  } else {
    logger.warn(logPayload, 'Client error');
  }

  // --- Build response ---
  const response = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(config.env === 'development' && {
      stack: err.stack,
    }),
  };

  res.status(statusCode).json(response);
};

export default errorHandler;
