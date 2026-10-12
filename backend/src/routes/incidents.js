const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const incidentService = require('../services/incidentService');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const multer = require('multer');
const storage = require('../services/storageService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Only images allowed', 400));
  },
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  locationId: z.string().optional(),
  priority: z.string().optional(),
  escalated: z.string().optional(),
  overdue: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  block: z.string().optional(),
});

// GET /api/incidents – filtered list
router.get('/', authenticate, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    // Lazy escalation check on dashboard load
    incidentService.runEscalationCheck().catch(() => {});

    const { page, pageSize, status, departmentId, categoryId, locationId, priority, escalated, overdue, search, dateFrom, dateTo, block } = req.query;
    const skip = (page - 1) * pageSize;

    const where = {};

    // Role-based filters
    if (req.user.role === 'STAFF') {
      where.departmentId = req.user.departmentId;
    } else if (req.user.role === 'STUDENT') {
      // Students only see their own incidents via reports
      const reports = await prisma.report.findMany({
        where: { reporterId: req.user.id },
        select: { incidentId: true },
      });
      where.id = { in: reports.map((r) => r.incidentId) };
    }

    if (status) where.status = status;
    if (departmentId && req.user.role === 'ADMIN') where.departmentId = departmentId;
    if (categoryId) where.categoryId = categoryId;
    if (locationId) where.locationId = locationId;
    if (priority) where.priority = priority;
    if (escalated === 'true') where.escalated = true;
    if (block) where.location = { block };

    if (overdue === 'true') {
      // Rough overdue: created > 48h ago and not resolved
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      where.createdAt = { lt: cutoff };
      where.status = { notIn: ['RESOLVED', 'REJECTED'] };
    }

    if (search) {
      where.OR = [
        { summary: { contains: search } },
        { reports: { some: { ticketNumber: { contains: search } } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = where.createdAt || {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          category: true,
          location: true,
          department: true,
          reports: { select: { ticketNumber: true, reporterId: true }, take: 1 },
          assignments: {
            include: { assignee: { select: { id: true, name: true } } },
            orderBy: { assignedAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.incident.count({ where }),
    ]);

    res.json({ incidents, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const incident = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        location: true,
        department: true,
        reports: {
          include: {
            reporter: { select: { id: true, name: true, rollNo: true } },
            attachments: true,
          },
        },
        assignments: {
          include: {
            assignee: { select: { id: true, name: true } },
            assigner: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        issueUpdates: {
          include: { updater: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        feedbacks: true,
        attachments: true,
      },
    });

    if (!incident) throw new AppError('Incident not found', 404);

    // Access control
    if (req.user.role === 'STUDENT') {
      const myReport = incident.reports.find((r) => r.reporterId === req.user.id);
      if (!myReport) throw new AppError('Not found', 404);
    }
    if (req.user.role === 'STAFF' && incident.departmentId !== req.user.departmentId) {
      throw new AppError('Not found', 404);
    }

    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/incidents/:id/status – staff/admin transition
router.patch('/:id/status', authenticate, requireRole('STAFF', 'ADMIN'), (req, res, next) => {
  // Only run multer if this is a multipart request
  if (req.is('multipart/form-data')) {
    return upload.array('attachments', 3)(req, res, next);
  }
  next();
}, async (req, res, next) => {
  try {
    const body = req.is('multipart/form-data')
      ? (typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body)
      : req.body;

    const { newStatus, note, version, holdReason, holdNextAction, holdReviewDate } = body;

    if (!newStatus) throw new AppError('newStatus required', 400);
    if (newStatus === 'AWAITING_CONFIRMATION' && !note) {
      throw new AppError('Resolution note required when marking Awaiting Confirmation', 400);
    }
    if (newStatus === 'ON_HOLD' && !holdReason) {
      throw new AppError('Hold reason required', 400);
    }

    const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) throw new AppError('Incident not found', 404);

    // Staff can only touch their department
    if (req.user.role === 'STAFF' && incident.departmentId !== req.user.departmentId) {
      throw new AppError('Not authorized', 403);
    }

    await incidentService.transitionStatus(
      req.params.id,
      newStatus,
      req.user.id,
      req.user.role,
      note,
      version
    );

    // Update hold fields if ON_HOLD
    if (newStatus === 'ON_HOLD') {
      await prisma.incident.update({
        where: { id: req.params.id },
        data: {
          holdReason: holdReason || null,
          holdNextAction: holdNextAction || null,
          holdReviewDate: holdReviewDate ? new Date(holdReviewDate) : null,
        },
      });
    }

    // Handle resolution attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = file.originalname.split('.').pop();
        const { filePath } = await storage.save(file.buffer, file.mimetype, ext);
        await prisma.attachment.create({
          data: {
            incidentId: req.params.id,
            filePath,
            mime: file.mimetype,
            size: file.size,
            uploadedBy: req.user.id,
            kind: 'resolution',
          },
        });
      }
    }

    await auditService.log(req.user.id, `STATUS_TRANSITION_${newStatus}`, 'Incident', req.params.id, { note });

    const updated = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: { department: true, category: true, location: true },
    });
    res.json({ incident: updated });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/incidents/:id/assign – reassign within dept or admin assigns anywhere
router.patch('/:id/assign', authenticate, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const { assignedTo, reason } = req.body;
    if (!assignedTo) throw new AppError('assignedTo required', 400);

    const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) throw new AppError('Incident not found', 404);

    if (req.user.role === 'STAFF' && incident.departmentId !== req.user.departmentId) {
      throw new AppError('Not authorized', 403);
    }

    const targetUser = await prisma.user.findUnique({ where: { id: assignedTo } });
    if (!targetUser || !targetUser.isActive) throw new AppError('Target user not found', 404);

    // Staff can only assign within their dept
    if (req.user.role === 'STAFF' && targetUser.departmentId !== req.user.departmentId) {
      throw new AppError('Can only assign to staff in your department', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.assignment.create({
        data: {
          incidentId: req.params.id,
          assignedTo,
          assignedBy: req.user.id,
          reason: reason || 'Manual reassignment',
        },
      });
      await tx.incident.update({
        where: { id: req.params.id },
        data: { status: 'ASSIGNED', version: { increment: 1 } },
      });
    });

    await notificationService.createNotification(
      assignedTo,
      `Incident reassigned to you`,
      `/staff/tickets/${req.params.id}`
    );

    await auditService.log(req.user.id, 'REASSIGN', 'Incident', req.params.id, { assignedTo, reason });

    res.json({ message: 'Reassigned' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/incidents/:id/transfer – staff/admin transfer to another department
router.patch('/:id/transfer', authenticate, requireRole('STAFF', 'ADMIN'), async (req, res, next) => {
  try {
    const { toDepartmentId, reason } = req.body;
    if (!toDepartmentId || !reason) throw new AppError('toDepartmentId and reason are required', 400);

    const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) throw new AppError('Incident not found', 404);

    if (req.user.role === 'STAFF' && incident.departmentId !== req.user.departmentId) {
      throw new AppError('Not authorized', 403);
    }

    const toDept = await prisma.department.findUnique({ where: { id: toDepartmentId } });
    if (!toDept || !toDept.isActive) throw new AppError('Target department not found', 404);

    const prevDeptId = incident.departmentId;

    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id: req.params.id },
        data: { departmentId: toDepartmentId, version: { increment: 1 } },
      });
      await tx.issueUpdate.create({
        data: {
          incidentId: req.params.id,
          updatedBy: req.user.id,
          note: `Transferred from department ${prevDeptId} to ${toDepartmentId}. Reason: ${reason}`,
        },
      });
    });

    // Auto-assign in new department
    await incidentService.autoAssign(req.params.id, toDepartmentId, req.user.id);
    await auditService.log(req.user.id, 'TRANSFER', 'Incident', req.params.id, { from: prevDeptId, to: toDepartmentId, reason });

    res.json({ message: 'Transferred' });
  } catch (err) {
    next(err);
  }
});

// GET /api/incidents/admin/unassigned
router.get('/admin/unassigned', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const incidents = await prisma.incident.findMany({
      where: { departmentId: null, status: { notIn: ['RESOLVED', 'REJECTED'] } },
      orderBy: { createdAt: 'asc' },
      include: { category: true, location: true, reports: { take: 1 } },
    });
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
