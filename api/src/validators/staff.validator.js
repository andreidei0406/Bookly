/**
 * @module validators/staff
 * @description Zod validation schemas for staff schedule endpoints.
 */

import { z } from 'zod';

/**
 * Time pattern: HH:mm format (24-hour).
 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Schema for creating or updating a staff schedule entry.
 * @type {{ body: z.ZodObject }}
 */
export const staffScheduleSchema = {
  body: z.object({
    date: z
      .string({ required_error: 'Date is required' })
      .date('Date must be a valid date string (YYYY-MM-DD)'),
    startTime: z
      .string()
      .regex(timeRegex, 'Start time must be in HH:mm format (24-hour)')
      .optional(),
    endTime: z
      .string()
      .regex(timeRegex, 'End time must be in HH:mm format (24-hour)')
      .optional(),
    isAvailable: z.boolean({ required_error: 'isAvailable is required' }),
    note: z
      .string()
      .trim()
      .optional(),
  }),
};
