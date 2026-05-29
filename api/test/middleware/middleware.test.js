import { describe, it, expect, vi, beforeEach } from 'vitest';
import authenticate from '../../src/middleware/auth.middleware.js';
import { requirePlatformRole, requireBusinessRole, requireBookingAccess } from '../../src/middleware/rbac.middleware.js';
import validate from '../../src/middleware/validate.middleware.js';
import errorHandler from '../../src/middleware/errorHandler.middleware.js';
import { verifyAccessToken } from '../../src/utils/tokens.js';
import prisma from '../../src/utils/prisma.js';
import ApiError from '../../src/utils/apiError.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

vi.mock('../../src/utils/tokens.js', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    businessMember: {
      findUnique: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Middlewares', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      cookies: {},
      headers: {},
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe('auth.middleware', () => {
    it('should authenticate user with valid Bearer token', async () => {
      req.headers.authorization = 'Bearer valid-token';
      verifyAccessToken.mockReturnValue({ id: 'user_123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        platformRole: 'USER',
        isActive: true,
      });

      await authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user_123');
      expect(next).toHaveBeenCalledWith();
    });

    it('should authenticate user with valid cookie token', async () => {
      req.cookies.accessToken = 'cookie-token';
      verifyAccessToken.mockReturnValue({ id: 'user_123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        platformRole: 'USER',
        isActive: true,
      });

      await authenticate(req, res, next);

      expect(req.user.id).toBe('user_123');
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next with ApiError 401 if no token provided', async () => {
      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('should throw 401 if token has expired', async () => {
      req.headers.authorization = 'Bearer expired-token';
      const expiredErr = new Error('Expired');
      expiredErr.name = 'TokenExpiredError';
      verifyAccessToken.mockImplementation(() => { throw expiredErr; });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].message).toContain('expired');
    });

    it('should throw 401 if user not found or deactivated', async () => {
      req.headers.authorization = 'Bearer valid-token';
      verifyAccessToken.mockReturnValue({ id: 'user_123' });
      prisma.user.findUnique.mockResolvedValue(null);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].message).toContain('not found');
    });
  });

  describe('rbac.middleware', () => {
    describe('requirePlatformRole', () => {
      it('should allow access if user platformRole matches', () => {
        req.user = { platformRole: 'SUPER_ADMIN' };
        const middleware = requirePlatformRole('SUPER_ADMIN');
        
        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
      });

      it('should block access if user platformRole does not match', () => {
        req.user = { platformRole: 'USER' };
        const middleware = requirePlatformRole('SUPER_ADMIN');

        middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(ApiError));
        expect(next.mock.calls[0][0].statusCode).toBe(403);
      });
    });

    describe('requireBusinessRole', () => {
      it('should auto-allow SUPER_ADMIN platforms and bypass check', async () => {
        req.user = { id: 'sa_1', platformRole: 'SUPER_ADMIN' };
        req.params.businessId = 'bus_1';
        
        const middleware = requireBusinessRole('OWNER');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.businessMember).toBeDefined();
        expect(req.businessMember.role).toBe('OWNER');
      });

      it('should allow business member if role matches', async () => {
        req.user = { id: 'user_1', platformRole: 'USER' };
        req.params.businessId = 'bus_1';

        prisma.businessMember.findUnique.mockResolvedValue({
          userId: 'user_1',
          businessId: 'bus_1',
          role: 'ADMIN',
        });

        const middleware = requireBusinessRole('OWNER', 'ADMIN');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.businessMember.role).toBe('ADMIN');
      });

      it('should forbid if user is not business member or lacks role', async () => {
        req.user = { id: 'user_1', platformRole: 'USER' };
        req.params.businessId = 'bus_1';
        prisma.businessMember.findUnique.mockResolvedValue(null);

        const middleware = requireBusinessRole('OWNER');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(ApiError));
        expect(next.mock.calls[0][0].statusCode).toBe(403);
      });
    });

    describe('requireBookingAccess', () => {
      it('should allow customer who owns booking', async () => {
        req.user = { id: 'cust_123', platformRole: 'USER' };
        req.params.id = 'booking_abc';

        prisma.booking.findUnique.mockResolvedValue({
          id: 'booking_abc',
          customerId: 'cust_123',
          businessId: 'bus_1',
        });

        const middleware = requireBookingAccess();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.booking.id).toBe('booking_abc');
      });

      it('should allow business staff member access to booking', async () => {
        req.user = { id: 'staff_123', platformRole: 'USER' };
        req.params.id = 'booking_abc';

        prisma.booking.findUnique.mockResolvedValue({
          id: 'booking_abc',
          customerId: 'other_cust',
          businessId: 'bus_1',
        });

        prisma.businessMember.findUnique.mockResolvedValue({
          userId: 'staff_123',
          businessId: 'bus_1',
          role: 'STAFF',
        });

        const middleware = requireBookingAccess();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.booking.id).toBe('booking_abc');
      });
    });
  });

  describe('validate.middleware', () => {
    it('should validate and parse schema successfully', () => {
      const schema = {
        body: z.object({
          name: z.string(),
          age: z.string().transform((val) => parseInt(val, 10)),
        }),
      };
      req.body = { name: 'Alice', age: '25' };

      const middleware = validate(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.body.age).toBe(25);
    });

    it('should call next with validation errors if parsing fails', () => {
      const schema = {
        body: z.object({
          email: z.string().email(),
        }),
      };
      req.body = { email: 'not-an-email' };

      const middleware = validate(schema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toContain('Validation failed');
    });
  });

  describe('errorHandler.middleware', () => {
    it('should handle custom ApiErrors correctly', () => {
      const error = ApiError.badRequest('Invalid details', [{ field: 'name', message: 'req' }]);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Invalid details',
        errors: [{ field: 'name', message: 'req' }],
      }));
    });

    it('should handle Prisma P2002 unique constraint violations as 409 Conflict', () => {
      const error = new Prisma.PrismaClientKnownRequestError('ErrorMsg', {
        code: 'P2002',
        meta: { target: ['email'] },
        clientVersion: '7.0.0',
      });

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('email already exists'),
      }));
    });
  });
});
