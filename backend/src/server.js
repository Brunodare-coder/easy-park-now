/**
 * EasyParkNow Backend Server
 * 
 * This is the main entry point for the EasyParkNow backend API server.
 * It sets up Express.js with all necessary middleware, routes, and error handling.
 * 
 * Key Features:
 * - RESTful API endpoints for parking space booking
 * - JWT-based authentication
 * - Stripe payment integration
 * - File upload handling with AWS S3
 * - Email notifications
 * - Rate limiting and security middleware
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import custom middleware and routes
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
/* const userRoutes = require('./routes/users'); */
const spaceRoutes = require('./routes/spaces');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - allows frontend to communicate with backend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware - reduces response size
app.use(compression());

// Request logging middleware - logs all HTTP requests
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Rate limiting - prevents abuse by limiting requests per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all requests
app.use('/api/', limiter);

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Health check endpoint - useful for monitoring and load balancers
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
// All API routes are prefixed with /api for better organization
app.use('/api/auth', authLimiter, authRoutes);
/* app.use('/api/users', authMiddleware, userRoutes); */
app.use('/api/spaces', spaceRoutes);
app.use('/api/bookings', authMiddleware, bookingRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Stripe webhook endpoint (must be before body parsing middleware)
// This endpoint receives webhook events from Stripe for payment processing
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), paymentRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
// This catches all errors and sends a consistent error response
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
app.listen(PORT, () => {
  console.log(`
🚀 EasyParkNow Backend Server Started!
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Server running on port ${PORT}
📊 Health check: http://localhost:${PORT}/health
📚 API base URL: http://localhost:${PORT}/api
⏰ Started at: ${new Date().toISOString()}
  `);
});

// Export app for testing purposes
module.exports = app;
