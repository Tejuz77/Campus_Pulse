const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const incidentService = require('../services/incidentService');

// GET /api/admin/overview – dashboard stats
router.get('/overview', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    // Lazy escalation check
    incidentService.runEscalationCheck().catch(() => {});

    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      escalatedTickets,
      unassignedTickets,
      pendingLocations,
    ] = await Promise.all([
      prisma.incident.count(),
      prisma.incident.count({ where: { status: { notIn: ['RESOLVED', 'REJECTED'] } } }),
      prisma.incident.count({ where: { status: 'RESOLVED' } }),
      prisma.incident.count({ where: { escalated: true, status: { notIn: ['RESOLVED', 'REJECTED'] } } }),
      prisma.incident.count({ where: { departmentId: null, status: { notIn: ['RESOLVED', 'REJECTED'] } } }),
      prisma.location.count({ where: { status: 'pending' } }),
    ]);

    // Dept workload
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { incidents: { where: { status: { notIn: ['RESOLVED', 'REJECTED'] } } } } },
      },
    });

    res.json({
      totalTickets,
      openTickets,
      resolvedTickets,
      escalatedTickets,
      unassignedTickets,
      pendingLocations,
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        openTickets: d._count.incidents,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-log
router.get('/audit-log', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const result = await auditService.getLogs({ page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/escalated
router.get('/escalated', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const incidents = await prisma.incident.findMany({
      where: { escalated: true, status: { notIn: ['RESOLVED', 'REJECTED'] } },
      orderBy: { escalatedAt: 'asc' },
      include: {
        category: true,
        location: true,
        department: true,
        reports: { select: { ticketNumber: true }, take: 1 },
        assignments: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/pending-locations
router.get('/pending-locations', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const locations = await prisma.location.findMany({
      where: { status: 'pending' },
      include: { proposedBy: { select: { id: true, name: true, rollNo: true, email: true } } },
      orderBy: { id: 'desc' },
    });
    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/analytics
router.get('/analytics', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const [
      totalResolved,
      totalTickets,
      totalFeedback,
    ] = await Promise.all([
      prisma.incident.count({ where: { status: 'RESOLVED' } }),
      prisma.incident.count(),
      prisma.feedback.aggregate({ _avg: { rating: true }, _count: true }),
    ]);

    // Average resolution time
    const resolved = await prisma.incident.findMany({
      where: { status: 'RESOLVED', closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      take: 100,
    });
    const avgResolutionMs =
      resolved.length > 0
        ? resolved.reduce((sum, r) => sum + (new Date(r.closedAt) - new Date(r.createdAt)), 0) / resolved.length
        : 0;
    const avgResolutionHours = Math.round(avgResolutionMs / (1000 * 60 * 60));

    // Top locations by incident count
    const topLocations = await prisma.incident.groupBy({
      by: ['locationId'],
      _count: { locationId: true },
      orderBy: { _count: { locationId: 'desc' } },
      take: 5,
    });

    const topLocationsWithNames = await Promise.all(
      topLocations.map(async (l) => {
        const loc = await prisma.location.findUnique({
          where: { id: l.locationId },
          select: { name: true, block: true },
        });
        return { ...loc, count: l._count.locationId };
      })
    );

    // Status breakdown
    const statusBreakdown = await prisma.incident.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    // Priority breakdown
    const priorityBreakdown = await prisma.incident.groupBy({
      by: ['priority'],
      _count: { priority: true },
    });

    res.json({
      totalTickets,
      totalResolved,
      resolutionRate: totalTickets > 0 ? Math.round((totalResolved / totalTickets) * 100) : 0,
      avgResolutionHours,
      avgSatisfaction: totalFeedback._avg.rating,
      totalFeedbackCount: totalFeedback._count,
      topRecurringLocations: topLocationsWithNames,
      statusBreakdown: Object.fromEntries(statusBreakdown.map((s) => [s.status, s._count.status])),
      priorityBreakdown: Object.fromEntries(priorityBreakdown.map((p) => [p.priority, p._count.priority])),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/export/csv – CSV export of all incidents
router.get('/export/csv', authenticate, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const incidents = await prisma.incident.findMany({
      include: {
        category: { select: { name: true } },
        location: { select: { name: true, block: true } },
        department: { select: { name: true } },
        reports: { select: { ticketNumber: true, reporterId: true, createdAt: true }, take: 1 },
        assignments: {
          include: { assignee: { select: { name: true } } },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Ticket', 'Summary', 'Category', 'Location', 'Block', 'Department', 'Priority', 'Status', 'Escalated', 'Assigned To', 'Created', 'Closed'];
    const rows = incidents.map((i) => [
      i.reports[0]?.ticketNumber || '',
      `"${(i.summary || '').replace(/"/g, '""')}"`,
      i.category?.name || '',
      i.location?.name || '',
      i.location?.block || '',
      i.department?.name || 'Unassigned',
      i.priority,
      i.status,
      i.escalated ? 'Yes' : 'No',
      i.assignments[0]?.assignee?.name || '',
      new Date(i.createdAt).toISOString(),
      i.closedAt ? new Date(i.closedAt).toISOString() : '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campuspulse-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
