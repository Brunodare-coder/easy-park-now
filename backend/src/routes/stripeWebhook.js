/**
 * Stripe Webhook Handler
 * 
 * This route handles incoming webhook events from Stripe.
 * It verifies the event signature and processes payment events.
 * 
 * Security Features:
 * - Webhook signature verification
 * - Raw body parsing for signature validation
 * - Comprehensive error logging
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { handleWebhookEvent } = require('../services/paymentService');

const router = express.Router();

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature for security
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook configuration error',
        code: 'WEBHOOK_CONFIG_ERROR'
      });
    }

    // Construct and verify the event
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`Stripe webhook received: ${event.type}`);

    // Process the verified Stripe webhook event
    await handleWebhookEvent(event);

    res.status(200).json({ 
      success: true,
      received: true,
      eventType: event.type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stripe webhook error:', {
      message: error.message,
      type: error.type || 'unknown',
      signature: sig ? 'present' : 'missing',
      timestamp: new Date().toISOString()
    });

    // Handle signature verification errors
    if (error.type === 'StripeSignatureVerificationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
    }

    // Handle other webhook processing errors
    res.status(400).json({
      success: false,
      message: `Webhook Error: ${error.message}`,
      code: 'WEBHOOK_PROCESSING_ERROR'
    });
  }
});

module.exports = router;
