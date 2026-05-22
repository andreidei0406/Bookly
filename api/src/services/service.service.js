/**
 * @module services/service
 * @description Service (offering) management — CRUD operations for the
 * services a business offers (e.g. "Haircut", "Consultation").
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

/**
 * Create a new service for a business.
 * @param {string} businessId - The business ID this service belongs to.
 * @param {object} data - Service data (name, description, duration, price, etc.).
 * @returns {Promise<object>} The created service.
 */
export async function create(businessId, data) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  const service = await prisma.service.create({
    data: {
      businessId,
      name: data.name,
      description: data.description || null,
      duration: data.duration,
      price: data.price,
      currency: data.currency || 'USD',
      color: data.color || null,
    },
  });

  logger.info(`Service created: ${service.name} (${service.id}) for business ${businessId}`);

  return service;
}

/**
 * Find all active services for a business with pagination.
 * @param {string} businessId - The business ID.
 * @param {object} params
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit=20] - Items per page.
 * @returns {Promise<{data: object[], meta: object}>} Paginated services.
 */
export async function findAll(businessId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  const where = {
    businessId,
    deletedAt: null,
  };

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.service.count({ where }),
  ]);

  return {
    data: services,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Find a service by ID.
 * @param {string} id - The service ID.
 * @returns {Promise<object>} The service.
 */
export async function findById(id) {
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!service) {
    throw ApiError.notFound('Service not found');
  }

  return service;
}

/**
 * Update a service.
 * @param {string} id - The service ID.
 * @param {object} data - Fields to update.
 * @returns {Promise<object>} The updated service.
 */
export async function update(id, data) {
  const existing = await prisma.service.findUnique({ where: { id } });

  if (!existing) {
    throw ApiError.notFound('Service not found');
  }

  const updatedService = await prisma.service.update({
    where: { id },
    data,
  });

  logger.info(`Service updated: ${updatedService.id}`);

  return updatedService;
}

/**
 * Soft-delete a service by setting deletedAt.
 * @param {string} id - The service ID.
 * @returns {Promise<object>} The soft-deleted service.
 */
export async function softDelete(id) {
  const existing = await prisma.service.findUnique({ where: { id } });

  if (!existing) {
    throw ApiError.notFound('Service not found');
  }

  const deleted = await prisma.service.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  logger.info(`Service soft-deleted: ${id}`);

  return deleted;
}
