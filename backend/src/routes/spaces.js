/**
 * Parking Spaces Routes
 * 
 * This file handles all parking space-related endpoints including:
 * - Search and filter parking spaces
 * - Get space details
 * - Create new parking spaces (hosts)
 * - Update existing spaces
 * - Upload space images
 * - Manage space availability
 * 
 * Routes are protected based on user roles and ownership.
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const multer = require('multer');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authMiddleware, requireRole, optionalAuth } = require('../middleware/auth');
const { uploadToS3, deleteFromS3 } = require('../services/uploadService');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files are allowed', 400, 'INVALID_FILE_TYPE'), false);
    }
  }
});

// Validation schemas
const searchSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().optional(),
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).optional(),
  type: Joi.string().valid('DRIVEWAY', 'GARAGE', 'CAR_PARK', 'STREET_PARKING', 'COMMERCIAL_LOT').optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  hasEVCharging: Joi.boolean().optional(),
  isCovered: Joi.boolean().optional(),
  hasCCTV: Joi.boolean().optional(),
  has24Access: Joi.boolean().optional(),
  hasDisabledAccess: Joi.boolean().optional(),
  radius: Joi.number().min(0.1).max(50).default(5), // Search radius in km
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

const createSpaceSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().max(500).optional(),
  address: Joi.string().required(),
  city: Joi.string().required(),
  postcode: Joi.string().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  type: Joi.string().valid('DRIVEWAY', 'GARAGE', 'CAR_PARK', 'STREET_PARKING', 'COMMERCIAL_LOT').required(),
  price: Joi.number().min(0.5).max(50).required(),
  maxHeight: Joi.number().min(1).max(5).optional(),
  maxWidth: Joi.number().min(1).max(5).optional(),
  maxLength: Joi.number().min(2).max(15).optional(),
  isCovered: Joi.boolean().default(false),
  hasEVCharging: Joi.boolean().default(false),
  hasCCTV: Joi.boolean().default(false),
  has24Access: Joi.boolean().default(false),
  hasDisabledAccess: Joi.boolean().default(false),
  accessInstructions: Joi.string().max(1000).optional()
});

const updateSpaceSchema = createSpaceSchema.fork(['latitude', 'longitude'], (schema) => schema.optional());

const availabilitySchema = Joi.object({
  schedule: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(), // 0 = Sunday
      startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(), // HH:MM format
      endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      isActive: Joi.boolean().default(true)
    })
  ).min(1).required()
});

/**
 * GET /api/spaces/search
 * Search for available parking spaces with filters
 */
