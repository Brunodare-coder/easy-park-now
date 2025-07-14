/**
 * Authentication Routes
 * 
 * This file handles all authentication-related endpoints including:
 * - User registration (sign up)
 * - User login
 * - Password reset
 * - Email verification
 * - Token refresh
 * 
 * All routes include proper validation, error handling, and security measures.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas using Joi
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required'
  }),
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'First name must be at least 2 characters long',
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Last name must be at least 2 characters long',
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required'
  }),
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number'
  }),
  role: Joi.string().valid('DRIVER', 'HOST').default('DRIVER')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required'
  })
});

/**
 * Helper function to generate JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Helper function to generate verification token
 */
const generateVerificationToken = () => {
  return jwt.sign(
    { purpose: 'email_verification', timestamp: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { email, password, firstName, lastName, phone, role } = value;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
  }

  // Hash password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isEmailVerified: true,
      createdAt: true
    }
  });

  // Generate tokens
  const authToken = generateToken(user.id, user.role);
  const verificationToken = generateVerificationToken();

  // Send verification email
  try {
    await sendEmail({
      to: user.email,
      subject: 'Welcome to EasyParkNow - Verify Your Email',
      template: 'welcome',
      data: {
        firstName: user.firstName,
        verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&userId=${user.id}`
      }
    });
  } catch (emailError) {
    console.error('Failed to send verification email:', emailError);
    // Don't fail registration if email fails
  }

  res.status(201).json({
    success: true,
    message: 'Account created successfully. Please check your email to verify your account.',
    data: {
      user,
      token: authToken
    }
  });
}));

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { email, password } = value;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      password: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      isEmailVerified: true
    }
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact support.', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate token
  const token = generateToken(user.id, user.role);

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: userWithoutPassword,
      token
    }
  });
}));

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = forgotPasswordSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { email } = value;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, firstName: true, isActive: true }
  });

  // Always return success to prevent email enumeration
  const successMessage = 'If an account with that email exists, we have sent a password reset link.';

  if (!user || !user.isActive) {
    return res.json({
      success: true,
      message: successMessage
    });
  }

  // Generate reset token
  const resetToken = jwt.sign(
    { userId: user.id, purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Send reset email
  try {
    await sendEmail({
      to: user.email,
      subject: 'EasyParkNow - Password Reset Request',
      template: 'password-reset',
      data: {
        firstName: user.firstName,
        resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      }
    });
  } catch (emailError) {
    console.error('Failed to send password reset email:', emailError);
    throw new AppError('Failed to send password reset email. Please try again.', 500, 'EMAIL_ERROR');
  }

  res.json({
    success: true,
    message: successMessage
  });
}));

/**
 * POST /api/auth/reset-password
 * Reset user password with token
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { token, password } = value;

  // Verify reset token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }

  if (decoded.purpose !== 'password_reset') {
    throw new AppError('Invalid reset token', 400, 'INVALID_TOKEN');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, isActive: true }
  });

  if (!user || !user.isActive) {
    throw new AppError('User not found or account is deactivated', 404, 'USER_NOT_FOUND');
  }

  // Hash new password
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  res.json({
    success: true,
    message: 'Password reset successfully. You can now login with your new password.'
  });
}));

/**
 * POST /api/auth/verify-email
 * Verify user email address
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token, userId } = req.body;

  if (!token || !userId) {
    throw new AppError('Verification token and user ID are required', 400, 'MISSING_PARAMETERS');
  }

  // Verify token
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtError) {
    throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
  }

  // Update user email verification status
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isEmailVerified: true
    }
  });

  res.json({
    success: true,
    message: 'Email verified successfully',
    data: { user }
  });
}));

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      profileImage: true,
      address: true,
      city: true,
      postcode: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: { user }
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authMiddleware, asyncHandler(async (req, res) => {
  // Generate new token
  const newToken = generateToken(req.user.id, req.user.role);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: { token: newToken }
  });
}));

module.exports = router;
