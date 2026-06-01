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
import prisma from '../utils/prisma.js';
import { verifyAccessToken, generateStateToken, verifyRefreshToken } from '../utils/tokens.js';

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
  (req, res, next) => {
    const isLinkAction = req.query?.action === 'link';
    let stateToken = undefined;
    let userId = null;
    
    if (isLinkAction) {
      const token = req.cookies?.accessToken;
      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          userId = decoded.id;
        } catch {
          // Ignore invalid/expired token cookie
        }
      }

      // Fallback to refresh token if access token has expired or is missing
      if (!userId && req.cookies?.refreshToken) {
        try {
          const decoded = verifyRefreshToken(req.cookies.refreshToken);
          userId = decoded.sub || decoded.id;
        } catch {
          // Ignore invalid/expired refresh token
        }
      }

      if (userId) {
        stateToken = generateStateToken({ userId });
      }
    }

    passport.authenticate('google', {
      scope: [
        'profile', 
        'email', 
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      accessType: 'offline', // Request a refresh token
      prompt: 'consent',     // Force consent screen to always get refresh token
      ...(stateToken && { state: stateToken }),
    })(req, res, next);
  }
);


router.get(
  '/google/callback',
  (req, res, next) => {
    if (req.query?.state) {
      req.oauthState = req.query.state;
    }
    next();
  },
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
