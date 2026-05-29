import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: { findUnique: vi.fn() },
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    availabilityBlock: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendBookingConfirmation: vi.fn(),
  sendBookingCancellation: vi.fn(),
  sendBookingPending: vi.fn(),
}));

vi.mock('../../src/services/google.service.js', () => ({
  createCalendarEventWithMeet: vi.fn(),
  deleteCalendarEvent: vi.fn(),
}));

import prisma from '../../src/utils/prisma.js';
import ApiError from '../../src/utils/apiError.js';
import {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendBookingPending,
} from '../../src/services/email.service.js';
import {
  createCalendarEventWithMeet,
  deleteCalendarEvent,
} from '../../src/services/google.service.js';
import {
  publicCreate,
  findAll,
  findById,
  updateStatus,
  reschedule,
  publicCancel,
  syncMissingMeetLinks,
} from '../../src/services/booking.service.js';

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

const makeHost = (overrides = {}) => ({
  id: 'host-1',
  email: 'host@example.com',
  firstName: 'Host',
  lastName: 'User',
  username: 'hostuser',
  googleAccessToken: null,
  googleRefreshToken: null,
  googleTokenExpiry: null,
  ...overrides,
});

const makeBooking = (overrides = {}) => ({
  id: 'booking-1',
  hostId: 'host-1',
  guestName: 'Guest',
  guestEmail: 'guest@example.com',
  meetingName: 'Standup',
  duration: 30,
  date: new Date('2030-06-15'),
  startTime: '10:00',
  endTime: '10:30',
  status: 'PENDING',
  notes: null,
  meetLink: null,
  googleEventId: null,
  host: {
    id: 'host-1',
    email: 'host@example.com',
    firstName: 'Host',
    lastName: 'User',
    username: 'hostuser',
  },
  ...overrides,
});

