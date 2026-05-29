import { describe, it, expect, vi, afterEach } from 'vitest';
import { google } from 'googleapis';

// --- Mocks (vi.hoisted ensures these exist before vi.mock factories run) ---

const { mockInsert, mockList, mockDelete, mockSetCredentials, mockOn } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockList: vi.fn(),
  mockDelete: vi.fn(),
  mockSetCredentials: vi.fn(),
  mockOn: vi.fn(),
}));

vi.mock('googleapis', () => {
  const mockOAuth2Instance = {
    setCredentials: mockSetCredentials,
    on: mockOn,
  };
  const mockCalendar = {
    events: {
      insert: mockInsert,
      list: mockList,
      delete: mockDelete,
    },
  };
  return {
    google: {
      auth: {
        OAuth2: vi.fn(() => mockOAuth2Instance),
      },
      calendar: vi.fn(() => mockCalendar),
    },
  };
});

vi.mock('../../src/config/index.js', () => ({
  default: {
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'http://localhost/callback',
    },
  },
}));

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../src/utils/prisma.js', () => ({
  default: { user: { update: vi.fn() } },
}));

// --- Import SUT after mocks ---

import {
  createCalendarEventWithMeet,
  fetchCalendarEvents,
  deleteCalendarEvent,
} from '../../src/services/google.service.js';
import logger from '../../src/config/logger.js';
import prisma from '../../src/utils/prisma.js';

// --- Helpers ---

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    googleAccessToken: 'access-token-123',
    googleRefreshToken: 'refresh-token-456',
    googleTokenExpiry: new Date('2026-12-31T00:00:00Z'),
    ...overrides,
  };
}

function makeBooking(overrides = {}) {
  return {
    id: 'booking-1',
    date: new Date('2026-06-15T00:00:00Z'),
    startTime: '10:00',
    endTime: '11:00',
    timezone: 'America/New_York',
    notes: 'Please bring documents',
    guestEmail: 'guest@example.com',
    ...overrides,
  };
}

function makeService(overrides = {}) {
  return {
    name: 'Consultation',
    ...overrides,
  };
}

// --- Tests ---

