/**
 * Payment Service
 * 
 * This service handles all payment processing for the EasyParkNow platform
 * using Stripe as the payment processor. It manages:
 * - Payment processing for bookings
 * - Refunds for cancelled bookings
 * - Webhook handling for payment events
 * - Customer management
 * - Payment method storage
 * 
 * Features:
 * - Secure payment processing
 * - Support for cards, Apple Pay, Google Pay
 * - Automatic refund processing
 * - Webhook event handling
 * - Payment failure handling
 */

const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');
const { sendPaymentReceiptEmail } = require('./emailService');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

/**
 * Create or get Stripe customer
 * @param {Object} user - User object
 * @returns {Promise<string>} - Stripe customer ID
 */
const createOrGetCustomer = async (user) => {
  try {
    // Check if user already has a Stripe customer ID
    if (user.stripeCustomerId) {
      // Verify customer exists in Stripe
      try {
        await stripe.customers.retrieve(user.stripeCustomerId);
        return user.stripeCustomerId;
      } catch (error) {
        // Customer doesn't exist in Stripe, create new one
        console.log('Stripe customer not found, creating new one');
      }
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id,
        role: user.role
      }
    });

    // Update user with Stripe customer ID
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id }
    });

    console.log('Created Stripe customer:', customer.id);
    return customer.id;

  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new AppError('Failed to create payment customer', 500, 'CUSTOMER_CREATION_ERROR');
  }
};

/**
 * Process payment for booking
 * @param {Object} paymentData - Payment information
 * @param {number} paymentData.amount - Amount in pounds
 * @param {string} paymentData.currency - Currency code (default: 'gbp')
 * @param {string} paymentData.paymentMethodId - Stripe payment method ID
 * @param {string} paymentData.customerId - Stripe customer ID
 * @param {Object} paymentData.metadata - Additional metadata
 * @returns {Promise<Object>} - Payment result
 */
