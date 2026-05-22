/**
 * @module services/booking
 * @description Booking management service — creation with availability
 * checking, status transitions, rescheduling, and role-filtered listing.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';
import { create as createNotification } from './notification.service.js';
import { sendBookingConfirmation, sendBookingCancellation } from './email.service.js';
import { createCalendarEventWithMeet } from './google.service.js';

/**
 * Valid booking status transitions.
 * Maps from current status to allowed next statuses.
 */
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

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
 * Check if a time slot is available (no overlapping bookings).
 * @param {string} businessId
 * @param {Date} date
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @param {string} [excludeBookingId] - Booking ID to exclude (for rescheduling).
 * @returns {Promise<boolean>}
 */
async function isSlotAvailable(businessId, date, startTime, endTime, excludeBookingId = null) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

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
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: {
      startTime: true,
      endTime: true,
    },
  });

  return !existingBookings.some((booking) => {
    const bookedStart = timeToMinutes(booking.startTime);
    const bookedEnd = timeToMinutes(booking.endTime);
    return startMinutes < bookedEnd && endMinutes > bookedStart;
  });
}

/**
 * Create a new booking.
 * @param {object} params
 * @param {string} params.customerId - The customer's user ID.
 * @param {string} params.businessId - The business ID.
 * @param {string} params.serviceId - The service ID.
 * @param {string} [params.staffId] - Optional staff member ID.
 * @param {string} params.date - Booking date (YYYY-MM-DD).
 * @param {string} params.startTime - Start time (HH:mm).
 * @param {string} [params.notes] - Optional customer notes.
 * @returns {Promise<object>} The created booking with relations.
 */
