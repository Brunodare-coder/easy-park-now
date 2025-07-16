/**
 * Error Logs Routes
 * 
 * This module handles error logging and retrieval for admin dashboard.
 * It provides endpoints for logging client-side errors and retrieving error statistics.
 * 
 * Features:
 * - Client-side error logging
 * - Error statistics and analytics
 * - Error filtering and search
 * - AI-powered error summarization (optional)
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Log client-side error
 * POST /api/error-logs
 */
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const {
    message,
    stack,
    url,
    userAgent,
    timestamp,
    severity = 'error',
    metadata = {}
  } = req.body;

  // Validate required fields
  if (!message) {
    throw new AppError('Error message is required', 400, 'VALIDATION_ERROR');
  }

  // Create error log entry
  const errorLog = await prisma.errorLog.create({
    data: {
      message,
      stack,
      url,
      userAgent,
      severity,
      metadata: JSON.stringify(metadata),
      userId: req.user?.id,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      resolved: false
    }
  });

  console.error('Client-side error logged:', {
    id: errorLog.id,
    message,
    userId: req.user?.id,
    url,
    timestamp: errorLog.timestamp
  });

  res.status(201).json({
    success: true,
    message: 'Error logged successfully',
    data: {
      id: errorLog.id,
      timestamp: errorLog.timestamp
    }
  });
}));

/**
 * Get error logs (Admin only)
 * GET /api/error-logs
 */
router.get('/', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    severity,
    resolved,
    startDate,
    endDate,
    search
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Build where clause
  const where = {};

  if (severity) {
    where.severity = severity;
  }

  if (resolved !== undefined) {
    where.resolved = resolved === 'true';
  }

  if (startDate && endDate) {
    where.timestamp = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  if (search) {
    where.OR = [
      { message: { contains: search, mode: 'insensitive' } },
      { url: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Get error logs with pagination
  const [errorLogs, totalCount] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      skip,
      take,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    }),
    prisma.errorLog.count({ where })
  ]);

  // Parse metadata for each log
  const processedLogs = errorLogs.map(log => ({
    ...log,
    metadata: log.metadata ? JSON.parse(log.metadata) : {}
  }));

  res.json({
    success: true,
    data: {
      errorLogs: processedLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    }
  });
}));

/**
 * Get error statistics (Admin only)
 * GET /api/error-logs/stats
 */
router.get('/stats', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const [
    totalErrors,
    errorsBySeverity,
    errorsByDay,
    topErrors,
    resolvedCount
  ] = await Promise.all([
    // Total errors in period
    prisma.errorLog.count({
      where: {
        timestamp: { gte: startDate }
      }
    }),

    // Errors by severity
    prisma.errorLog.groupBy({
      by: ['severity'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: true
    }),

    // Errors by day
    prisma.$queryRaw`
      SELECT DATE(timestamp) as date, COUNT(*) as count
      FROM ErrorLog
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `,

    // Top error messages
    prisma.errorLog.groupBy({
      by: ['message'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: true,
      orderBy: {
        _count: {
          message: 'desc'
        }
      },
      take: 10
    }),

    // Resolved errors count
    prisma.errorLog.count({
      where: {
        timestamp: { gte: startDate },
        resolved: true
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      totalErrors,
      resolvedCount,
      unresolvedCount: totalErrors - resolvedCount,
      errorsBySeverity: errorsBySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {}),
      errorsByDay,
      topErrors: topErrors.map(item => ({
        message: item.message,
        count: item._count
      })),
      period: `${days} days`
    }
  });
}));

/**
 * Mark error as resolved (Admin only)
 * PATCH /api/error-logs/:id/resolve
 */
router.patch('/:id/resolve', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolved = true, notes } = req.body;

  const errorLog = await prisma.errorLog.update({
    where: { id },
    data: {
      resolved,
      resolvedAt: resolved ? new Date() : null,
      resolvedBy: resolved ? req.user.id : null,
      resolutionNotes: notes
    }
  });

  res.json({
    success: true,
    message: `Error ${resolved ? 'marked as resolved' : 'reopened'}`,
    data: errorLog
  });
}));

/**
 * AI-powered error summary (Admin only)
 * POST /api/error-logs/ai-summary
 */
router.post('/ai-summary', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { days = 7, limit = 100 } = req.body;
  
  // Check if AI integration is enabled
  if (!process.env.OPENROUTER_API_KEY) {
    throw new AppError('AI integration not configured', 400, 'AI_NOT_CONFIGURED');
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  // Get recent error logs
  const errorLogs = await prisma.errorLog.findMany({
    where: {
      timestamp: { gte: startDate },
      resolved: false
    },
    take: parseInt(limit),
    orderBy: { timestamp: 'desc' },
    select: {
      message,
      severity,
      url,
      timestamp,
      metadata: true
    }
  });

  if (errorLogs.length === 0) {
    return res.json({
      success: true,
      data: {
        summary: 'No unresolved errors found in the specified period.',
        errorCount: 0,
        period: `${days} days`
      }
    });
  }

  // Prepare data for AI analysis
  const errorData = errorLogs.map(log => ({
    message: log.message,
    severity: log.severity,
    url: log.url,
    timestamp: log.timestamp.toISOString(),
    metadata: log.metadata ? JSON.parse(log.metadata) : {}
  }));

  try {
    // Call OpenRouter API for error analysis
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'EasyParkNow Error Analysis'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert software engineer analyzing error logs for a parking booking platform called EasyParkNow. 

Your task is to:
1. Analyze the provided error logs
2. Identify patterns and common issues
3. Categorize errors by severity and type
4. Provide actionable recommendations for fixes
5. Highlight any critical issues that need immediate attention

Please provide a comprehensive summary in JSON format with the following structure:
{
  "summary": "Brief overview of the error analysis",
  "criticalIssues": ["List of critical issues requiring immediate attention"],
  "commonPatterns": ["List of common error patterns identified"],
  "recommendations": ["List of actionable recommendations"],
  "errorCategories": {
    "frontend": number,
    "backend": number,
    "database": number,
    "payment": number,
    "authentication": number,
    "other": number
  },
  "severityBreakdown": {
    "critical": number,
    "error": number,
    "warning": number,
    "info": number
  }
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze the following error logs from the past ${days} days and provide insights:`
              },
              {
                type: 'text',
                text: JSON.stringify(errorData, null, 2)
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.statusText}`);
    }

    const aiResponse = await response.json();
    const aiSummary = aiResponse.choices[0]?.message?.content;

    if (!aiSummary) {
      throw new Error('No response from AI service');
    }

    // Try to parse JSON response
    let parsedSummary;
    try {
      parsedSummary = JSON.parse(aiSummary);
    } catch (parseError) {
      // If JSON parsing fails, return raw text
      parsedSummary = {
        summary: aiSummary,
        note: 'AI response was not in expected JSON format'
      };
    }

    res.json({
      success: true,
      data: {
        ...parsedSummary,
        errorCount: errorLogs.length,
        period: `${days} days`,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AI summary generation error:', error);
    throw new AppError('Failed to generate AI summary', 500, 'AI_SUMMARY_ERROR');
  }
}));

/**
 * Delete old error logs (Admin only)
 * DELETE /api/error-logs/cleanup
 */
router.delete('/cleanup', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { days = 30 } = req.body;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

  const deletedCount = await prisma.errorLog.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
      resolved: true
    }
  });

  res.json({
    success: true,
    message: `Cleaned up ${deletedCount.count} resolved error logs older than ${days} days`,
    data: {
      deletedCount: deletedCount.count,
      cutoffDate
    }
  });
}));

module.exports = router;
