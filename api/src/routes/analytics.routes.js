import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireBusinessRole } from '../middleware/rbac.middleware.js';

const router = Router();

/**
 * Middleware helper that maps req.params.businessId to req.params.id temporarily
 * if requireBusinessRole expects id, or we just map it.
 */
const mapBusinessId = (req, _res, next) => {
  req.params.id = req.params.businessId;
  next();
};

/**
 * @route GET /api/v1/analytics/businesses/:businessId/insights
 * @desc Get aggregated metrics for dashboard
 * @access Private (OWNER, ADMIN, STAFF)
 */
router.get(
  '/businesses/:businessId/insights',
  authenticate,
  requireBusinessRole('OWNER', 'ADMIN', 'STAFF'),
  analyticsController.getBusinessInsights
);

export default router;
