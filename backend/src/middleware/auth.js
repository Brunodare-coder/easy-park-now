/**
 * Authentication Middleware
 * 
 * This middleware handles JWT token verification and user authentication.
 * It protects routes that require user authentication and adds user information
 * to the request object for use in route handlers.
 * 
 * Features:
 * - JWT token verification
 * - User role checking
 * - Token expiration handling
 * - Error handling for invalid tokens
 */

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Main authentication middleware
 * Verifies JWT token and adds user info to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isEmailVerified: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Account is deactivated.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Add user info to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);

    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required role(s)
 * 
 * @param {string|string[]} roles - Required role(s)
 * @returns {Function} Middleware function
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated first
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'AUTH_REQUIRED'
        });
      }

      // Convert single role to array for consistent handling
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      
      // Check if user has any of the required roles
      if (!requiredRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: requiredRoles,
          current: req.user.role
        });
      }

      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during authorization.',
        code: 'AUTH_ERROR'
      });
    }
  };
};

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return next(); // No token, continue without user info
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return next(); // No token, continue without user info
    }

    // Verify token and get user info
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true
      }
    });

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // If token is invalid, continue without user info
    next();
  }
};

/**
 * Admin-only middleware
 * Shorthand for requiring ADMIN role
 */
const requireAdmin = requireRole('ADMIN');

/**
 * Host or Admin middleware
 * Allows both HOST and ADMIN roles
 */
const requireHostOrAdmin = requireRole(['HOST', 'ADMIN']);

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth,
  requireAdmin,
  requireHostOrAdmin
};
