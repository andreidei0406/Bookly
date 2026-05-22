/**
 * @module services/notification
 * @description In-app notification service for managing user notifications
 * related to bookings and system events.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

/**
 * Create a new notification record.
 * @param {object} params
 * @param {string} params.userId - The recipient user's ID.
 * @param {string} [params.bookingId] - Optional related booking ID.
 * @param {string} params.type - Notification type (e.g. BOOKING_CREATED, BOOKING_CANCELLED).
 * @param {string} params.subject - Short subject/title.
 * @param {string} params.body - Full notification body text.
 * @returns {Promise<object>} The created notification.
 */
export async function create({ userId, bookingId, type, subject, body }) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      bookingId: bookingId || null,
      type,
      subject,
      body,
    },
  });

  logger.debug(`Notification created: ${type} for user ${userId}`);

  return notification;
}

/**
 * Find all notifications for a user with pagination and optional read filter.
 * @param {string} userId - The user's ID.
 * @param {object} params
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit=20] - Items per page.
 * @param {boolean} [params.isRead] - Optional filter: true for read, false for unread.
 * @returns {Promise<{data: object[], meta: object}>} Paginated notifications.
 */
export async function findAll(userId, { page = 1, limit = 20, isRead } = {}) {
  const skip = (page - 1) * limit;

  const where = { userId };

  if (isRead !== undefined && isRead !== null) {
    where.isRead = isRead;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    data: notifications,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mark a single notification as read.
 * @param {string} id - The notification ID.
 * @param {string} userId - The user's ID (for ownership verification).
 * @returns {Promise<object>} The updated notification.
 */
export async function markAsRead(id, userId) {
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw ApiError.notFound('Notification not found');
  }

  if (notification.userId !== userId) {
    throw ApiError.forbidden('You can only mark your own notifications as read');
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return updated;
}

/**
 * Mark all unread notifications as read for a user.
 * @param {string} userId - The user's ID.
 * @returns {Promise<{count: number}>} The number of notifications updated.
 */
export async function markAllAsRead(userId) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  logger.info(`Marked ${result.count} notifications as read for user ${userId}`);

  return { count: result.count };
}
