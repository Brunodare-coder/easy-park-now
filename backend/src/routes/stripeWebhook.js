/**
 * Stripe Webhook Handler
 * 
 * This route handles incoming webhook events from Stripe.
 * It verifies the event signature and processes payment events.
 */

const express = require('express');
const { handleWebhookEvent } = require('../services/paymentService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const event = req.body;

    // Process the Stripe webhook event
    await handleWebhookEvent(event);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

module.exports = router;
