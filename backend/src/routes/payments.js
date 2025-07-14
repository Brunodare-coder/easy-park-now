/**
 * Payment Routes
 * 
 * This file handles all payment-related endpoints including:
 * - Process payments for bookings
 * - Handle Stripe webhooks
 * - Manage payment methods
 * - Process refunds
 * - Get payment history
 * 
 * All routes include proper authentication and validation.
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const Stripe = require('stripe');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
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
} = require('../services/paymentService');

const router = express.Router();
const prisma = new PrismaClient();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Validation schemas
const processPaymentSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
  paymentMethodId: Joi.string().required(),
  savePaymentMethod: Joi.boolean().default(false)
});

const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string().required()
});

const refundSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
  amount: Joi.number().min(0.01).optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').default('requested_by_customer')
});

/**
 * POST /api/payments/process
 * Process payment for a booking
 */
router.post('/process', authMiddleware, asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = processPaymentSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { bookingId, paymentMethodId, savePaymentMethod } = value;

  // Get booking details
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      space: true,
      user: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== req.user.id) {
    throw new AppError('You can only pay for your own bookings', 403, 'UNAUTHORIZED');
  }

  if (booking.status !== 'PENDING') {
    throw new AppError('Only pending bookings can be paid for', 400, 'INVALID_BOOKING_STATUS');
  }

  // Create or get Stripe customer
  const customerId = await createOrGetCustomer(req.user);

  // Save payment method if requested
  if (savePaymentMethod) {
    try {
      await attachPaymentMethod(paymentMethodId, customerId);
    } catch (error) {
      console.error('Failed to save payment method:', error);
      // Don't fail payment if saving method fails
    }
  }

  // Process payment
  const paymentResult = await processPayment({
    amount: booking.totalCost,
    currency: 'gbp',
    paymentMethodId,
    customerId,
    metadata: {
      bookingId: booking.id,
      spaceId: booking.spaceId,
      userId: req.user.id
    }
  });

  // Handle different payment outcomes
  if (paymentResult.requiresAction) {
    // Payment requires additional authentication
    res.json({
      success: false,
      requiresAction: true,
      clientSecret: paymentResult.clientSecret,
      message: 'Payment requires additional authentication'
    });
  } else if (paymentResult.success) {
    // Payment successful - update booking and create payment record
    const [updatedBooking, paymentRecord] = await Promise.all([
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: {
          space: true,
          user: true
        }
      }),
      prisma.payment.create({
        data: {
          userId: req.user.id,
          bookingId: booking.id,
          amount: booking.totalCost,
          currency: 'GBP',
          status: 'SUCCEEDED',
          stripePaymentId: paymentResult.id,
          paymentMethod: paymentResult.payment_method?.type || 'card',
          last4: paymentResult.payment_method?.card?.last4,
          brand: paymentResult.payment_method?.card?.brand
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        booking: updatedBooking,
        payment: paymentRecord
      }
    });
  }
}));

/**
 * POST /api/payments/confirm
 * Confirm payment intent (for 3D Secure)
 */
router.post('/confirm', authMiddleware, asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = confirmPaymentSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { paymentIntentId } = value;

  // Confirm payment
  const confirmResult = await confirmPayment(paymentIntentId);

  if (confirmResult.success) {
    // Get payment intent details to find booking
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const bookingId = paymentIntent.metadata?.bookingId;

    if (bookingId) {
      // Update booking status
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: {
          space: true,
          user: true
        }
      });

      // Update payment record
      await prisma.payment.updateMany({
        where: {
          stripePaymentId: paymentIntentId
        },
        data: {
          status: 'SUCCEEDED'
        }
      });

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: { booking: updatedBooking }
      });
    } else {
      res.json({
        success: true,
        message: 'Payment confirmed successfully'
      });
    }
  }
}));

/**
 * GET /api/payments/methods
 * Get user's saved payment methods
 */
router.get('/methods', authMiddleware, asyncHandler(async (req, res) => {
  // Get or create Stripe customer
  const customerId = await createOrGetCustomer(req.user);

  // Get payment methods
  const paymentMethods = await getPaymentMethods(customerId);

  res.json({
    success: true,
    data: { paymentMethods }
  });
}));

/**
 * POST /api/payments/methods/setup
 * Create setup intent for saving payment methods
 */
router.post('/methods/setup', authMiddleware, asyncHandler(async (req, res) => {
  // Get or create Stripe customer
  const customerId = await createOrGetCustomer(req.user);

  // Create setup intent
  const setupIntent = await createSetupIntent(customerId);

  res.json({
    success: true,
    data: { setupIntent }
  });
}));

/**
 * DELETE /api/payments/methods/:paymentMethodId
 * Remove saved payment method
 */
router.delete('/methods/:paymentMethodId', authMiddleware, asyncHandler(async (req, res) => {
  const { paymentMethodId } = req.params;

  // Detach payment method
  await detachPaymentMethod(paymentMethodId);

  res.json({
    success: true,
    message: 'Payment method removed successfully'
  });
}));

/**
 * GET /api/payments/history
 * Get user's payment history
 */
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    startDate,
    endDate
  } = req.query;

  // Build filters
  const where = {
    userId: req.user.id
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get payments
  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            space: {
              select: {
                title: true,
                address: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.payment.count({ where })
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    }
  });
}));

/**
 * POST /api/payments/refund
 * Process refund for a payment (admin only)
 */
router.post('/refund', authMiddleware, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = refundSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { paymentId, amount, reason } = value;

  // Get payment details
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: true,
      user: true
    }
  });

  if (!payment) {
    throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.status !== 'SUCCEEDED') {
    throw new AppError('Only successful payments can be refunded', 400, 'INVALID_PAYMENT_STATUS');
  }

  // Use provided amount or full payment amount
  const refundAmount = amount || payment.amount;

  if (refundAmount > payment.amount) {
    throw new AppError('Refund amount cannot exceed payment amount', 400, 'INVALID_REFUND_AMOUNT');
  }

  // Process refund
  const refundResult = await processRefund(payment.stripePaymentId, refundAmount, reason);

  if (refundResult.success) {
    // Update payment record
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        refundAmount: refundAmount
      }
    });

    // Update booking status if full refund
    if (refundAmount === payment.amount) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'REFUNDED' }
      });
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        payment: updatedPayment,
        refund: refundResult
      }
    });
  }
}));

/**
 * GET /api/payments/stats
 * Get payment statistics (admin only)
 */
router.get('/stats', authMiddleware, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const stats = await getPaymentStats({
    startDate,
    endDate
  });

  res.json({
    success: true,
    data: { stats }
  });
}));

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    await handleWebhookEvent(event);
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handling failed:', error);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
}));

module.exports = router;
