import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import * as availabilityController from '../controllers/availability.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import {
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/user.validator.js';
import { availableSlotsSchema } from '../validators/availability.validator.js';

const router = Router();

// Private routes (defined first to prevent wildcard shadowing)
/**
 * @route GET /api/v1/users/me
 * @desc Get the authenticated user's profile
 * @access Private
 */
router.get('/me', authenticate, userController.getProfile);

/**
 * @route PATCH /api/v1/users/me
 * @desc Update the authenticated user's profile
 * @access Private
 */
router.patch('/me', authenticate, validate(updateProfileSchema), userController.updateProfile);

/**
 * @route PATCH /api/v1/users/me/password
 * @desc Change the authenticated user's password
 * @access Private
 */
router.patch(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  userController.changePassword
);

// Public routes
/**
 * @route GET /api/v1/users/:username
 * @desc Get user profile for public booking page
 * @access Public
 */
router.get('/:username', userController.getPublicProfile);

/**
 * @route GET /api/v1/users/:username/availability/slots
 * @desc Get available booking slots for a user
 * @access Public
 */
router.get(
  '/:username/availability/slots',
  validate(availableSlotsSchema, 'query'),
  availabilityController.getAvailableSlots
);

/**
 * @route GET /api/v1/users/:username/availability/days
 * @desc Get available booking days for a user in a month
 * @access Public
 */
router.get(
  '/:username/availability/days',
  availabilityController.getAvailableDays
);

export default router;
