const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const storage = require('../services/storageService');

// GET /api/attachments/file/:filename – serve authorized attachment
router.get('/file/:filename', authenticate, async (req, res, next) => {
  try {
    const { filename } = req.params;

    // Find attachment in DB to check ownership
    const attachment = await prisma.attachment.findFirst({
      where: { filePath: filename },
      include: {
        report: { select: { reporterId: true, incidentId: true } },
        incident: { select: { departmentId: true } },
      },
    });

    if (!attachment) throw new AppError('File not found', 404);

    // Access control
    const user = req.user;
    if (user.role === 'STUDENT') {
      const isOwner = attachment.report?.reporterId === user.id;
      if (!isOwner) throw new AppError('Not authorized', 403);
    } else if (user.role === 'STAFF') {
      const deptId = attachment.incident?.departmentId || attachment.report?.incident?.departmentId;
      if (deptId && deptId !== user.departmentId) {
        throw new AppError('Not authorized', 403);
      }
    }
    // ADMIN: unrestricted

    const fullPath = storage.getFullPath(filename);
    if (!fs.existsSync(fullPath)) throw new AppError('File not found on disk', 404);

    res.setHeader('Content-Type', attachment.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
