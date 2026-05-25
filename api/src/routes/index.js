import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import businessRoutes from './business.routes.js';
import serviceRoutes from './service.routes.js';
import staffRoutes from './staff.routes.js';
import availabilityRoutes from './availability.routes.js';
import bookingRoutes from './booking.routes.js';
import notificationRoutes from './notification.routes.js';
import stripeRoutes from './stripe.routes.js';

import analyticsRoutes from './analytics.routes.js';
import googleRoutes from './google.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);
router.use('/businesses/:businessId/services', serviceRoutes);
router.use('/businesses/:businessId/staff', staffRoutes);
router.use('/businesses/:businessId/availability', availabilityRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/stripe', stripeRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/integrations/google', googleRoutes);

export default router;
