import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as availabilityService from '../services/availability.service.js';
import logger from '../config/logger.js';

/**
 * Get available booking slots for a user.
 * @route GET /api/v1/users/:username/availability/slots
 */
export const getAvailableSlots = catchAsync(async (req, res) => {
  const result = await availabilityService.getAvailableSlots(
    req.params.username,
    req.query
  );
  return success(res, { data: result });
});

/**
 * Get days that have availability for a user.
 * @route GET /api/v1/users/:username/availability/days
 */
export const getAvailableDays = catchAsync(async (req, res) => {
  const result = await availabilityService.getAvailableDays(
    req.params.username,
    req.query.month
  );
  return success(res, { data: result });
});

/**
 * Get availability blocks for the authenticated user.
 * @route GET /api/v1/availability/blocks
 */
export const getBlocks = catchAsync(async (req, res) => {
  const result = await availabilityService.getBlocks(req.user.id, req.query);
  return success(res, { data: result });
});

/**
 * Create a new availability block for the authenticated user.
 * @route POST /api/v1/availability/blocks
 */
export const createBlock = catchAsync(async (req, res) => {
  const result = await availabilityService.createBlock(req.user.id, req.body);
  return success(res, { data: result });
});

/**
 * Clear availability blocks within a date range (or all if omitted).
 * @route DELETE /api/v1/availability/blocks/clear
 */
export const clearBlocks = catchAsync(async (req, res) => {
  logger.info(`clearBlocks request received for user ${req.user.id}. Query: ${JSON.stringify(req.query)}`);
  const result = await availabilityService.clearBlocks(req.user.id, req.query);
  logger.info(`clearBlocks result: ${JSON.stringify(result)}`);
  return success(res, { data: result });
});

/**
 * Update an existing availability block.
 * @route PUT /api/v1/availability/blocks/:blockId
 */
export const updateBlock = catchAsync(async (req, res) => {
  const result = await availabilityService.updateBlock(
    req.user.id,
    req.params.blockId,
    req.body
  );
  return success(res, { data: result });
});

/**
 * Delete an availability block.
 * @route DELETE /api/v1/availability/blocks/:blockId
 */
export const deleteBlock = catchAsync(async (req, res) => {
  await availabilityService.deleteBlock(req.user.id, req.params.blockId);
  res.status(204).send();
});