// ─── publicCreate ────────────────────────────────────────────────────
describe('publicCreate', () => {
  const futureDate = '2030-06-15';

  it('should throw 404 when host not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      publicCreate({
        hostUsername: 'nonexistent',
        guestName: 'G',
        guestEmail: 'g@e.com',
        meetingName: 'M',
        duration: 30,
        date: futureDate,
        startTime: '10:00',
        timezone: 'UTC',
      }),
    ).rejects.toThrow(ApiError);

    await expect(
      publicCreate({
        hostUsername: 'nonexistent',
        guestName: 'G',
        guestEmail: 'g@e.com',
        meetingName: 'M',
        duration: 30,
        date: futureDate,
        startTime: '10:00',
        timezone: 'UTC',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should throw 400 when booking is less than 1 hour in advance', async () => {
    const host = makeHost();
    prisma.user.findUnique.mockResolvedValue(host);
    prisma.booking.findMany.mockResolvedValue([]);

    // Fix "now" to 2030-06-15 10:00 UTC — a slot at 10:30 is only 30 min away
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-15T10:00:00Z'));

    await expect(
      publicCreate({
        hostUsername: 'hostuser',
        guestName: 'G',
        guestEmail: 'g@e.com',
        meetingName: 'M',
        duration: 30,
        date: '2030-06-15',
        startTime: '10:30',
        timezone: 'UTC',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Bookings must be scheduled at least 1 hour in advance',
    });
  });

  it('should throw 409 when slot is not available (overlap)', async () => {
    const host = makeHost();
    prisma.user.findUnique.mockResolvedValue(host);

    // isSlotAvailable internally calls prisma.booking.findMany → return overlapping booking
    prisma.booking.findMany.mockResolvedValue([
      { startTime: '09:30', endTime: '10:30' },
    ]);

    await expect(
      publicCreate({
        hostUsername: 'hostuser',
        guestName: 'G',
        guestEmail: 'g@e.com',
        meetingName: 'M',
        duration: 30,
        date: futureDate,
        startTime: '10:00',
        timezone: 'UTC',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should create a PENDING booking when host has no Google token', async () => {
    const host = makeHost();
    prisma.user.findUnique.mockResolvedValue(host);
    prisma.booking.findMany.mockResolvedValue([]); // no overlaps

    const createdBooking = makeBooking({ status: 'PENDING' });
    prisma.booking.create.mockResolvedValue(createdBooking);
    sendBookingPending.mockResolvedValue(undefined);

    const result = await publicCreate({
      hostUsername: 'hostuser',
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      meetingName: 'Standup',
      duration: 30,
      date: futureDate,
      startTime: '10:00',
      timezone: 'UTC',
    });

    expect(result.status).toBe('PENDING');
    expect(prisma.booking.create).toHaveBeenCalled();
    expect(sendBookingPending).toHaveBeenCalledWith(createdBooking);
  });

  it('should create a CONFIRMED booking with Meet link when host has Google token', async () => {
    const host = makeHost({ googleAccessToken: 'token123' });
    prisma.user.findUnique.mockResolvedValue(host);
    prisma.booking.findMany.mockResolvedValue([]);

    const createdBooking = makeBooking({ status: 'CONFIRMED' });
    prisma.booking.create.mockResolvedValue(createdBooking);

    createCalendarEventWithMeet.mockResolvedValue({
      meetLink: 'https://meet.google.com/abc',
      eventId: 'gcal-event-1',
    });

    const updatedBooking = makeBooking({
      status: 'CONFIRMED',
      meetLink: 'https://meet.google.com/abc',
      googleEventId: 'gcal-event-1',
    });
    prisma.booking.update.mockResolvedValue(updatedBooking);
    sendBookingConfirmation.mockResolvedValue(undefined);

    const result = await publicCreate({
      hostUsername: 'hostuser',
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      meetingName: 'Standup',
      duration: 30,
      date: futureDate,
      startTime: '10:00',
      timezone: 'UTC',
    });

    expect(result.meetLink).toBe('https://meet.google.com/abc');
    expect(createCalendarEventWithMeet).toHaveBeenCalled();
    expect(sendBookingConfirmation).toHaveBeenCalledWith(updatedBooking);
  });

  it('should fall back to PENDING when Meet link creation fails', async () => {
    const host = makeHost({ googleAccessToken: 'token123' });
    prisma.user.findUnique.mockResolvedValue(host);
    prisma.booking.findMany.mockResolvedValue([]);

    const createdBooking = makeBooking({ status: 'CONFIRMED' });
    prisma.booking.create.mockResolvedValue(createdBooking);

    createCalendarEventWithMeet.mockResolvedValue(null);

    const fallbackBooking = makeBooking({ status: 'PENDING' });
    prisma.booking.update.mockResolvedValue(fallbackBooking);
    sendBookingPending.mockResolvedValue(undefined);

    const result = await publicCreate({
      hostUsername: 'hostuser',
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      meetingName: 'Standup',
      duration: 30,
      date: futureDate,
      startTime: '10:00',
      timezone: 'UTC',
    });

    expect(result.status).toBe('PENDING');
  });

  it('should not throw when email sending fails', async () => {
    const host = makeHost();
    prisma.user.findUnique.mockResolvedValue(host);
    prisma.booking.findMany.mockResolvedValue([]);

    const createdBooking = makeBooking({ status: 'PENDING' });
    prisma.booking.create.mockResolvedValue(createdBooking);
    sendBookingPending.mockRejectedValue(new Error('SMTP error'));

    const result = await publicCreate({
      hostUsername: 'hostuser',
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      meetingName: 'Standup',
      duration: 30,
      date: futureDate,
      startTime: '10:00',
      timezone: 'UTC',
    });

    expect(result).toBeDefined();
  });
});

// ─── findAll ─────────────────────────────────────────────────────────
describe('findAll', () => {
  it('should return paginated results with meta', async () => {
    const bookings = [makeBooking()];
    prisma.booking.findMany.mockResolvedValue(bookings);
    prisma.booking.count.mockResolvedValue(1);

    const result = await findAll('host-1');

    expect(result.data).toEqual(bookings);
    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });

  it('should filter by status when provided', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);

    await findAll('host-1', { status: 'CONFIRMED' });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hostId: 'host-1', status: 'CONFIRMED' },
      }),
    );
  });
});

// ─── findById ────────────────────────────────────────────────────────
describe('findById', () => {
  it('should return booking when found', async () => {
    const booking = makeBooking();
    prisma.booking.findUnique.mockResolvedValue(booking);

    const result = await findById('booking-1');
    expect(result).toEqual(booking);
  });

  it('should throw 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(findById('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Booking not found',
    });
  });
});

