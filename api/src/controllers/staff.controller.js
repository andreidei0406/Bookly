import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as staffService from '../services/staff.service.js';

/**
 * Get all staff members for a business.
 * @route GET /api/v1/businesses/:businessId/staff
 */
export const getStaff = catchAsync(async (req, res) => {
  const result = await staffService.getStaffForBusiness(req.params.businessId);
  return success(res, { data: result });
});

/**
 * Get a staff member's schedule.
 * @route GET /api/v1/businesses/:businessId/staff/:staffId/schedule
 */
export const getSchedule = catchAsync(async (req, res) => {
  const result = await staffService.getSchedule(req.params.staffId, req.query);
  return success(res, { data: result });
});

/**
 * Set or update a staff member's schedule.
 * @route PUT /api/v1/businesses/:businessId/staff/:staffId/schedule
 */
export const setSchedule = catchAsync(async (req, res) => {
  const result = await staffService.setSchedule(req.params.staffId, req.body);
  return success(res, { data: result });
});
