/**
 * Booking Routes
 * 
 * This file handles all booking-related endpoints including:
 * - Create new bookings
 * - Get user bookings (past and upcoming)
 * - Update booking details
 * - Cancel bookings
 * - Extend booking duration
 * - Start/stop parking sessions
 * 
 * All routes require authentication and include proper validation.
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendBookingConfirmationEmail } = require('../services/emailService');
const { processPayment } = require('../services/paymentService');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createBookingSchema = Joi.object({
  spaceId: Joi.string().uuid().required(),
  startTime: Joi.date().iso().min('now').required(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required(),
  vehicleReg: Joi.string().min(2).max(15).required(),
  vehicleMake: Joi.string().max(50).optional(),
  vehicleModel: Joi.string().max(50).optional(),
  vehicleColor: Joi.string().max(30).optional(),
  specialRequests: Joi.string().max(500).optional(),
  paymentMethodId: Joi.string().required() // Stripe payment method ID
});

const updateBookingSchema = Joi.object({
  vehicleReg: Joi.string().min(2).max(15).optional(),
  vehicleMake: Joi.string().max(50).optional(),
  vehicleModel: Joi.string().max(50).optional(),
  vehicleColor: Joi.string().max(30).optional(),
  specialRequests: Joi.string().max(500).optional()
});

const extendBookingSchema = Joi.object({
  newEndTime: Joi.date().iso().greater(Joi.ref('$currentEndTime')).required(),
  paymentMethodId: Joi.string().required()
});

/**
 * Helper function to calculate booking cost
 * @param {Date} startTime - Booking start time
 * @param {Date} endTime - Booking end time
 * @param {number} hourlyRate - Space hourly rate
 * @returns {number} - Total cost in pounds
 */
const calculateBookingCost = (startTime, endTime, hourlyRate) => {
  const durationMs = new Date(endTime) - new Date(startTime);
  const durationHours = durationMs / (1000 * 60 * 60);
  
  // Round up to nearest 15 minutes for billing
  const billingHours = Math.ceil(durationHours * 4) / 4;
  
  return Math.round(billingHours * hourlyRate * 100) / 100; // Round to 2 decimal places
};

/**
 * Helper function to check space availability
 * @param {string} spaceId - Parking space ID
 * @param {Date} startTime - Requested start time
 * @param {Date} endTime - Requested end time
 * @param {string} excludeBookingId - Booking ID to exclude from conflict check
 * @returns {boolean} - True if available
 */
const checkSpaceAvailability = async (spaceId, startTime, endTime, excludeBookingId = null) => {
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      spaceId,
      status: { in: ['CONFIRMED', 'ACTIVE'] },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } }
          ]
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } }
          ]
        },
        {
          AND: [
            { startTime: { gte: startTime } },
            { endTime: { lte: endTime } }
          ]
        }
      ]
    }
  });

  return conflictingBookings.length === 0;
};

/**
 * POST /api/bookings
 * Create a new parking booking
 */
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = createBookingSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const {
    spaceId,
    startTime,
    endTime,
    vehicleReg,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    specialRequests,
    paymentMethodId
  } = value;

  // Get parking space details
  const space = await prisma.parkingSpace.findUnique({
    where: { id: spaceId },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!space) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (!space.isActive) {
    throw new AppError('Parking space is not available', 400, 'SPACE_INACTIVE');
  }

  // Check if user is trying to book their own space
  if (space.ownerId === req.user.id) {
    throw new AppError('You cannot book your own parking space', 400, 'CANNOT_BOOK_OWN_SPACE');
  }

  // Check availability
  const isAvailable = await checkSpaceAvailability(spaceId, startTime, endTime);
  if (!isAvailable) {
    throw new AppError('Parking space is not available for the selected time', 409, 'SPACE_NOT_AVAILABLE');
  }

  // Calculate total cost
  const totalCost = calculateBookingCost(startTime, endTime, space.price);

  // Create booking (initially pending)
  const booking = await prisma.booking.create({
    data: {
      userId: req.user.id,
      spaceId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      totalCost,
      vehicleReg: vehicleReg.toUpperCase(),
      vehicleMake,
      vehicleModel,
      vehicleColor,
      specialRequests,
      status: 'PENDING'
    },
    include: {
      space: {
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  try {
    // Process payment
    const paymentResult = await processPayment({
      amount: totalCost,
      currency: 'gbp',
      paymentMethodId,
      customerId: req.user.stripeCustomerId,
      metadata: {
        bookingId: booking.id,
        spaceId: space.id,
        userId: req.user.id
      }
    });

    // Update booking status to confirmed
    const confirmedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED' },
      include: {
        space: true,
        user: true
      }
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        bookingId: booking.id,
        amount: totalCost,
        currency: 'GBP',
        status: 'SUCCEEDED',
        stripePaymentId: paymentResult.id,
        paymentMethod: paymentResult.payment_method?.type || 'card',
        last4: paymentResult.payment_method?.card?.last4,
        brand: paymentResult.payment_method?.card?.brand
      }
    });

    // Send confirmation emails
    try {
      await Promise.all([
        // Email to customer
        sendBookingConfirmationEmail(confirmedBooking, confirmedBooking.user, confirmedBooking.space),
        // TODO: Email to space owner about new booking
      ]);
    } catch (emailError) {
      console.error('Failed to send confirmation emails:', emailError);
      // Don't fail the booking if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Booking created and payment processed successfully',
      data: {
        booking: confirmedBooking,
        payment: {
          id: paymentResult.id,
          amount: totalCost,
          status: 'succeeded'
        }
      }
    });

  } catch (paymentError) {
    // Payment failed - cancel the booking
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' }
    });

    console.error('Payment processing failed:', paymentError);
    throw new AppError('Payment processing failed. Please try again.', 400, 'PAYMENT_FAILED');
  }
}));

