const prisma = require('../lib/prisma');

async function log(actorId, action, entity, entityId, metadata = {}) {
  return prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      metadata: JSON.stringify(metadata),
    },
  });
}

async function getLogs({ entity, entityId, page = 1, pageSize = 20 } = {}) {
  const where = {};
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;

  const skip = (page - 1) * pageSize;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { actor: { select: { name: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { logs, total, page, pageSize };
}

module.exports = { log, getLogs };
