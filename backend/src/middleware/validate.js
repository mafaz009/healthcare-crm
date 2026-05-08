const { validationResult } = require('express-validator');
const { badRequest } = require('../utils/response');

/**
 * Drop this after any array of express-validator checks.
 * If validation fails it sends a 400 with a structured errors array.
 * If it passes it calls next().
 *
 * Usage:
 *   router.post('/', [body('email').isEmail(), validate], controller)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return badRequest(res, 'Validation failed', formatted);
  }
  next();
};

module.exports = validate;
