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

    // Calculate dates
    const [startH, startM] = booking.startTime.split(':');
    const [endH, endM] = booking.endTime.split(':');
    
    const startDateTime = new Date(booking.date);
    startDateTime.setHours(Number(startH), Number(startM), 0, 0);

    const endDateTime = new Date(booking.date);
    endDateTime.setHours(Number(endH), Number(endM), 0, 0);

    const event = {
      summary: `Booking: ${service.name}`,
      description: `Appointment with ${user.firstName} ${user.lastName}\nNotes: ${booking.notes || 'None'}`,
      start: {
        dateTime: startDateTime.toISOString(),
      },
      end: {
        dateTime: endDateTime.toISOString(),
      },
      conferenceData: {
        createRequest: {
          requestId: booking.id, // unique ID per meeting
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      attendees: [
        { email: booking.customer?.email },
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
