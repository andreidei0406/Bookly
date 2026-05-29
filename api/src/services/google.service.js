import { google } from 'googleapis';
import config from '../config/index.js';
import logger from '../config/logger.js';
import prisma from '../utils/prisma.js';

const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl
);

/**
 * Generate a Google Meet link for a booking by creating a Calendar Event
 * @param {object} user - The business owner or staff user object with Google tokens
 * @param {object} booking - The booking details
 * @param {object} service - The service details
 * @returns {Promise<{meetLink: string, eventId: string} | null>}
 */
export async function createCalendarEventWithMeet(user, booking, service) {
  if (!user.googleAccessToken) {
    return null;
  }

  try {
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
      expiry_date: user.googleTokenExpiry?.getTime(),
    });

    // Handle token refresh internally if needed, but googleapis does it automatically if refresh_token is set
    // However, if we get a new access token, we should theoretically save it.
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleAccessToken: tokens.access_token,
            ...(tokens.refresh_token && { googleRefreshToken: tokens.refresh_token }),
            googleTokenExpiry: new Date(tokens.expiry_date),
          },
        });
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const dateStr = booking.date.toISOString().split('T')[0]; // "YYYY-MM-DD"

    const event = {
      summary: `Booking: ${service.name}`,
      description: `Appointment with ${user.firstName} ${user.lastName}\nNotes: ${booking.notes || 'None'}`,
      start: {
        dateTime: `${dateStr}T${booking.startTime}:00`,
        timeZone: booking.timezone || 'UTC',
      },
      end: {
        dateTime: `${dateStr}T${booking.endTime}:00`,
        timeZone: booking.timezone || 'UTC',
      },
      conferenceData: {
        createRequest: {
          requestId: booking.id, // unique ID per meeting
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      attendees: [
        { email: booking.guestEmail },
      ],
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1, // Required to create Google Meet links
      sendUpdates: 'all', // Send email to attendees
    });

    return {
      meetLink: response.data.hangoutLink,
      eventId: response.data.id,
    };
  } catch (error) {
    logger.error(`Failed to create Google Meet event: ${error.message}`);
    return null;
  }
}

/**
 * Fetch calendar events for a user within a date range
 * @param {object} user - The user object with Google tokens
 * @param {string} startDate - ISO string
 * @param {string} endDate - ISO string
 * @returns {Promise<object[]>} Array of events { id, title, start, end }
 */
export async function fetchCalendarEvents(user, startDate, endDate) {
  if (!user.googleAccessToken) {
    return [];
  }

  try {
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
      expiry_date: user.googleTokenExpiry?.getTime(),
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Default to a 2 week range if not provided
    const timeMin = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
    const timeMax = endDate 
      ? new Date(endDate).toISOString() 
      : new Date(new Date().setDate(new Date().getDate() + 14)).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    
    return events.map(item => ({
      id: item.id,
      title: item.summary || 'Busy',
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
    }));
  } catch (error) {
    logger.error(`Failed to fetch Google Calendar events: ${error.message}`);
    return [];
  }
}

/**
 * Delete a Google Calendar Event
 * @param {object} user - The user object with Google tokens
 * @param {string} eventId - The Google Calendar Event ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteCalendarEvent(user, eventId) {
  if (!user || !user.googleAccessToken || !eventId) {
    return false;
  }

  try {
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
      expiry_date: user.googleTokenExpiry?.getTime(),
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all', // Send cancellation email to guest attendee
    });

    logger.info(`Successfully deleted Google Calendar event ${eventId} for host ${user.id}`);
    return true;
  } catch (error) {
    logger.error(`Failed to delete Google Calendar event ${eventId}: ${error.message}`);
    return false;
  }
}
