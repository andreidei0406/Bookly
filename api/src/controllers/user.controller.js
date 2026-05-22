import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as userService from '../services/user.service.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * Get the authenticated user's profile.
 * @route GET /api/v1/users/me
 */
export const getProfile = catchAsync(async (req, res) => {
  const result = await userService.getProfile(req.user.id);
  return success(res, { data: result });
});

/**
 * Update the authenticated user's profile.
 * @route PATCH /api/v1/users/me
 */
export const updateProfile = catchAsync(async (req, res) => {
  const result = await userService.updateProfile(req.user.id, req.body);
  return success(res, { data: result });
});

/**
 * Change the authenticated user's password.
 * @route PATCH /api/v1/users/me/password
 */
export const changePassword = catchAsync(async (req, res) => {
  await userService.changePassword(req.user.id, req.body);
  return success(res, { message: 'Password changed successfully' });
});

/**
 * List all users (SUPER_ADMIN only).
 * @route GET /api/v1/users
 */
export const listUsers = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { data, meta } = await userService.listUsers(pagination);
  return success(res, { data, meta });
});
