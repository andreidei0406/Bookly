/**
 * @module validators/user
 * @description Zod validation schemas for user profile endpoints.
 */

import { z } from 'zod';

/**
 * Password validation schema with strong complexity requirements.
 * Requires at least 8 characters with uppercase, lowercase, digit, and special character.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character'
  );

/**
 * Schema for updating user profile.
 * All fields are optional — only provided fields will be updated.
 * @type {{ body: z.ZodObject }}
 */
export const updateProfileSchema = {
  body: z.object({
    firstName: z
      .string()
      .min(1, 'First name cannot be empty')
      .max(50, 'First name must be at most 50 characters')
      .trim()
      .optional(),
    lastName: z
      .string()
      .min(1, 'Last name cannot be empty')
      .max(50, 'Last name must be at most 50 characters')
      .trim()
      .optional(),
    phone: z
      .string()
      .trim()
      .optional(),
    avatar: z
      .string()
      .url('Avatar must be a valid URL')
      .optional(),
  }),
};

/**
 * Schema for changing user password.
 * @type {{ body: z.ZodObject }}
 */
export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string({ required_error: 'Current password is required' }),
    newPassword: passwordSchema,
  }),
};
