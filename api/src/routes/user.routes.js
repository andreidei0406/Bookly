import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import { requirePlatformRole } from '../middleware/rbac.middleware.js';
import {
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/user.validator.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/users/me
 * @desc Get the authenticated user's profile
 * @access Private
 */
router.get('/me', userController.getProfile);

/**
 * @route PATCH /api/v1/users/me
 * @desc Update the authenticated user's profile
 * @access Private
 */
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);

/**
 * @route PATCH /api/v1/users/me/password
 * @desc Change the authenticated user's password
 * @access Private
 */
router.patch(
  '/me/password',
  validate(changePasswordSchema),
  userController.changePassword
);

/**
 * @route GET /api/v1/users
 * @desc List all users (SUPER_ADMIN only)
 * @access Private (SUPER_ADMIN)
 */
router.get('/', requirePlatformRole('SUPER_ADMIN'), userController.listUsers);

export default router;
