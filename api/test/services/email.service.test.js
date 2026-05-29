import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';

// Mock the config BEFORE importing the email service so the transporter gets initialized.
vi.mock('../../src/config/index.js', () => ({
  default: {
    email: {
      host: 'smtp.example.com',
      port: 587,
      user: 'test@example.com',
      pass: 'password',
      from: 'Bookly <noreply@bookly.com>'
    },
    cors: {
      origin: 'http://localhost:4200'
    }
  }
}));

// Mock nodemailer.createTransport with a mock sendMail function.
// We store the mock in a hoisted mock object so we can access it inside our tests.
const mockNodemailer = {
  sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id-123' })
};

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockImplementation(() => ({
      sendMail: (...args) => mockNodemailer.sendMail(...args)
    }))
  }
}));

// Now import the service under test
import {
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendBookingPending,
  sendBookingCancellation,
  sendPasswordResetEmail
} from '../../src/services/email.service.js';

describe('Email Service', () => {
  beforeEach(() => {
    mockNodemailer.sendMail.mockClear();
  });

  describe('sendWelcomeEmail()', () => {
    it('should compile and send the welcome email', async () => {
      const user = {
        email: 'user@example.com',
        firstName: 'Alice'
      };

      await sendWelcomeEmail(user);

      expect(mockNodemailer.sendMail).toHaveBeenCalledTimes(1);
      const args = mockNodemailer.sendMail.mock.calls[0][0];
      expect(args.to).toBe(user.email);
      expect(args.subject).toBe('Welcome to Bookly!');
      expect(args.html).toContain('Alice');
      expect(args.html).toContain('Welcome to Bookly');
    });
  });

  describe('sendBookingConfirmation()', () => {
    it('should compile and send confirmation email to guest', async () => {
      const booking = {
        id: 'booking-1',
        guestEmail: 'guest@example.com',
        guestName: 'Bob',
        meetingName: 'Quick Sync',
        date: new Date('2030-10-15'),
        startTime: '10:00',
        endTime: '10:30',
        status: 'CONFIRMED',
        meetLink: 'https://meet.google.com/abc-defg-hij',
        host: {
          firstName: 'Host',
          lastName: 'User',
          email: 'host@example.com'
        }
      };

      await sendBookingConfirmation(booking);

      expect(mockNodemailer.sendMail).toHaveBeenCalledTimes(1);
      const args = mockNodemailer.sendMail.mock.calls[0][0];
      expect(args.to).toBe(booking.guestEmail);
      expect(args.subject).toBe('Booking Confirmed: Quick Sync - Bookly');
      expect(args.html).toContain('Bob');
      expect(args.html).toContain('Quick Sync');
      expect(args.html).toContain('Host User');
      expect(args.html).toContain('https://meet.google.com/abc-defg-hij');
      expect(args.html).toContain('/booking/booking-1/guest-cancel');
    });
  });

  describe('sendBookingPending()', () => {
    it('should compile and send pending email to guest', async () => {
      const booking = {
        id: 'booking-2',
        guestEmail: 'pending-guest@example.com',
        guestName: 'Charlie',
        meetingName: 'Consultation',
        date: new Date('2030-10-16'),
        startTime: '14:00',
        endTime: '15:00',
        status: 'PENDING',
        host: {
          firstName: 'Admin',
          lastName: 'Owner',
          email: 'admin@example.com'
        }
      };

      await sendBookingPending(booking);

      expect(mockNodemailer.sendMail).toHaveBeenCalledTimes(1);
      const args = mockNodemailer.sendMail.mock.calls[0][0];
      expect(args.to).toBe(booking.guestEmail);
      expect(args.subject).toBe('Booking Received (Pending): Consultation - Bookly');
      expect(args.html).toContain('Charlie');
      expect(args.html).toContain('Consultation');
      expect(args.html).toContain('Admin Owner');
    });
  });

  describe('sendBookingCancellation()', () => {
    it('should compile and send cancellation email to guest', async () => {
      const booking = {
        id: 'booking-3',
        guestEmail: 'cancelled-guest@example.com',
        guestName: 'Dave',
        meetingName: 'Consultation',
        date: new Date('2030-10-17'),
        startTime: '11:00',
        endTime: '12:00',
        cancelReason: 'Conflict in schedule',
        host: {
          firstName: 'DaveHost',
          lastName: 'Hosty',
          username: 'davehost'
        }
      };

      await sendBookingCancellation(booking);

      expect(mockNodemailer.sendMail).toHaveBeenCalledTimes(1);
      const args = mockNodemailer.sendMail.mock.calls[0][0];
      expect(args.to).toBe(booking.guestEmail);
      expect(args.subject).toBe('Booking Cancelled: Consultation - Bookly');
      expect(args.html).toContain('Dave');
      expect(args.html).toContain('Conflict in schedule');
      expect(args.html).toContain('/booking/davehost');
    });
  });

  describe('sendPasswordResetEmail()', () => {
    it('should compile and send password reset link email', async () => {
      const user = {
        email: 'reset-user@example.com',
        firstName: 'Frank'
      };
      const token = 'fake-jwt-reset-token';

      await sendPasswordResetEmail(user, token);

      expect(mockNodemailer.sendMail).toHaveBeenCalledTimes(1);
      const args = mockNodemailer.sendMail.mock.calls[0][0];
      expect(args.to).toBe(user.email);
      expect(args.subject).toBe('Reset Your Password - Bookly');
      expect(args.html).toContain('Frank');
      expect(args.html).toContain('http://localhost:4200/reset-password?token&#x3D;fake-jwt-reset-token');
    });
  });
});
