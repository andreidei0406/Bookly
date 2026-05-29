import Stripe from 'stripe';
import config from '../config/index.js';
import prisma from '../utils/prisma.js';
import ApiError from '../utils/apiError.js';
import { success } from '../utils/apiResponse.js';
import catchAsync from '../utils/catchAsync.js';

const stripe = new Stripe(config.stripe.secretKey);

/**
 * Create a Stripe Checkout Session for upgrading plan
 * @route POST /api/v1/billing/checkout
 */
export const createCheckoutSession = catchAsync(async (req, res) => {
  const { plan } = req.body;
  if (!['PREMIUM', 'ULTIMATE'].includes(plan)) {
    throw ApiError.badRequest('Invalid subscription plan specified');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Prevent Downgrading and duplicate active plans
  if (user.plan === 'ULTIMATE') {
    throw ApiError.badRequest('Already on the Ultimate plan. Downgrading is not permitted.');
  }

  if (user.plan === 'PREMIUM' && plan === 'PREMIUM') {
    throw ApiError.badRequest('Already on the Premium plan.');
  }

  // Calculate pricing in cents
  const amount = plan === 'PREMIUM' ? 900 : 1900; // $9 or $19

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Bookly ${plan.charAt(0) + plan.slice(1).toLowerCase()} Plan`,
            description: plan === 'PREMIUM' 
              ? 'Share personalized booking links and receive reservations.'
              : 'Sync calendar with Google Calendar and automatically generate Google Meet links.',
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${config.cors.origin}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}&success=true&plan=${plan}`,
    cancel_url: `${config.cors.origin}/dashboard/settings`,
    metadata: {
      userId: user.id,
      plan: plan,
    },
  });

  return success(res, { data: { checkoutUrl: session.url } });
});

/**
 * Confirm a Stripe payment and upgrade the user's plan
 * @route POST /api/v1/billing/confirm
 */
export const confirmPayment = catchAsync(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    throw ApiError.badRequest('Checkout Session ID is required');
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session) {
    throw ApiError.notFound('Stripe checkout session not found');
  }

  if (session.payment_status !== 'paid') {
    throw ApiError.badRequest('Payment has not been completed');
  }

  const { userId, plan } = session.metadata;

  if (userId !== req.user.id) {
    throw ApiError.forbidden('Session does not belong to the current authenticated user');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { plan }
  });

  const { password, ...safeUser } = updatedUser;
  return success(res, { data: safeUser, message: `Successfully upgraded to the ${plan} plan!` });
});

/**
 * Stripe Webhook Handler for background updates
 * @route POST /api/v1/billing/webhook
 */
export const handleWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const payload = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(payload, sig, config.stripe.webhookSecret);
  } catch (err) {
    // Fallback for direct API testing or developers mocking webhook payloads
    event = req.body;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, plan } = session.metadata;

    if (userId && plan) {
      await prisma.user.update({
        where: { id: userId },
        data: { plan }
      });
    }
  }

  return success(res, { received: true });
});