describe('Google Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // =============================================
  // createCalendarEventWithMeet
  // =============================================
  describe('createCalendarEventWithMeet', () => {
    it('should return null when user has no googleAccessToken', async () => {
      const user = makeUser({ googleAccessToken: null });
      const result = await createCalendarEventWithMeet(user, makeBooking(), makeService());

      expect(result).toBeNull();
      expect(mockSetCredentials).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should return null when googleAccessToken is undefined', async () => {
      const user = makeUser({ googleAccessToken: undefined });
      const result = await createCalendarEventWithMeet(user, makeBooking(), makeService());

      expect(result).toBeNull();
    });

    it('should return null when googleAccessToken is empty string', async () => {
      const user = makeUser({ googleAccessToken: '' });
      const result = await createCalendarEventWithMeet(user, makeBooking(), makeService());

      expect(result).toBeNull();
    });

    it('should successfully create a calendar event and return meetLink + eventId', async () => {
      const user = makeUser();
      const booking = makeBooking();
      const service = makeService();

      mockInsert.mockResolvedValue({
        data: {
          hangoutLink: 'https://meet.google.com/abc-defg-hij',
          id: 'event-id-123',
        },
      });

      const result = await createCalendarEventWithMeet(user, booking, service);

      expect(result).toEqual({
        meetLink: 'https://meet.google.com/abc-defg-hij',
        eventId: 'event-id-123',
      });

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: user.googleTokenExpiry.getTime(),
      });

      expect(mockInsert).toHaveBeenCalledWith({
        calendarId: 'primary',
        resource: {
          summary: 'Booking: Consultation',
          description: 'Appointment with John Doe\nNotes: Please bring documents',
          start: { dateTime: '2026-06-15T10:00:00', timeZone: 'America/New_York' },
          end: { dateTime: '2026-06-15T11:00:00', timeZone: 'America/New_York' },
          conferenceData: {
            createRequest: {
              requestId: 'booking-1',
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          attendees: [{ email: 'guest@example.com' }],
        },
        conferenceDataVersion: 1,
        sendUpdates: 'all',
      });
    });

    it('should use UTC as default timezone when booking has no timezone', async () => {
      const user = makeUser();
      const booking = makeBooking({ timezone: undefined });
      const service = makeService();

      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'https://meet.google.com/xyz', id: 'evt-2' },
      });

      await createCalendarEventWithMeet(user, booking, service);

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.resource.start.timeZone).toBe('UTC');
      expect(insertCall.resource.end.timeZone).toBe('UTC');
    });

    it('should handle booking with no notes gracefully', async () => {
      const user = makeUser();
      const booking = makeBooking({ notes: null });
      const service = makeService();

      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'https://meet.google.com/xyz', id: 'evt-3' },
      });

      await createCalendarEventWithMeet(user, booking, service);

      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.resource.description).toBe(
        'Appointment with John Doe\nNotes: None'
      );
    });

    it('should register a tokens listener on oauth2Client', async () => {
      const user = makeUser();
      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'link', id: 'id' },
      });

      await createCalendarEventWithMeet(user, makeBooking(), makeService());

      expect(mockOn).toHaveBeenCalledWith('tokens', expect.any(Function));
    });

    it('should update user tokens in DB when token refresh callback fires with access_token', async () => {
      const user = makeUser();
      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'link', id: 'id' },
      });

      await createCalendarEventWithMeet(user, makeBooking(), makeService());

      // Extract the callback registered on 'tokens'
      const tokensCallback = mockOn.mock.calls.find((c) => c[0] === 'tokens')[1];

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: 1735689600000,
      };

      await tokensCallback(newTokens);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          googleAccessToken: 'new-access-token',
          googleRefreshToken: 'new-refresh-token',
          googleTokenExpiry: new Date(1735689600000),
        },
      });
    });

    it('should update user tokens without refresh_token when callback fires without it', async () => {
      const user = makeUser();
      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'link', id: 'id' },
      });

      await createCalendarEventWithMeet(user, makeBooking(), makeService());

      const tokensCallback = mockOn.mock.calls.find((c) => c[0] === 'tokens')[1];

      const newTokens = {
        access_token: 'new-access-token',
        expiry_date: 1735689600000,
      };

      await tokensCallback(newTokens);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          googleAccessToken: 'new-access-token',
          googleTokenExpiry: new Date(1735689600000),
        },
      });
    });

    it('should not update DB when tokens callback fires without access_token', async () => {
      const user = makeUser();
      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'link', id: 'id' },
      });

      await createCalendarEventWithMeet(user, makeBooking(), makeService());

      const tokensCallback = mockOn.mock.calls.find((c) => c[0] === 'tokens')[1];

      await tokensCallback({ expiry_date: 123456 });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return null on API error and log the error', async () => {
      const user = makeUser();
      mockInsert.mockRejectedValue(new Error('Google API rate limit exceeded'));

      const result = await createCalendarEventWithMeet(
        user,
        makeBooking(),
        makeService()
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create Google Meet event: Google API rate limit exceeded'
      );
    });

    it('should handle googleTokenExpiry being null', async () => {
      const user = makeUser({ googleTokenExpiry: null });
      mockInsert.mockResolvedValue({
        data: { hangoutLink: 'link', id: 'id' },
      });

      const result = await createCalendarEventWithMeet(user, makeBooking(), makeService());

      expect(result).toEqual({ meetLink: 'link', eventId: 'id' });
      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: undefined,
      });
    });
  });

  // =============================================
  // fetchCalendarEvents
  // =============================================
  describe('fetchCalendarEvents', () => {
    it('should return empty array when user has no googleAccessToken', async () => {
      const user = makeUser({ googleAccessToken: null });
      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([]);
      expect(mockList).not.toHaveBeenCalled();
    });

    it('should return empty array when googleAccessToken is undefined', async () => {
      const user = makeUser({ googleAccessToken: undefined });
      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([]);
    });

    it('should return empty array when googleAccessToken is empty string', async () => {
      const user = makeUser({ googleAccessToken: '' });
      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([]);
    });

    it('should successfully fetch and map events with dateTime format', async () => {
      const user = makeUser();

      mockList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'evt-1',
              summary: 'Team Meeting',
              start: { dateTime: '2026-06-15T10:00:00-04:00' },
              end: { dateTime: '2026-06-15T11:00:00-04:00' },
            },
            {
              id: 'evt-2',
              summary: 'Lunch',
              start: { dateTime: '2026-06-15T12:00:00-04:00' },
              end: { dateTime: '2026-06-15T13:00:00-04:00' },
            },
          ],
        },
      });

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([
        {
          id: 'evt-1',
          title: 'Team Meeting',
          start: '2026-06-15T10:00:00-04:00',
          end: '2026-06-15T11:00:00-04:00',
        },
        {
          id: 'evt-2',
          title: 'Lunch',
          start: '2026-06-15T12:00:00-04:00',
          end: '2026-06-15T13:00:00-04:00',
        },
      ]);

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: user.googleTokenExpiry.getTime(),
      });

      expect(mockList).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin: new Date('2026-06-01').toISOString(),
        timeMax: new Date('2026-06-30').toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime',
      });
    });

    it('should handle events with date-only format (all-day events)', async () => {
      const user = makeUser();

      mockList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'evt-allday',
              summary: 'Holiday',
              start: { date: '2026-06-20' },
              end: { date: '2026-06-21' },
            },
          ],
        },
      });

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([
        {
          id: 'evt-allday',
          title: 'Holiday',
          start: '2026-06-20',
          end: '2026-06-21',
        },
      ]);
    });

    it('should use "Busy" as title when event has no summary', async () => {
      const user = makeUser();

      mockList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'evt-no-summary',
              start: { dateTime: '2026-06-15T14:00:00Z' },
              end: { dateTime: '2026-06-15T15:00:00Z' },
            },
          ],
        },
      });

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([
        {
          id: 'evt-no-summary',
          title: 'Busy',
          start: '2026-06-15T14:00:00Z',
          end: '2026-06-15T15:00:00Z',
        },
      ]);
    });

    it('should handle mixed dateTime and date-only events', async () => {
      const user = makeUser();

      mockList.mockResolvedValue({
        data: {
          items: [
            {
              id: 'evt-timed',
              summary: 'Call',
              start: { dateTime: '2026-06-15T09:00:00Z' },
              end: { dateTime: '2026-06-15T09:30:00Z' },
            },
            {
              id: 'evt-allday',
              summary: 'Vacation',
              start: { date: '2026-06-16' },
              end: { date: '2026-06-17' },
            },
          ],
        },
      });

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toHaveLength(2);
      expect(result[0].start).toBe('2026-06-15T09:00:00Z');
      expect(result[1].start).toBe('2026-06-16');
    });

    it('should return empty array when API returns no items', async () => {
      const user = makeUser();

      mockList.mockResolvedValue({
        data: {},
      });

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([]);
    });

    it('should return empty array when API returns null items', async () => {
      const user = makeUser();

      mockList.mockResolvedValue({
        data: { items: null },
      });

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([]);
    });

    it('should return empty array on API error and log the error', async () => {
      const user = makeUser();
      mockList.mockRejectedValue(new Error('Calendar API unavailable'));

      const result = await fetchCalendarEvents(user, '2026-06-01', '2026-06-30');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to fetch Google Calendar events: Calendar API unavailable'
      );
    });
  });

  // =============================================
  // deleteCalendarEvent
  // =============================================
  describe('deleteCalendarEvent', () => {
    it('should return false when user is null', async () => {
      const result = await deleteCalendarEvent(null, 'event-123');

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should return false when user is undefined', async () => {
      const result = await deleteCalendarEvent(undefined, 'event-123');

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should return false when user has no googleAccessToken', async () => {
      const user = makeUser({ googleAccessToken: null });
      const result = await deleteCalendarEvent(user, 'event-123');

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should return false when user has empty googleAccessToken', async () => {
      const user = makeUser({ googleAccessToken: '' });
      const result = await deleteCalendarEvent(user, 'event-123');

      expect(result).toBe(false);
    });

    it('should return false when eventId is null', async () => {
      const user = makeUser();
      const result = await deleteCalendarEvent(user, null);

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should return false when eventId is undefined', async () => {
      const user = makeUser();
      const result = await deleteCalendarEvent(user, undefined);

      expect(result).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('should return false when eventId is empty string', async () => {
      const user = makeUser();
      const result = await deleteCalendarEvent(user, '');

      expect(result).toBe(false);
    });

    it('should successfully delete a calendar event and return true', async () => {
      const user = makeUser();
      mockDelete.mockResolvedValue({});

      const result = await deleteCalendarEvent(user, 'event-to-delete');

      expect(result).toBe(true);

      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: user.googleTokenExpiry.getTime(),
      });

      expect(mockDelete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-to-delete',
        sendUpdates: 'all',
      });
    });

    it('should return false on API error and log the error', async () => {
      const user = makeUser();
      mockDelete.mockRejectedValue(new Error('Not Found'));

      const result = await deleteCalendarEvent(user, 'nonexistent-event');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete Google Calendar event nonexistent-event: Not Found'
      );
    });

    it('should handle googleTokenExpiry being null', async () => {
      const user = makeUser({ googleTokenExpiry: null });
      mockDelete.mockResolvedValue({});

      const result = await deleteCalendarEvent(user, 'event-123');

      expect(result).toBe(true);
      expect(mockSetCredentials).toHaveBeenCalledWith({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-456',
        expiry_date: undefined,
      });
    });
  });
});
