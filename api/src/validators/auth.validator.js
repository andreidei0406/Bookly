/**
 * @module validators/auth
 * @description Zod validation schemas for authentication endpoints.
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
 * Schema for user registration.
 * @type {{ body: z.ZodObject }}
 */
export const registerSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .trim()
      .toLowerCase(),
    password: passwordSchema,
    firstName: z
      .string({ required_error: 'First name is required' })
      .min(1, 'First name is required')
      .max(50, 'First name must be at most 50 characters')
      .trim(),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .min(1, 'Last name is required')
      .max(50, 'Last name must be at most 50 characters')
      .trim(),
    phone: z
      .string()
      .trim()
      .optional(),
  }),
};

/**
 * Schema for user login.
 * @type {{ body: z.ZodObject }}
 */
export const loginSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .trim()
      .toLowerCase(),
    password: z.string({ required_error: 'Password is required' }),
  }),
};

/**
 * Schema for token refresh.
 * @type {{ body: z.ZodObject }}
 */
export const refreshTokenSchema = {
  body: z.object({
    refreshToken: z.string({ required_error: 'Refresh token is required' }),
  }),
};

/**
 * Schema for forgot password request.
 * @type {{ body: z.ZodObject }}
 */
export const forgotPasswordSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .trim()
      .toLowerCase(),
  }),
};

/**
 * Schema for password reset.
 * @type {{ body: z.ZodObject, params: z.ZodObject }}
 */
export const resetPasswordSchema = {
  body: z.object({
    password: passwordSchema,
  }),
  params: z.object({
    token: z.string({ required_error: 'Reset token is required' }),
  }),
};
