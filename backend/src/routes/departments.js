const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');

// GET /api/departments
router.get('/', authenticate, async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role !== 'ADMIN') where.isActive = true;

    const departments = await prisma.department.findMany({
      where,
      include: {
        _count: { select: { users: { where: { role: 'STAFF', isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const dept = await prisma.department.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          where: { role: 'STAFF', isActive: true },
          select: { id: true, name: true, email: true, onLeave: true },
        },
        _count: { select: { incidents: { where: { status: { notIn: ['RESOLVED', 'REJECTED'] } } } } },
      },
    });
    if (!dept) throw new AppError('Department not found', 404);
    res.json({ department: dept });
  } catch (err) {
    next(err);
  }
});

// POST /api/departments – admin only
const deptSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['academic', 'service']),
  contactReference: z.string().optional(),
});

router.post('/', authenticate, requireRole('ADMIN'), validate(deptSchema), async (req, res, next) => {
  try {
    const dept = await prisma.department.create({ data: req.body });
    await auditService.log(req.user.id, 'CREATE_DEPARTMENT', 'Department', dept.id, req.body);
    res.status(201).json({ department: dept });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/departments/:id
router.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, type, contactReference, isActive } = req.body;

    if (isActive === false) {
      // Block deactivation if open tickets or active staff
      const openTickets = await prisma.incident.count({
        where: { departmentId: req.params.id, status: { notIn: ['RESOLVED', 'REJECTED'] } },
      });
      if (openTickets > 0) {
        throw new AppError(`Cannot deactivate: ${openTickets} open ticket(s) must be reassigned first`, 400);
      }
      const activeStaff = await prisma.user.count({
        where: { departmentId: req.params.id, role: 'STAFF', isActive: true },
      });
      if (activeStaff > 0) {
        throw new AppError(`Cannot deactivate: ${activeStaff} active staff must be reassigned first`, 400);
      }
    }

    const dept = await prisma.department.update({
      where: { id: req.params.id },
      data: { name, type, contactReference, isActive },
    });
    await auditService.log(req.user.id, 'UPDATE_DEPARTMENT', 'Department', dept.id, req.body);
    res.json({ department: dept });
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/:id/workload – admin dashboard
router.get('/:id/workload', authenticate, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      where: { departmentId: req.params.id, role: 'STAFF', isActive: true },
      select: { id: true, name: true, onLeave: true },
    });

    const workload = await Promise.all(
      staff.map(async (s) => {
        const openCount = await prisma.assignment.count({
          where: {
            assignedTo: s.id,
            incident: { status: { notIn: ['RESOLVED', 'REJECTED'] } },
          },
        });
        return { ...s, openTickets: openCount };
      })
    );

    res.json({ workload });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