router.get('/search', optionalAuth, asyncHandler(async (req, res) => {
  // Validate query parameters
  const { error, value } = searchSchema.validate(req.query);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const {
    latitude,
    longitude,
    address,
    startTime,
    endTime,
    type,
    minPrice,
    maxPrice,
    hasEVCharging,
    isCovered,
    hasCCTV,
    has24Access,
    hasDisabledAccess,
    radius,
    page,
    limit
  } = value;

  // Build search filters
  const where = {
    isActive: true,
    ...(type && { type }),
    ...(minPrice !== undefined && { price: { gte: minPrice } }),
    ...(maxPrice !== undefined && { price: { ...where.price, lte: maxPrice } }),
    ...(hasEVCharging !== undefined && { hasEVCharging }),
    ...(isCovered !== undefined && { isCovered }),
    ...(hasCCTV !== undefined && { hasCCTV }),
    ...(has24Access !== undefined && { has24Access }),
    ...(hasDisabledAccess !== undefined && { hasDisabledAccess })
  };

  // Add location-based search if coordinates provided
  if (latitude && longitude) {
    // Use Haversine formula for distance calculation
    // This is a simplified version - in production, consider using PostGIS
    const latRad = latitude * Math.PI / 180;
    const lonRad = longitude * Math.PI / 180;
    const deltaLat = radius / 111.32; // Approximate km per degree latitude
    const deltaLon = radius / (111.32 * Math.cos(latRad)); // Adjust for longitude

    where.latitude = {
      gte: latitude - deltaLat,
      lte: latitude + deltaLat
    };
    where.longitude = {
      gte: longitude - deltaLon,
      lte: longitude + deltaLon
    };
  }

  // Add text search for address if provided
  if (address) {
    where.OR = [
      { address: { contains: address, mode: 'insensitive' } },
      { city: { contains: address, mode: 'insensitive' } },
      { postcode: { contains: address, mode: 'insensitive' } }
    ];
  }

  // Check availability if time range provided
  if (startTime && endTime) {
    // Find spaces that don't have conflicting bookings
    where.bookings = {
      none: {
        AND: [
          { status: { in: ['CONFIRMED', 'ACTIVE'] } },
          {
            OR: [
              {
                AND: [
                  { startTime: { lte: new Date(startTime) } },
                  { endTime: { gt: new Date(startTime) } }
                ]
              },
              {
                AND: [
                  { startTime: { lt: new Date(endTime) } },
                  { endTime: { gte: new Date(endTime) } }
                ]
              },
              {
                AND: [
                  { startTime: { gte: new Date(startTime) } },
                  { endTime: { lte: new Date(endTime) } }
                ]
              }
            ]
          }
        ]
      }
    };
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get spaces with related data
  const [spaces, totalCount] = await Promise.all([
    prisma.parkingSpace.findMany({
      where,
      include: {
        images: {
          orderBy: { order: 'asc' },
          take: 3 // Limit images for search results
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        reviews: {
          select: {
            rating: true
          }
        },
        _count: {
          select: {
            reviews: true,
            bookings: true
          }
        }
      },
      skip,
      take: limit,
      orderBy: [
        // If location provided, we could add distance ordering here
        { createdAt: 'desc' }
      ]
    }),
    prisma.parkingSpace.count({ where })
  ]);

  // Calculate average ratings and add distance if coordinates provided
  const spacesWithMetadata = spaces.map(space => {
    const avgRating = space.reviews.length > 0
      ? space.reviews.reduce((sum, review) => sum + review.rating, 0) / space.reviews.length
      : 0;

    let distance = null;
    if (latitude && longitude) {
      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (space.latitude - latitude) * Math.PI / 180;
      const dLon = (space.longitude - longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(latitude * Math.PI / 180) * Math.cos(space.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance = R * c;
    }

    return {
      ...space,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: space._count.reviews,
      bookingCount: space._count.bookings,
      ...(distance !== null && { distance: Math.round(distance * 100) / 100 })
    };
  });

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  res.json({
    success: true,
    data: {
      spaces: spacesWithMetadata,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit
      },
      filters: {
        ...(latitude && longitude && { center: { latitude, longitude } }),
        radius,
        ...(type && { type }),
        ...(minPrice !== undefined && { minPrice }),
        ...(maxPrice !== undefined && { maxPrice })
      }
    }
  });
}));

/**
 * GET /api/spaces/:id
 * Get detailed information about a specific parking space
 */
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const space = await prisma.parkingSpace.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { order: 'asc' }
      },
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          createdAt: true
        }
      },
      reviews: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImage: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limit recent reviews
      },
      availability: {
        where: { isActive: true },
        orderBy: { dayOfWeek: 'asc' }
      },
      _count: {
        select: {
          reviews: true,
          bookings: true
        }
      }
    }
  });

  if (!space) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (!space.isActive) {
    throw new AppError('Parking space is not available', 404, 'SPACE_INACTIVE');
  }

  // Calculate average rating
  const avgRating = space.reviews.length > 0
    ? space.reviews.reduce((sum, review) => sum + review.rating, 0) / space.reviews.length
    : 0;

  // Check if current user is the owner
  const isOwner = req.user && req.user.id === space.ownerId;

  res.json({
    success: true,
    data: {
      space: {
        ...space,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: space._count.reviews,
        bookingCount: space._count.bookings,
        isOwner
      }
    }
  });
}));

/**
 * POST /api/spaces
 * Create a new parking space (hosts only)
 */
router.post('/', authMiddleware, requireRole(['HOST', 'ADMIN']), asyncHandler(async (req, res) => {
  // Validate request body
  const { error, value } = createSpaceSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  // Create parking space
  const space = await prisma.parkingSpace.create({
    data: {
      ...value,
      ownerId: req.user.id
    },
    include: {
      images: true,
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    }
  });

  res.status(201).json({
    success: true,
    message: 'Parking space created successfully',
    data: { space }
  });
}));

/**
 * PUT /api/spaces/:id
 * Update an existing parking space (owner only)
 */
router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if space exists and user is owner or admin
  const existingSpace = await prisma.parkingSpace.findUnique({
    where: { id },
    select: { id: true, ownerId: true }
  });

  if (!existingSpace) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (existingSpace.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new AppError('You can only update your own parking spaces', 403, 'UNAUTHORIZED');
  }

  // Validate request body
  const { error, value } = updateSpaceSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  // Update space
  const updatedSpace = await prisma.parkingSpace.update({
    where: { id },
    data: value,
    include: {
      images: true,
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    }
  });

  res.json({
    success: true,
    message: 'Parking space updated successfully',
    data: { space: updatedSpace }
  });
}));

