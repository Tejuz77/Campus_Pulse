const express = require('express');
const router = express.Router();
const { z } = require('zod');
const argon2 = require('argon2');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const incidentService = require('../services/incidentService');

const MAX_STAFF_PER_DEPT = 2;

// GET /api/users – admin: all users; staff: dept staff; student: self only
router.get('/', authenticate, async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'STUDENT') {
      where.id = req.user.id;
    } else if (req.user.role === 'STAFF') {
      where.departmentId = req.user.departmentId;
      where.role = 'STAFF';
    }

    const { role, departmentId, isActive } = req.query;
    if (req.user.role === 'ADMIN') {
      if (role) where.role = role;
      if (departmentId) where.departmentId = departmentId;
      if (isActive !== undefined) where.isActive = isActive === 'true';
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rollNo: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        isActive: true,
        onLeave: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me/leave – staff toggles on-leave (must be BEFORE /:id)
router.patch('/me/leave', authenticate, requireRole('STAFF'), async (req, res, next) => {
  try {
    const { onLeave } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { onLeave: !!onLeave },
    });

    if (onLeave) {
      await reassignOpenTickets(req.user.id, req.user.id);
    }

    const { passwordHash, ...safeUser } = updated;
    res.json({ user: safeUser });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'STUDENT' && req.params.id !== req.user.id) {
      throw new AppError('Not authorized', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rollNo: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        isActive: true,
        onLeave: true,
        createdAt: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// POST /api/users – admin creates staff accounts only
const createStaffSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  departmentId: z.string().min(1),
  role: z.enum(['STAFF']).default('STAFF'),
});

router.post('/', authenticate, requireRole('ADMIN'), validate(createStaffSchema), async (req, res, next) => {
  try {
    const { name, email, password, departmentId } = req.body;

    // Enforce 2-staff cap with transaction
    const user = await prisma.$transaction(async (tx) => {
      const activeStaffCount = await tx.user.count({
        where: { departmentId, role: 'STAFF', isActive: true },
      });

      if (activeStaffCount >= MAX_STAFF_PER_DEPT) {
        throw new AppError(
          `Cannot add staff: department already has ${MAX_STAFF_PER_DEPT} active staff members (maximum allowed).`,
          400
        );
      }

      const dept = await tx.department.findUnique({ where: { id: departmentId } });
      if (!dept || !dept.isActive) throw new AppError('Department not found or inactive', 404);

      const existing = await tx.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) throw new AppError('Email already registered', 409);

      const passwordHash = await argon2.hash(password);
      return tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: 'STAFF',
          departmentId,
          isActive: true,
        },
      });
    });

    await auditService.log(req.user.id, 'CREATE_STAFF', 'User', user.id, { departmentId });
    const { passwordHash, ...safeUser } = user;
    res.status(201).json({ user: safeUser });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id – admin updates users
router.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, email, isActive, onLeave, departmentId, password } = req.body;

    // Protect admin account
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new AppError('User not found', 404);

    if (target.role === 'ADMIN' && isActive === false) {
      throw new AppError('Cannot deactivate the admin account', 403);
    }

    // If changing departmentId (reassigning staff), check cap
    if (departmentId && departmentId !== target.departmentId) {
      const activeStaffCount = await prisma.user.count({
        where: { departmentId, role: 'STAFF', isActive: true },
      });
      if (activeStaffCount >= MAX_STAFF_PER_DEPT) {
        throw new AppError(`Target department already has ${MAX_STAFF_PER_DEPT} active staff`, 400);
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (onLeave !== undefined) updateData.onLeave = onLeave;
    if (departmentId) updateData.departmentId = departmentId;
    if (password) updateData.passwordHash = await argon2.hash(password);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // If staff deactivated or going on leave, auto-reassign their open tickets
    if (isActive === false || onLeave === true) {
      await reassignOpenTickets(req.params.id, req.user.id);
    }

    await auditService.log(req.user.id, 'UPDATE_USER', 'User', req.params.id, { isActive, onLeave, departmentId });
    const { passwordHash, ...safeUser } = updated;
    res.json({ user: safeUser });
  } catch (err) {
    next(err);
  }
});




async function reassignOpenTickets(staffId, actorId) {
  // Find staff's open assignments
  const openAssignments = await prisma.assignment.findMany({
    where: {
      assignedTo: staffId,
      incident: { status: { notIn: ['RESOLVED', 'REJECTED'] } },
    },
    include: { incident: true },
    // Get only the latest assignment per incident
  });

  const user = await prisma.user.findUnique({ where: { id: staffId } });
  if (!user) return;

  // Get unique incidents
  const incidentIds = [...new Set(openAssignments.map((a) => a.incidentId))];

  for (const incidentId of incidentIds) {
    const assigned = await incidentService.autoAssign(incidentId, user.departmentId, actorId);
    if (!assigned) {
      await incidentService.notifyAdmins(`Ticket ${incidentId} moved to unassigned queue – all staff unavailable`);
    }
  }
}

module.exports = router;
