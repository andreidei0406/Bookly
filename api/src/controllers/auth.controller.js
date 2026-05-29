import { created, success, noContent } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as authService from '../services/auth.service.js';
import prisma from '../utils/prisma.js';
import { syncMissingMeetLinks } from '../services/booking.service.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Register a new user account.
 * @route POST /api/v1/auth/register
 */
export const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return created(res, { data: { user: result.user } });
});

/**
 * Authenticate a user and return tokens.
 * @route POST /api/v1/auth/login
 */
export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return success(res, { data: { user: result.user } });
});

/**
 * Refresh an access token using a refresh token.
 * @route POST /api/v1/auth/refresh-token
 */
export const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token missing' });
  }

  const result = await authService.refreshToken({ refreshToken: token });
  
  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return success(res, { message: 'Tokens refreshed' });
});

/**
 * Logout the current user (invalidate refresh token).
 * @route POST /api/v1/auth/logout
 */
export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  return noContent(res);
});

/**
 * Send a password reset email if the account exists.
 * @route POST /api/v1/auth/forgot-password
 */
export const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body);
  return success(res, { message: 'If email exists, reset link sent' });
});

/**
 * Reset the user's password using a valid reset token.
 * @route POST /api/v1/auth/reset-password/:token
 */
export const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.params.token, req.body);
  return success(res, { message: 'Password reset successful' });
});

/**
 * Handle Google OAuth callback and redirect to frontend with tokens.
 * @route GET /api/v1/auth/google/callback
 */
export const googleCallback = catchAsync(async (req, res) => {
  // req.user contains the googleData from passport
  const googleData = req.user;
  let currentUserId = null;

  // Determine if the user is already logged in by verifying the accessToken cookie
  const token = req.cookies?.accessToken;
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      currentUserId = decoded.id;
    } catch (err) {
      // Ignore expired/invalid token cookie
    }
  }

  const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:4200';

  if (currentUserId) {
    // 1. LINKING FLOW: User is already logged in, connect Google to their current Bookly session
    await authService.linkGoogleAccount(currentUserId, googleData);
    
    // Redirect back to settings page directly
    const redirectUrl = new URL(`${frontendUrl}/dashboard/settings`);
    res.redirect(redirectUrl.toString());
  } else {
    // 2. SIGN IN / LOGIN FLOW: Standard OAuth sign-in flow
    const result = await authService.googleLogin(googleData);
    
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Must be lax or none for OAuth redirect back
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    const redirectUrl = new URL(`${frontendUrl}/dashboard`);
    res.redirect(redirectUrl.toString());
  }
});

/**
 * Get current user profile.
 * @route GET /api/v1/auth/me
 */
export const getMe = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });
  
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  // Background-sync any missing Google Meet links now that the host is logged in/online
  syncMissingMeetLinks(user.id);
  
  // exclude password
  const { password, ...safeUser } = user;
  
  return success(res, { data: safeUser });
});

/**
 * Disconnect Google account
 * @route DELETE /api/v1/auth/google
 */
export const disconnectGoogle = catchAsync(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      googleId: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    }
  });
  
  const { password, ...safeUser } = user;
  return success(res, { data: safeUser, message: 'Google account disconnected' });
});
