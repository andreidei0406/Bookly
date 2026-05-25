import * as googleService from '../services/google.service.js';
import catchAsync from '../utils/catchAsync.js';
import prisma from '../utils/prisma.js';
import ApiError from '../utils/apiError.js';

/**
 * Get Google Calendar events for the authenticated user
 */
export const getCalendarEvents = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user || !user.googleAccessToken) {
    // If not connected to google, just return empty events so dashboard doesn't crash
    return res.json({ status: 'success', data: [] });
  }

  const events = await googleService.fetchCalendarEvents(user, startDate, endDate);

  res.json({
    status: 'success',
    data: events,
  });
});
