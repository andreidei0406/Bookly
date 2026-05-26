/**
 * @module services/booking
 * @description Booking management service — creation with availability
 * checking, status transitions, rescheduling, and listing.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';
import { sendBookingConfirmation, sendBookingCancellation } from './email.service.js';
import { createCalendarEventWithMeet } from './google.service.js';

/**
 * Valid booking status transitions.
 */
const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Check if a time slot is available (no overlapping bookings for the host).
 */
async function isSlotAvailable(hostId, date, startTime, endTime, excludeBookingId = null) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  const existingBookings = await prisma.booking.findMany({
    where: {
      hostId,
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
 * Create a new booking as a guest (Public).
 */
export async function publicCreate({ hostUsername, guestName, guestEmail, meetingName, duration, date, startTime, notes, timezone }) {
  const host = await prisma.user.findUnique({
    where: { username: hostUsername },
  });

  if (!host) {
    throw ApiError.notFound('Host not found');
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  const endTime = minutesToTime(endMinutes);

  const bookingDate = new Date(date);
  const available = await isSlotAvailable(host.id, bookingDate, startTime, endTime);

  if (!available) {
    throw ApiError.conflict('The selected time slot is not available');
  }

  const booking = await prisma.booking.create({
    data: {
      hostId: host.id,
      guestName,
      guestEmail,
      meetingName,
      duration,
      date: bookingDate,
      startTime,
      endTime,
      notes: notes || null,
      status: 'CONFIRMED', // auto confirm for P2P
    },
    include: {
      host: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  // Generate Google Meet link if host is connected
  let meetLink = null;
  let googleEventId = null;

  if (host.googleAccessToken) {
    // Pass a dummy service to createCalendarEventWithMeet to keep signature
    const dummyService = { name: meetingName, duration };
    // Pass timezone in booking object
    booking.timezone = timezone;
    const calendarData = await createCalendarEventWithMeet(host, booking, dummyService);
    
    if (calendarData) {
      meetLink = calendarData.meetLink;
      googleEventId = calendarData.eventId;

      await prisma.booking.update({
        where: { id: booking.id },
        data: { meetLink, googleEventId },
      });
      booking.meetLink = meetLink;
      booking.googleEventId = googleEventId;
    }
  }

  try {
    sendBookingConfirmation(booking);
  } catch (err) {
    logger.error('Failed to send booking confirmation email', err);
  }

  logger.info(`Booking created: ${booking.id} for host ${host.id}`);
  return booking;
}

/**
 * Self create booking.
 */
export async function create(params) {
  return publicCreate({
    ...params,
    guestName: 'Self',
    guestEmail: 'self@local', // This shouldn't normally be used
  });
}

/**
 * Find all bookings for the host.
 */
export async function findAll(hostId, { page = 1, limit = 20, status } = {}) {
  const skip = (page - 1) * limit;
  const where = { hostId };

  if (status) {
    where.status = status;
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        host: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
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

export async function findById(id) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      host: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  return booking;
}

export async function updateStatus(id, { status, cancelReason }) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      host: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  const allowedTransitions = VALID_TRANSITIONS[booking.status];
  if (!allowedTransitions || !allowedTransitions.includes(status)) {
    throw ApiError.badRequest(
      `Cannot transition booking from ${booking.status} to ${status}`
    );
  }

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
      host: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  });

  try {
    if (status === 'CANCELLED') {
      sendBookingCancellation(updatedBooking);
    }
  } catch (err) {
    logger.error('Failed to send status update notification', err);
  }

  return updatedBooking;
}

export async function reschedule(id, { date, startTime }) {
  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
    throw ApiError.badRequest(
      `Cannot reschedule a booking with status ${booking.status}`
    );
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + booking.duration;
  const endTime = minutesToTime(endMinutes);

  const newDate = new Date(date);
  const available = await isSlotAvailable(
    booking.hostId,
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
      host: { select: { id: true, name: true } },
    },
  });

  return updatedBooking;
}
