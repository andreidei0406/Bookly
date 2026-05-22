/**
 * @module middleware/validate
 * @description Zod-based validation middleware factory for the Bookly API.
 * Accepts a schema object with optional body, params, and query keys,
 * validates the corresponding parts of the request, and replaces them
 * with the parsed (and coerced) values on success.
 */

import { ZodError } from 'zod';
import ApiError from '../utils/apiError.js';

/**
 * Format Zod validation errors into a human-readable array.
 *
 * @param {ZodError} zodError - The Zod validation error
 * @returns {Array<{field: string, message: string}>} Formatted error list
 */
const formatZodErrors = (zodError) => zodError.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

/**
 * Creates an Express middleware that validates request data against Zod schemas.
 *
 * @param {Object} schema - Object with optional `body`, `params`, and `query` Zod schemas
 * @param {import('zod').ZodSchema} [schema.body] - Schema for request body
 * @param {import('zod').ZodSchema} [schema.params] - Schema for route parameters
 * @param {import('zod').ZodSchema} [schema.query] - Schema for query string parameters
 * @returns {import('express').RequestHandler} Express middleware
 *
 * @example
 * import validate from './validate.middleware.js';
 * import { createBusinessSchema } from '../validators/business.validator.js';
 *
 * router.post('/', validate(createBusinessSchema), businessController.create);
 */
const validate = (schema) => (req, res, next) => {
  try {
    const sources = ['body', 'params', 'query'];

    for (const source of sources) {
      if (schema[source]) {
        const result = schema[source].safeParse(req[source]);

        if (!result.success) {
          const errors = formatZodErrors(result.error);
          const message = errors
            .map((e) => `${e.field ? `${e.field}: ` : ''}${e.message}`)
            .join('; ');

          throw ApiError.badRequest(`Validation failed: ${message}`, errors);
        }

        // Replace with parsed/coerced values
        req[source] = result.data;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validate;
