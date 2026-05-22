import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import authenticate from '../middleware/auth.middleware.js';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * @route GET /api/v1/notifications
 * @desc List notifications for the authenticated user
 * @access Private
 */
router.get('/', notificationController.findAll);

/**
 * @route PATCH /api/v1/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
router.patch('/:id/read', notificationController.markAsRead);

export default router;
