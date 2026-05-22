/**
 * @module validators/business
 * @description Zod validation schemas for business endpoints.
 */

import { z } from 'zod';

/**
 * Slug pattern: lowercase alphanumeric characters and hyphens only.
 */
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reusable business fields object for create/update schemas.
 */
const businessFields = {
  name: z
    .string({ required_error: 'Business name is required' })
    .min(1, 'Business name is required')
    .max(100, 'Business name must be at most 100 characters')
    .trim(),
  slug: z
    .string()
    .regex(slugRegex, 'Slug must contain only lowercase alphanumeric characters and hyphens')
    .optional(),
  description: z
    .string()
    .trim()
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .toLowerCase()
    .optional(),
  phone: z
    .string()
    .trim()
    .optional(),
  address: z
    .string()
    .trim()
    .optional(),
  city: z
    .string()
    .trim()
    .optional(),
  state: z
    .string()
    .trim()
    .optional(),
  country: z
    .string()
    .trim()
    .optional(),
  zipCode: z
    .string()
    .trim()
    .optional(),
  timezone: z
    .string()
    .trim()
    .optional(),
  website: z
    .string()
    .url('Website must be a valid URL')
    .optional(),
};

/**
 * Schema for creating a new business.
 * Name is required; all other fields are optional.
 * @type {{ body: z.ZodObject }}
 */
export const createBusinessSchema = {
  body: z.object(businessFields),
};

/**
 * Schema for updating an existing business.
 * All fields are optional.
 * @type {{ body: z.ZodObject }}
 */
export const updateBusinessSchema = {
  body: z.object({
    name: z
      .string()
      .min(1, 'Business name cannot be empty')
      .max(100, 'Business name must be at most 100 characters')
      .trim()
      .optional(),
    slug: businessFields.slug,
    description: businessFields.description,
    email: businessFields.email,
    phone: businessFields.phone,
    address: businessFields.address,
    city: businessFields.city,
    state: businessFields.state,
    country: businessFields.country,
    zipCode: businessFields.zipCode,
    timezone: businessFields.timezone,
    website: businessFields.website,
  }),
};

/**
 * Schema for validating a businessId route parameter.
 * Supports both :businessId and :id parameter names.
 * @type {{ params: z.ZodObject }}
 */
export const businessIdSchema = {
  params: z.object({
    businessId: z.string({ required_error: 'Business ID is required' }).optional(),
    id: z.string({ required_error: 'Business ID is required' }).optional(),
  }).refine(
    (data) => data.businessId || data.id,
    { message: 'Business ID is required', path: ['businessId'] }
  ),
};

/**
 * Schema for adding a member to a business.
 * @type {{ body: z.ZodObject }}
 */
export const addMemberSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .trim()
      .toLowerCase(),
    role: z.enum(['OWNER', 'ADMIN', 'STAFF'], {
      required_error: 'Role is required',
      invalid_type_error: 'Role must be one of: OWNER, ADMIN, STAFF',
    }),
  }),
};
