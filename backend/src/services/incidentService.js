const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('./notificationService');
const auditService = require('./auditService');

// Valid status transitions
const TRANSITIONS = {
  SUBMITTED: ['ASSIGNED', 'REJECTED', 'ON_HOLD'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'REJECTED'],
  IN_PROGRESS: ['AWAITING_CONFIRMATION', 'ON_HOLD'],
  AWAITING_CONFIRMATION: ['RESOLVED', 'REOPENED', 'IN_PROGRESS'],
  ON_HOLD: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  REJECTED: [],
  RESOLVED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'],
};

// Role permissions for transitions
const ROLE_TRANSITIONS = {
  STAFF: ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'ON_HOLD', 'REJECTED'],
  ADMIN: ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'ON_HOLD', 'REJECTED', 'RESOLVED', 'REOPENED'],
  STUDENT: ['REOPENED'],
};

/**
 * Generate ticket number: CP-YYYY-NNNNNN
 */
async function generateTicketNumber() {
  const year = new Date().getFullYear().toString();

  return await prisma.$transaction(async (tx) => {
    const seq = await tx.ticketSequence.upsert({
      where: { yearKey: year },
      update: { seq: { increment: 1 } },
      create: { yearKey: year, seq: 1 },
    });
    const padded = String(seq.seq).padStart(6, '0');
    return `CP-${year}-${padded}`;
  });
}

/**
 * Routing rules to determine which department handles an incident.
 */
async function routeToDocument(categoryId, locationId) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { defaultDepartment: true },
  });
  if (!category) throw new AppError('Category not found', 404);

  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { ownerDepartment: true },
  });
  if (!location) throw new AppError('Location not found', 404);

  // Rule 1: department-owned category + location has an owner department
  if (category.isDepartmentOwned && location.ownerDepartmentId) {
    return { departmentId: location.ownerDepartmentId, department: location.ownerDepartment };
  }

  // Rule 2: category has a default department
  if (category.defaultDepartmentId) {
    return { departmentId: category.defaultDepartmentId, department: category.defaultDepartment };
  }

  // Rule 3: Admin unassigned queue
  return { departmentId: null, department: null };
}

/**
 * Auto-assign to staff with fewest open tickets in department.
 */
async function autoAssign(incidentId, departmentId, assignedById) {
  if (!departmentId) return null;

  const staffList = await prisma.user.findMany({
    where: {
      departmentId,
      role: 'STAFF',
      isActive: true,
      onLeave: false,
    },
  });

  if (staffList.length === 0) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: { departmentId: null },
    });
    await notifyAdmins(`Incident ${incidentId} unassigned – all staff on leave in department ${departmentId}`);
    return null;
  }

  // Count open tickets per staff
  const counts = await Promise.all(
    staffList.map(async (s) => {
      const count = await prisma.assignment.count({
        where: {
          assignedTo: s.id,
          incident: {
            status: { notIn: ['RESOLVED', 'REJECTED'] },
          },
        },
      });
      return { staff: s, count };
    })
  );

  counts.sort((a, b) => a.count - b.count);
  const chosen = counts[0].staff;

  await prisma.$transaction(async (tx) => {
    await tx.incident.update({
      where: { id: incidentId },
      data: { status: 'ASSIGNED', version: { increment: 1 } },
    });
    await tx.assignment.create({
      data: {
        incidentId,
        assignedTo: chosen.id,
        assignedBy: assignedById,
        reason: 'Auto-assigned',
      },
    });
  });

  await notificationService.createNotification(
    chosen.id,
    `New ticket assigned to you`,
    `/staff/tickets/${incidentId}`
  );

  return chosen;
}

/**
 * Create a report + incident (or link to existing incident).
 */
async function createReportFull(data, reporterId) {
  const { categoryId, locationId, systemNumber, description, idempotencyKey, linkToIncidentId } = data;

  // Idempotency check
  const existing = await prisma.report.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return {
      report: existing,
      incident: await prisma.incident.findUnique({ where: { id: existing.incidentId } }),
      created: false,
    };
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category || !category.isActive) throw new AppError('Category not found', 404);

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || !location.isActive) throw new AppError('Location not found', 404);
  if (location.status !== 'approved') throw new AppError('Location is pending admin approval', 400);

  const priority = category.isSafety ? 'CRITICAL' : category.defaultPriority;
  const { departmentId } = await routeToDocument(categoryId, locationId);

  const ticketNumber = await generateTicketNumber();

  let incidentId = linkToIncidentId;
  let incident;

  if (!incidentId) {
    incident = await prisma.incident.create({
      data: {
        summary: description.slice(0, 120),
        categoryId,
        locationId,
        departmentId,
        priority,
        status: 'SUBMITTED',
      },
    });
    incidentId = incident.id;
  } else {
    incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new AppError('Linked incident not found', 404);
  }

  const report = await prisma.report.create({
    data: {
      ticketNumber,
      reporterId,
      incidentId,
      categoryId,
      locationId,
      systemNumber: systemNumber || null,
      description,
      priority,
      idempotencyKey,
    },
  });

  await prisma.issueUpdate.create({
    data: {
      incidentId,
      reportId: report.id,
      updatedBy: reporterId,
      oldStatus: null,
      newStatus: 'SUBMITTED',
      note: 'Report submitted',
    },
  });

  return { report, incident, created: true };
}

