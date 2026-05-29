import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/utils/prisma.js';
import { verifyAccessToken } from '../../src/utils/tokens.js';
import Stripe from 'stripe';

// Mock token verification
vi.mock('../../src/utils/tokens.js', () => ({
  verifyAccessToken: vi.fn(),
}));

// Mock Prisma
vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

// Mock Stripe
vi.mock('stripe', () => {
  const mockCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' });
  const mockRetrieve = vi.fn().mockResolvedValue({
    payment_status: 'paid',
    metadata: { userId: 'u123', plan: 'PREMIUM' }
  });
  
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockCreate,
          retrieve: mockRetrieve,
        }
      }
    }))
  };
});

describe('Billing Routes Integration', () => {
  let stripeInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    stripeInstance = new Stripe();
  });

  describe('POST /api/v1/billing/checkout', () => {
    it('should successfully create a checkout session for PREMIUM plan upgrade', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        isActive: true,
        plan: 'FREE',
      });

      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ plan: 'PREMIUM' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.checkoutUrl).toBe('https://checkout.stripe.com/test');
      expect(stripeInstance.checkout.sessions.create).toHaveBeenCalled();
    });

    it('should block downgrade from ULTIMATE plan', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        isActive: true,
        plan: 'ULTIMATE',
      });

      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ plan: 'PREMIUM' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Downgrading is not permitted');
    });

    it('should reject invalid plan name', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      
      const res = await request(app)
        .post('/api/v1/billing/checkout')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ plan: 'INVALID_PLAN' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/billing/confirm', () => {
    it('should successfully confirm payment and update user plan in DB', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        isActive: true,
        plan: 'FREE',
      });
      prisma.user.update.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        isActive: true,
        plan: 'PREMIUM',
      });

      const res = await request(app)
        .post('/api/v1/billing/confirm')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ sessionId: 'sess_123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plan).toBe('PREMIUM');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u123' },
        data: { plan: 'PREMIUM' }
      });
    });

    it('should return 400 bad request if payment has not been completed', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        isActive: true,
        plan: 'FREE',
      });
      
      stripeInstance.checkout.sessions.retrieve.mockResolvedValueOnce({
        payment_status: 'unpaid',
        metadata: { userId: 'u123', plan: 'PREMIUM' }
      });

      const res = await request(app)
        .post('/api/v1/billing/confirm')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ sessionId: 'sess_123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
