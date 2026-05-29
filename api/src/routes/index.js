import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import availabilityRoutes from './availability.routes.js';
import bookingRoutes from './booking.routes.js';
import googleRoutes from './google.routes.js';
import billingRoutes from './billing.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/availability', availabilityRoutes);
router.use('/bookings', bookingRoutes);
router.use('/integrations/google', googleRoutes);
router.use('/billing', billingRoutes);

export default router;
