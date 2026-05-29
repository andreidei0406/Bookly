import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import prisma from '../../src/utils/prisma.js';
import bcrypt from 'bcrypt';
import ApiError from '../../src/utils/apiError.js';
import {
  getPublicProfile,
  getProfile,
  updateProfile,
  changePassword,
  listUsers,
} from '../../src/services/user.service.js';

const USER_SELECT_SAFE = {
  id: true,
  email: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  plan: true,
  googleId: true,
  createdAt: true,
  updatedAt: true,
};

const makeFakeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'john@example.com',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  phone: '1234567890',
  avatar: 'https://example.com/avatar.png',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-02'),
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── getPublicProfile ────────────────────────────────────────────────
describe('getPublicProfile', () => {
  it('should return the user when found by username', async () => {
    const user = makeFakeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await getPublicProfile('johndoe');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'johndoe' },
      select: USER_SELECT_SAFE,
    });
    expect(result).toEqual(user);
  });

  it('should throw 404 ApiError when user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(getPublicProfile('nonexistent')).rejects.toThrow(ApiError);
    await expect(getPublicProfile('nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });
});

// ─── getProfile ──────────────────────────────────────────────────────
describe('getProfile', () => {
  it('should return the user when found by id', async () => {
    const user = makeFakeUser();
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await getProfile('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: USER_SELECT_SAFE,
    });
    expect(result).toEqual(user);
  });

  it('should throw 404 ApiError when user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(getProfile('missing-id')).rejects.toThrow(ApiError);
    await expect(getProfile('missing-id')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });
});

