import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';
import passport from '../config/passport.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register
);

/**
 * @route POST /api/v1/auth/login
 * @desc Authenticate user and return tokens
 * @access Public
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * @route POST /api/v1/auth/refresh-token
 * @desc Refresh access token using a refresh token
 * @access Public
 */
router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  authController.refreshToken
);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout and invalidate refresh token
 * @access Private
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current user profile based on cookie
 * @access Private
 */
router.get(
  '/me',
  authenticate,
  authController.getMe
);

/**
 * @route POST /api/v1/auth/forgot-password
 * @desc Send password reset email
 * @access Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @route POST /api/v1/auth/reset-password/:token
 * @desc Reset password using a valid token
 * @access Public
 */
router.post(
  '/reset-password/:token',
  validate(resetPasswordSchema),
  authController.resetPassword
);

/**
 * @route GET /api/v1/auth/google
 * @desc Initiate Google OAuth flow
 * @access Public
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: [
      'profile', 
      'email', 
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    accessType: 'offline', // Request a refresh token
    prompt: 'consent',     // Force consent screen to always get refresh token
  })
);

/**
 * @route GET /api/v1/auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback
);

/**
 * @route DELETE /api/v1/auth/google
 * @desc Disconnect Google account
 * @access Private
 */
router.delete(
  '/google',
  authenticate,
  authController.disconnectGoogle
);

export default router;