// ─── updateStatus ────────────────────────────────────────────────────
describe('updateStatus', () => {
  it('should successfully transition PENDING → CONFIRMED', async () => {
    const booking = makeBooking({ status: 'PENDING' });
    prisma.booking.findUnique.mockResolvedValue(booking);

    const updated = makeBooking({ status: 'CONFIRMED' });
    prisma.booking.update.mockResolvedValue(updated);

    const result = await updateStatus('booking-1', { status: 'CONFIRMED' });
    expect(result.status).toBe('CONFIRMED');
  });

  it('should throw 400 for invalid transition (COMPLETED → PENDING)', async () => {
    const booking = makeBooking({ status: 'COMPLETED' });
    prisma.booking.findUnique.mockResolvedValue(booking);

    await expect(
      updateStatus('booking-1', { status: 'PENDING' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('should throw 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(
      updateStatus('missing', { status: 'CONFIRMED' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should send cancellation email and delete gcal event on CANCELLED', async () => {
    const booking = makeBooking({
      status: 'PENDING',
      googleEventId: 'gcal-1',
      host: {
        id: 'host-1',
        email: 'host@example.com',
        firstName: 'Host',
        lastName: 'User',
        username: 'hostuser',
        googleAccessToken: 'token',
        googleRefreshToken: 'refresh',
        googleTokenExpiry: new Date(),
      },
    });
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.availabilityBlock.findMany.mockResolvedValue([]);

    const updated = makeBooking({ status: 'CANCELLED' });
    prisma.booking.update.mockResolvedValue(updated);
    sendBookingCancellation.mockResolvedValue(undefined);
    deleteCalendarEvent.mockResolvedValue(true);

    await updateStatus('booking-1', {
      status: 'CANCELLED',
      cancelReason: 'Changed my mind',
    });

    expect(sendBookingCancellation).toHaveBeenCalled();
    expect(deleteCalendarEvent).toHaveBeenCalledWith(booking.host, 'gcal-1');
  });

  it('should split availability blocks with 15-min buffer on CANCELLED', async () => {
    const booking = makeBooking({
      status: 'PENDING',
      startTime: '10:00',
      endTime: '10:30',
      date: new Date('2030-06-15'),
    });
    prisma.booking.findUnique.mockResolvedValue(booking);

    // Availability block from 08:00 to 12:00 — booking at 10:00-10:30 should split it
    prisma.availabilityBlock.findMany.mockResolvedValue([
      { id: 'block-1', startTime: '08:00', endTime: '12:00', userId: 'host-1', date: new Date('2030-06-15') },
    ]);

    const updated = makeBooking({ status: 'CANCELLED' });
    prisma.booking.update.mockResolvedValue(updated);
    sendBookingCancellation.mockResolvedValue(undefined);

    await updateStatus('booking-1', { status: 'CANCELLED' });

    // Should split: block-1 becomes 08:00-09:45 (buffer at 10:00-15min=09:45)
    // and new block 10:45-12:00 (buffer at 10:30+15min=10:45)
    expect(prisma.availabilityBlock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'block-1' },
        data: { endTime: '09:45' },
      }),
    );
    expect(prisma.availabilityBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: '10:45',
          endTime: '12:00',
        }),
      }),
    );
  });
});