// ─── updateProfile ───────────────────────────────────────────────────
describe('updateProfile', () => {
  it('should update all provided fields and return the updated user', async () => {
    const existing = makeFakeUser({ password: 'hashed' });
    const updated = makeFakeUser({ username: 'newname', firstName: 'Jane' });

    prisma.user.findUnique
      .mockResolvedValueOnce(existing)          // first call: find user
      .mockResolvedValueOnce(null);             // second call: username uniqueness check
    prisma.user.update.mockResolvedValue(updated);

    const result = await updateProfile('user-1', {
      username: 'newname',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '9999999999',
      avatar: 'https://example.com/new.png',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        username: 'newname',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '9999999999',
        avatar: 'https://example.com/new.png',
      },
      select: USER_SELECT_SAFE,
    });
    expect(result).toEqual(updated);
  });

  it('should skip username uniqueness check when username is unchanged', async () => {
    const existing = makeFakeUser({ password: 'hashed', username: 'johndoe' });
    const updated = makeFakeUser({ firstName: 'Jane' });

    prisma.user.findUnique.mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(updated);

    const result = await updateProfile('user-1', {
      username: 'johndoe', // same as existing
      firstName: 'Jane',
    });

    // Only called once (to find the user), NOT a second time for username check
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(result).toEqual(updated);
  });

  it('should handle partial update with only firstName', async () => {
    const existing = makeFakeUser({ password: 'hashed' });
    const updated = makeFakeUser({ firstName: 'Updated' });

    prisma.user.findUnique.mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(updated);

    const result = await updateProfile('user-1', { firstName: 'Updated' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { firstName: 'Updated' },
      select: USER_SELECT_SAFE,
    });
    expect(result).toEqual(updated);
  });

  it('should handle partial update with only avatar', async () => {
    const existing = makeFakeUser({ password: 'hashed' });
    const updated = makeFakeUser({ avatar: 'https://new-avatar.png' });

    prisma.user.findUnique.mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(updated);

    const result = await updateProfile('user-1', { avatar: 'https://new-avatar.png' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatar: 'https://new-avatar.png' },
      select: USER_SELECT_SAFE,
    });
    expect(result).toEqual(updated);
  });

  it('should pass an empty data object when no recognized fields are provided', async () => {
    const existing = makeFakeUser({ password: 'hashed' });
    prisma.user.findUnique.mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(existing);

    await updateProfile('user-1', { someRandomField: 'value' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {},
      select: USER_SELECT_SAFE,
    });
  });

  it('should throw 404 ApiError when user to update is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(updateProfile('missing-id', { firstName: 'Jane' })).rejects.toThrow(ApiError);
    await expect(updateProfile('missing-id', { firstName: 'Jane' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should throw 409 ApiError when the new username is already taken', async () => {
    const existing = makeFakeUser({ password: 'hashed', username: 'johndoe' });
    const conflicting = makeFakeUser({ id: 'user-2', username: 'takenname' });

    // Need 4 mocks: the test calls updateProfile twice (toThrow + toMatchObject),
    // each of which calls findUnique twice (find user + username check)
    prisma.user.findUnique
      .mockResolvedValueOnce(existing)     // 1st call: find user
      .mockResolvedValueOnce(conflicting)  // 1st call: username check
      .mockResolvedValueOnce(existing)     // 2nd call: find user
      .mockResolvedValueOnce(conflicting); // 2nd call: username check

    await expect(
      updateProfile('user-1', { username: 'takenname' }),
    ).rejects.toThrow(ApiError);

    await expect(
      updateProfile('user-1', { username: 'takenname' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Username is already taken',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should not check username uniqueness when username is not provided in data', async () => {
    const existing = makeFakeUser({ password: 'hashed' });
    prisma.user.findUnique.mockResolvedValueOnce(existing);
    prisma.user.update.mockResolvedValue(existing);

    await updateProfile('user-1', { firstName: 'Jane' });

    // findUnique called once only (to find the user)
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });
});

// ─── changePassword ──────────────────────────────────────────────────
describe('changePassword', () => {
  it('should change password successfully when current password matches', async () => {
    const user = makeFakeUser({ password: 'old-hashed' });
    prisma.user.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('new-hashed');
    prisma.user.update.mockResolvedValue(undefined);

    await changePassword('user-1', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(bcrypt.compare).toHaveBeenCalledWith('OldPass123!', 'old-hashed');
    expect(bcrypt.hash).toHaveBeenCalledWith('NewPass456!', 12);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'new-hashed' },
    });
  });

  it('should throw 404 ApiError when user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      changePassword('missing-id', { currentPassword: 'a', newPassword: 'b' }),
    ).rejects.toThrow(ApiError);

    await expect(
      changePassword('missing-id', { currentPassword: 'a', newPassword: 'b' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('should throw 400 ApiError when current password is incorrect', async () => {
    const user = makeFakeUser({ password: 'hashed' });
    prisma.user.findUnique.mockResolvedValue(user);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      changePassword('user-1', { currentPassword: 'wrong', newPassword: 'new' }),
    ).rejects.toThrow(ApiError);

    await expect(
      changePassword('user-1', { currentPassword: 'wrong', newPassword: 'new' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Current password is incorrect',
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

// ─── listUsers ───────────────────────────────────────────────────────
describe('listUsers', () => {
  it('should return users with default pagination (page=1, limit=20)', async () => {
    const users = [makeFakeUser(), makeFakeUser({ id: 'user-2', username: 'jane' })];
    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(2);

    const result = await listUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      select: USER_SELECT_SAFE,
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.user.count).toHaveBeenCalled();
    expect(result).toEqual({
      data: users,
      meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
    });
  });

  it('should handle custom pagination parameters', async () => {
    const users = [makeFakeUser()];
    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(50);

    const result = await listUsers({ page: 3, limit: 10 });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      skip: 20,
      take: 10,
      select: USER_SELECT_SAFE,
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual({
      data: users,
      meta: { total: 50, page: 3, limit: 10, totalPages: 5 },
    });
  });

  it('should return empty data array when no users exist', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    const result = await listUsers();

    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
  });

  it('should calculate totalPages correctly with non-even division', async () => {
    prisma.user.findMany.mockResolvedValue([makeFakeUser()]);
    prisma.user.count.mockResolvedValue(21);

    const result = await listUsers({ page: 1, limit: 10 });

    expect(result.meta.totalPages).toBe(3); // Math.ceil(21/10) = 3
  });

  it('should use page 1 and limit 20 when called with an empty object', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await listUsers({});

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 20,
      select: USER_SELECT_SAFE,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should calculate correct skip for page 2 with limit 5', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(12);

    const result = await listUsers({ page: 2, limit: 5 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.meta).toEqual({
      total: 12,
      page: 2,
      limit: 5,
      totalPages: 3, // Math.ceil(12/5)
    });
  });
});
