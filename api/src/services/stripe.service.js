import Stripe from 'stripe';
import config from '../config/index.js';
import prisma from '../utils/prisma.js';
import logger from '../config/logger.js';
import ApiError from '../utils/apiError.js';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

/**
 * Create a Stripe Checkout Session for a booking.
 * @param {object} params
 * @param {string} params.bookingId
 * @returns {Promise<{url: string}>}
 */
export async function createBookingCheckoutSession({ bookingId }) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, business: true, customer: true },
  });

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  if (booking.service.paymentType === 'FREE') {
    throw ApiError.badRequest('This service is free');
  }

  // Create or get Stripe Customer for the business
  let stripeCustomerId = booking.business.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: booking.business.email || 'business@bookly.com',
      name: booking.business.name,
    });
    stripeCustomerId = customer.id;
    await prisma.business.update({
      where: { id: booking.business.id },
      data: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: booking.service.currency.toLowerCase(),
          product_data: {
            name: booking.service.name,
            description: `Booking with ${booking.business.name}`,
          },
          unit_amount: Math.round(Number(booking.service.price) * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${config.cors.origin}/booking/${booking.id}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.cors.origin}/booking/${booking.id}/cancel`,
    client_reference_id: booking.id,
    metadata: {
      bookingId: booking.id,
      type: 'booking_payment',
    },
  });

  return { url: session.url };
}

/**
 * Handle Stripe Webhook Events
 */
export async function handleWebhook(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      
      if (session.metadata.type === 'booking_payment') {
        const bookingId = session.metadata.bookingId;
        
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'PAID',
            stripePaymentIntentId: session.payment_intent,
            // If the booking requires payment to be confirmed, confirm it now
            status: 'CONFIRMED', 
          },
        });
        
        logger.info(`Payment completed for booking ${bookingId}`);
      }
      break;
    }
    // Add other events here (e.g. subscription renewals for businesses)
    default:
      logger.info(`Unhandled event type ${event.type}`);
  }
}

export default stripe;
