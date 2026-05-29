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
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

describe('User Routes Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/v1/users/:username', () => {
    it('should return public profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        username: 'alicesmith',
      });

      const res = await request(app).get('/api/v1/users/alicesmith');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('alicesmith');
    });
  });

  describe('GET /api/v1/users/me', () => {
    it('should return profile for authenticated user', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        username: 'alicesmith',
        isActive: true,
      });

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('alice@example.com');
    });

    it('should return 401 unauthorized if no token is passed', async () => {
      const res = await request(app).get('/api/v1/users/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should successfully update authenticated user profile', async () => {
      verifyAccessToken.mockReturnValue({ id: 'u123' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Smith',
        username: 'alicesmith',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        id: 'u123',
        email: 'alice@example.com',
        firstName: 'Alicia',
        lastName: 'Smith',
        username: 'alicesmith',
      });

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          firstName: 'Alicia',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Alicia');
    });
  });
});
