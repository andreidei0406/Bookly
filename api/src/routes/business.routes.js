import { Router } from 'express';
import * as businessController from '../controllers/business.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireBusinessRole } from '../middleware/rbac.middleware.js';
import {
  createBusinessSchema,
  updateBusinessSchema,
  addMemberSchema,
} from '../validators/business.validator.js';

const router = Router();

/**
 * Middleware helper that maps req.params.id to req.params.businessId
 * so requireBusinessRole can consistently read businessId from params.
 */
const mapBusinessId = (req, _res, next) => {
  req.params.businessId = req.params.id;
  next();
};

/**
 * @route POST /api/v1/businesses
 * @desc Create a new business
 * @access Private
 */
router.post(
  '/',
  authenticate,
  validate(createBusinessSchema),
  businessController.create
);

/**
 * @route GET /api/v1/businesses
 * @desc List all businesses (public)
 * @access Public
 */
router.get('/', businessController.findAll);

/**
 * @route GET /api/v1/businesses/:id
 * @desc Get a business by ID (public)
 * @access Public
 */
router.get('/:id', businessController.findById);

/**
 * @route PATCH /api/v1/businesses/:id
 * @desc Update a business
 * @access Private (OWNER, ADMIN)
 */
router.patch(
  '/:id',
  authenticate,
  mapBusinessId,
  requireBusinessRole('OWNER', 'ADMIN'),
  validate(updateBusinessSchema),
  businessController.update
);

/**
 * @route DELETE /api/v1/businesses/:id
 * @desc Soft-delete a business
 * @access Private (OWNER)
 */
router.delete(
  '/:id',
  authenticate,
  mapBusinessId,
  requireBusinessRole('OWNER'),
  businessController.remove
);

/**
 * @route GET /api/v1/businesses/:id/members
 * @desc Get all members of a business
 * @access Private (OWNER, ADMIN)
 */
router.get(
  '/:id/members',
  authenticate,
  mapBusinessId,
  requireBusinessRole('OWNER', 'ADMIN'),
  businessController.getMembers
);

/**
 * @route POST /api/v1/businesses/:id/members
 * @desc Add a member to a business
 * @access Private (OWNER, ADMIN)
 */
router.post(
  '/:id/members',
  authenticate,
  mapBusinessId,
  requireBusinessRole('OWNER', 'ADMIN'),
  validate(addMemberSchema),
  businessController.addMember
);

/**
 * @route DELETE /api/v1/businesses/:id/members/:memberId
 * @desc Remove a member from a business
 * @access Private (OWNER)
 */
router.delete(
  '/:id/members/:memberId',
  authenticate,
  mapBusinessId,
  requireBusinessRole('OWNER'),
  businessController.removeMember
);

export default router;
