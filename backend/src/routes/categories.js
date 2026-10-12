const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

// GET /api/categories
router.get('/', authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: req.user.role !== 'ADMIN' ? { isActive: true } : {},
      include: { defaultDepartment: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// GET /api/categories/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const cat = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: { defaultDepartment: true },
    });
    if (!cat) throw new AppError('Category not found', 404);
    res.json({ category: cat });
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({
  name: z.string().min(2).max(100),
  defaultDepartmentId: z.string().nullable().optional(),
  isDepartmentOwned: z.boolean().default(false),
  defaultPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  isSafety: z.boolean().default(false),
});

// POST /api/categories – admin only
router.post('/', authenticate, requireRole('ADMIN'), validate(categorySchema), async (req, res, next) => {
  try {
    const cat = await prisma.category.create({ data: req.body });
    await auditService.log(req.user.id, 'CREATE_CATEGORY', 'Category', cat.id, req.body);
    res.status(201).json({ category: cat });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/categories/:id – admin only
router.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const cat = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    await auditService.log(req.user.id, 'UPDATE_CATEGORY', 'Category', cat.id, req.body);
    res.json({ category: cat });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
