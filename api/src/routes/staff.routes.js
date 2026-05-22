import { Router } from 'express';
import * as staffController from '../controllers/staff.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireBusinessRole } from '../middleware/rbac.middleware.js';

// mergeParams: true allows access to :businessId from the parent router
const router = Router({ mergeParams: true });

/**
 * @route GET /api/v1/businesses/:businessId/staff
 * @desc Get all staff members for a business
 * @access Public
 */
router.get('/', staffController.getStaff);

/**
 * @route GET /api/v1/businesses/:businessId/staff/:staffId/schedule
 * @desc Get a staff member's schedule
 * @access Private
 */
router.get(
  '/:staffId/schedule',
  authenticate,
  staffController.getSchedule
);

/**
 * @route PUT /api/v1/businesses/:businessId/staff/:staffId/schedule
 * @desc Set or update a staff member's schedule
 * @access Private (OWNER, ADMIN, STAFF)
 */
router.put(
  '/:staffId/schedule',
  authenticate,
  requireBusinessRole('OWNER', 'ADMIN', 'STAFF'),
  staffController.setSchedule
);

export default router;
