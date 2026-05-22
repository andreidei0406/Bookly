/**
 * @module tokens
 * @description JWT helper functions for generating and verifying
 * access and refresh tokens used in authentication.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Generates a short-lived access token.
 * @param {object} payload - Data to encode in the token (e.g. { userId, email })
 * @returns {string} Signed JWT access token
 */
export const generateAccessToken = (payload) => jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  });

/**
 * Generates a long-lived refresh token.
 * @param {object} payload - Data to encode in the token (e.g. { userId })
 * @returns {string} Signed JWT refresh token
 */
export const generateRefreshToken = (payload) => jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });

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
