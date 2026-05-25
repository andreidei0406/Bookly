import prisma from '../utils/prisma.js';
import ApiError from '../utils/apiError.js';

export async function getDashboardInsights(businessId) {
  // Total Bookings (all time)
  const totalBookings = await prisma.booking.count({
    where: { businessId },
  });

  // Completed Bookings
  const completedBookings = await prisma.booking.count({
    where: { businessId, status: 'COMPLETED' },
  });
  
  // Calculate Completion Rate
  const completionRate = totalBookings > 0 
    ? Math.round((completedBookings / totalBookings) * 100) 
    : 0;

  // Active Services
  const activeServices = await prisma.service.count({
    where: { businessId, isActive: true, deletedAt: null },
  });

  // Estimated Revenue (Sum of all paid or completed bookings)
  // For simplicity, we just calculate the sum of prices of CONFIRMED or COMPLETED bookings
  const bookingsForRevenue = await prisma.booking.findMany({
    where: {
      businessId,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    },
    include: { service: true }
  });

  let estimatedRevenue = 0;
  bookingsForRevenue.forEach(b => {
    estimatedRevenue += Number(b.service.price) || 0;
  });

  return {
    totalBookings,
    completionRate,
    activeServices,
    estimatedRevenue,
  };
}
