/**
 * @module services/auth
 * @description Authentication service handling registration, login, token
 * refresh, logout, and password reset flows.
 */

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokens.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from './email.service.js';

const BCRYPT_ROUNDS = 12;

/**
 * Hash a refresh token with SHA-256 for secure storage.
 * @param {string} token - The raw refresh token.
 * @returns {string} Hex-encoded SHA-256 hash.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Strip password and sensitive fields from a user object.
 * @param {object} user - Prisma user record.
 * @returns {object} User without password.
 */
function excludePassword(user) {
  if (!user) {return null;}
  const { password, ...safeUser } = user;
  return safeUser;
}

/**
 * Register a new user account.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} [params.phone]
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
export async function register({ email, password, firstName, lastName, phone }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict('A user with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
    },
    include: { memberships: { include: { business: true } } }
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store hashed refresh token
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Fire-and-forget welcome email
  sendWelcomeEmail(user);

  logger.info(`User registered: ${user.email}`);

  return {
    user: excludePassword(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Authenticate a user with email and password.
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: { memberships: { include: { business: true } } }
  });
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store hashed refresh token
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info(`User logged in: ${user.email}`);

  return {
    user: excludePassword(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh an access/refresh token pair.
 * The old refresh token is revoked and a new pair is issued (rotation).
 * @param {object} params
 * @param {string} params.refreshToken - The current refresh token.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
export async function refreshTokens({ refreshToken }) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      userId: payload.sub,
      revoked: false,
    },
  });

  if (!storedToken) {
    throw ApiError.unauthorized('Refresh token not found or already revoked');
  }

  if (storedToken.expiresAt < new Date()) {
    // Revoke expired token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });
    throw ApiError.unauthorized('Refresh token has expired');
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Store new hashed refresh token
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(newRefreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info(`Tokens refreshed for user: ${user.email}`);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout by revoking a refresh token.
 * @param {object} params
 * @param {string} params.refreshToken
 * @returns {Promise<void>}
 */
export async function logout({ refreshToken }) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    // If the token is already invalid/expired, treat logout as successful
    logger.warn('Logout called with invalid refresh token');
    return;
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      userId: payload.sub,
    },
  });

  if (storedToken && !storedToken.revoked) {
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });
  }

  logger.info(`User logged out: ${payload.sub}`);
}

/**
 * Initiate the forgot-password flow. Sends a reset email with a short-lived JWT.
 * @param {object} params
 * @param {string} params.email
 * @returns {Promise<void>}
 */
export async function forgotPassword({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    logger.warn(`Forgot password requested for non-existent email: ${email}`);
    return;
  }

  // Generate a short-lived JWT as reset token (15 minutes)
  const resetToken = jwt.sign(
    { sub: user.id, purpose: 'password-reset' },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  // Send reset email (fire-and-forget)
  sendPasswordResetEmail(user, resetToken);

  logger.info(`Password reset email sent to: ${email}`);
}

/**
 * Reset a user's password using a valid reset token.
 * @param {object} params
 * @param {string} params.token - The JWT reset token from the email.
 * @param {string} params.password - The new password.
 * @returns {Promise<void>}
 */
export async function resetPassword({ token, password }) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  if (payload.purpose !== 'password-reset') {
    throw ApiError.badRequest('Invalid reset token');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // Revoke all existing refresh tokens for security
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revoked: false },
    data: { revoked: true },
  });

  logger.info(`Password reset completed for user: ${user.email}`);
}

/**
 * Handle Google OAuth login or registration.
 * @param {object} googleData - Data from passport Google strategy
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>}
 */
export async function googleLogin(googleData) {
  const { googleId, email, firstName, lastName, avatar, accessToken, refreshToken, expiryDate } = googleData;

  let user = await prisma.user.findUnique({
    where: { googleId },
  });

  if (!user) {
    // Check if user exists by email (link accounts)
    user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Link Google to existing account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken || user.googleRefreshToken, // keep old if new is missing
          googleTokenExpiry: expiryDate,
          emailVerified: true,
        },
        include: { memberships: { include: { business: true } } },
      });
    } else {
      // Create new user via Google
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatar,
          googleId,
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
          googleTokenExpiry: expiryDate,
          emailVerified: true,
        },
        include: { memberships: { include: { business: true } } },
      });
      // Fire-and-forget welcome email
      sendWelcomeEmail(user);
    }
  } else {
    // Update existing Google user tokens
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken || user.googleRefreshToken,
        googleTokenExpiry: expiryDate,
      },
      include: { memberships: { include: { business: true } } },
    });
  }

  const appAccessToken = generateAccessToken(user);
  const appRefreshToken = generateRefreshToken(user);

  // Store hashed refresh token for the Bookly API
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(appRefreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info(`User logged in via Google: ${user.email}`);

  return {
    user: excludePassword(user),
    accessToken: appAccessToken,
    refreshToken: appRefreshToken,
  };
}
