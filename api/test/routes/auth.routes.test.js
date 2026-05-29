import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/utils/prisma.js';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_pw'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../../src/services/booking.service.js', () => ({
  syncMissingMeetLinks: vi.fn(),
}));

describe('Auth Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a user and set cookies', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u123',
        email: 'register@example.com',
        firstName: 'Reg',
        lastName: 'User',
        username: 'reguser',
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt123' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'register@example.com',
          password: 'Password123!',
          firstName: 'Reg',
          lastName: 'User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('register@example.com');
      
      const cookies = res.headers['set-cookie'].join(';');
      expect(cookies).toContain('accessToken');
      expect(cookies).toContain('refreshToken');
    });

    it('should return 400 validation error for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'bad-email',
          password: 'Password123!',
          firstName: 'Reg',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should successfully login and set cookies', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u123',
        email: 'login@example.com',
        password: 'hashed_password',
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt123' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('login@example.com');
      
      const cookies = res.headers['set-cookie'].join(';');
      expect(cookies).toContain('accessToken');
      expect(cookies).toContain('refreshToken');
    });
  });
});
