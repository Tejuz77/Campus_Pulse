const prisma = require('../lib/prisma');

async function createNotification(userId, message, link = null) {
  return prisma.notification.create({
    data: { userId, message, link },
  });
}

async function markRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

async function getForUser(userId, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);
  return { notifications, total, page, pageSize };
}

async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

module.exports = { createNotification, markRead, markAllRead, getForUser, getUnreadCount };