const processPayment = async (paymentData) => {
  try {
    const {
      amount,
      currency = 'gbp',
      paymentMethodId,
      customerId,
      metadata = {}
    } = paymentData;

    // Convert amount to pence (Stripe uses smallest currency unit)
    const amountInPence = Math.round(amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPence,
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/booking-success`,
      metadata: {
        ...metadata,
        platform: 'EasyParkNow'
      },
      description: `EasyParkNow parking booking - ${metadata.bookingId || 'Unknown'}`
    });

    // Handle different payment statuses
    if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_source_action') {
      // Payment requires additional authentication (3D Secure)
      return {
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status
      };
    } else if (paymentIntent.status === 'succeeded') {
      // Payment successful
      console.log('Payment succeeded:', paymentIntent.id);
      return {
        success: true,
        id: paymentIntent.id,
        amount: amount,
        status: 'succeeded',
        payment_method: paymentIntent.payment_method
      };
    } else {
      // Payment failed
      throw new AppError(`Payment failed with status: ${paymentIntent.status}`, 400, 'PAYMENT_FAILED');
    }

  } catch (error) {
    console.error('Payment processing error:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      throw new AppError(error.message, 400, 'CARD_ERROR');
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new AppError('Invalid payment request', 400, 'INVALID_REQUEST');
    } else if (error.type === 'StripeAPIError') {
      throw new AppError('Payment service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE');
    } else if (error instanceof AppError) {
      throw error;
    } else {
      throw new AppError('Payment processing failed', 500, 'PAYMENT_ERROR');
    }
  }
};

/**
 * Confirm payment intent (for 3D Secure)
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} - Confirmation result
 */
const confirmPayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        id: paymentIntent.id,
        status: 'succeeded'
      };
    } else {
      throw new AppError(`Payment confirmation failed: ${paymentIntent.status}`, 400, 'CONFIRMATION_FAILED');
    }

  } catch (error) {
    console.error('Payment confirmation error:', error);
    throw new AppError('Payment confirmation failed', 400, 'CONFIRMATION_ERROR');
  }
};

/**
 * Process refund for cancelled booking
 * @param {string} paymentIntentId - Original payment intent ID
 * @param {number} amount - Refund amount in pounds
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} - Refund result
 */
const processRefund = async (paymentIntentId, amount, reason = 'requested_by_customer') => {
  try {
    // Convert amount to pence
    const amountInPence = Math.round(amount * 100);

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInPence,
      reason: reason,
      metadata: {
        platform: 'EasyParkNow',
        refund_type: 'booking_cancellation'
      }
    });

    console.log('Refund processed:', refund.id);

    return {
      success: true,
      id: refund.id,
      amount: amount,
      status: refund.status,
      reason: reason
    };

  } catch (error) {
    console.error('Refund processing error:', error);
    throw new AppError('Refund processing failed', 500, 'REFUND_ERROR');
  }
};

/**
 * Get payment methods for customer
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Array>} - Array of payment methods
 */
const getPaymentMethods = async (customerId) => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year
      },
      created: pm.created
    }));

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw new AppError('Failed to fetch payment methods', 500, 'PAYMENT_METHODS_ERROR');
  }
};

/**
 * Attach payment method to customer
 * @param {string} paymentMethodId - Payment method ID
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Object>} - Attached payment method
 */
const attachPaymentMethod = async (paymentMethodId, customerId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      card: paymentMethod.card
    };

  } catch (error) {
    console.error('Error attaching payment method:', error);
    throw new AppError('Failed to save payment method', 500, 'PAYMENT_METHOD_ERROR');
  }
};

/**
 * Detach payment method from customer
 * @param {string} paymentMethodId - Payment method ID
 * @returns {Promise<Object>} - Detached payment method
 */
const detachPaymentMethod = async (paymentMethodId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    return { success: true, id: paymentMethod.id };

  } catch (error) {
    console.error('Error detaching payment method:', error);
    throw new AppError('Failed to remove payment method', 500, 'PAYMENT_METHOD_ERROR');
  }
};

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe webhook event
 * @returns {Promise<void>}
 */
const handleWebhookEvent = async (event) => {
  try {
    console.log('Processing webhook event:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleChargeDispute(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

  } catch (error) {
    console.error('Webhook handling error:', error);
    throw error;
  }
};

/**
 * Handle successful payment
 * @param {Object} paymentIntent - Stripe payment intent object
 */
const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    const bookingId = paymentIntent.metadata?.bookingId;
    
    if (!bookingId) {
      console.log('No booking ID in payment metadata');
      return;
    }

    // Update payment record
    await prisma.payment.updateMany({
      where: {
        stripePaymentId: paymentIntent.id
      },
      data: {
        status: 'SUCCEEDED'
      }
    });

    // Get booking details for email
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        space: true,
        payment: true
      }
    });

    if (booking) {
      // Send payment receipt email
      try {
        await sendPaymentReceiptEmail(
          booking.payment,
          booking.user,
          booking,
          booking.space
        );
      } catch (emailError) {
        console.error('Failed to send payment receipt email:', emailError);
      }
    }

    console.log('Payment succeeded webhook processed for booking:', bookingId);

  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

/**
 * Handle failed payment
 * @param {Object} paymentIntent - Stripe payment intent object
 */
const handlePaymentFailed = async (paymentIntent) => {
  try {
    const bookingId = paymentIntent.metadata?.bookingId;
    
    if (!bookingId) {
      console.log('No booking ID in payment metadata');
      return;
    }

    // Update payment record
    await prisma.payment.updateMany({
      where: {
        stripePaymentId: paymentIntent.id
      },
      data: {
        status: 'FAILED'
      }
    });

    // Cancel the booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' }
    });

    console.log('Payment failed webhook processed for booking:', bookingId);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

/**
 * Handle charge dispute
 * @param {Object} dispute - Stripe dispute object
 */
const handleChargeDispute = async (dispute) => {
  try {
    console.log('Charge dispute created:', dispute.id);
    
    // TODO: Implement dispute handling logic
    // - Notify admin
    // - Update booking status
    // - Gather evidence
    
  } catch (error) {
    console.error('Error handling charge dispute:', error);
  }
};

/**
 * Handle invoice payment succeeded (for subscriptions if implemented)
 * @param {Object} invoice - Stripe invoice object
 */
const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    console.log('Invoice payment succeeded:', invoice.id);
    
    // TODO: Handle subscription payments if implemented
    
  } catch (error) {
    console.error('Error handling invoice payment:', error);
  }
};

/**
 * Create setup intent for saving payment methods
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Object>} - Setup intent
 */
const createSetupIntent = async (customerId) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });

    return {
      client_secret: setupIntent.client_secret,
      id: setupIntent.id
    };

  } catch (error) {
    console.error('Error creating setup intent:', error);
    throw new AppError('Failed to create payment setup', 500, 'SETUP_INTENT_ERROR');
  }
};

/**
 * Get payment statistics for admin dashboard
 * @param {Object} filters - Date and other filters
 * @returns {Promise<Object>} - Payment statistics
 */
const getPaymentStats = async (filters = {}) => {
  try {
    const { startDate, endDate } = filters;
    
    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalPayments,
      successfulPayments,
      failedPayments,
      refundedPayments,
      totalRevenue
    ] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...where, status: 'SUCCEEDED' } }),
      prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
      prisma.payment.count({ where: { ...where, status: 'REFUNDED' } }),
      prisma.payment.aggregate({
        where: { ...where, status: 'SUCCEEDED' },
        _sum: { amount: true }
      })
    ]);

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      refundedPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      successRate: totalPayments > 0 ? (successfulPayments / totalPayments * 100).toFixed(2) : 0
    };

  } catch (error) {
    console.error('Error getting payment stats:', error);
    throw new AppError('Failed to get payment statistics', 500, 'STATS_ERROR');
  }
};

module.exports = {
  createOrGetCustomer,
  processPayment,
  confirmPayment,
  processRefund,
  getPaymentMethods,
  attachPaymentMethod,
  detachPaymentMethod,
  handleWebhookEvent,
  createSetupIntent,
  getPaymentStats
};
