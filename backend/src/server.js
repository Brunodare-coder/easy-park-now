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
const councilSpacesRoutes = require('./routes/councilSpaces');
/* const adminRoutes = require('./routes/admin'); */

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
/* app.use('/api/users', authMiddleware, userRoutes); */
app.use('/api/spaces', spaceRoutes);
app.use('/api/bookings', authMiddleware, bookingRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/council-spaces', councilSpacesRoutes);
app.use('/api/error-logs', require('./routes/errorLogs'));
/* app.use('/api/admin', authMiddleware, adminRoutes); */

// Stripe webhook handler (must be before other payment routes to handle raw body)
const stripeWebhookHandler = require('./routes/stripeWebhook');
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start server
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

module.exports = app;
