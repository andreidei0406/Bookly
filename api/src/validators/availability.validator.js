/**
 * @module validators/availability
 * @description Zod validation schemas for availability and working-hours endpoints.
 */

import { z } from 'zod';

/**
 * Time pattern: HH:mm format (24-hour).
 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Days of the week enum values.
 */
const daysOfWeek = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

/**
 * Schema for setting business working hours.
 * Accepts an array of day-specific hour objects.
 * @type {{ body: z.ZodObject }}
 */
export const workingHoursSchema = {
  body: z.object({
    hours: z
      .array(
        z.object({
          dayOfWeek: z.enum(daysOfWeek, {
            required_error: 'Day of week is required',
            invalid_type_error: `Day of week must be one of: ${daysOfWeek.join(', ')}`,
          }),
          openTime: z
            .string({ required_error: 'Open time is required' })
            .regex(timeRegex, 'Open time must be in HH:mm format (24-hour)'),
          closeTime: z
            .string({ required_error: 'Close time is required' })
            .regex(timeRegex, 'Close time must be in HH:mm format (24-hour)'),
          isClosed: z.boolean({ required_error: 'isClosed is required' }),
        })
      )
      .min(1, 'At least one working-hours entry is required'),
  }),
};

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
    serviceId: z.string({ required_error: 'Service ID is required' }),
  }),
};
