/**
 * @module services/availability
 * @description Availability management service — working hours CRUD and
 * the core slot availability algorithm.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';
import { fetchCalendarEvents } from './google.service.js';

/** Map JS Date.getDay() (0=Sun) to day-of-week names used in the schema. */
const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

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

/**
 * Get all working hours for a business.
 * @param {string} businessId - The business ID.
 * @returns {Promise<object[]>} Array of WorkingHours records.
 */
export async function getWorkingHours(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  const workingHours = await prisma.workingHours.findMany({
    where: { businessId },
    orderBy: { dayOfWeek: 'asc' },
  });

  return workingHours;
}

/**
 * Set working hours for a business. Replaces all existing entries in a transaction.
 * @param {string} businessId - The business ID.
 * @param {object[]} hours - Array of working hour entries.
 * @param {string} hours[].dayOfWeek - Day of the week (MONDAY, TUESDAY, etc.).
 * @param {string} hours[].openTime - Opening time (HH:mm).
 * @param {string} hours[].closeTime - Closing time (HH:mm).
 * @param {boolean} [hours[].isClosed=false] - Whether the business is closed on this day.
 * @returns {Promise<object[]>} The newly created working hours.
 */
export async function setWorkingHours(businessId, hours) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  const result = await prisma.$transaction(async (tx) => {
    // Delete all existing working hours for this business
    await tx.workingHours.deleteMany({
      where: { businessId },
    });

    // Create new working hours entries
    if (hours.length > 0) {
      await tx.workingHours.createMany({
        data: hours.map((entry) => ({
          businessId,
          dayOfWeek: entry.dayOfWeek,
          openTime: entry.openTime,
          closeTime: entry.closeTime,
          isClosed: entry.isClosed || false,
        })),
      });
    }

    // Fetch and return the newly created records
    return tx.workingHours.findMany({
      where: { businessId },
      orderBy: { dayOfWeek: 'asc' },
    });
  });

  logger.info(`Working hours set for business ${businessId}: ${hours.length} entries`);

  return result;
}

export async function getBlocks(businessId, query) {
  const { startDate, endDate } = query;
  
  const where = { businessId };
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

export async function createBlock(businessId, data) {
  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  const startMins = timeToMinutes(data.startTime);
  const endMins = timeToMinutes(data.endTime);

  return prisma.$transaction(async (tx) => {
    // 1. Fetch existing blocks for this date
    const existingBlocks = await tx.availabilityBlock.findMany({
      where: {
        businessId,
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
        businessId,
        date,
        startTime: minutesToTime(mergedStart),
        endTime: minutesToTime(mergedEnd)
      }
    });
  });
}

export async function clearBlocks(businessId, query) {
  const { startDate, endDate } = query;
  const where = { businessId };
  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }
  
  const result = await prisma.availabilityBlock.deleteMany({ where });
  return { deletedCount: result.count };
}

export async function deleteBlock(businessId, blockId) {
  return prisma.availabilityBlock.delete({
    where: { id: blockId, businessId }
  });
}

export async function updateBlock(businessId, blockId, data) {
  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  return prisma.availabilityBlock.update({
    where: { id: blockId, businessId },
    data: {
      date,
      startTime: data.startTime,
      endTime: data.endTime
    }
  });
}

/**
 * Get available booking time slots for a business on a given date.
 *
 * Algorithm:
 * 1. Look up the requested service to determine duration.
 * 2. Determine the day of week from the date.
 * 3. Retrieve working hours for that day — return empty if closed.
 * 4. Fetch existing confirmed/pending bookings for that date.
 * 5. Generate candidate slots from open to close at service-duration intervals.
 * 6. Filter out slots that overlap with existing bookings.
 *
 * @param {string} businessId - The business ID.
 * @param {object} params
 * @param {string} params.date - The target date (YYYY-MM-DD).
 * @param {string} params.serviceId - The service ID (for duration).
 * @returns {Promise<{startTime: string, endTime: string}[]>} Available slots.
 */
export async function getAvailableSlots(businessId, { date, serviceId }) {
  // 1. Get the service to know the duration
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  if (service.businessId !== businessId) {
    throw ApiError.badRequest('Service does not belong to this business');
  }

  const durationMinutes = service.duration; // duration in minutes

  // 2. Get AvailabilityBlocks for that day
  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      businessId,
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
      businessId,
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
  const ownerMember = await prisma.businessMember.findFirst({
    where: { businessId, role: 'OWNER' },
    include: { user: true }
  });

  if (ownerMember && ownerMember.user) {
    const googleEvents = await fetchCalendarEvents(ownerMember.user, dayStart.toISOString(), dayEnd.toISOString());
    for (const event of googleEvents) {
      if (!event.start || !event.end) {
        continue;
      }
      const startDt = new Date(event.start);
      const endDt = new Date(event.end);
      // convert to minutes
      const startMins = startDt.getHours() * 60 + startDt.getMinutes();
      const endMins = endDt.getHours() * 60 + endDt.getMinutes();
      bookedSlots.push({ start: startMins, end: endMins });
    }
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
