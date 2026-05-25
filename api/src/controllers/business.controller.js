import { created, success, noContent } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as businessService from '../services/business.service.js';
import { parsePagination } from '../utils/pagination.js';

/**
 * Create a new business.
 * @route POST /api/v1/businesses
 */
export const create = catchAsync(async (req, res) => {
  const result = await businessService.create(req.user.id, req.body);
  return created(res, { data: result });
});

/**
 * List all businesses with pagination and optional search.
 * @route GET /api/v1/businesses
 */
export const findAll = catchAsync(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { search } = req.query;
  const { data, meta } = await businessService.findAll({ ...pagination, search });
  return success(res, { data, meta });
});

/**
 * Get a single business by ID.
 * @route GET /api/v1/businesses/:id
 */
export const findById = catchAsync(async (req, res) => {
  const result = await businessService.findById(req.params.id);
  return success(res, { data: result });
});

/**
 * Get a single business by slug.
 * @route GET /api/v1/businesses/slug/:slug
 */
export const findBySlug = catchAsync(async (req, res) => {
  const business = await businessService.findBySlug(req.params.slug);
  return success(res, { data: business });
});

/**
 * Update a business by ID.
 * @route PATCH /api/v1/businesses/:id
 */
export const update = catchAsync(async (req, res) => {
  const result = await businessService.update(req.params.id, req.body);
  return success(res, { data: result });
});

/**
 * Soft-delete a business by ID.
 * @route DELETE /api/v1/businesses/:id
 */
export const remove = catchAsync(async (req, res) => {
  await businessService.softDelete(req.params.id);
  return noContent(res);
});

/**
 * Get all members of a business.
 * @route GET /api/v1/businesses/:id/members
 */
export const getMembers = catchAsync(async (req, res) => {
  const result = await businessService.getMembers(req.params.id);
  return success(res, { data: result });
});

/**
 * Add a member to a business.
 * @route POST /api/v1/businesses/:id/members
 */
export const addMember = catchAsync(async (req, res) => {
  const result = await businessService.addMember(req.params.id, req.body);
  return created(res, { data: result });
});

/**
 * Remove a member from a business.
 * @route DELETE /api/v1/businesses/:id/members/:memberId
 */
export const removeMember = catchAsync(async (req, res) => {
  await businessService.removeMember(req.params.id, req.params.memberId);
  return noContent(res);
});
