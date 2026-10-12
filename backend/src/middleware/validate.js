const { z } = require('zod');

/**
 * Middleware factory – validates req.body against a Zod schema.
 * On failure throws a ZodError which errorHandler converts to 400.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware factory – validates req.query against a Zod schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate, validateQuery };
