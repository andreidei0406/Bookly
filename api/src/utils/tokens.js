/**
 * @module tokens
 * @description JWT helper functions for generating and verifying
 * access and refresh tokens used in authentication.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Generates a short-lived access token.
 * @param {object} user - User object from Prisma
 * @returns {string} Signed JWT access token
 */
export const generateAccessToken = (user) => {
  const payload = {
    id: user.id,
    sub: user.id,
    email: user.email,
    username: user.username,
    platformRole: user.platformRole,
  };
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  });
};

/**
 * Generates a long-lived refresh token.
 * @param {object} user - User object from Prisma
 * @returns {string} Signed JWT refresh token
 */
export const generateRefreshToken = (user) => {
  const payload = {
    id: user.id,
    sub: user.id,
  };
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
};

/**
 * Verifies and decodes an access token.
 * @param {string} token - JWT access token to verify
 * @returns {object} Decoded token payload
 * @throws {import('jsonwebtoken').JsonWebTokenError} If the token is invalid or expired
 */
export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.accessSecret);

/**
 * Verifies and decodes a refresh token.
 * @param {string} token - JWT refresh token to verify
 * @returns {object} Decoded token payload
 * @throws {import('jsonwebtoken').JsonWebTokenError} If the token is invalid or expired
 */
export const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

/**
 * Generates a short-lived signed OAuth state token.
 * @param {object} payload - Data to encode (e.g. { userId })
 * @returns {string} Signed JWT state token
 */
export const generateStateToken = (payload) => jwt.sign(payload, config.jwt.accessSecret, {
  expiresIn: '10m',
});

/**
 * Verifies and decodes an OAuth state token.
 * @param {string} token - Signed state token to verify
 * @returns {object} Decoded token payload
 * @throws {import('jsonwebtoken').JsonWebTokenError} If the token is invalid or expired
 */
export const verifyStateToken = (token) => jwt.verify(token, config.jwt.accessSecret);

