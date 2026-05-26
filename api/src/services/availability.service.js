/**
 * @module services/availability
 * @description Availability management service — blocks CRUD and
 * the core slot availability algorithm.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';
import { fetchCalendarEvents } from './google.service.js';

/**
 * Parse a time string (HH:mm) into total minutes from midnight.
 * @param {string} time - Time in "HH:mm" format.
 * @returns {number} Minutes since midnight.
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert total minutes from midnight to "HH:mm" format.
 * @param {number} minutes - Minutes since midnight.
 * @returns {string} Time in "HH:mm" format.
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export async function getBlocks(userId, query) {
  const { startDate, endDate } = query;
  
  const where = { userId };
  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  return prisma.availabilityBlock.findMany({
    where,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
  });
}

export async function createBlock(userId, data) {
  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  const startMins = timeToMinutes(data.startTime);
  const endMins = timeToMinutes(data.endTime);

  return prisma.$transaction(async (tx) => {
    // 1. Fetch existing blocks for this date
    const existingBlocks = await tx.availabilityBlock.findMany({
      where: {
        userId,
        date
      }
    });

    // 2. Find overlaps or adjacencies
    const overlapping = [];
    for (const b of existingBlocks) {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      // touching or overlapping condition
      if (bEnd >= startMins && bStart <= endMins) {
        overlapping.push({ id: b.id, start: bStart, end: bEnd });
      }
    }

    // 3. Compute merged boundaries
    let mergedStart = startMins;
    let mergedEnd = endMins;

    for (const b of overlapping) {
      mergedStart = Math.min(mergedStart, b.start);
      mergedEnd = Math.max(mergedEnd, b.end);
    }

    // 4. Delete overlapping blocks
    if (overlapping.length > 0) {
      await tx.availabilityBlock.deleteMany({
        where: {
          id: { in: overlapping.map(o => o.id) }
        }
      });
    }

    // 5. Create merged block
    return tx.availabilityBlock.create({
      data: {
        userId,
        date,
        startTime: minutesToTime(mergedStart),
        endTime: minutesToTime(mergedEnd)
      }
    });
  });
}

export async function clearBlocks(userId, query) {
  const { startDate, endDate } = query;
  const where = { userId };
  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lt: new Date(endDate)
    };
  }
  
  const result = await prisma.availabilityBlock.deleteMany({ where });
  return { deletedCount: result.count };
}

export async function deleteBlock(userId, blockId) {
  return prisma.availabilityBlock.delete({
    where: { id: blockId, userId }
  });
}

export async function updateBlock(userId, blockId, data) {
  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  return prisma.availabilityBlock.update({
    where: { id: blockId, userId },
    data: {
      date,
      startTime: data.startTime,
      endTime: data.endTime
    }
  });
}

/**
 * Get available booking time slots for a user on a given date.
 *
 * Algorithm:
 * 1. Determine duration from query (default 30 mins).
 * 2. Get AvailabilityBlocks for that day.
 * 3. Fetch existing confirmed/pending bookings for that date.
 * 4. Fetch Google Calendar events.
 * 5. Generate candidate slots from open to close at service-duration intervals.
 * 6. Filter out slots that overlap with existing bookings or Google events.
 *
 * @param {string} username - The host's username.
 * @param {object} params
 * @param {string} params.date - The target date (YYYY-MM-DD).
 * @param {string} params.duration - Duration in minutes.
 * @returns {Promise<{startTime: string, endTime: string}[]>} Available slots.
 */
export async function getAvailableSlots(username, { date, duration }) {
  const durationMinutes = parseInt(duration) || 30;

  const hostUser = await prisma.user.findUnique({
    where: { username }
  });

  if (!hostUser) {
    throw ApiError.notFound('Host user not found');
  }

  const userId = hostUser.id;

  // 2. Get AvailabilityBlocks for that day
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      userId,
      date: targetDate,
    },
  });

  if (blocks.length === 0) {
    return [];
  }

  // 3. Get existing bookings for that date
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const existingBookings = await prisma.booking.findMany({
    where: {
      hostId: userId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  // Convert booked times to minute ranges for comparison
  const bookedSlots = existingBookings.map((booking) => ({
    start: timeToMinutes(booking.startTime),
    end: timeToMinutes(booking.endTime),
  }));

  // 4. Fetch Google Calendar Events to subtract as busy time
  const googleEvents = await fetchCalendarEvents(hostUser, dayStart.toISOString(), dayEnd.toISOString());
  for (const event of googleEvents) {
    if (!event.start || !event.end) {
      continue;
    }
    // event.start is either an ISO string (e.g. 2025-05-25T10:00:00-04:00) or a date string (2025-05-25)
    let startMins, endMins;
    
    if (event.start.includes('T')) {
      // Parse the time part directly from the ISO string to keep it local to the event's timezone
      const timePartStart = event.start.split('T')[1].substring(0, 5);
      const timePartEnd = event.end.split('T')[1].substring(0, 5);
      startMins = timeToMinutes(timePartStart);
      endMins = timeToMinutes(timePartEnd);
    } else {
      // All day event -> block entire day
      startMins = 0;
      endMins = 1440;
    }
    bookedSlots.push({ start: startMins, end: endMins });
  }

  // 5. Generate candidate time slots from all availability blocks
  const availableSlots = [];

  for (const block of blocks) {
    const blockStart = timeToMinutes(block.startTime);
    const blockEnd = timeToMinutes(block.endTime);

    for (let slotStart = blockStart; slotStart + durationMinutes <= blockEnd; slotStart += durationMinutes) {
      const slotEnd = slotStart + durationMinutes;

      // 6. Check if this slot overlaps with any existing booking or Google event
      const hasOverlap = bookedSlots.some(
        (booked) => slotStart < booked.end && slotEnd > booked.start
      );

      if (!hasOverlap) {
        availableSlots.push({
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
        });
      }
    }
  }

  // Sort available slots chronologically
  availableSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  return availableSlots;
}

/**
 * Get a list of dates that have availability blocks for a user.
 * @param {string} username 
 * @param {string} month - YYYY-MM
 * @returns {Promise<string[]>} Array of YYYY-MM-DD strings
 */
export async function getAvailableDays(username, month) {
  const hostUser = await prisma.user.findUnique({
    where: { username }
  });

  if (!hostUser) {
    throw ApiError.notFound('Host user not found');
  }

  const startDate = new Date(`${month}-01T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      userId: hostUser.id,
      date: {
        gte: startDate,
        lt: endDate
      }
    },
    select: {
      date: true
    }
  });

  // Extract unique dates
  const dates = new Set();
  for (const b of blocks) {
    dates.add(b.date.toISOString().split('T')[0]);
  }

  return Array.from(dates);
}
