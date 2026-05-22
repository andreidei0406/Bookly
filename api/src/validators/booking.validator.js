/**
 * @module validators/booking
 * @description Zod validation schemas for booking endpoints.
 */

import { z } from 'zod';

/**
 * Time pattern: HH:mm format (24-hour).
 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Date pattern: YYYY-MM-DD format.
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schema for creating a new booking.
 * @type {{ body: z.ZodObject }}
 */
export const createBookingSchema = {
  body: z.object({
    businessId: z.string({ required_error: 'Business ID is required' }),
    serviceId: z.string({ required_error: 'Service ID is required' }),
    staffId: z
      .string()
      .optional(),
    date: z
      .string({ required_error: 'Date is required' })
      .regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
    startTime: z
      .string({ required_error: 'Start time is required' })
      .regex(timeRegex, 'Start time must be in HH:mm format (24-hour)'),
    notes: z
      .string()
      .trim()
      .optional(),
  }),
};

/**
 * Schema for updating a booking's status.
 * @type {{ body: z.ZodObject }}
 */
export const updateBookingStatusSchema = {
  body: z.object({
    status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'], {
      required_error: 'Status is required',
      invalid_type_error:
        'Status must be one of: CONFIRMED, CANCELLED, COMPLETED, NO_SHOW',
    }),
    cancelReason: z
      .string()
      .trim()
      .optional(),
  }),
};

/**
 * Schema for rescheduling a booking.
 * @type {{ body: z.ZodObject }}
 */
export const rescheduleBookingSchema = {
  body: z.object({
    date: z
      .string({ required_error: 'Date is required' })
      .regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
    startTime: z
      .string({ required_error: 'Start time is required' })
      .regex(timeRegex, 'Start time must be in HH:mm format (24-hour)'),
  }),
};
