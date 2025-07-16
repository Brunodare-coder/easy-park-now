/**
 * Council Parking Spaces Routes
 * 
 * This file handles endpoints for council parking spaces:
 * - Search council spaces by street or area
 * - Validate council code
 * - Generate QR code with price info
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const QRCode = require('qrcode');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const searchSchema = Joi.object({
  street: Joi.string().optional(),
  area: Joi.string().optional(),
  activeOnly: Joi.boolean().default(true),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

const codeValidationSchema = Joi.object({
  code: Joi.string().required()
});

/**
 * GET /api/council-spaces/search
 * Search council parking spaces by street or area
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { error, value } = searchSchema.validate(req.query);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { street, area, activeOnly, page, limit } = value;

  const where = {};
  if (street) {
    where.street = { contains: street, mode: 'insensitive' };
  }
  if (area) {
    where.area = { contains: area, mode: 'insensitive' };
  }
  if (activeOnly) {
    where.isActive = true;
  }

  const skip = (page - 1) * limit;

  const [spaces, totalCount] = await Promise.all([
    prisma.councilParkingSpace.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.councilParkingSpace.count({ where })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  res.json({
    success: true,
    data: {
      spaces,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    }
  });
}));

/**
 * POST /api/council-spaces/validate-code
 * Validate council parking code and generate QR code with price info
 */
router.post('/validate-code', asyncHandler(async (req, res) => {
  const { error, value } = codeValidationSchema.validate(req.body);
  if (error) {
    throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
  }

  const { code } = value;

  // Find council parking space by code
  const space = await prisma.councilParkingSpace.findUnique({
    where: { code }
  });

  if (!space || !space.isActive) {
    throw new AppError('Invalid or inactive council parking code', 404, 'CODE_NOT_FOUND');
  }

  // Generate QR code data URL with price info and code
  const qrData = JSON.stringify({
    code: space.code,
    street: space.street,
    area: space.area,
    pricePerHour: space.pricePerHour
  });

  const qrCodeUrl = await QRCode.toDataURL(qrData);

  res.json({
    success: true,
    data: {
      space: {
        id: space.id,
        street: space.street,
        area: space.area,
        pricePerHour: space.pricePerHour
      },
      qrCodeUrl
    }
  });
}));

module.exports = router;
