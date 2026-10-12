const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, validateQuery } = require('../middleware/validate');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const locationSchema = z.object({
  block: z.string().max(20).optional(),
  floor: z.coerce.number().int().optional().nullable(),
  name: z.string().min(1).max(200),
  type: z.enum(['classroom', 'lab', 'washroom', 'corridor', 'other']),
  systemCount: z.coerce.number().int().positive().optional().nullable(),
  ownerDepartmentId: z.string().optional().nullable(),
  status: z.enum(['approved', 'pending', 'rejected']).default('approved'),
});

const proposeSchema = z.object({
  block: z.string().max(20).optional(),
  floor: z.coerce.number().int().optional().nullable(),
  name: z.string().min(1).max(200),
  type: z.enum(['classroom', 'lab', 'washroom', 'corridor', 'other']),
});

const listQuerySchema = z.object({
  block: z.string().optional(),
  floor: z.coerce.number().int().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  isActive: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

// GET /api/locations
router.get('/', authenticate, validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { block, floor, type, status, search, isActive, page, pageSize } = req.query;
    const where = {};

    if (req.user.role !== 'ADMIN') {
      where.status = 'approved';
      where.isActive = true;
    } else {
      if (status) where.status = status;
      if (isActive !== undefined) where.isActive = isActive === 'true';
    }

    if (block) where.block = block;
    if (floor !== undefined) where.floor = floor;
    if (type) where.type = type;
    if (search) where.name = { contains: search };

    const skip = (page - 1) * pageSize;
    const [locations, total] = await Promise.all([
      prisma.location.findMany({
        where,
        orderBy: [{ block: 'asc' }, { floor: 'asc' }, { name: 'asc' }],
        skip,
        take: pageSize,
        include: { ownerDepartment: { select: { id: true, name: true } } },
      }),
      prisma.location.count({ where }),
    ]);

    res.json({ locations, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations – admin creates locations (before /:id routes)
router.post('/', authenticate, requireRole('ADMIN'), validate(locationSchema), async (req, res, next) => {
  try {
    const loc = await prisma.location.create({ data: req.body });
    await auditService.log(req.user.id, 'CREATE_LOCATION', 'Location', loc.id, req.body);
    res.status(201).json({ location: loc });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/bulk-add – admin bulk creates rooms (MUST be before /:id)
router.post('/bulk-add', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { block, floor, startRoom, endRoom, type } = req.body;
    if (!block || !floor || !startRoom || !endRoom) {
      throw new AppError('block, floor, startRoom, endRoom are required', 400);
    }

    const created = [];
    for (let r = parseInt(startRoom); r <= parseInt(endRoom); r++) {
      const name = `Room ${r}`;
      const existing = await prisma.location.findFirst({ where: { name, block, floor: parseInt(floor) } });
      if (!existing) {
        const loc = await prisma.location.create({
          data: { block, floor: parseInt(floor), name, type: type || 'classroom', status: 'approved' },
        });
        created.push(loc);
      }
    }

    await auditService.log(req.user.id, 'BULK_ADD_LOCATIONS', 'Location', 'bulk', { block, floor, startRoom, endRoom, count: created.length });
    res.status(201).json({ created, count: created.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/bulk-assign-owner – admin bulk assigns owner (MUST be before /:id)
router.post('/bulk-assign-owner', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { block, floor, ownerDepartmentId } = req.body;
    if (!ownerDepartmentId) throw new AppError('ownerDepartmentId required', 400);

    const where = { status: 'approved' };
    if (block) where.block = block;
    if (floor !== undefined && floor !== '') where.floor = parseInt(floor);

    const result = await prisma.location.updateMany({ where, data: { ownerDepartmentId } });
    await auditService.log(req.user.id, 'BULK_ASSIGN_OWNER', 'Location', 'bulk', { block, floor, ownerDepartmentId, count: result.count });
    res.json({ count: result.count });
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/propose – student proposes a new place (MUST be before /:id)
router.post('/propose', authenticate, requireRole('STUDENT'), validate(proposeSchema), async (req, res, next) => {
  try {
    const pendingCount = await prisma.location.count({
      where: { proposedById: req.user.id, status: 'pending' },
    });
    const maxPending = 3;
    if (pendingCount >= maxPending) {
      throw new AppError(`You already have ${maxPending} pending location proposals. Wait for admin approval.`, 400);
    }

    const { block, name } = req.body;
    if (block) {
      const similar = await prisma.location.findFirst({
        where: { block, name: { contains: name }, status: 'approved' },
      });
      if (similar) {
        return res.status(200).json({
          duplicate: true,
          suggestion: similar,
          message: `A similar location "${similar.name}" already exists in Block ${block}. Did you mean this?`,
        });
      }
    }

    const loc = await prisma.location.create({
      data: { ...req.body, status: 'pending', proposedById: req.user.id },
    });

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } });
    const { createNotification } = require('../services/notificationService');
    for (const admin of admins) {
      await createNotification(admin.id, `New location proposed: "${loc.name}"`, '/admin/pending-locations');
    }

    res.status(201).json({ location: loc, message: 'Location proposed. Your report will be held until admin approves.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/locations/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const loc = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: { ownerDepartment: true, proposedBy: { select: { id: true, name: true } } },
    });
    if (!loc) throw new AppError('Location not found', 404);
    res.json({ location: loc });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/locations/:id/approve – admin approves/rejects proposed location
router.patch('/:id/approve', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { action, reason, ownerDepartmentId, mergeIntoId } = req.body;

    const loc = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!loc || loc.status !== 'pending') throw new AppError('Location not pending', 400);

    if (action === 'approve') {
      const updated = await prisma.location.update({
        where: { id: req.params.id },
        data: { status: 'approved', ownerDepartmentId: ownerDepartmentId || loc.ownerDepartmentId },
      });
      const { routeToDocument, autoAssign } = require('../services/incidentService');
      const incidents = await prisma.incident.findMany({ where: { locationId: req.params.id, status: 'SUBMITTED' } });
      for (const inc of incidents) {
        const { departmentId } = await routeToDocument(inc.categoryId, inc.locationId);
        await prisma.incident.update({ where: { id: inc.id }, data: { departmentId } });
        if (departmentId) await autoAssign(inc.id, departmentId, req.user.id);
      }
      await auditService.log(req.user.id, 'APPROVE_LOCATION', 'Location', req.params.id, { ownerDepartmentId });
      return res.json({ location: updated });
    }

    if (action === 'reject') {
      const updated = await prisma.location.update({
        where: { id: req.params.id },
        data: { status: 'rejected', rejectedReason: reason || 'No reason given' },
      });
      if (loc.proposedById) {
        const { createNotification } = require('../services/notificationService');
        await createNotification(
          loc.proposedById,
          `Your proposed location "${loc.name}" was rejected. Reason: ${reason || 'See admin'}`,
          '/student/tickets'
        );
      }
      await auditService.log(req.user.id, 'REJECT_LOCATION', 'Location', req.params.id, { reason });
      return res.json({ location: updated });
    }

    if (action === 'merge') {
      if (!mergeIntoId) throw new AppError('mergeIntoId required for merge', 400);
      await prisma.report.updateMany({ where: { locationId: req.params.id }, data: { locationId: mergeIntoId } });
      await prisma.incident.updateMany({ where: { locationId: req.params.id }, data: { locationId: mergeIntoId } });
      await prisma.location.update({
        where: { id: req.params.id },
        data: { isActive: false, status: 'rejected', rejectedReason: `Merged into ${mergeIntoId}` },
      });
      await auditService.log(req.user.id, 'MERGE_LOCATION', 'Location', req.params.id, { mergeIntoId });
      return res.json({ message: 'Merged' });
    }

    throw new AppError('Invalid action', 400);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/locations/:id – admin edits
router.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (isActive === false) {
      const hasReports = await prisma.report.count({ where: { locationId: req.params.id } });
      if (hasReports > 0) {
        throw new AppError('Cannot delete location with existing reports. It has been deactivated instead.', 400);
      }
    }
    const loc = await prisma.location.update({ where: { id: req.params.id }, data: req.body });
    await auditService.log(req.user.id, 'UPDATE_LOCATION', 'Location', loc.id, req.body);
    res.json({ location: loc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
