import { created, success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as bookingService from '../services/booking.service.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * Create a new booking (Authenticated host self-booking, rarely used but supported).
 * @route POST /api/v1/bookings
 */
export const create = catchAsync(async (req, res) => {
  const result = await bookingService.create({
    hostUsername: req.user.username,
    ...req.body,
  });
  return created(res, { data: result });
});

/**
 * Create a new booking (Public/Guest).
 * @route POST /api/v1/bookings/public
 */
export const publicCreate = catchAsync(async (req, res) => {
  const result = await bookingService.publicCreate(req.body);
  return created(res, { data: result });
});

/**
 * List bookings for the authenticated host with pagination and filters.
 * @route GET /api/v1/bookings
 */
export const findAll = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { status, from, to } = req.query;
  const filters = { status, from, to };
  const { data, meta } = await bookingService.findAll(
    req.user.id,
    { ...pagination, ...filters }
  );
  return success(res, { data, meta });
});

/**
 * Get a single booking by ID.
 * @route GET /api/v1/bookings/:id
 */
export const findById = catchAsync(async (req, res) => {
  const result = await bookingService.findById(req.params.id);
  return success(res, { data: result });
});

/**
 * Update the status of a booking (confirm, cancel, complete, no-show).
 * @route PATCH /api/v1/bookings/:id/status
 */
export const updateStatus = catchAsync(async (req, res) => {
  const result = await bookingService.updateStatus(req.params.id, req.body);
  return success(res, { data: result });
});

/**
 * Reschedule a booking to a new time slot.
 * @route PATCH /api/v1/bookings/:id
 */
export const reschedule = catchAsync(async (req, res) => {
  const result = await bookingService.reschedule(req.params.id, req.body);
  return success(res, { data: result });
});
