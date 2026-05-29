import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  getBlocks,
  createBlock,
  clearBlocks,
  deleteBlock,
  updateBlock,
  getAvailableSlots,
  getAvailableDays,
} from '../../src/services/availability.service.js';
import prisma from '../../src/utils/prisma.js';
import ApiError from '../../src/utils/apiError.js';
import { fetchCalendarEvents } from '../../src/services/google.service.js';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    availabilityBlock: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../src/services/google.service.js', () => ({
  fetchCalendarEvents: vi.fn(),
}));

describe('Availability Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getBlocks ────────────────────────────────────────────────────────────────

  describe('getBlocks()', () => {
    const userId = 'user_1';

    it('should return all blocks for the user when no date range is provided', async () => {
      const mockBlocks = [
        { id: 'b1', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '12:00' },
        { id: 'b2', userId, date: new Date('2025-06-02'), startTime: '14:00', endTime: '17:00' },
      ];
      prisma.availabilityBlock.findMany.mockResolvedValue(mockBlocks);

      const result = await getBlocks(userId, {});

      expect(prisma.availabilityBlock.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
      expect(result).toEqual(mockBlocks);
    });

    it('should filter blocks by date range when startDate and endDate are provided', async () => {
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      await getBlocks(userId, { startDate: '2025-06-01', endDate: '2025-06-30' });

      expect(prisma.availabilityBlock.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: { gte: new Date('2025-06-01'), lte: new Date('2025-06-30') },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    });

    it('should not add date filter when only startDate is provided', async () => {
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      await getBlocks(userId, { startDate: '2025-06-01' });

      expect(prisma.availabilityBlock.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
    });

    it('should return an empty array when no blocks exist', async () => {
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      const result = await getBlocks(userId, {});

      expect(result).toEqual([]);
    });
  });

  // ─── createBlock ──────────────────────────────────────────────────────────────

  describe('createBlock()', () => {
    const userId = 'user_1';

    it('should create a block when there are no overlapping blocks', async () => {
      const createdBlock = { id: 'b1', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '12:00' };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          availabilityBlock: {
            findMany: vi.fn().mockResolvedValue([]),
            deleteMany: vi.fn(),
            create: vi.fn().mockResolvedValue(createdBlock),
          },
        };
        return callback(tx);
      });

      const result = await createBlock(userId, { date: '2025-06-01', startTime: '09:00', endTime: '12:00' });

      expect(result).toEqual(createdBlock);
      // tx.deleteMany should NOT have been called since no overlapping blocks
      const txCallback = prisma.$transaction.mock.calls[0][0];
      // We verify via the result that the create was called with the right data
    });

    it('should merge with overlapping blocks and delete them', async () => {
      const existingBlock = { id: 'b_existing', userId, date: new Date('2025-06-01'), startTime: '10:00', endTime: '14:00' };
      const mergedBlock = { id: 'b_merged', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '14:00' };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          availabilityBlock: {
            findMany: vi.fn().mockResolvedValue([existingBlock]),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(mergedBlock),
          },
        };
        const result = await callback(tx);
        // Verify deleteMany was called with the overlapping block id
        expect(tx.availabilityBlock.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['b_existing'] } },
        });
        // Verify create was called with merged start/end
        expect(tx.availabilityBlock.create).toHaveBeenCalledWith({
          data: {
            userId,
            date: expect.any(Date),
            startTime: '09:00',
            endTime: '14:00',
          },
        });
        return result;
      });

      const result = await createBlock(userId, { date: '2025-06-01', startTime: '09:00', endTime: '12:00' });

      expect(result).toEqual(mergedBlock);
    });

    it('should merge with multiple overlapping blocks', async () => {
      const existing1 = { id: 'b1', userId, date: new Date('2025-06-01'), startTime: '08:00', endTime: '10:00' };
      const existing2 = { id: 'b2', userId, date: new Date('2025-06-01'), startTime: '11:00', endTime: '15:00' };
      const mergedBlock = { id: 'b_merged', userId, date: new Date('2025-06-01'), startTime: '08:00', endTime: '15:00' };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          availabilityBlock: {
            findMany: vi.fn().mockResolvedValue([existing1, existing2]),
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
            create: vi.fn().mockResolvedValue(mergedBlock),
          },
        };
        const result = await callback(tx);
        expect(tx.availabilityBlock.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['b1', 'b2'] } },
        });
        expect(tx.availabilityBlock.create).toHaveBeenCalledWith({
          data: {
            userId,
            date: expect.any(Date),
            startTime: '08:00',
            endTime: '15:00',
          },
        });
        return result;
      });

      const result = await createBlock(userId, { date: '2025-06-01', startTime: '09:00', endTime: '12:00' });

      expect(result).toEqual(mergedBlock);
    });

    it('should not call deleteMany when there are no overlapping blocks', async () => {
      const nonOverlapping = { id: 'b_no', userId, date: new Date('2025-06-01'), startTime: '15:00', endTime: '17:00' };
      const createdBlock = { id: 'b_new', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '12:00' };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          availabilityBlock: {
            findMany: vi.fn().mockResolvedValue([nonOverlapping]),
            deleteMany: vi.fn(),
            create: vi.fn().mockResolvedValue(createdBlock),
          },
        };
        const result = await callback(tx);
        // No overlap → deleteMany should not have been called
        expect(tx.availabilityBlock.deleteMany).not.toHaveBeenCalled();
        // The block should be created with the original times (no merge)
        expect(tx.availabilityBlock.create).toHaveBeenCalledWith({
          data: {
            userId,
            date: expect.any(Date),
            startTime: '09:00',
            endTime: '12:00',
          },
        });
        return result;
      });

      const result = await createBlock(userId, { date: '2025-06-01', startTime: '09:00', endTime: '12:00' });

      expect(result).toEqual(createdBlock);
    });

    it('should merge with an adjacent block that touches exactly at the boundary', async () => {
      // Existing block ends at 12:00 (720 min), new block starts at 12:00 (720 min)
      // Overlap condition: bEnd >= startMins && bStart <= endMins → 720 >= 720 && 540 <= 840 → true
      const adjacentBlock = { id: 'b_adj', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '12:00' };
      const mergedBlock = { id: 'b_merged', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '14:00' };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          availabilityBlock: {
            findMany: vi.fn().mockResolvedValue([adjacentBlock]),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(mergedBlock),
          },
        };
        const result = await callback(tx);
        expect(tx.availabilityBlock.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['b_adj'] } },
        });
        expect(tx.availabilityBlock.create).toHaveBeenCalledWith({
          data: {
            userId,
            date: expect.any(Date),
            startTime: '09:00',
            endTime: '14:00',
          },
        });
        return result;
      });

      const result = await createBlock(userId, { date: '2025-06-01', startTime: '12:00', endTime: '14:00' });

      expect(result).toEqual(mergedBlock);
    });

    it('should handle creating a block fully contained within an existing block', async () => {
      // Existing 08:00–17:00, new 10:00–12:00 → merged = 08:00–17:00
      const existingBlock = { id: 'b_big', userId, date: new Date('2025-06-01'), startTime: '08:00', endTime: '17:00' };
      const mergedBlock = { id: 'b_merged', userId, date: new Date('2025-06-01'), startTime: '08:00', endTime: '17:00' };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          availabilityBlock: {
            findMany: vi.fn().mockResolvedValue([existingBlock]),
            deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(mergedBlock),
          },
        };
        const result = await callback(tx);
        expect(tx.availabilityBlock.create).toHaveBeenCalledWith({
          data: {
            userId,
            date: expect.any(Date),
            startTime: '08:00',
            endTime: '17:00',
          },
        });
        return result;
      });

      const result = await createBlock(userId, { date: '2025-06-01', startTime: '10:00', endTime: '12:00' });

      expect(result).toEqual(mergedBlock);
    });
  });

  // ─── clearBlocks ──────────────────────────────────────────────────────────────

  describe('clearBlocks()', () => {
    const userId = 'user_1';

    it('should delete all blocks for user when no date range is provided', async () => {
      prisma.availabilityBlock.deleteMany.mockResolvedValue({ count: 5 });

      const result = await clearBlocks(userId, {});

      expect(prisma.availabilityBlock.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual({ deletedCount: 5 });
    });

    it('should delete blocks within date range when startDate and endDate are provided', async () => {
      prisma.availabilityBlock.deleteMany.mockResolvedValue({ count: 2 });

      const result = await clearBlocks(userId, { startDate: '2025-06-01', endDate: '2025-06-30' });

      const call = prisma.availabilityBlock.deleteMany.mock.calls[0][0];
      expect(call.where.userId).toBe(userId);
      expect(call.where.date.gte).toEqual(expect.any(Date));
      expect(call.where.date.lte).toEqual(expect.any(Date));
      // start should be beginning of day
      expect(call.where.date.gte.getUTCHours()).toBe(0);
      expect(call.where.date.gte.getUTCMinutes()).toBe(0);
      // end should be end of day
      expect(call.where.date.lte.getUTCHours()).toBe(23);
      expect(call.where.date.lte.getUTCMinutes()).toBe(59);
      expect(result).toEqual({ deletedCount: 2 });
    });

    it('should return deletedCount of 0 when no blocks match', async () => {
      prisma.availabilityBlock.deleteMany.mockResolvedValue({ count: 0 });

      const result = await clearBlocks(userId, {});

      expect(result).toEqual({ deletedCount: 0 });
    });
  });

  // ─── deleteBlock ──────────────────────────────────────────────────────────────

  describe('deleteBlock()', () => {
    const userId = 'user_1';

    it('should delete the specific block by id and userId', async () => {
      const deletedBlock = { id: 'b1', userId, date: new Date('2025-06-01'), startTime: '09:00', endTime: '12:00' };
      prisma.availabilityBlock.delete.mockResolvedValue(deletedBlock);

      const result = await deleteBlock(userId, 'b1');

      expect(prisma.availabilityBlock.delete).toHaveBeenCalledWith({
        where: { id: 'b1', userId },
      });
      expect(result).toEqual(deletedBlock);
    });

    it('should propagate errors when block is not found', async () => {
      prisma.availabilityBlock.delete.mockRejectedValue(new Error('Record not found'));

      await expect(deleteBlock(userId, 'nonexistent')).rejects.toThrow('Record not found');
    });
  });

  // ─── updateBlock ──────────────────────────────────────────────────────────────

  describe('updateBlock()', () => {
    const userId = 'user_1';

    it('should update the block with new date, startTime and endTime', async () => {
      const updatedBlock = { id: 'b1', userId, date: new Date('2025-06-05'), startTime: '10:00', endTime: '15:00' };
      prisma.availabilityBlock.update.mockResolvedValue(updatedBlock);

      const result = await updateBlock(userId, 'b1', {
        date: '2025-06-05',
        startTime: '10:00',
        endTime: '15:00',
      });

      const call = prisma.availabilityBlock.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'b1', userId });
      expect(call.data.startTime).toBe('10:00');
      expect(call.data.endTime).toBe('15:00');
      expect(call.data.date.getUTCHours()).toBe(0);
      expect(call.data.date.getUTCMinutes()).toBe(0);
      expect(result).toEqual(updatedBlock);
    });

    it('should propagate errors when block is not found', async () => {
      prisma.availabilityBlock.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        updateBlock(userId, 'nonexistent', { date: '2025-06-01', startTime: '09:00', endTime: '12:00' })
      ).rejects.toThrow('Record not found');
    });
  });

  // ─── getAvailableSlots ────────────────────────────────────────────────────────

  describe('getAvailableSlots()', () => {
    const username = 'johndoe';
    const hostUser = { id: 'user_1', username: 'johndoe' };

    it('should throw ApiError 404 when host user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(getAvailableSlots(username, { date: '2025-06-01', duration: '30' }))
        .rejects.toThrow(ApiError);
      await expect(getAvailableSlots(username, { date: '2025-06-01', duration: '30' }))
        .rejects.toHaveProperty('statusCode', 404);
    });

    it('should return empty array when there are no availability blocks', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      expect(result).toEqual([]);
    });

    it('should return available slots with no bookings or calendar events', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '11:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      expect(result).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
        { startTime: '10:00', endTime: '10:30' },
        { startTime: '10:30', endTime: '11:00' },
      ]);
    });

    it('should use default duration of 30 minutes when duration is not a valid number', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '10:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: 'invalid' });

      // Default 30 min → 2 slots in a 1-hour block
      expect(result).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
      ]);
    });

    it('should use custom duration to generate slots', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '11:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '60' });

      expect(result).toEqual([
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' },
      ]);
    });

    it('should filter out slots that overlap with existing bookings', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '11:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([
        { startTime: '09:30', endTime: '10:00' },
      ]);
      fetchCalendarEvents.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      // 09:00–09:30 is free, 09:30–10:00 is booked, 10:00–10:30 is free, 10:30–11:00 is free
      expect(result).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '10:00', endTime: '10:30' },
        { startTime: '10:30', endTime: '11:00' },
      ]);
    });

    it('should filter out slots that overlap with Google Calendar events (timed events)', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '11:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([
        { start: '2025-06-01T10:00:00Z', end: '2025-06-01T10:30:00Z' },
      ]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      // 10:00–10:30 blocked by Google event
      expect(result).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
        { startTime: '10:30', endTime: '11:00' },
      ]);
    });

    it('should block all slots when there is an all-day Google Calendar event', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '11:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([
        { start: '2025-06-01', end: '2025-06-02' }, // all-day event → 0 to 1440
      ]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      expect(result).toEqual([]);
    });

    it('should skip Google Calendar events with missing start or end', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '10:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([
        { start: null, end: null },
        { start: undefined, end: '2025-06-01T10:00:00Z' },
        { end: '2025-06-01T10:00:00Z' },
      ]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      // None of those events should block anything
      expect(result).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
      ]);
    });

    it('should combine bookings and Google events to filter slots', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '12:00' },
      ]);
      // Booking blocks 09:00–09:30
      prisma.booking.findMany.mockResolvedValue([
        { startTime: '09:00', endTime: '09:30' },
      ]);
      // Google event blocks 10:00–11:00
      fetchCalendarEvents.mockResolvedValue([
        { start: '2025-06-01T10:00:00Z', end: '2025-06-01T11:00:00Z' },
      ]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      expect(result).toEqual([
        { startTime: '09:30', endTime: '10:00' },
        { startTime: '11:00', endTime: '11:30' },
        { startTime: '11:30', endTime: '12:00' },
      ]);
    });

    it('should handle multiple availability blocks and sort the result', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b2', userId: 'user_1', startTime: '14:00', endTime: '15:00' },
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '10:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      expect(result).toEqual([
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
        { startTime: '14:00', endTime: '14:30' },
        { startTime: '14:30', endTime: '15:00' },
      ]);
    });

    it('should return no slots when duration is larger than the block', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '09:30' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([]);

      const result = await getAvailableSlots(username, { date: '2025-06-01', duration: '60' });

      expect(result).toEqual([]);
    });

    it('should query bookings with the correct status filter', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', userId: 'user_1', startTime: '09:00', endTime: '10:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);
      fetchCalendarEvents.mockResolvedValue([]);

      await getAvailableSlots(username, { date: '2025-06-01', duration: '30' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hostId: 'user_1',
            status: { in: ['PENDING', 'CONFIRMED'] },
          }),
          select: { startTime: true, endTime: true },
        })
      );
    });
  });

  // ─── getAvailableDays ─────────────────────────────────────────────────────────

  describe('getAvailableDays()', () => {
    const username = 'johndoe';
    const hostUser = { id: 'user_1', username: 'johndoe' };

    it('should throw ApiError 404 when host user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(getAvailableDays(username, '2025-06')).rejects.toThrow(ApiError);
      await expect(getAvailableDays(username, '2025-06')).rejects.toHaveProperty('statusCode', 404);
    });

    it('should return unique dates with availability for the given month', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { date: new Date('2025-06-01T00:00:00.000Z') },
        { date: new Date('2025-06-01T00:00:00.000Z') }, // duplicate date
        { date: new Date('2025-06-15T00:00:00.000Z') },
        { date: new Date('2025-06-20T00:00:00.000Z') },
      ]);

      const result = await getAvailableDays(username, '2025-06');

      expect(result).toEqual(['2025-06-01', '2025-06-15', '2025-06-20']);
    });

    it('should return empty array when there are no blocks in the month', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      const result = await getAvailableDays(username, '2025-06');

      expect(result).toEqual([]);
    });

    it('should query with correct date range for the month', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      await getAvailableDays(username, '2025-06');

      expect(prisma.availabilityBlock.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_1',
          date: {
            gte: new Date('2025-06-01T00:00:00.000Z'),
            lt: new Date('2025-07-01T00:00:00.000Z'),
          },
        },
        select: { date: true },
      });
    });

    it('should handle December correctly (month rolls over to next year)', async () => {
      prisma.user.findUnique.mockResolvedValue(hostUser);
      prisma.availabilityBlock.findMany.mockResolvedValue([]);

      await getAvailableDays(username, '2025-12');

      expect(prisma.availabilityBlock.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_1',
          date: {
            gte: new Date('2025-12-01T00:00:00.000Z'),
            lt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
        select: { date: true },
      });
    });
  });
});
