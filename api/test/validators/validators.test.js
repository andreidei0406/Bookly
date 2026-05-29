import { describe, it, expect } from 'vitest';
import {
  createBookingSchema,
  publicCreateBookingSchema,
  updateBookingStatusSchema,
  rescheduleBookingSchema,
} from '../../src/validators/booking.validator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validBookingInput = () => ({
  guestName: 'John Doe',
  guestEmail: 'john@example.com',
  meetingName: 'Consultation',
  duration: 30,
  date: '2026-06-15',
  startTime: '14:30',
});

const validPublicBookingInput = () => ({
  ...validBookingInput(),
  hostUsername: 'drewhost',
});

// ---------------------------------------------------------------------------
// createBookingSchema.body
// ---------------------------------------------------------------------------

describe('createBookingSchema.body', () => {
  const schema = createBookingSchema.body;

  // ---- success cases ----

  it('should pass with all required fields', () => {
    const result = schema.safeParse(validBookingInput());
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      meetingName: 'Consultation',
      duration: 30,
      date: '2026-06-15',
      startTime: '14:30',
    });
  });

  it('should pass with optional notes and timezone', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      notes: 'Please call 5 min early',
      timezone: 'Europe/Bucharest',
    });
    expect(result.success).toBe(true);
    expect(result.data.notes).toBe('Please call 5 min early');
    expect(result.data.timezone).toBe('Europe/Bucharest');
  });

  it('should pass when notes and timezone are omitted', () => {
    const result = schema.safeParse(validBookingInput());
    expect(result.success).toBe(true);
    expect(result.data.notes).toBeUndefined();
    expect(result.data.timezone).toBeUndefined();
  });

  it('should trim guestName', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      guestName: '  John Doe  ',
    });
    expect(result.success).toBe(true);
    expect(result.data.guestName).toBe('John Doe');
  });

  it('should trim meetingName', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      meetingName: '  Consultation  ',
    });
    expect(result.success).toBe(true);
    expect(result.data.meetingName).toBe('Consultation');
  });

  it('should trim notes', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      notes: '  some note  ',
    });
    expect(result.success).toBe(true);
    expect(result.data.notes).toBe('some note');
  });

  it('should trim timezone', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      timezone: '  America/New_York  ',
    });
    expect(result.success).toBe(true);
    expect(result.data.timezone).toBe('America/New_York');
  });

  // ---- missing required fields ----

  it('should fail when guestName is missing', () => {
    const { guestName, ...rest } = validBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when guestEmail is missing', () => {
    const { guestEmail, ...rest } = validBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when meetingName is missing', () => {
    const { meetingName, ...rest } = validBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when duration is missing', () => {
    const { duration, ...rest } = validBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when date is missing', () => {
    const { date, ...rest } = validBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when startTime is missing', () => {
    const { startTime, ...rest } = validBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when body is empty', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  // ---- email validation ----

  it('should fail with invalid email (no @)', () => {
    const result = schema.safeParse({ ...validBookingInput(), guestEmail: 'notanemail' });
    expect(result.success).toBe(false);
  });

  it('should fail with invalid email (no domain)', () => {
    const result = schema.safeParse({ ...validBookingInput(), guestEmail: 'user@' });
    expect(result.success).toBe(false);
  });

  it('should fail with invalid email (spaces)', () => {
    const result = schema.safeParse({ ...validBookingInput(), guestEmail: 'user @example.com' });
    expect(result.success).toBe(false);
  });

  // ---- meetingName max length ----

  it('should pass with meetingName exactly 50 chars', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      meetingName: 'A'.repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it('should fail with meetingName exceeding 50 chars', () => {
    const result = schema.safeParse({
      ...validBookingInput(),
      meetingName: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  // ---- date format ----

  it('should pass with valid date YYYY-MM-DD', () => {
    const result = schema.safeParse({ ...validBookingInput(), date: '2026-01-01' });
    expect(result.success).toBe(true);
  });

  it('should fail with date in DD-MM-YYYY format', () => {
    const result = schema.safeParse({ ...validBookingInput(), date: '15-06-2026' });
    expect(result.success).toBe(false);
  });

  it('should fail with date in MM/DD/YYYY format', () => {
    const result = schema.safeParse({ ...validBookingInput(), date: '06/15/2026' });
    expect(result.success).toBe(false);
  });

  it('should fail with date as just text', () => {
    const result = schema.safeParse({ ...validBookingInput(), date: 'tomorrow' });
    expect(result.success).toBe(false);
  });

  it('should fail with date as empty string', () => {
    const result = schema.safeParse({ ...validBookingInput(), date: '' });
    expect(result.success).toBe(false);
  });

  // ---- time format ----

  it('should pass with valid 24h time 00:00', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '00:00' });
    expect(result.success).toBe(true);
  });

  it('should pass with valid 24h time 23:59', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '23:59' });
    expect(result.success).toBe(true);
  });

  it('should fail with time 24:00', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '24:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with time 12:60', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '12:60' });
    expect(result.success).toBe(false);
  });

  it('should fail with 12-hour AM/PM format', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '2:30 PM' });
    expect(result.success).toBe(false);
  });

  it('should fail with single-digit hour', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '9:30' });
    expect(result.success).toBe(false);
  });

  it('should fail with time containing seconds', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '14:30:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with empty startTime', () => {
    const result = schema.safeParse({ ...validBookingInput(), startTime: '' });
    expect(result.success).toBe(false);
  });

  // ---- duration validation ----

  it('should pass with positive integer duration', () => {
    const result = schema.safeParse({ ...validBookingInput(), duration: 60 });
    expect(result.success).toBe(true);
  });

  it('should fail with duration = 0', () => {
    const result = schema.safeParse({ ...validBookingInput(), duration: 0 });
    expect(result.success).toBe(false);
  });

  it('should fail with negative duration', () => {
    const result = schema.safeParse({ ...validBookingInput(), duration: -15 });
    expect(result.success).toBe(false);
  });

  it('should fail with float duration', () => {
    const result = schema.safeParse({ ...validBookingInput(), duration: 30.5 });
    expect(result.success).toBe(false);
  });

  it('should fail with string duration', () => {
    const result = schema.safeParse({ ...validBookingInput(), duration: '30' });
    expect(result.success).toBe(false);
  });

  // ---- type coercion / wrong types ----

  it('should fail when guestName is a number', () => {
    const result = schema.safeParse({ ...validBookingInput(), guestName: 123 });
    expect(result.success).toBe(false);
  });

  it('should fail when date is a number', () => {
    const result = schema.safeParse({ ...validBookingInput(), date: 20260615 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// publicCreateBookingSchema.body
// ---------------------------------------------------------------------------

describe('publicCreateBookingSchema.body', () => {
  const schema = publicCreateBookingSchema.body;

  it('should pass with all required fields including hostUsername', () => {
    const result = schema.safeParse(validPublicBookingInput());
    expect(result.success).toBe(true);
    expect(result.data.hostUsername).toBe('drewhost');
  });

  it('should pass with optional notes and timezone', () => {
    const result = schema.safeParse({
      ...validPublicBookingInput(),
      notes: 'Looking forward to it',
      timezone: 'UTC',
    });
    expect(result.success).toBe(true);
  });

  it('should fail when hostUsername is missing', () => {
    const { hostUsername, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when guestName is missing', () => {
    const { guestName, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when guestEmail is missing', () => {
    const { guestEmail, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail with invalid email', () => {
    const result = schema.safeParse({
      ...validPublicBookingInput(),
      guestEmail: 'bad-email',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when meetingName is missing', () => {
    const { meetingName, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail when meetingName exceeds 50 chars', () => {
    const result = schema.safeParse({
      ...validPublicBookingInput(),
      meetingName: 'X'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('should fail when duration is missing', () => {
    const { duration, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail with non-positive duration', () => {
    const result = schema.safeParse({
      ...validPublicBookingInput(),
      duration: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should fail when date is missing', () => {
    const { date, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail with invalid date format', () => {
    const result = schema.safeParse({
      ...validPublicBookingInput(),
      date: '15/06/2026',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when startTime is missing', () => {
    const { startTime, ...rest } = validPublicBookingInput();
    const result = schema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should fail with invalid startTime format', () => {
    const result = schema.safeParse({
      ...validPublicBookingInput(),
      startTime: '25:00',
    });
    expect(result.success).toBe(false);
  });

  it('should fail with empty object', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateBookingStatusSchema.body
// ---------------------------------------------------------------------------

describe('updateBookingStatusSchema.body', () => {
  const schema = updateBookingStatusSchema.body;

  // ---- valid statuses ----

  it('should pass with status CONFIRMED', () => {
    const result = schema.safeParse({ status: 'CONFIRMED' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('CONFIRMED');
  });

  it('should pass with status CANCELLED', () => {
    const result = schema.safeParse({ status: 'CANCELLED' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('CANCELLED');
  });

  it('should pass with status COMPLETED', () => {
    const result = schema.safeParse({ status: 'COMPLETED' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('COMPLETED');
  });

  it('should pass with status NO_SHOW', () => {
    const result = schema.safeParse({ status: 'NO_SHOW' });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('NO_SHOW');
  });

  // ---- invalid statuses ----

  it('should fail with lowercase status', () => {
    const result = schema.safeParse({ status: 'confirmed' });
    expect(result.success).toBe(false);
  });

  it('should fail with unknown status', () => {
    const result = schema.safeParse({ status: 'PENDING' });
    expect(result.success).toBe(false);
  });

  it('should fail with empty string status', () => {
    const result = schema.safeParse({ status: '' });
    expect(result.success).toBe(false);
  });

  it('should fail when status is missing', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should fail when status is a number', () => {
    const result = schema.safeParse({ status: 1 });
    expect(result.success).toBe(false);
  });

  // ---- cancelReason ----

  it('should pass with optional cancelReason provided', () => {
    const result = schema.safeParse({
      status: 'CANCELLED',
      cancelReason: 'Schedule conflict',
    });
    expect(result.success).toBe(true);
    expect(result.data.cancelReason).toBe('Schedule conflict');
  });

  it('should pass without cancelReason', () => {
    const result = schema.safeParse({ status: 'CONFIRMED' });
    expect(result.success).toBe(true);
    expect(result.data.cancelReason).toBeUndefined();
  });

  it('should trim cancelReason', () => {
    const result = schema.safeParse({
      status: 'CANCELLED',
      cancelReason: '  I am busy  ',
    });
    expect(result.success).toBe(true);
    expect(result.data.cancelReason).toBe('I am busy');
  });
});

// ---------------------------------------------------------------------------
// rescheduleBookingSchema.body
// ---------------------------------------------------------------------------

describe('rescheduleBookingSchema.body', () => {
  const schema = rescheduleBookingSchema.body;

  // ---- success cases ----

  it('should pass with valid date and startTime', () => {
    const result = schema.safeParse({ date: '2026-07-01', startTime: '10:00' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ date: '2026-07-01', startTime: '10:00' });
  });

  it('should pass with boundary time 00:00', () => {
    const result = schema.safeParse({ date: '2026-01-01', startTime: '00:00' });
    expect(result.success).toBe(true);
  });

  it('should pass with boundary time 23:59', () => {
    const result = schema.safeParse({ date: '2026-12-31', startTime: '23:59' });
    expect(result.success).toBe(true);
  });

  // ---- missing fields ----

  it('should fail when date is missing', () => {
    const result = schema.safeParse({ startTime: '10:00' });
    expect(result.success).toBe(false);
  });

  it('should fail when startTime is missing', () => {
    const result = schema.safeParse({ date: '2026-07-01' });
    expect(result.success).toBe(false);
  });

  it('should fail with empty object', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  // ---- invalid date formats ----

  it('should fail with date in wrong format (DD/MM/YYYY)', () => {
    const result = schema.safeParse({ date: '01/07/2026', startTime: '10:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with date missing leading zeros', () => {
    const result = schema.safeParse({ date: '2026-7-1', startTime: '10:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with date as ISO datetime string', () => {
    const result = schema.safeParse({ date: '2026-07-01T10:00:00Z', startTime: '10:00' });
    expect(result.success).toBe(false);
  });

  // ---- invalid time formats ----

  it('should fail with startTime 24:00', () => {
    const result = schema.safeParse({ date: '2026-07-01', startTime: '24:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with startTime as single-digit hour', () => {
    const result = schema.safeParse({ date: '2026-07-01', startTime: '9:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with startTime with seconds', () => {
    const result = schema.safeParse({ date: '2026-07-01', startTime: '10:00:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with startTime in 12h format', () => {
    const result = schema.safeParse({ date: '2026-07-01', startTime: '1:00 PM' });
    expect(result.success).toBe(false);
  });

  it('should fail with non-string date', () => {
    const result = schema.safeParse({ date: 20260701, startTime: '10:00' });
    expect(result.success).toBe(false);
  });

  it('should fail with non-string startTime', () => {
    const result = schema.safeParse({ date: '2026-07-01', startTime: 1000 });
    expect(result.success).toBe(false);
  });
});
