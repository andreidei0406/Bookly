import { Router } from 'express';
import * as availabilityController from '../controllers/availability.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import {
  availableSlotsSchema,
  createBlockSchema,
} from '../validators/availability.validator.js';

const router = Router();

/**
 * @route GET /api/v1/availability/blocks
 * @desc Get availability blocks for the authenticated user
 * @access Private
 */
router.get(
  '/blocks',
  authenticate,
  availabilityController.getBlocks
);

/**
 * @route POST /api/v1/availability/blocks
 * @desc Create a specific availability block for the authenticated user
 * @access Private
 */
router.post(
  '/blocks',
  authenticate,
  validate(createBlockSchema),
  availabilityController.createBlock
);

/**
 * @route DELETE /api/v1/availability/blocks/clear
 * @desc Clear all availability blocks for the user within a date range (optional)
 * @access Private
 */
router.delete(
  '/blocks/clear',
  authenticate,
  availabilityController.clearBlocks
);

/**
 * @route PUT /api/v1/availability/blocks/:blockId
 * @desc Update a specific availability block
 * @access Private
 */
router.put(
  '/blocks/:blockId',
  authenticate,
  validate(createBlockSchema),
  availabilityController.updateBlock
);

/**
 * @route DELETE /api/v1/availability/blocks/:blockId
 * @desc Delete a specific availability block
 * @access Private
 */
router.delete(
  '/blocks/:blockId',
  authenticate,
  availabilityController.deleteBlock
);

export default router;