/**
 * DELETE /api/spaces/:id
 * Delete a parking space (owner only)
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if space exists and user is owner or admin
  const existingSpace = await prisma.parkingSpace.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
    include: {
      bookings: {
        where: {
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startTime: { gt: new Date() }
        }
      }
    }
  });

  if (!existingSpace) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (existingSpace.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new AppError('You can only delete your own parking spaces', 403, 'UNAUTHORIZED');
  }

  // Check for active bookings
  if (existingSpace.bookings.length > 0) {
    throw new AppError('Cannot delete space with active or future bookings', 400, 'HAS_ACTIVE_BOOKINGS');
  }

  // Soft delete by setting isActive to false
  await prisma.parkingSpace.update({
    where: { id },
    data: { isActive: false }
  });

  res.json({
    success: true,
    message: 'Parking space deleted successfully'
  });
}));

/**
 * POST /api/spaces/:id/images
 * Upload images for a parking space
 */
router.post('/:id/images', authMiddleware, upload.array('images', 10), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if space exists and user is owner
  const space = await prisma.parkingSpace.findUnique({
    where: { id },
    select: { id: true, ownerId: true }
  });

  if (!space) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (space.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new AppError('You can only upload images to your own parking spaces', 403, 'UNAUTHORIZED');
  }

  if (!req.files || req.files.length === 0) {
    throw new AppError('No images provided', 400, 'NO_FILES');
  }

  // Upload images to S3 and create database records
  const imagePromises = req.files.map(async (file, index) => {
    const uploadResult = await uploadToS3(file, 'parking-spaces');
    
    return prisma.spaceImage.create({
      data: {
        spaceId: id,
        url: uploadResult.url,
        caption: req.body.captions?.[index] || null,
        order: index
      }
    });
  });

  const images = await Promise.all(imagePromises);

  res.status(201).json({
    success: true,
    message: 'Images uploaded successfully',
    data: { images }
  });
}));

/**
 * DELETE /api/spaces/:spaceId/images/:imageId
 * Delete a specific image from a parking space
 */
router.delete('/:spaceId/images/:imageId', authMiddleware, asyncHandler(async (req, res) => {
  const { spaceId, imageId } = req.params;

  // Check if space exists and user is owner
  const space = await prisma.parkingSpace.findUnique({
    where: { id: spaceId },
    select: { id: true, ownerId: true }
  });

  if (!space) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (space.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new AppError('You can only delete images from your own parking spaces', 403, 'UNAUTHORIZED');
  }

  // Get image details
  const image = await prisma.spaceImage.findUnique({
    where: { id: imageId },
    select: { id: true, url: true, spaceId: true }
  });

  if (!image || image.spaceId !== spaceId) {
    throw new AppError('Image not found', 404, 'IMAGE_NOT_FOUND');
  }

  // Delete from S3 and database
  await Promise.all([
    deleteFromS3(image.url),
    prisma.spaceImage.delete({ where: { id: imageId } })
  ]);

  res.json({
    success: true,
    message: 'Image deleted successfully'
  });
}));

/**
 * PUT /api/spaces/:id/availability
 * Update availability schedule for a parking space
 */
router.put('/:id/availability', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if space exists and user is owner
  const space = await prisma.parkingSpace.findUnique({
    where: { id },
    select: { id: true, ownerId: true }
  });

  if (!space) {
    throw new AppError('Parking space not found', 404, 'SPACE_NOT_FOUND');
  }

  if (space.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
    throw new AppError('You can only update availability for your own parking spaces', 403, 'UNAUTHORIZED');
  }

  // Validate request body
  const { error, value } = availabilitySchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  // Delete existing availability and create new ones
  await prisma.availability.deleteMany({
    where: { spaceId: id }
  });

  const availabilityRecords = await prisma.availability.createMany({
    data: value.schedule.map(slot => ({
      spaceId: id,
      ...slot
    }))
  });

  // Get updated availability
  const updatedAvailability = await prisma.availability.findMany({
    where: { spaceId: id, isActive: true },
    orderBy: { dayOfWeek: 'asc' }
  });

  res.json({
    success: true,
    message: 'Availability updated successfully',
    data: { availability: updatedAvailability }
  });
}));

module.exports = router;
