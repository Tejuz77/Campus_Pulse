const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// GET /api/notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await notificationService.getForUser(req.user.id, page);
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.json({ ...result, unreadCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await notificationService.markRead(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
