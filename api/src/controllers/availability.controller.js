import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as availabilityService from '../services/availability.service.js';
import * as staffService from '../services/staff.service.js';

/**
 * Get working hours for a business.
 * @route GET /api/v1/businesses/:businessId/availability/working-hours
 */
export const getWorkingHours = catchAsync(async (req, res) => {
  const result = await availabilityService.getWorkingHours(req.params.businessId);
  return success(res, { data: result });
});

/**
 * Set or update working hours for a business.
 * @route PUT /api/v1/businesses/:businessId/availability/working-hours
 */
export const setWorkingHours = catchAsync(async (req, res) => {
  const result = await availabilityService.setWorkingHours(
    req.params.businessId,
    req.body.hours
  );
  return success(res, { data: result });
});

/**
 * Get available booking slots for a business.
 * @route GET /api/v1/businesses/:businessId/availability/slots
 */
export const getAvailableSlots = catchAsync(async (req, res) => {
  const result = await availabilityService.getAvailableSlots(
    req.params.businessId,
    req.query
  );
  return success(res, { data: result });
});

/**
 * Get a staff member's schedule with availability info.
 * @route GET /api/v1/businesses/:businessId/availability/staff/:staffId/schedule
 */
export const getStaffSchedule = catchAsync(async (req, res) => {
  const schedule = await staffService.getSchedule(req.params.staffId, req.query);
  const availability = await availabilityService.getWorkingHours(req.params.businessId);
  return success(res, {
    data: {
      schedule,
      businessWorkingHours: availability,
    },
  });
});

/**
 * Set a staff member's schedule.
 * @route PUT /api/v1/businesses/:businessId/availability/staff/:staffId/schedule
 */
export const setStaffSchedule = catchAsync(async (req, res) => {
  const result = await staffService.setSchedule(req.params.staffId, req.body);
  return success(res, { data: result });
});

/**
 * Get availability blocks for a business.
 * @route GET /api/v1/businesses/:businessId/availability/blocks
 */
export const getBlocks = catchAsync(async (req, res) => {
  const result = await availabilityService.getBlocks(req.params.businessId, req.query);
  return success(res, { data: result });
});

/**
 * Create a new availability block.
 * @route POST /api/v1/businesses/:businessId/availability/blocks
 */
export const createBlock = catchAsync(async (req, res) => {
  const result = await availabilityService.createBlock(req.params.businessId, req.body);
  return success(res, { data: result });
});

/**
 * Clear availability blocks within a date range (or all if omitted).
 * @route DELETE /api/v1/businesses/:businessId/availability/blocks/clear
 */
export const clearBlocks = catchAsync(async (req, res) => {
  const result = await availabilityService.clearBlocks(req.params.businessId, req.query);
  return success(res, { data: result });
});

/**
 * Update an existing availability block.
 * @route PUT /api/v1/businesses/:businessId/availability/blocks/:blockId
 */
export const updateBlock = catchAsync(async (req, res) => {
  const result = await availabilityService.updateBlock(
    req.params.businessId,
    req.params.blockId,
    req.body
  );
  return success(res, { data: result });
});

/**
 * Delete an availability block.
 * @route DELETE /api/v1/businesses/:businessId/availability/blocks/:blockId
 */
export const deleteBlock = catchAsync(async (req, res) => {
  await availabilityService.deleteBlock(req.params.businessId, req.params.blockId);
  res.status(204).send();
});
