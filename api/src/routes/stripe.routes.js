import express from 'express';
import { Router } from 'express';
import * as stripeController from '../controllers/stripe.controller.js';
import authenticate from '../middleware/auth.middleware.js';

const router = Router();

/**
 * @route POST /api/v1/stripe/checkout-session
 * @desc Create a checkout session
 * @access Private
 */
router.post(
  '/checkout-session',
  authenticate,
  stripeController.createCheckoutSession
);

/**
 * @route POST /api/v1/stripe/webhook
 * @desc Handle Stripe webhook events
 * @access Public
 */
// Webhook endpoint needs raw body for signature verification!
router.post(
  '/webhook',
  stripeController.handleWebhook
);

export default router;
