/**
 * @module services/availability
 * @description Availability management service — working hours CRUD and
 * the core slot availability algorithm.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

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

  // 2. Get the day of week from the date
  const targetDate = new Date(date);
  const dayOfWeek = DAY_NAMES[targetDate.getUTCDay()];

  // 3. Get working hours for that day
  const workingHoursEntry = await prisma.workingHours.findFirst({
    where: {
      businessId,
      dayOfWeek,
    },
  });

  if (!workingHoursEntry || workingHoursEntry.isClosed) {
    return [];
  }

  const openMinutes = timeToMinutes(workingHoursEntry.openTime);
  const closeMinutes = timeToMinutes(workingHoursEntry.closeTime);

  // 4. Get existing bookings for that date (only active ones)
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

  // 5. Generate candidate time slots
  const availableSlots = [];

  for (let slotStart = openMinutes; slotStart + durationMinutes <= closeMinutes; slotStart += durationMinutes) {
    const slotEnd = slotStart + durationMinutes;

    // 6. Check if this slot overlaps with any existing booking
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

  return availableSlots;
}