/**
 * GET /api/bookings
 * Get user's bookings with filtering options
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const {
    status,
    upcoming = 'false',
    past = 'false',
    page = 1,
    limit = 20
  } = req.query;

  // Build filters
  const where = {
    userId: req.user.id
  };

  if (status) {
    where.status = status.toUpperCase();
  }

  if (upcoming === 'true') {
    where.startTime = { gte: new Date() };
  }

  if (past === 'true') {
    where.endTime = { lt: new Date() };
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get bookings
  const [bookings, totalCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        space: {
          include: {
            images: {
              take: 1,
              orderBy: { order: 'asc' }
            },
            owner: {
              select: {
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentMethod: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.booking.count({ where })
  ]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      bookings,
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
 * GET /api/bookings/:id
 * Get specific booking details
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      space: {
        include: {
          images: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          }
        }
      },
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true
        }
      },
      payment: true,
      review: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  // Check if user owns this booking or is the space owner or admin
  const canView = booking.userId === req.user.id || 
                  booking.space.ownerId === req.user.id || 
                  req.user.role === 'ADMIN';

  if (!canView) {
    throw new AppError('You do not have permission to view this booking', 403, 'UNAUTHORIZED');
  }

  res.json({
    success: true,
    data: { booking }
  });
}));

/**
 * PUT /api/bookings/:id
 * Update booking details (before start time only)
 */
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate request body
  const { error, value } = updateBookingSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  // Get booking
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      startTime: true,
      status: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== req.user.id) {
    throw new AppError('You can only update your own bookings', 403, 'UNAUTHORIZED');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new AppError('Only confirmed bookings can be updated', 400, 'INVALID_BOOKING_STATUS');
  }

  // Check if booking has already started
  if (new Date(booking.startTime) <= new Date()) {
    throw new AppError('Cannot update booking that has already started', 400, 'BOOKING_ALREADY_STARTED');
  }

  // Update booking
  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      ...value,
      ...(value.vehicleReg && { vehicleReg: value.vehicleReg.toUpperCase() })
    },
    include: {
      space: true,
      payment: true
    }
  });

  res.json({
    success: true,
    message: 'Booking updated successfully',
    data: { booking: updatedBooking }
  });
}));

/**
 * POST /api/bookings/:id/extend
 * Extend booking duration
 */
