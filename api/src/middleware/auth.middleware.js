/**
 * @module middleware/auth
 * @description JWT authentication middleware for the Bookly API.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the authenticated user to req.user.
 */

import { verifyAccessToken } from '../utils/tokens.js';
import prisma from '../utils/prisma.js';
import ApiError from '../utils/apiError.js';

/**
 * Express middleware that authenticates requests using JWT Bearer tokens.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
const authenticate = async (req, res, next) => {
  try {
    // Support both cookie-based auth and Bearer token fallback for API clients
    let token = req.cookies?.accessToken;
    
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication required');
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Access token has expired');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw ApiError.unauthorized('Invalid access token');
      }
      throw ApiError.unauthorized('Authentication failed');
    }

    let user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        platformRole: true,
        isActive: true,
        plan: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('User account is deactivated');
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      platformRole: user.platformRole,
      plan: user.plan,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
