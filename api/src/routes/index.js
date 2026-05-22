import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import businessRoutes from './business.routes.js';
import serviceRoutes from './service.routes.js';
import staffRoutes from './staff.routes.js';
import availabilityRoutes from './availability.routes.js';
import bookingRoutes from './booking.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);
router.use('/businesses/:businessId/services', serviceRoutes);
router.use('/businesses/:businessId/staff', staffRoutes);
router.use('/businesses/:businessId/availability', availabilityRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);

export default router;
