/**
 * @module services/user
 * @description User profile management service including profile retrieval,
 * updates, password changes, and admin user listing.
 */

import bcrypt from 'bcrypt';
import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

const BCRYPT_ROUNDS = 12;

/** Fields to always exclude from user responses. */
const USER_SELECT_SAFE = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Get a user's profile by ID.
 * @param {string} userId - The user's ID.
 * @returns {Promise<object>} The user profile (without password).
 */
export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT_SAFE,
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return user;
}

/**
 * Update a user's profile.
 * @param {string} userId - The user's ID.
 * @param {object} data - Fields to update (firstName, lastName, phone, avatar).
 * @returns {Promise<object>} The updated user profile (without password).
 */
export async function updateProfile(userId, data) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
    select: USER_SELECT_SAFE,
  });

  logger.info(`Profile updated for user: ${userId}`);

  return updatedUser;
}

/**
 * Change a user's password.
 * @param {string} userId - The user's ID.
 * @param {object} params
 * @param {string} params.currentPassword - The current password for verification.
 * @param {string} params.newPassword - The new password.
 * @returns {Promise<void>}
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  logger.info(`Password changed for user: ${userId}`);
}

/**
 * List all users with pagination (SUPER_ADMIN only).
 * @param {object} params
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit=20] - Items per page.
 * @returns {Promise<{data: object[], meta: object}>} Paginated user list.
 */
export async function listUsers({ page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      select: USER_SELECT_SAFE,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  return {
    data: users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
