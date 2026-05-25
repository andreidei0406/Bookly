import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as analyticsService from '../services/analytics.service.js';

/**
 * Get dashboard insights for a business
 * @route GET /api/v1/analytics/businesses/:businessId/insights
 */
export const getBusinessInsights = catchAsync(async (req, res) => {
  const result = await analyticsService.getDashboardInsights(req.params.businessId);
  return success(res, { data: result });
});