/**
 * Transition an incident status (state machine).
 */
async function transitionStatus(incidentId, newStatus, actorId, actorRole, note, version) {
  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) throw new AppError('Incident not found', 404);

  // Optimistic locking
  if (version !== undefined && incident.version !== version) {
    throw new AppError('Conflict: incident was updated by someone else. Please refresh.', 409);
  }

  const allowed = TRANSITIONS[incident.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(`Cannot transition from ${incident.status} to ${newStatus}`, 400);
  }

  // Role check
  const roleAllowed = ROLE_TRANSITIONS[actorRole] || [];
  if (!roleAllowed.includes(newStatus) && actorRole !== 'ADMIN') {
    throw new AppError('Your role cannot perform this transition', 403);
  }

  const updateData = {
    status: newStatus,
    version: { increment: 1 },
  };

  if (newStatus === 'AWAITING_CONFIRMATION') {
    updateData.awaitingConfirmationAt = new Date();
  }
  if (newStatus === 'RESOLVED') {
    updateData.closedAt = new Date();
    updateData.escalated = false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.incident.update({ where: { id: incidentId }, data: updateData });
    await tx.issueUpdate.create({
      data: {
        incidentId,
        updatedBy: actorId,
        oldStatus: incident.status,
        newStatus,
        note: note || null,
      },
    });
  });

  // Notify reporter if awaiting confirmation
  if (newStatus === 'AWAITING_CONFIRMATION') {
    const report = await prisma.report.findFirst({ where: { incidentId }, orderBy: { createdAt: 'asc' } });
    if (report) {
      await notificationService.createNotification(
        report.reporterId,
        `Your ticket ${report.ticketNumber} is awaiting your confirmation. Please confirm or dispute the resolution.`,
        `/tickets/${report.ticketNumber}`
      );
    }
  }

  // Notify admin on reopen
  if (newStatus === 'REOPENED') {
    await notifyAdmins(`Ticket reopened for incident ${incidentId}`);
  }

  return prisma.incident.findUnique({ where: { id: incidentId } });
}

async function notifyAdmins(message) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } });
  for (const admin of admins) {
    await notificationService.createNotification(admin.id, message, '/admin/tickets');
  }
}

/**
 * Check and run escalation logic lazily (called on dashboard load).
 */
async function runEscalationCheck() {
  const settings = await prisma.settings.findMany();
  const s = Object.fromEntries(settings.map((x) => [x.key, parseInt(x.value) || x.value]));

  const thresholds = {
    CRITICAL: { response: s.ESCALATION_CRITICAL_RESPONSE_H || 1, resolution: s.ESCALATION_CRITICAL_RESOLUTION_H || 24 },
    HIGH: { response: s.ESCALATION_HIGH_RESPONSE_H || 4, resolution: s.ESCALATION_HIGH_RESOLUTION_H || 48 },
    MEDIUM: { response: s.ESCALATION_MEDIUM_RESPONSE_H || 24, resolution: s.ESCALATION_MEDIUM_RESOLUTION_H || 120 },
    LOW: { response: s.ESCALATION_LOW_RESPONSE_H || 48, resolution: s.ESCALATION_LOW_RESOLUTION_H || 240 },
  };

  const openIncidents = await prisma.incident.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'REJECTED'] },
    },
  });

  const now = new Date();

  for (const incident of openIncidents) {
    const th = thresholds[incident.priority] || thresholds.MEDIUM;
    const ageH = (now - new Date(incident.createdAt)) / (1000 * 60 * 60);
    const escalate = ageH > th.response && !incident.escalated;

    if (escalate) {
      await prisma.incident.update({
        where: { id: incident.id },
        data: { escalated: true, escalatedAt: new Date() },
      });
      await notifyAdmins(
        `⚠️ Incident ${incident.id} (${incident.priority}) has been escalated after ${Math.round(ageH)}h`
      );
    }
  }

  // Auto-close awaiting confirmation tickets past CONFIRM_WINDOW_HOURS
  const confirmWindowH = parseInt(s.CONFIRM_WINDOW_HOURS) || 72;
  const cutoff = new Date(now - confirmWindowH * 60 * 60 * 1000);

  const awaitingIncidents = await prisma.incident.findMany({
    where: {
      status: 'AWAITING_CONFIRMATION',
      awaitingConfirmationAt: { lt: cutoff },
    },
  });

  for (const incident of awaitingIncidents) {
    const systemUserId = await getSystemUserId();
    await prisma.$transaction(async (tx) => {
      await tx.incident.update({
        where: { id: incident.id },
        data: { status: 'RESOLVED', closedAt: new Date(), version: { increment: 1 } },
      });
      await tx.issueUpdate.create({
        data: {
          incidentId: incident.id,
          updatedBy: systemUserId,
          oldStatus: 'AWAITING_CONFIRMATION',
          newStatus: 'RESOLVED',
          note: `Auto-resolved after ${confirmWindowH}h confirmation window`,
        },
      });
    });
  }
}

let _systemUserId = null;
async function getSystemUserId() {
  if (_systemUserId) return _systemUserId;
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  _systemUserId = admin?.id;
  return _systemUserId;
}

module.exports = {
  generateTicketNumber,
  routeToDocument,
  autoAssign,
  createReportFull,
  transitionStatus,
  runEscalationCheck,
  notifyAdmins,
  TRANSITIONS,
};