router.post('/:id/extend', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get current booking
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { space: true }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== req.user.id) {
    throw new AppError('You can only extend your own bookings', 403, 'UNAUTHORIZED');
  }

  if (!['CONFIRMED', 'ACTIVE'].includes(booking.status)) {
    throw new AppError('Only confirmed or active bookings can be extended', 400, 'INVALID_BOOKING_STATUS');
  }

  // Validate request body with current end time context
  const { error, value } = extendBookingSchema.validate(req.body, {
    context: { currentEndTime: booking.endTime }
  });
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { newEndTime, paymentMethodId } = value;

  // Check availability for extended time
  const isAvailable = await checkSpaceAvailability(
    booking.spaceId,
    booking.endTime,
    newEndTime,
    booking.id
  );

  if (!isAvailable) {
    throw new AppError('Space is not available for the extended time', 409, 'SPACE_NOT_AVAILABLE');
  }

  // Calculate additional cost
  const additionalCost = calculateBookingCost(booking.endTime, newEndTime, booking.space.price);

  try {
    // Process additional payment
    const paymentResult = await processPayment({
      amount: additionalCost,
      currency: 'gbp',
      paymentMethodId,
      customerId: req.user.stripeCustomerId,
      metadata: {
        bookingId: booking.id,
        type: 'extension',
        originalEndTime: booking.endTime.toISOString(),
        newEndTime: newEndTime
      }
    });

    // Update booking
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        endTime: new Date(newEndTime),
        totalCost: booking.totalCost + additionalCost
      },
      include: {
        space: true,
        payment: true
      }
    });

    // Create additional payment record
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        bookingId: booking.id,
        amount: additionalCost,
        currency: 'GBP',
        status: 'SUCCEEDED',
        stripePaymentId: paymentResult.id,
        paymentMethod: paymentResult.payment_method?.type || 'card'
      }
    });

    res.json({
      success: true,
      message: 'Booking extended successfully',
      data: {
        booking: updatedBooking,
        additionalCost,
        newTotalCost: updatedBooking.totalCost
      }
    });

  } catch (paymentError) {
    console.error('Extension payment failed:', paymentError);
    throw new AppError('Payment for extension failed. Please try again.', 400, 'PAYMENT_FAILED');
  }
}));

/**
 * POST /api/bookings/:id/cancel
 * Cancel a booking
 */
router.post('/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      space: true,
      payment: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== req.user.id) {
    throw new AppError('You can only cancel your own bookings', 403, 'UNAUTHORIZED');
  }

  if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
    throw new AppError('Only confirmed or pending bookings can be cancelled', 400, 'INVALID_BOOKING_STATUS');
  }

  // Check cancellation policy (e.g., must cancel at least 1 hour before)
  const hoursUntilStart = (new Date(booking.startTime) - new Date()) / (1000 * 60 * 60);
  const canCancel = hoursUntilStart >= 1;
  const refundAmount = canCancel ? booking.totalCost : booking.totalCost * 0.5; // 50% refund for late cancellation

  // Update booking status
  const cancelledBooking = await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: { space: true }
  });

  // Process refund if applicable
  if (refundAmount > 0 && booking.payment) {
    try {
      // TODO: Implement refund processing with Stripe
      // const refundResult = await processRefund(booking.payment.stripePaymentId, refundAmount);
      
      // Update payment record
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: 'REFUNDED',
          refundAmount
        }
      });
    } catch (refundError) {
      console.error('Refund processing failed:', refundError);
      // Don't fail cancellation if refund fails - handle manually
    }
  }

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking: cancelledBooking,
      refundAmount,
      refundPolicy: canCancel ? 'Full refund' : '50% refund (late cancellation)'
    }
  });
}));

/**
 * POST /api/bookings/:id/start
 * Start parking session (mark as active)
 */
router.post('/:id/start', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      startTime: true,
      endTime: true,
      status: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== req.user.id) {
    throw new AppError('You can only start your own bookings', 403, 'UNAUTHORIZED');
  }

  if (booking.status !== 'CONFIRMED') {
    throw new AppError('Only confirmed bookings can be started', 400, 'INVALID_BOOKING_STATUS');
  }

  // Check if it's time to start (allow 15 minutes early)
  const now = new Date();
  const startTime = new Date(booking.startTime);
  const earlyStartAllowed = new Date(startTime.getTime() - 15 * 60 * 1000);

  if (now < earlyStartAllowed) {
    throw new AppError('Cannot start parking session more than 15 minutes early', 400, 'TOO_EARLY');
  }

  if (now > new Date(booking.endTime)) {
    throw new AppError('Booking has expired', 400, 'BOOKING_EXPIRED');
  }

  // Update booking status
  const activeBooking = await prisma.booking.update({
    where: { id },
    data: { status: 'ACTIVE' },
    include: {
      space: {
        select: {
          title: true,
          address: true,
          accessInstructions: true
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Parking session started successfully',
    data: { booking: activeBooking }
  });
}));

/**
 * POST /api/bookings/:id/stop
 * Stop parking session (mark as completed)
 */
router.post('/:id/stop', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      endTime: true,
      status: true
    }
  });

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userId !== req.user.id) {
    throw new AppError('You can only stop your own bookings', 403, 'UNAUTHORIZED');
  }

  if (booking.status !== 'ACTIVE') {
    throw new AppError('Only active bookings can be stopped', 400, 'INVALID_BOOKING_STATUS');
  }

  // Update booking status
  const completedBooking = await prisma.booking.update({
    where: { id },
    data: { status: 'COMPLETED' },
    include: {
      space: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Parking session completed successfully',
    data: { booking: completedBooking }
  });
}));

module.exports = router;
