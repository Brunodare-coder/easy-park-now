/**
 * Global Error Handler Middleware
 * 
 * This middleware catches all errors in the application and provides
 * consistent error responses. It handles different types of errors
 * including validation errors, database errors, and custom application errors.
 * 
 * Features:
 * - Consistent error response format
 * - Different handling for development vs production
 * - Logging of errors for debugging
 * - Security - doesn't expose sensitive information in production
 */

const { Prisma } = require('@prisma/client');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * This function handles all errors that occur in the application
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Prisma/Database errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    error = new AppError('Invalid data provided', 400, 'VALIDATION_ERROR');
  }

  // JWT errors (handled in auth middleware, but just in case)
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Validation errors from Joi or other validators
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400, 'VALIDATION_ERROR');
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new AppError('File too large', 400, 'FILE_TOO_LARGE');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new AppError('Too many files uploaded', 400, 'TOO_MANY_FILES');
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const code = error.code || 'INTERNAL_ERROR';

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: message,
    code: code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    }),
    timestamp: new Date().toISOString()
  });
};

/**
 * Handle Prisma database errors
 * Converts Prisma errors to user-friendly messages
 */
const handlePrismaError = (err) => {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const field = err.meta?.target?.[0] || 'field';
      return new AppError(`${field} already exists`, 409, 'DUPLICATE_ENTRY');
    
    case 'P2025':
      // Record not found
      return new AppError('Record not found', 404, 'NOT_FOUND');
    
    case 'P2003':
      // Foreign key constraint violation
      return new AppError('Related record not found', 400, 'FOREIGN_KEY_ERROR');
    
    case 'P2014':
      // Required relation violation
      return new AppError('Required relation missing', 400, 'RELATION_ERROR');
    
    default:
      return new AppError('Database error occurred', 500, 'DATABASE_ERROR');
  }
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found handler
 * Handles requests to non-existent routes
 */
const notFound = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

module.exports = {
  errorHandler,
  AppError,
  asyncHandler,
  notFound
};
