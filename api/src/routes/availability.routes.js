import { Router } from 'express';
import * as availabilityController from '../controllers/availability.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireBusinessRole } from '../middleware/rbac.middleware.js';
import {
  workingHoursSchema,
  availableSlotsSchema,
} from '../validators/availability.validator.js';

// mergeParams: true allows access to :businessId from the parent router
const router = Router({ mergeParams: true });

/**
 * @route GET /api/v1/businesses/:businessId/availability/working-hours
 * @desc Get working hours for a business
 * @access Public
 */
router.get('/working-hours', availabilityController.getWorkingHours);

/**
 * @route PUT /api/v1/businesses/:businessId/availability/working-hours
 * @desc Set or update working hours for a business
 * @access Private (OWNER, ADMIN)
 */
router.put(
  '/working-hours',
  authenticate,
  requireBusinessRole('OWNER', 'ADMIN'),
  validate(workingHoursSchema),
  availabilityController.setWorkingHours
);

/**
 * @route GET /api/v1/businesses/:businessId/availability/slots
 * @desc Get available booking slots
 * @access Public
 */
router.get(
  '/slots',
  validate(availableSlotsSchema, 'query'),
  availabilityController.getAvailableSlots
);

export default router;
