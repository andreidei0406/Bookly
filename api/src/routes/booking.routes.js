import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import validate from '../middleware/validate.middleware.js';
import authenticate from '../middleware/auth.middleware.js';
import {
  createBookingSchema,
  publicCreateBookingSchema,
  updateBookingStatusSchema,
  rescheduleBookingSchema,
} from '../validators/booking.validator.js';

const router = Router();

/**
 * @route POST /api/v1/bookings/public
 * @desc Create a new booking as a guest
 * @access Public
 */
router.post(
  '/public',
  validate(publicCreateBookingSchema),
  bookingController.publicCreate
);

/**
 * @route GET /api/v1/bookings/public/:id
 * @desc Get a single booking by ID as a guest
 * @access Public
 */
router.get('/public/:id', bookingController.findPublicById);

/**
 * @route POST /api/v1/bookings/public/cancel/:id
 * @desc Cancel a booking on guest behalf
 * @access Public
 */
router.post('/public/cancel/:id', bookingController.publicCancel);

// All subsequent booking routes require authentication
router.use(authenticate);

/**
 * @route POST /api/v1/bookings
 * @desc Create a new booking
 * @access Private
 */
router.post(
  '/',
  validate(createBookingSchema),
  bookingController.create
);

/**
 * @route GET /api/v1/bookings
 * @desc List bookings with filters and pagination
 * @access Private
 */
router.get('/', bookingController.findAll);

/**
 * @route GET /api/v1/bookings/:id
 * @desc Get a single booking by ID
 * @access Private
 */
router.get('/:id', bookingController.findById);

/**
 * @route PATCH /api/v1/bookings/:id/status
 * @desc Update booking status (confirm, cancel, complete, no-show)
 * @access Private
 */
router.patch(
  '/:id/status',
  validate(updateBookingStatusSchema),
  bookingController.updateStatus
);

/**
 * @route PATCH /api/v1/bookings/:id
 * @desc Reschedule a booking
 * @access Private
 */
router.patch(
  '/:id',
  validate(rescheduleBookingSchema),
  bookingController.reschedule
);

export default router;
