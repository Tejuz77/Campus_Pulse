const express = require('express');
const router = express.Router();
const { z } = require('zod');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const incidentService = require('../services/incidentService');
const auditService = require('../services/auditService');
const storage = require('../services/storageService');
const rateLimit = require('express-rate-limit');

// Rate limit: 5 reports per hour per student
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.REPORTS_PER_HOUR || '5'),
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Report limit exceeded. You can submit up to 5 reports per hour.' },
  skip: (req) => req.user?.role !== 'STUDENT',
});

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Only JPG, PNG, and WebP images are allowed', 400));
  },
});

const reportSchema = z.object({
  categoryId: z.string().min(1),
  locationId: z.string().min(1),
  systemNumber: z.coerce.number().int().positive().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  idempotencyKey: z.string().min(1).max(64),
  linkToIncidentId: z.string().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// POST /api/reports
router.post(
  '/',
  authenticate,
  requireRole('STUDENT'),
  reportLimiter,
  upload.array('attachments', 3),
  async (req, res, next) => {
    try {
      const data = reportSchema.parse(
        typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body
      );

      const { report, incident, created } = await incidentService.createReportFull(data, req.user.id);

      // Handle attachments
      if (req.files && req.files.length > 0 && created) {
        for (const file of req.files) {
          // Magic byte check
          const validMagic = checkMagicBytes(file.buffer, file.mimetype);
          if (!validMagic) continue;

          const ext = file.originalname.split('.').pop();
          const { filePath } = await storage.save(file.buffer, file.mimetype, ext);

          await prisma.attachment.create({
            data: {
              reportId: report.id,
              incidentId: incident.id,
              filePath,
              mime: file.mimetype,
              size: file.size,
              uploadedBy: req.user.id,
              kind: 'evidence',
            },
          });
        }
      }

      // Auto-assign if new incident
      if (created && incident.departmentId) {
        await incidentService.autoAssign(incident.id, incident.departmentId, req.user.id);
      }

      // Lazy escalation check
      incidentService.runEscalationCheck().catch(() => {});

      const fullReport = await prisma.report.findUnique({
        where: { id: report.id },
        include: {
          incident: { include: { department: true, category: true, location: true } },
          category: true,
          location: true,
          attachments: true,
        },
      });

      res.status(created ? 201 : 200).json({ report: fullReport, created });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports – student sees own; admin/staff see filtered
router.get('/', authenticate, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, pageSize, status, categoryId, locationId, priority, search, dateFrom, dateTo } = req.query;
    const skip = (page - 1) * pageSize;

    const where = {};

    if (req.user.role === 'STUDENT') {
      where.reporterId = req.user.id;
    } else if (req.user.role === 'STAFF') {
      where.incident = { departmentId: req.user.departmentId };
    }
    // ADMIN: no extra filter

    if (status) where.incident = { ...where.incident, status };
    if (categoryId) where.categoryId = categoryId;
    if (locationId) where.locationId = locationId;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          incident: { include: { department: true, category: true, location: true, assignments: { include: { assignee: { select: { id: true, name: true } } }, orderBy: { assignedAt: 'desc' }, take: 1 } } },
          category: true,
          location: true,
          reporter: req.user.role !== 'STUDENT'
            ? { select: { id: true, name: true, rollNo: true, email: true } }
            : false,
          attachments: { select: { id: true, mime: true, kind: true, filePath: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({ reports, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:ticketNumber
router.get('/:ticketNumber', authenticate, async (req, res, next) => {
  try {
    const report = await prisma.report.findUnique({
      where: { ticketNumber: req.params.ticketNumber },
      include: {
        incident: {
          include: {
            department: true,
            category: true,
            location: true,
            issueUpdates: {
              include: { updater: { select: { id: true, name: true, role: true } } },
              orderBy: { createdAt: 'asc' },
            },
            assignments: {
              include: {
                assignee: { select: { id: true, name: true } },
                assigner: { select: { id: true, name: true } },
              },
              orderBy: { assignedAt: 'desc' },
            },
            feedbacks: { include: { reporter: { select: { name: true } } } },
          },
        },
        category: true,
        location: true,
        attachments: true,
        reporter: req.user.role !== 'STUDENT'
          ? { select: { id: true, name: true, rollNo: true, email: true } }
          : { select: { id: true, name: true } },
      },
    });

    if (!report) throw new AppError('Report not found', 404);

    // Students can only see their own
    if (req.user.role === 'STUDENT' && report.reporterId !== req.user.id) {
      throw new AppError('Not found', 404);
    }

    // Staff can only see their dept
    if (req.user.role === 'STAFF' && report.incident.departmentId !== req.user.departmentId) {
      throw new AppError('Not found', 404);
    }

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/confirm – reporter confirms resolution
router.post('/:id/confirm', authenticate, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { incident: true } });
    if (!report || report.reporterId !== req.user.id) throw new AppError('Not found', 404);

    if (report.incident.status !== 'AWAITING_CONFIRMATION') {
      throw new AppError('Ticket is not awaiting confirmation', 400);
    }

    await incidentService.transitionStatus(
      report.incident.id,
      'RESOLVED',
      req.user.id,
      'ADMIN', // allowed to resolve via confirm
      'Reporter confirmed resolution'
    );

    res.json({ message: 'Resolution confirmed. Thank you!' });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/dispute – reporter disputes resolution
router.post('/:id/dispute', authenticate, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.length < 5) throw new AppError('Reason required (min 5 chars)', 400);

    const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { incident: true } });
    if (!report || report.reporterId !== req.user.id) throw new AppError('Not found', 404);

    if (report.incident.status !== 'AWAITING_CONFIRMATION') {
      throw new AppError('Ticket is not awaiting confirmation', 400);
    }

    await incidentService.transitionStatus(
      report.incident.id,
      'REOPENED',
      req.user.id,
      'ADMIN',
      `Disputed: ${reason}`
    );

    res.json({ message: 'Dispute registered. The team will review.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/reopen
router.post('/:id/reopen', authenticate, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { incident: true } });
    if (!report || report.reporterId !== req.user.id) throw new AppError('Not found', 404);

    if (report.incident.status !== 'RESOLVED') {
      throw new AppError('Can only reopen resolved tickets', 400);
    }

    // Check 7-day window
    const resolvedAt = report.incident.closedAt || report.incident.createdAt;
    const daysSince = (Date.now() - new Date(resolvedAt)) / (1000 * 60 * 60 * 24);
    const window = parseInt(process.env.REOPEN_WINDOW_DAYS || '7');

    if (daysSince > window) {
      throw new AppError(`Cannot reopen after ${window} days. Please submit a new report.`, 400);
    }

    await incidentService.transitionStatus(
      report.incident.id,
      'REOPENED',
      req.user.id,
      'ADMIN',
      reason || 'Reopened by reporter'
    );

    res.json({ message: 'Ticket reopened.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/reports/:id/feedback
router.post('/:id/feedback', authenticate, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const ratingNum = parseInt(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) throw new AppError('Rating must be 1-5', 400);

    const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { incident: true } });
    if (!report || report.reporterId !== req.user.id) throw new AppError('Not found', 404);

    if (report.incident.status !== 'RESOLVED') {
      throw new AppError('Can only give feedback on resolved tickets', 400);
    }

    const feedback = await prisma.feedback.upsert({
      where: { incidentId_reporterId: { incidentId: report.incidentId, reporterId: req.user.id } },
      update: { rating: ratingNum, comment },
      create: { incidentId: report.incidentId, reporterId: req.user.id, rating: ratingNum, comment },
    });

    res.json({ feedback });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/similar?categoryId=&locationId=
router.get('/check/similar', authenticate, async (req, res, next) => {
  try {
    const { categoryId, locationId, systemNumber } = req.query;
    if (!categoryId || !locationId) return res.json({ incidents: [] });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const where = {
      categoryId,
      status: { notIn: ['RESOLVED', 'REJECTED'] },
      createdAt: { gte: sevenDaysAgo },
      OR: [
        { locationId },
      ],
    };

    const incidents = await prisma.incident.findMany({
      where,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { name: true } },
        location: { select: { name: true, block: true } },
        reports: { select: { ticketNumber: true }, take: 1 },
      },
    });

    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

function checkMagicBytes(buffer, mime) {
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8;
  }
  if (mime === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mime === 'image/webp') {
    return buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';
  }
  return false;
}

module.exports = router;
