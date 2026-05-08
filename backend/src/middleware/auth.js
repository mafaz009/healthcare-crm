const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const env = require('../config/env');
const { unauthorized, forbidden } = require('../utils/response');

/**
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches req.user = { id, name, email, role, doctorId } on success.
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided');
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, doctorId: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return unauthorized(res, 'Account not found or disabled');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired');
    return unauthorized(res, 'Invalid token');
  }
};

/**
 * Restrict a route to specific roles.
 * Always chain AFTER protect().
 *
 * Usage:  router.get('/', protect, allowRoles('SUPER_ADMIN'), controller)
 */
const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return forbidden(res, 'You do not have permission to perform this action');
  }
  next();
};

/**
 * For multi-tenant data access:
 * SUPER_ADMIN can see everything.
 * DOCTOR / STAFF can only see rows belonging to their own doctorId.
 *
 * Attaches req.tenantFilter = { doctorId: X } or {} to use in Prisma where clauses.
 */
const tenantFilter = (req, _res, next) => {
  if (req.user.role === 'SUPER_ADMIN') {
    req.tenantFilter = {};
  } else {
    req.tenantFilter = { doctorId: req.user.doctorId };
  }
  next();
};

/**
 * Validate external website API key (used by doctor websites to fetch blogs/submit forms).
 * Attaches req.doctor to the request.
 */
const apiKeyAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key) return unauthorized(res, 'API key required');

  const doctor = await prisma.doctor.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true, domain: true, status: true },
  });

  if (!doctor || doctor.status !== 'ACTIVE') {
    return unauthorized(res, 'Invalid or inactive API key');
  }

  req.doctor = doctor;
  next();
};

module.exports = { protect, allowRoles, tenantFilter, apiKeyAuth };
