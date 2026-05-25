/**
 * @module services/business
 * @description Business management service including CRUD, slug generation,
 * soft-delete, and member management (add/remove roles).
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

/**
 * Generate a URL-friendly slug from a name.
 * Lowercases, replaces spaces with hyphens, strips non-alphanumeric characters.
 * @param {string} name - The business name.
 * @returns {string} A slugified string.
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure a slug is unique; if taken, append a numeric suffix.
 * @param {string} baseSlug - The initial slug candidate.
 * @param {string} [excludeId] - Business ID to exclude (for updates).
 * @returns {Promise<string>} A unique slug.
 */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let suffix = 1;

   
  while (true) {
    const existing = await prisma.business.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (!existing) {return slug;}

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

/**
 * Create a new business and assign the creator as OWNER.
 * @param {string} userId - The ID of the user creating the business.
 * @param {object} data - Business data (name, description, slug, etc.).
 * @returns {Promise<object>} The created business.
 */
export async function create(userId, data) {
  const slug = data.slug ? data.slug : generateSlug(data.name);
  const uniqueSlug = await ensureUniqueSlug(slug);

  const business = await prisma.$transaction(async (tx) => {
    const newBusiness = await tx.business.create({
      data: {
        name: data.name,
        slug: uniqueSlug,
        description: data.description || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        country: data.country || null,
        website: data.website || null,
        logo: data.logo || null,
      },
    });

    await tx.businessMember.create({
      data: {
        businessId: newBusiness.id,
        userId,
        role: 'OWNER',
      },
    });

    return newBusiness;
  });

  logger.info(`Business created: ${business.name} (${business.id}) by user ${userId}`);

  return business;
}

/**
 * Find all active businesses with optional search and pagination.
 * @param {object} params
 * @param {number} [params.page=1] - Page number.
 * @param {number} [params.limit=20] - Items per page.
 * @param {string} [params.search] - Optional search term for business name.
 * @returns {Promise<{data: object[], meta: object}>} Paginated businesses.
 */
export async function findAll({ page = 1, limit = 20, search } = {}) {
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(search
      ? {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.business.count({ where }),
  ]);

  return {
    data: businesses,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Find a business by ID, including services and working hours.
 * @param {string} id - The business ID.
 * @returns {Promise<object>} The business with relations.
 */
export async function findById(id) {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      services: {
        where: { deletedAt: null },
      },
      workingHours: true,
    },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  return business;
}

/**
 * Find a business by slug, including active services and working hours.
 * @param {string} slug - The business slug.
 * @returns {Promise<object>} The business with relations.
 */
export async function findBySlug(slug) {
  const business = await prisma.business.findUnique({
    where: { slug, deletedAt: null },
    include: {
      services: {
        where: { isActive: true, deletedAt: null },
      },
      workingHours: true,
      members: {
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      },
    },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  return business;
}

/**
 * Update a business.
 * @param {string} id - The business ID.
 * @param {object} data - Fields to update.
 * @returns {Promise<object>} The updated business.
 */
export async function update(id, data) {
  const existing = await prisma.business.findUnique({ where: { id } });

  if (!existing) {
    throw ApiError.notFound('Business not found');
  }

  // If slug is being changed, ensure uniqueness
  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await prisma.business.findFirst({
      where: { slug: data.slug, id: { not: id } },
    });
    if (slugTaken) {
      throw ApiError.conflict('This slug is already in use');
    }
  }

  const updatedBusiness = await prisma.business.update({
    where: { id },
    data,
  });

  logger.info(`Business updated: ${updatedBusiness.id}`);

  return updatedBusiness;
}

/**
 * Soft-delete a business by setting deletedAt.
 * @param {string} id - The business ID.
 * @returns {Promise<object>} The soft-deleted business.
 */
export async function softDelete(id) {
  const existing = await prisma.business.findUnique({ where: { id } });

  if (!existing) {
    throw ApiError.notFound('Business not found');
  }

  const deleted = await prisma.business.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  logger.info(`Business soft-deleted: ${id}`);

  return deleted;
}

/**
 * Get all members of a business with their user info.
 * @param {string} businessId - The business ID.
 * @returns {Promise<object[]>} List of business members.
 */
export async function getMembers(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  const members = await prisma.businessMember.findMany({
    where: { businessId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
        },
      },
    },
  });

  return members;
}

/**
 * Add a member to a business by email.
 * @param {string} businessId - The business ID.
 * @param {object} params
 * @param {string} params.email - The email of the user to add.
 * @param {string} params.role - The role (OWNER, ADMIN, STAFF).
 * @returns {Promise<object>} The created business member.
 */
export async function addMember(businessId, { email, role }) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw ApiError.notFound('User with this email not found');
  }

  const existingMember = await prisma.businessMember.findFirst({
    where: { businessId, userId: user.id },
  });

  if (existingMember) {
    throw ApiError.conflict('User is already a member of this business');
  }

  const member = await prisma.businessMember.create({
    data: {
      businessId,
      userId: user.id,
      role,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  logger.info(`Member ${user.email} added to business ${businessId} with role ${role}`);

  return member;
}

/**
 * Remove a member from a business. Cannot remove the last OWNER.
 * @param {string} businessId - The business ID.
 * @param {string} memberId - The business member ID.
 * @returns {Promise<void>}
 */
export async function removeMember(businessId, memberId) {
  const member = await prisma.businessMember.findFirst({
    where: { id: memberId, businessId },
  });

  if (!member) {
    throw ApiError.notFound('Member not found in this business');
  }

  // If the member is an OWNER, ensure they're not the last one
  if (member.role === 'OWNER') {
    const ownerCount = await prisma.businessMember.count({
      where: { businessId, role: 'OWNER' },
    });

    if (ownerCount <= 1) {
      throw ApiError.badRequest('Cannot remove the last owner of a business');
    }
  }

  await prisma.businessMember.delete({
    where: { id: memberId },
  });

  logger.info(`Member ${memberId} removed from business ${businessId}`);
}
