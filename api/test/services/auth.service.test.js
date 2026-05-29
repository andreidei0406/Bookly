import { describe, it, expect, vi, afterEach } from 'vitest';
import { register, login, refreshTokens, logout, forgotPassword, resetPassword, googleLogin } from '../../src/services/auth.service.js';
import prisma from '../../src/utils/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import ApiError from '../../src/utils/apiError.js';
import config from '../../src/config/index.js';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../../src/services/booking.service.js', () => ({
  syncMissingMeetLinks: vi.fn(),
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
          lastName: args.data.lastName,
          username: args.data.username
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

  describe('refreshTokens()', () => {
    it('should rotate and refresh a valid token successfully', async () => {
      const payload = { sub: 'user_123' };
      const token = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: '1d' });

      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'stored_token_abc',
        userId: 'user_123',
        expiresAt: new Date(Date.now() + 100000),
        revoked: false
      });

      prisma.refreshToken.update.mockResolvedValue({ id: 'stored_token_abc', revoked: true });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'Bob',
        lastName: 'Smith'
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'new_token_xyz' });

      const result = await refreshTokens({ refreshToken: token });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'stored_token_abc' },
        data: { revoked: true }
      });
    });

    it('should throw Unauthorized on invalid signature/malformed token', async () => {
      await expect(refreshTokens({ refreshToken: 'invalid-jwt-token' })).rejects.toThrow(ApiError);
    });

    it('should throw Unauthorized if refresh token is expired', async () => {
      const payload = { sub: 'user_123' };
      // Create a token that's already expired
      const token = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: '-1s' });

      await expect(refreshTokens({ refreshToken: token })).rejects.toThrow(ApiError);
    });

    it('should throw Unauthorized if token is not found in database or already revoked', async () => {
      const payload = { sub: 'user_123' };
      const token = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: '1d' });

      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(refreshTokens({ refreshToken: token })).rejects.toThrow(ApiError);
    });
  });

  describe('logout()', () => {
    it('should successfully revoke active refresh token', async () => {
      const payload = { sub: 'user_123' };
      const token = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: '1d' });

      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'stored_token_abc',
        userId: 'user_123',
        revoked: false
      });

      prisma.refreshToken.update.mockResolvedValue({ id: 'stored_token_abc', revoked: true });

      await expect(logout({ refreshToken: token })).resolves.not.toThrow();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'stored_token_abc' },
        data: { revoked: true }
      });
    });

    it('should handle invalid logout refresh token gracefully', async () => {
      await expect(logout({ refreshToken: 'invalid' })).resolves.not.toThrow();
    });
  });

  describe('forgotPassword()', () => {
    it('should dispatch password reset email if user exists', async () => {
      const mockUser = { id: 'user_123', email: 'test@example.com', firstName: 'Jack' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const emailService = await import('../../src/services/email.service.js');

      await forgotPassword({ email: 'test@example.com' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return successfully and not email if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const emailService = await import('../../src/services/email.service.js');

      await forgotPassword({ email: 'fake@example.com' });

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword()', () => {
    it('should successfully hash new password and update user', async () => {
      const token = jwt.sign({ sub: 'user_123', purpose: 'password-reset' }, config.jwt.accessSecret, { expiresIn: '15m' });

      prisma.user.findUnique.mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
      bcrypt.hash.mockResolvedValue('new_hash_mock');
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({});

      await resetPassword({ token, password: 'NewPassword123!' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { password: 'new_hash_mock' }
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user_123', revoked: false },
        data: { revoked: true }
      });
    });

    it('should throw BadRequest if purpose in JWT is incorrect', async () => {
      const token = jwt.sign({ sub: 'user_123', purpose: 'wrong-purpose' }, config.jwt.accessSecret, { expiresIn: '15m' });

      await expect(resetPassword({ token, password: 'NewPassword123!' })).rejects.toThrow(ApiError);
    });
  });

  describe('googleLogin()', () => {
    it('should login existing Google user and update tokens', async () => {
      const googleData = {
        googleId: 'g123',
        email: 'google@example.com',
        firstName: 'Google',
        lastName: 'User',
        avatar: 'http://avatar.jpg',
        accessToken: 'g_access',
        refreshToken: 'g_refresh',
        expiryDate: new Date()
      };

      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user_123', email: 'google@example.com' }); // first call by googleId

      prisma.user.update.mockResolvedValue({ id: 'user_123', email: 'google@example.com' });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rf_123' });

      const result = await googleLogin(googleData);

      expect(result.user.email).toBe('google@example.com');
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should register a new Google user if they do not exist', async () => {
      const googleData = {
        googleId: 'g123',
        email: 'new_google@example.com',
        firstName: 'NewGoogle',
        lastName: 'User',
        avatar: 'http://avatar.jpg',
        accessToken: 'g_access',
        refreshToken: 'g_refresh',
        expiryDate: new Date()
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(null) // by googleId
        .mockResolvedValueOnce(null) // by email
        .mockResolvedValueOnce(null); // by username uniqueness check

      prisma.user.create.mockResolvedValue({
        id: 'new_g_123',
        email: 'new_google@example.com',
        firstName: 'NewGoogle',
        lastName: 'User'
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rf_123' });

      const result = await googleLogin(googleData);

      expect(result.user.email).toBe('new_google@example.com');
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });
});
