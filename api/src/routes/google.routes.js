import { Router } from 'express';
import * as googleController from '../controllers/google.controller.js';
import authenticate from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @route GET /api/v1/integrations/google/events
 * @desc Get Google Calendar events for the authenticated user
 * @access Private
 */
router.get('/events', authenticate, googleController.getCalendarEvents);

export default router;
