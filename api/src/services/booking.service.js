/**
 * @module services/booking
 * @description Booking management service — creation with availability
 * checking, status transitions, rescheduling, and listing.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';
import { sendBookingConfirmation, sendBookingCancellation, sendBookingPending } from './email.service.js';
import { createCalendarEventWithMeet, deleteCalendarEvent } from './google.service.js';

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

  // Enforce timezone-safe "at least 1 hour in advance" constraint
  const guestNowStr = new Date().toLocaleString('en-US', { timeZone: timezone || 'UTC' });
  const guestNow = new Date(guestNowStr);
  const slotStart = new Date(`${date} ${startTime}`);
  const diffMs = slotStart.getTime() - guestNow.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    throw ApiError.badRequest('Bookings must be scheduled at least 1 hour in advance');
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + duration;
  const endTime = minutesToTime(endMinutes);

  const bookingDate = new Date(date);
  const available = await isSlotAvailable(host.id, bookingDate, startTime, endTime);

  if (!available) {
    throw ApiError.conflict('The selected time slot is not available');
  }

  const status = host.googleAccessToken ? 'CONFIRMED' : 'PENDING';

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
      status,
    },
    include: {
      host: {
        select: { id: true, email: true, firstName: true, lastName: true, username: true },
      },
    },
  });

  // Generate Google Meet link if host is connected
  let meetLink = null;
  let googleEventId = null;
  let finalBooking = booking;

  if (host.googleAccessToken) {
    // Pass a dummy service to createCalendarEventWithMeet to keep signature
    const dummyService = { name: meetingName, duration };
    // Pass timezone in booking object
    booking.timezone = timezone;
    const calendarData = await createCalendarEventWithMeet(host, booking, dummyService);
    
    if (calendarData && calendarData.meetLink) {
      meetLink = calendarData.meetLink;
      googleEventId = calendarData.eventId;

      finalBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: { meetLink, googleEventId },
        include: {
          host: {
            select: { id: true, email: true, firstName: true, lastName: true, username: true },
          },
        },
      });
    } else {
      // Meet link generation failed (e.g. token expired/revoked)
      // Safely downgrade status to PENDING so it syncs when they next log in
      finalBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'PENDING' },
        include: {
          host: {
            select: { id: true, email: true, firstName: true, lastName: true, username: true },
          },
        },
      });
    }
  }

  try {
    if (finalBooking.status === 'CONFIRMED') {
      await sendBookingConfirmation(finalBooking);
    } else {
      await sendBookingPending(finalBooking);
    }
  } catch (err) {
    logger.error('Failed to send booking notification email', err);
  }

  logger.info(`Booking created: ${booking.id} for host ${host.id} (Status: ${finalBooking.status})`);
  return finalBooking;
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
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
        },
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

    // Split and buffer availability blocks by 15 minutes on Host Cancellation
    try {
      const blocks = await prisma.availabilityBlock.findMany({
        where: {
          userId: booking.hostId,
          date: booking.date,
        },
      });

      for (const block of blocks) {
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        const bookingStart = timeToMinutes(booking.startTime);
        const bookingEnd = timeToMinutes(booking.endTime);

        const bufferStart = bookingStart - 15;
        const bufferEnd = bookingEnd + 15;

        // Check if the booking overlaps with this availability block
        if (blockStart < bookingEnd && blockEnd > bookingStart) {
          const hasLeftBlock = bufferStart > blockStart;
          const hasRightBlock = bufferEnd < blockEnd;

          if (hasLeftBlock && hasRightBlock) {
            // Split into two blocks: update current to left, create new right
            await prisma.availabilityBlock.update({
              where: { id: block.id },
              data: { endTime: minutesToTime(bufferStart) },
            });

            await prisma.availabilityBlock.create({
              data: {
                userId: booking.hostId,
                date: booking.date,
                startTime: minutesToTime(bufferEnd),
                endTime: block.endTime,
              },
            });
          } else if (hasLeftBlock) {
            // Shrink from right: update current to left
            await prisma.availabilityBlock.update({
              where: { id: block.id },
              data: { endTime: minutesToTime(bufferStart) },
            });
          } else if (hasRightBlock) {
            // Shrink from left: update current to right
            await prisma.availabilityBlock.update({
              where: { id: block.id },
              data: { startTime: minutesToTime(bufferEnd) },
            });
          } else {
            // Entirely consumed: delete the block
            await prisma.availabilityBlock.delete({
              where: { id: block.id },
            });
          }
        }
      }
    } catch (err) {
      logger.error('Failed to split and buffer availability blocks on host cancellation', err);
    }
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
        select: { id: true, email: true, firstName: true, lastName: true, username: true },
      },
    },
  });

  try {
    if (status === 'CANCELLED') {
      await sendBookingCancellation(updatedBooking);
      if (booking.googleEventId && booking.host) {
        await deleteCalendarEvent(booking.host, booking.googleEventId);
      }
    }
  } catch (err) {
    logger.error('Failed to send status update notification or delete calendar event', err);
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
      host: { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
    },
  });

  return updatedBooking;
}

export async function publicCancel(id) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      host: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
        },
      },
    },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  if (booking.status === 'CANCELLED') {
    return booking; // already cancelled
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: 'Cancelled by guest',
    },
    include: {
      host: {
        select: { id: true, email: true, firstName: true, lastName: true, username: true },
      },
    },
  });

  // Since it was cancelled by the guest, we do NOT change availability blocks!
  // The slot automatically opens up because the booking is no longer active.

  try {
    await sendBookingCancellation(updatedBooking);
    if (booking.googleEventId && booking.host) {
      await deleteCalendarEvent(booking.host, booking.googleEventId);
    }
  } catch (err) {
    logger.error('Failed to send status update notification or delete calendar event', err);
  }

  return updatedBooking;
}

export async function syncMissingMeetLinks(hostId) {
  try {
    const host = await prisma.user.findUnique({
      where: { id: hostId },
    });

    if (!host || !host.googleAccessToken) {
      return;
    }

    // Find future or current PENDING bookings for this host
    const pendingBookings = await prisma.booking.findMany({
      where: {
        hostId,
        status: 'PENDING',
        meetLink: null,
        googleEventId: null,
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      include: {
        host: {
          select: { id: true, email: true, firstName: true, lastName: true, username: true },
        },
      },
    });

    if (pendingBookings.length === 0) {
      return;
    }

    logger.info(`Syncing ${pendingBookings.length} pending bookings for host: ${hostId}`);

    for (const booking of pendingBookings) {
      try {
        const dummyService = { name: booking.meetingName, duration: booking.duration };
        booking.timezone = 'UTC';
        const calendarData = await createCalendarEventWithMeet(host, booking, dummyService);

        if (calendarData && calendarData.meetLink) {
          const updatedBooking = await prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CONFIRMED',
              meetLink: calendarData.meetLink,
              googleEventId: calendarData.eventId,
            },
            include: {
              host: {
                select: { id: true, email: true, firstName: true, lastName: true, username: true },
              },
            },
          });

          // Send confirmation email with the new Meet link
          try {
            await sendBookingConfirmation(updatedBooking);
            logger.info(`Sent booking confirmation with Meet link for booking: ${booking.id}`);
          } catch (mailErr) {
            logger.error(`Failed to send sync confirmation email for booking ${booking.id}: ${mailErr.message}`);
          }
        }
      } catch (err) {
        logger.error(`Failed to sync Meet link for booking ${booking.id}: ${err.message}`);
      }
    }
  } catch (syncErr) {
    logger.error(`Error in syncMissingMeetLinks: ${syncErr.message}`);
  }
}
