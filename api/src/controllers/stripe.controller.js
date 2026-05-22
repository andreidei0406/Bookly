import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';
import * as stripeService from '../services/stripe.service.js';
import config from '../config/index.js';
import stripe from '../services/stripe.service.js';
import logger from '../config/logger.js';

/**
 * Create a Stripe checkout session for a booking payment
 * @route POST /api/v1/stripe/checkout-session
 */
export const createCheckoutSession = catchAsync(async (req, res) => {
  const result = await stripeService.createBookingCheckoutSession({
    bookingId: req.body.bookingId,
  });
  return success(res, { data: result });
});

/**
 * Handle incoming Stripe Webhooks
 * @route POST /api/v1/stripe/webhook
 */
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.rawBody must be populated by express middleware for this route!
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err) {
    logger.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await stripeService.handleWebhook(event);
    res.json({ received: true });
  } catch (err) {
    logger.error(`Webhook processing error: ${err.message}`);
    res.status(500).send('Internal server error');
  }
};
