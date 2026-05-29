import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/utils/prisma.js';
import { verifyAccessToken } from '../../src/utils/tokens.js';

vi.mock('../../src/utils/tokens.js', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    availabilityBlock: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

describe('Availability Routes Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  });

  describe('GET /api/v1/availability/blocks', () => {
    it('should return availability blocks for authenticated user', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        isActive: true,
      });

      const mockBlocks = [
        { id: 'b1', userId: 'u123', date: new Date('2030-06-15'), startTime: '09:00', endTime: '12:00' },
      ];
      prisma.availabilityBlock.findMany.mockResolvedValue(mockBlocks);

      const res = await request(app)
        .get('/api/v1/availability/blocks')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should return 401 unauthorized if no token provided', async () => {
      const res = await request(app).get('/api/v1/availability/blocks');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/availability/blocks', () => {
    it('should create an availability block successfully', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        isActive: true,
      });

      const newBlock = {
        id: 'b2',
        userId: 'u123',
        date: new Date('2030-06-16'),
        startTime: '13:00',
        endTime: '17:00',
      };
      prisma.availabilityBlock.create.mockResolvedValue(newBlock);
      prisma.availabilityBlock.findMany.mockResolvedValue([]); // no overlap checks

      const res = await request(app)
        .post('/api/v1/availability/blocks')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          date: '2030-06-16',
          startTime: '13:00',
          endTime: '17:00',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('b2');
    });

    it('should return 400 validation error for invalid time format', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        isActive: true,
      });

      const res = await request(app)
        .post('/api/v1/availability/blocks')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          date: '2030-06-16',
          startTime: '9:00', // invalid HH:mm format, must be 09:00
          endTime: '17:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
    });
  });
});
