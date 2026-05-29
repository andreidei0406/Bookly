import { Router } from 'express';
import authenticate from '../middleware/auth.middleware.js';
import * as billingController from '../controllers/billing.controller.js';

const router = Router();

// Stripe Checkout Session Creation
router.post('/checkout', authenticate, billingController.createCheckoutSession);

// Payment Confirmation from Frontend
router.post('/confirm', authenticate, billingController.confirmPayment);

// Stripe Webhook Endpoint (Stripe calls this directly)
router.post('/webhook', billingController.handleWebhook);

export default router;