export async function create({ customerId, businessId, serviceId, staffId, date, startTime, notes }) {
  // 1. Verify service exists and belongs to business
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  if (service.businessId !== businessId) {
    throw ApiError.badRequest('Service does not belong to this business');
  }

  // 2. Calculate endTime from startTime + service.duration
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + service.duration;
  const endTime = minutesToTime(endMinutes);

  // 3. Check slot is available
  const bookingDate = new Date(date);
  const available = await isSlotAvailable(businessId, bookingDate, startTime, endTime);

  if (!available) {
    throw ApiError.conflict('The selected time slot is not available');
  }

  // 4. Create booking
  const booking = await prisma.booking.create({
    data: {
      customerId,
      businessId,
      serviceId,
      staffId: staffId || null,
      date: bookingDate,
      startTime,
      endTime,
      notes: notes || null,
      status: 'PENDING',
    },
    include: {
      service: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
        },
      },
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      staff: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  // 4.5 Generate Google Meet link if applicable
  let meetLink = null;
  let googleEventId = null;

  // Try to use assigned staff's Google account, fallback to business owner's Google account
  let targetUser = booking.staff?.user;
  if (!targetUser) {
    const ownerMember = await prisma.businessMember.findFirst({
      where: { businessId, role: 'OWNER' },
      include: { user: true },
    });
    targetUser = ownerMember?.user;
  }

  if (targetUser?.googleAccessToken) {
    const calendarData = await createCalendarEventWithMeet(targetUser, booking, service);
    if (calendarData) {
      meetLink = calendarData.meetLink;
      googleEventId = calendarData.eventId;

      // Update booking with meet details
      await prisma.booking.update({
        where: { id: booking.id },
        data: { meetLink, googleEventId },
      });
      booking.meetLink = meetLink;
      booking.googleEventId = googleEventId;
    }
  }

  // 5. Send confirmation notification (fire-and-forget)
  try {
    await createNotification({
      userId: customerId,
      bookingId: booking.id,
      type: 'BOOKING_CREATED',
      subject: 'Booking Confirmation',
      body: `Your booking for ${service.name} on ${date} at ${startTime} has been created.`,
    });

    sendBookingConfirmation(booking);
  } catch (err) {
    logger.error('Failed to send booking notification', err);
  }

  logger.info(`Booking created: ${booking.id} for customer ${customerId}`);

  return booking;
}

/**
 * Find all bookings with role-based filtering and pagination.
 * @param {string} userId - The requesting user's ID.
 * @param {string} userRole - The requesting user's platform role.
 * @param {object} params
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit=20] - Items per page.
 * @param {string} [params.status] - Filter by booking status.
 * @param {string} [params.businessId] - Filter by business ID.
 * @returns {Promise<{data: object[], meta: object}>} Paginated bookings.
 */
export async function findAll(userId, userRole, { page = 1, limit = 20, status, businessId } = {}) {
  const skip = (page - 1) * limit;

  const where = {};

  // SUPER_ADMIN sees all; regular users see only their own bookings
  if (userRole !== 'SUPER_ADMIN') {
    // Check if user is a business member — if so, show that business's bookings too
    const memberships = await prisma.businessMember.findMany({
      where: { userId },
      select: { businessId: true },
    });

    const memberBusinessIds = memberships.map((m) => m.businessId);

    if (memberBusinessIds.length > 0) {
      where.OR = [
        { customerId: userId },
        { businessId: { in: memberBusinessIds } },
      ];
    } else {
      where.customerId = userId;
    }
  }

  if (status) {
    where.status = status;
  }

  if (businessId) {
    where.businessId = businessId;
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        service: {
          select: { id: true, name: true, duration: true, price: true },
        },
        business: {
          select: { id: true, name: true, slug: true },
        },
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    data: bookings,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Find a booking by ID with full relations.
 * @param {string} id - The booking ID.
 * @returns {Promise<object>} The booking with relations.
 */
export async function findById(id) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      service: true,
      business: true,
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      staff: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  return booking;
}

/**
 * Update the status of a booking with state transition validation.
 * @param {string} id - The booking ID.
 * @param {object} params
 * @param {string} params.status - The new status.
 * @param {string} [params.cancelReason] - Reason for cancellation (if applicable).
 * @returns {Promise<object>} The updated booking.
 */
export async function updateStatus(id, { status, cancelReason }) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      service: true,
      business: { select: { id: true, name: true } },
      customer: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  // Validate state transition
  const allowedTransitions = VALID_TRANSITIONS[booking.status];
  if (!allowedTransitions || !allowedTransitions.includes(status)) {
    throw ApiError.badRequest(
      `Cannot transition booking from ${booking.status} to ${status}`
    );
  }

  // Build update data with timestamps
  const updateData = { status };

  if (status === 'CANCELLED') {
    updateData.cancelledAt = new Date();
    updateData.cancelReason = cancelReason || null;
  }

  if (status === 'CONFIRMED') {
    updateData.confirmedAt = new Date();
  }

  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: updateData,
    include: {
      service: true,
      business: { select: { id: true, name: true } },
      customer: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  // Send notifications based on status change
  try {
    if (status === 'CANCELLED') {
      await createNotification({
        userId: booking.customerId,
        bookingId: booking.id,
        type: 'BOOKING_CANCELLED',
        subject: 'Booking Cancelled',
        body: `Your booking for ${booking.service.name} has been cancelled.${cancelReason ? ` Reason: ${cancelReason}` : ''}`,
      });

      sendBookingCancellation(updatedBooking);
    } else if (status === 'CONFIRMED') {
      await createNotification({
        userId: booking.customerId,
        bookingId: booking.id,
        type: 'BOOKING_CONFIRMED',
        subject: 'Booking Confirmed',
        body: `Your booking for ${booking.service.name} has been confirmed.`,
      });
    }
  } catch (err) {
    logger.error('Failed to send status update notification', err);
  }

  logger.info(`Booking ${id} status updated: ${booking.status} -> ${status}`);

  return updatedBooking;
}

/**
 * Reschedule a booking to a new date/time.
 * @param {string} id - The booking ID.
 * @param {object} params
 * @param {string} params.date - New date (YYYY-MM-DD).
 * @param {string} params.startTime - New start time (HH:mm).
 * @returns {Promise<object>} The updated booking.
 */
export async function reschedule(id, { date, startTime }) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { service: true },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    throw ApiError.badRequest(
      `Cannot reschedule a booking with status ${booking.status}`
    );
  }

  // Calculate new end time
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + booking.service.duration;
  const endTime = minutesToTime(endMinutes);

  // Check availability for the new slot (excluding current booking)
  const newDate = new Date(date);
  const available = await isSlotAvailable(
    booking.businessId,
    newDate,
    startTime,
    endTime,
    booking.id
  );

  if (!available) {
    throw ApiError.conflict('The selected time slot is not available');
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      date: newDate,
      startTime,
      endTime,
    },
    include: {
      service: true,
      business: { select: { id: true, name: true } },
      customer: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  // Send notification
  try {
    await createNotification({
      userId: booking.customerId,
      bookingId: booking.id,
      type: 'BOOKING_RESCHEDULED',
      subject: 'Booking Rescheduled',
      body: `Your booking for ${booking.service.name} has been rescheduled to ${date} at ${startTime}.`,
    });
  } catch (err) {
    logger.error('Failed to send reschedule notification', err);
  }

  logger.info(`Booking ${id} rescheduled to ${date} at ${startTime}`);

  return updatedBooking;
}
