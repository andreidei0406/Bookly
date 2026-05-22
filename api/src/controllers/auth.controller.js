import { created, success, noContent } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as authService from '../services/auth.service.js';

/**
 * Register a new user account.
 * @route POST /api/v1/auth/register
 */
export const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  return created(res, { data: result });
});

/**
 * Authenticate a user and return tokens.
 * @route POST /api/v1/auth/login
 */
export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  return success(res, { data: result });
});

/**
 * Refresh an access token using a refresh token.
 * @route POST /api/v1/auth/refresh-token
 */
export const refreshToken = catchAsync(async (req, res) => {
  const result = await authService.refreshToken(req.body);
  return success(res, { data: result });
});

/**
 * Logout the current user (invalidate refresh token).
 * @route POST /api/v1/auth/logout
 */
export const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id);
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
