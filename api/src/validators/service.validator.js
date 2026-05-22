/**
 * @module validators/service
 * @description Zod validation schemas for service endpoints.
 */

import { z } from 'zod';

/**
 * Schema for creating a new service.
 * @type {{ body: z.ZodObject }}
 */
export const createServiceSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Service name is required' })
      .min(1, 'Service name is required')
      .max(100, 'Service name must be at most 100 characters')
      .trim(),
    description: z
      .string()
      .trim()
      .optional(),
    duration: z
      .number({ required_error: 'Duration is required' })
      .int('Duration must be a whole number of minutes')
      .positive('Duration must be a positive number'),
    price: z
      .number({ required_error: 'Price is required' })
      .nonnegative('Price must be zero or a positive number'),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .default('USD')
      .optional(),
    color: z
      .string()
      .trim()
      .optional(),
  }),
};

/**
 * Schema for updating an existing service.
 * All fields are optional.
 * @type {{ body: z.ZodObject }}
 */
export const updateServiceSchema = {
  body: z.object({
    name: z
      .string()
      .min(1, 'Service name cannot be empty')
      .max(100, 'Service name must be at most 100 characters')
      .trim()
      .optional(),
    description: z
      .string()
      .trim()
      .optional(),
    duration: z
      .number()
      .int('Duration must be a whole number of minutes')
      .positive('Duration must be a positive number')
      .optional(),
    price: z
      .number()
      .nonnegative('Price must be zero or a positive number')
      .optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .optional(),
    color: z
      .string()
      .trim()
      .optional(),
  }),
};
