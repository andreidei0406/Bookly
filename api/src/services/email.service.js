/**
 * @module services/email
 * @description Email service powered by Nodemailer and Handlebars templates.
 * All sends are wrapped in try/catch so email failures never break the
 * calling flow — errors are logged but not re-thrown.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import config from '../config/index.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Path to the email templates directory. */
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

/** In-memory cache for compiled Handlebars templates. */
const templateCache = new Map();

/**
 * Create the Nodemailer transporter from config.
 * Returns null if SMTP is not configured (e.g. in testing).
 */
function createTransporter() {
  if (!config.email.host) {
    logger.warn('SMTP not configured — emails will not be sent');
    return null;
  }

  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

const transporter = createTransporter();

/**
 * Load and compile a Handlebars template by name.
 * Templates are cached in memory after the first load.
 * @param {string} templateName - Template filename without extension (e.g. "welcome").
 * @returns {Promise<HandlebarsTemplateDelegate>} Compiled template function.
 */
async function loadTemplate(templateName) {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  const filePath = join(TEMPLATES_DIR, `${templateName}.hbs`);

  try {
    const source = await readFile(filePath, 'utf-8');
    const compiled = Handlebars.compile(source);
    templateCache.set(templateName, compiled);
    return compiled;
  } catch (err) {
    logger.error(`Failed to load email template "${templateName}": ${err.message}`);
    throw err;
  }
}

/**
 * Send an email using a Handlebars template.
 * @param {object} params
 * @param {string} params.to - Recipient email address.
 * @param {string} params.subject - Email subject line.
 * @param {string} params.template - Template name (without .hbs extension).
 * @param {object} params.context - Data to pass into the template.
 * @returns {Promise<void>}
 */
export async function sendEmail({ to, subject, template, context }) {
  try {
    if (!transporter) {
      logger.warn(`Email skipped (no transporter): "${subject}" to ${to}`);
      return;
    }

    const compiledTemplate = await loadTemplate(template);
    const html = compiledTemplate(context);

    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });

    logger.info(`Email sent: "${subject}" to ${to}`);
  } catch (err) {
    logger.error(`Failed to send email "${subject}" to ${to}: ${err.message}`);
    // Intentionally not re-throwing — email failures should not break the flow
  }
}

/**
 * Send a welcome email to a newly registered user.
 * @param {object} user - The user object.
 * @param {string} user.email
 * @param {string} user.firstName
 */
export async function sendWelcomeEmail(user) {
  await sendEmail({
    to: user.email,
    subject: 'Welcome to Bookly!',
    template: 'welcome',
    context: {
      firstName: user.firstName,
      year: new Date().getFullYear(),
    },
  });
}

/**
 * Send a booking confirmation email.
 * @param {object} booking - The booking with populated relations.
 */
export async function sendBookingConfirmation(booking) {
  const customerEmail = booking.customer?.email;
  if (!customerEmail) {return;}

  await sendEmail({
    to: customerEmail,
    subject: 'Your Booking is Confirmed - Bookly',
    template: 'booking-confirmation',
    context: {
      firstName: booking.customer.firstName,
      serviceName: booking.service?.name,
      businessName: booking.business?.name,
      date: booking.date instanceof Date ? booking.date.toLocaleDateString() : booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      year: new Date().getFullYear(),
    },
  });
}

/**
 * Send a booking cancellation email.
 * @param {object} booking - The booking with populated relations.
 */
export async function sendBookingCancellation(booking) {
  const customerEmail = booking.customer?.email;
  if (!customerEmail) {return;}

  await sendEmail({
    to: customerEmail,
    subject: 'Your Booking Has Been Cancelled - Bookly',
    template: 'booking-cancellation',
    context: {
      firstName: booking.customer.firstName,
      serviceName: booking.service?.name,
      businessName: booking.business?.name,
      date: booking.date instanceof Date ? booking.date.toLocaleDateString() : booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      cancelReason: booking.cancelReason || null,
      year: new Date().getFullYear(),
    },
  });
}

/**
 * Send a password reset email with a reset link.
 * @param {object} user - The user requesting the reset.
 * @param {string} resetToken - The JWT reset token.
 */
export async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${config.cors.origin}/reset-password?token=${resetToken}`;

  await sendEmail({
    to: user.email,
    subject: 'Reset Your Password - Bookly',
    template: 'password-reset',
    context: {
      firstName: user.firstName,
      resetUrl,
      year: new Date().getFullYear(),
    },
  });
}
