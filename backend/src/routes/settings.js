const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

// GET /api/settings – admin only
router.get('/', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const settings = await prisma.settings.findMany();
    res.json({ settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings – admin updates settings
router.patch('/', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { key, value, reason } = req.body;
    if (!key || !value) throw new AppError('key and value required', 400);
    if (!reason) throw new AppError('reason is required for admin override', 400);

    await prisma.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });

    await auditService.log(req.user.id, 'UPDATE_SETTING', 'Settings', key, { value, reason });
    res.json({ message: 'Setting updated' });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/public – publicly readable settings (safety banner, email pattern)
router.get('/public', async (req, res, next) => {
  try {
    const publicKeys = ['SAFETY_BANNER', 'STUDENT_EMAIL_PATTERN'];
    const settings = await prisma.settings.findMany({ where: { key: { in: publicKeys } } });
    res.json({ settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
