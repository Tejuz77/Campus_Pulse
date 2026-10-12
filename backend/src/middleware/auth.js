const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { AppError } = require('./errorHandler');

/**
 * Verifies JWT from httpOnly cookie or Authorization header.
 * Attaches req.user = full user record.
 */
async function authenticate(req, res, next) {
  try {
    let token = req.cookies?.token;

    if (!token) {
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        token = auth.slice(7);
      }
    }

    if (!token) throw new AppError('Authentication required', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });

    if (!user || !user.isActive) throw new AppError('User not found or inactive', 401);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role guard – pass an array of allowed roles.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
