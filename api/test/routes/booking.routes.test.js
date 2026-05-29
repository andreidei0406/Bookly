import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/utils/prisma.js';
import { verifyAccessToken } from '../../src/utils/tokens.js';

vi.mock('../../src/utils/tokens.js', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../../src/utils/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    availabilityBlock: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (cb) => cb(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendBookingConfirmation: vi.fn(),
  sendBookingPending: vi.fn(),
  sendBookingCancellation: vi.fn(),
}));

vi.mock('../../src/services/google.service.js', () => ({
  createCalendarEventWithMeet: vi.fn().mockResolvedValue({
    meetLink: 'meet-link-123',
    eventId: 'event-123',
  }),
  deleteCalendarEvent: vi.fn(),
}));

describe('Booking Routes Integration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  });

  describe('POST /api/v1/bookings/public', () => {
    it('should successfully create a public booking', async () => {
      // Mock host lookup
      prisma.user.findUnique.mockResolvedValue({
        id: 'host_123',
        username: 'goodhost',
        googleAccessToken: 'yes',
        isActive: true,
      });

      // Mock overlapping availability checks
      prisma.availabilityBlock.findMany.mockResolvedValue([
        { id: 'b1', date: new Date('2030-06-15'), startTime: '09:00', endTime: '17:00' },
      ]);
      prisma.booking.findMany.mockResolvedValue([]);

      // Mock booking creation
      const createdBooking = {
        id: 'booking_abc',
        hostId: 'host_123',
        guestName: 'Guest User',
        guestEmail: 'guest@example.com',
        meetingName: 'Quick Chat',
        duration: 30,
        date: new Date('2030-06-15'),
        startTime: '10:00',
        endTime: '10:30',
        status: 'CONFIRMED',
        meetLink: 'meet-link-123',
      };
      prisma.booking.create.mockResolvedValue(createdBooking);
      prisma.booking.update.mockResolvedValue(createdBooking);

      const res = await request(app)
        .post('/api/v1/bookings/public')
        .send({
          hostUsername: 'goodhost',
          guestName: 'Guest User',
          guestEmail: 'guest@example.com',
          meetingName: 'Quick Chat',
          duration: 30,
          date: '2030-06-15',
          startTime: '10:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('booking_abc');
    });

    it('should fail if host username is missing', async () => {
      const res = await request(app)
        .post('/api/v1/bookings/public')
        .send({
          guestName: 'Guest User',
          guestEmail: 'guest@example.com',
          meetingName: 'Quick Chat',
          duration: 30,
          date: '2030-06-15',
          startTime: '10:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/v1/bookings/public/:id', () => {
    it('should return a public booking details', async () => {
      const mockBooking = {
        id: 'booking_abc',
        hostId: 'host_123',
        guestName: 'Guest User',
        guestEmail: 'guest@example.com',
        meetingName: 'Quick Chat',
        duration: 30,
        date: new Date('2030-06-15'),
        startTime: '10:00',
        endTime: '10:30',
        status: 'CONFIRMED',
      };
      prisma.booking.findUnique.mockResolvedValue(mockBooking);

      const res = await request(app).get('/api/v1/bookings/public/booking_abc');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('booking_abc');
    });
  });
});
