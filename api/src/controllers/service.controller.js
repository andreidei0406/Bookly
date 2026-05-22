import { created, success, noContent } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as serviceService from '../services/service.service.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * Create a new service for a business.
 * @route POST /api/v1/businesses/:businessId/services
 */
export const create = catchAsync(async (req, res) => {
  const result = await serviceService.create(req.params.businessId, req.body);
  return created(res, { data: result });
});

/**
 * List all services for a business with pagination.
 * @route GET /api/v1/businesses/:businessId/services
 */
export const findAll = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { data, meta } = await serviceService.findAll(req.params.businessId, pagination);
  return success(res, { data, meta });
});

/**
 * Get a single service by ID.
 * @route GET /api/v1/businesses/:businessId/services/:id
 */
export const findById = catchAsync(async (req, res) => {
  const result = await serviceService.findById(req.params.id);
  return success(res, { data: result });
});

/**
 * Update a service by ID.
 * @route PATCH /api/v1/businesses/:businessId/services/:id
 */
export const update = catchAsync(async (req, res) => {
  const result = await serviceService.update(req.params.id, req.body);
  return success(res, { data: result });
});

/**
 * Soft-delete a service by ID.
 * @route DELETE /api/v1/businesses/:businessId/services/:id
 */
export const remove = catchAsync(async (req, res) => {
  await serviceService.softDelete(req.params.id);
  return noContent(res);
});
