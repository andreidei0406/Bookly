import { describe, it, expect, vi, afterEach } from 'vitest';
import { register, login } from '../../src/services/auth.service.js';
import prisma from '../../src/utils/prisma.js';
import bcrypt from 'bcrypt';
import ApiError from '../../src/utils/apiError.js';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
    }
  }
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  }
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendWelcomeEmail: vi.fn()
}));

describe('Auth Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register()', () => {
    it('should successfully register a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      
      prisma.user.create.mockImplementation(async (args) => {
        return {
          id: 'user_123',
          email: args.data.email,
          password: args.data.password,
          firstName: args.data.firstName,
          lastName: args.data.lastName
        };
      });
      
      prisma.refreshToken.create.mockResolvedValue({ id: 'token_123' });
      bcrypt.hash.mockResolvedValue('hashed_password_mock');
      
      const payload = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe'
      };
      
      const result = await register(payload);
      
      expect(result.user.email).toBe(payload.email);
      expect(result.user.firstName).toBe(payload.firstName);
      expect(result.user.password).toBeUndefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw Conflict if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user_123' });
      
      const payload = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Doe'
      };
      
      await expect(register(payload)).rejects.toThrow(ApiError);
      await expect(register(payload)).rejects.toHaveProperty('statusCode', 409);
    });
  });

  describe('login()', () => {
    it('should successfully login an existing user with valid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        password: 'hashed_password_mock'
      });
      
      bcrypt.compare.mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({ id: 'token_123' });
      
      const result = await login({ email: 'test@example.com', password: 'Password123!' });
      
      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
    });

    it('should throw Unauthorized for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        password: 'hashed_password_mock'
      });
      
      bcrypt.compare.mockResolvedValue(false);
      
      await expect(login({ email: 'test@example.com', password: 'WrongPassword' })).rejects.toThrow(ApiError);
      await expect(login({ email: 'test@example.com', password: 'WrongPassword' })).rejects.toHaveProperty('statusCode', 401);
    });
  });
});
