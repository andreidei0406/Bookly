import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as notificationService from '../services/notification.service.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * List notifications for the authenticated user with pagination and optional isRead filter.
 * @route GET /api/v1/notifications
 */
export const findAll = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { isRead } = req.query;
  const filters = {};
  if (isRead !== undefined) {
    filters.isRead = isRead === 'true';
  }
  const { data, meta } = await notificationService.findAll(req.user.id, {
    ...pagination,
    ...filters,
  });
  return success(res, { data, meta });
});

/**
 * Mark a notification as read.
 * @route PATCH /api/v1/notifications/:id/read
 */
export const markAsRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAsRead(req.params.id, req.user.id);
  return success(res, { data: result });
});
