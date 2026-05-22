import { Router } from 'express';
import * as serviceController from '../controllers/service.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireBusinessRole } from '../middleware/rbac.middleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
} from '../validators/service.validator.js';

// mergeParams: true allows access to :businessId from the parent router
const router = Router({ mergeParams: true });

/**
 * @route POST /api/v1/businesses/:businessId/services
 * @desc Create a new service for a business
 * @access Private (OWNER, ADMIN)
 */
router.post(
  '/',
  authenticate,
  requireBusinessRole('OWNER', 'ADMIN'),
  validate(createServiceSchema),
  serviceController.create
);

/**
 * @route GET /api/v1/businesses/:businessId/services
 * @desc List all services for a business (public)
 * @access Public
 */
router.get('/', serviceController.findAll);

/**
 * @route GET /api/v1/businesses/:businessId/services/:id
 * @desc Get a single service by ID (public)
 * @access Public
 */
router.get('/:id', serviceController.findById);

/**
 * @route PATCH /api/v1/businesses/:businessId/services/:id
 * @desc Update a service
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/:id',
  authenticate,
  requireBusinessRole('OWNER', 'ADMIN'),
  validate(updateServiceSchema),
  serviceController.update
);

/**
 * @route DELETE /api/v1/businesses/:businessId/services/:id
 * @desc Soft-delete a service
 * @access Private (OWNER, ADMIN)
 */
router.delete(
  '/:id',
  authenticate,
  requireBusinessRole('OWNER', 'ADMIN'),
  serviceController.remove
);

export default router;
