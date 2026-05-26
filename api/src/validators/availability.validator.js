/**
 * @module validators/availability
 * @description Zod validation schemas for availability endpoints.
 */

import { z } from 'zod';

/**
 * Time pattern: HH:mm format (24-hour).
 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Schema for querying available appointment slots.
 * @type {{ query: z.ZodObject }}
 */
export const availableSlotsSchema = {
  query: z.object({
    date: z
      .string({ required_error: 'Date is required' })
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        'Date must be in YYYY-MM-DD format'
      ),
    duration: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 30)),
  }),
};

/**
 * Schema for creating a specific availability block.
 * @type {{ body: z.ZodObject }}
 */
export const createBlockSchema = {
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    startTime: z.string().regex(timeRegex, 'Open time must be in HH:mm format (24-hour)'),
    endTime: z.string().regex(timeRegex, 'Close time must be in HH:mm format (24-hour)'),
  }),
};
