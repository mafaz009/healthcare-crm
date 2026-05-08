const { isDev } = require('../config/env');

// Catch unhandled route
const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

// Global error handler — must have 4 params for Express to treat it as error middleware
const globalHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const payload = { success: false, message };

  // Prisma known request errors
  if (err.code === 'P2002') {
    payload.message = 'A record with this value already exists.';
    return res.status(409).json(payload);
  }
  if (err.code === 'P2025') {
    payload.message = 'Record not found.';
    return res.status(404).json(payload);
  }

  if (isDev) {
    payload.stack = err.stack;
  }

  return res.status(statusCode).json(payload);
};

module.exports = { notFound, globalHandler };
