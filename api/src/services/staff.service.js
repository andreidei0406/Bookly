/**
 * @module services/staff
 * @description Staff schedule and membership management service.
 */

import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

/**
 * Get schedule entries for a staff member within a date range.
 * @param {string} memberId - The BusinessMember ID.
 * @param {object} params
 * @param {string|Date} params.startDate - Start of the date range.
 * @param {string|Date} params.endDate - End of the date range.
 * @returns {Promise<object[]>} Array of StaffSchedule entries.
 */
export async function getSchedule(memberId, { startDate, endDate }) {
  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw ApiError.notFound('Staff member not found');
  }

  const schedules = await prisma.staffSchedule.findMany({
    where: {
      memberId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    orderBy: { date: 'asc' },
  });

  return schedules;
}

/**
 * Set (upsert) a staff schedule entry for a specific date.
 * @param {string} memberId - The BusinessMember ID.
 * @param {object} data - Schedule data.
 * @param {string|Date} data.date - The date for this schedule.
 * @param {string} data.startTime - Start time (HH:mm format).
 * @param {string} data.endTime - End time (HH:mm format).
 * @param {boolean} [data.isAvailable=true] - Whether the staff member is available.
 * @returns {Promise<object>} The created or updated schedule entry.
 */
export async function setSchedule(memberId, data) {
  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    throw ApiError.notFound('Staff member not found');
  }

  const scheduleDate = new Date(data.date);

  // Check if a schedule already exists for this member on this date
  const existing = await prisma.staffSchedule.findFirst({
    where: {
      memberId,
      date: scheduleDate,
    },
  });

  let schedule;

  if (existing) {
    schedule = await prisma.staffSchedule.update({
      where: { id: existing.id },
      data: {
        startTime: data.startTime,
        endTime: data.endTime,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
      },
    });
    logger.info(`Staff schedule updated for member ${memberId} on ${data.date}`);
  } else {
    schedule = await prisma.staffSchedule.create({
      data: {
        memberId,
        date: scheduleDate,
        startTime: data.startTime,
        endTime: data.endTime,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
      },
    });
    logger.info(`Staff schedule created for member ${memberId} on ${data.date}`);
  }

  return schedule;
}

/**
 * Get all active staff members for a business with their user info.
 * @param {string} businessId - The business ID.
 * @returns {Promise<object[]>} Array of staff members with user details.
 */
export async function getStaffForBusiness(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw ApiError.notFound('Business not found');
  }

  const staffMembers = await prisma.businessMember.findMany({
    where: {
      businessId,
    },
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
    orderBy: { createdAt: 'asc' },
  });

  return staffMembers;
}