// ─── reschedule ──────────────────────────────────────────────────────
describe('reschedule', () => {
  it('should successfully reschedule a booking', async () => {
    const booking = makeBooking({ status: 'PENDING', duration: 30 });
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.booking.findMany.mockResolvedValue([]); // no overlaps

    const updated = makeBooking({ date: new Date('2030-06-20'), startTime: '14:00', endTime: '14:30' });
    prisma.booking.update.mockResolvedValue(updated);

    const result = await reschedule('booking-1', {
      date: '2030-06-20',
      startTime: '14:00',
    });

    expect(result.startTime).toBe('14:00');
  });

  it('should throw 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(
      reschedule('missing', { date: '2030-06-20', startTime: '14:00' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('should throw 400 when trying to reschedule a CANCELLED booking', async () => {
    const booking = makeBooking({ status: 'CANCELLED' });
    prisma.booking.findUnique.mockResolvedValue(booking);

    await expect(
      reschedule('booking-1', { date: '2030-06-20', startTime: '14:00' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('should throw 409 when new slot is not available', async () => {
    const booking = makeBooking({ status: 'PENDING', duration: 30 });
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.booking.findMany.mockResolvedValue([
      { startTime: '13:45', endTime: '14:15' },
    ]);

    await expect(
      reschedule('booking-1', { date: '2030-06-20', startTime: '14:00' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ─── publicCancel ────────────────────────────────────────────────────
describe('publicCancel', () => {
  it('should successfully cancel a booking and send email', async () => {
    const booking = makeBooking({ status: 'CONFIRMED' });
    prisma.booking.findUnique.mockResolvedValue(booking);

    const cancelled = makeBooking({ status: 'CANCELLED' });
    prisma.booking.update.mockResolvedValue(cancelled);
    sendBookingCancellation.mockResolvedValue(undefined);

    const result = await publicCancel('booking-1');
    expect(result.status).toBe('CANCELLED');
    expect(sendBookingCancellation).toHaveBeenCalled();
  });

  it('should return booking as-is if already cancelled', async () => {
    const booking = makeBooking({ status: 'CANCELLED' });
    prisma.booking.findUnique.mockResolvedValue(booking);

    const result = await publicCancel('booking-1');
    expect(result.status).toBe('CANCELLED');
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('should throw 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(publicCancel('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should delete Google Calendar event on cancel', async () => {
    const booking = makeBooking({
      status: 'CONFIRMED',
      googleEventId: 'gcal-1',
      host: {
        id: 'host-1',
        email: 'host@example.com',
        firstName: 'Host',
        lastName: 'User',
        username: 'hostuser',
        googleAccessToken: 'token',
        googleRefreshToken: 'refresh',
        googleTokenExpiry: new Date(),
      },
    });
    prisma.booking.findUnique.mockResolvedValue(booking);

    const cancelled = makeBooking({ status: 'CANCELLED' });
    prisma.booking.update.mockResolvedValue(cancelled);
    sendBookingCancellation.mockResolvedValue(undefined);
    deleteCalendarEvent.mockResolvedValue(true);

    await publicCancel('booking-1');

    expect(deleteCalendarEvent).toHaveBeenCalledWith(booking.host, 'gcal-1');
  });
});

// ─── syncMissingMeetLinks ────────────────────────────────────────────
describe('syncMissingMeetLinks', () => {
  it('should return early when host not found or no Google token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await syncMissingMeetLinks('host-1');

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('should return early when host has no Google token', async () => {
    prisma.user.findUnique.mockResolvedValue(makeHost());

    await syncMissingMeetLinks('host-1');

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('should return early when no pending bookings', async () => {
    prisma.user.findUnique.mockResolvedValue(makeHost({ googleAccessToken: 'token' }));
    prisma.booking.findMany.mockResolvedValue([]);

    await syncMissingMeetLinks('host-1');

    expect(createCalendarEventWithMeet).not.toHaveBeenCalled();
  });

  it('should sync pending bookings and confirm them', async () => {
    const host = makeHost({ googleAccessToken: 'token' });
    prisma.user.findUnique.mockResolvedValue(host);

    const pendingBooking = makeBooking({
      status: 'PENDING',
      meetLink: null,
      googleEventId: null,
      meetingName: 'Standup',
      duration: 30,
    });
    prisma.booking.findMany.mockResolvedValue([pendingBooking]);

    createCalendarEventWithMeet.mockResolvedValue({
      meetLink: 'https://meet.google.com/xyz',
      eventId: 'gcal-2',
    });

    const confirmedBooking = makeBooking({
      status: 'CONFIRMED',
      meetLink: 'https://meet.google.com/xyz',
      googleEventId: 'gcal-2',
    });
    prisma.booking.update.mockResolvedValue(confirmedBooking);
    sendBookingConfirmation.mockResolvedValue(undefined);

    await syncMissingMeetLinks('host-1');

    expect(createCalendarEventWithMeet).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          meetLink: 'https://meet.google.com/xyz',
          googleEventId: 'gcal-2',
        }),
      }),
    );
    expect(sendBookingConfirmation).toHaveBeenCalledWith(confirmedBooking);
  });
});
