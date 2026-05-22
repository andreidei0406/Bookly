/**
 * @module middleware/rbac
 * @description Role-based access control middleware for the Bookly API.
 * Provides platform-level, business-level, and booking-level authorization.
 */

import prisma from '../utils/prisma.js';
import ApiError from '../utils/apiError.js';

/**
 * Middleware factory that restricts access to users with one of the specified platform roles.
 *
 * @param {...string} roles - Allowed platform roles (e.g. 'SUPER_ADMIN', 'USER')
 * @returns {import('express').RequestHandler} Express middleware
 */
export const requirePlatformRole = (...roles) => (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      if (!roles.includes(req.user.platformRole)) {
        throw ApiError.forbidden(
          `Access denied. Required platform role(s): ${roles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

/**
 * Middleware factory that restricts access to users who are members of the
 * specified business with one of the given roles.
 * Expects req.params.businessId to be set.
 * On success, attaches the BusinessMember record to req.businessMember.
 *
 * @param {...string} roles - Allowed business roles (e.g. 'OWNER', 'ADMIN', 'STAFF')
 * @returns {import('express').RequestHandler} Express middleware
 */
export const requireBusinessRole = (...roles) => async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const { businessId } = req.params;

      if (!businessId) {
        throw ApiError.badRequest('Business ID is required');
      }

      // SUPER_ADMIN bypasses business role checks
      if (req.user.platformRole === 'SUPER_ADMIN') {
        req.businessMember = {
          userId: req.user.id,
          businessId,
          role: 'OWNER', // treat SUPER_ADMIN as OWNER equivalent
        };
        return next();
      }

      const member = await prisma.businessMember.findUnique({
        where: {
          userId_businessId: {
            userId: req.user.id,
            businessId,
          },
        },
      });

      if (!member) {
        throw ApiError.forbidden('You are not a member of this business');
      }

      if (!roles.includes(member.role)) {
        throw ApiError.forbidden(
          `Access denied. Required business role(s): ${roles.join(', ')}`
        );
      }

      req.businessMember = member;
      next();
    } catch (error) {
      next(error);
    }
  };

/**
 * Middleware that verifies the current user has access to a specific booking.
 * The user must be one of:
 *   - The customer who created the booking
 *   - A STAFF, ADMIN, or OWNER of the business associated with the booking
 *   - A SUPER_ADMIN platform user
 *
 * Expects req.params.bookingId (or req.params.id) to be set.
 * Attaches the booking to req.booking on success.
 *
 * @returns {import('express').RequestHandler} Express middleware
 */
export const requireBookingAccess = () => async (req, res, next) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const bookingId = req.params.bookingId || req.params.id;

      if (!bookingId) {
        throw ApiError.badRequest('Booking ID is required');
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          business: {
            select: { id: true },
          },
        },
      });

      if (!booking) {
        throw ApiError.notFound('Booking not found');
      }

      // SUPER_ADMIN always has access
      if (req.user.platformRole === 'SUPER_ADMIN') {
        req.booking = booking;
        return next();
      }

      // Customer who owns the booking
      if (booking.customerId === req.user.id) {
        req.booking = booking;
        return next();
      }

      // Staff / Admin / Owner of the business
      const member = await prisma.businessMember.findUnique({
        where: {
          userId_businessId: {
            userId: req.user.id,
            businessId: booking.businessId,
          },
        },
      });

      if (member && ['STAFF', 'ADMIN', 'OWNER'].includes(member.role)) {
        req.booking = booking;
        req.businessMember = member;
        return next();
      }

      throw ApiError.forbidden('You do not have access to this booking');
    } catch (error) {
      next(error);
    }
  };
