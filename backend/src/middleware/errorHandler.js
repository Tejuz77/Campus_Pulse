/**
 * Centralized error handler middleware.
 * Always returns { error: string, details?: any }
 */
function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Prisma unique constraint
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate entry', fields: err.meta?.target });
  }

  // Prisma not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // App-defined HTTP errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
}

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, AppError };
