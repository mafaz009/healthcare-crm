/**
 * auth.js — Authentication middleware
 *
 * Two authentication paths:
 *   1. JWT Bearer token  → CRM dashboard users (SUPER_ADMIN, DOCTOR_ADMIN, STAFF)
 *   2. X-Api-Key header  → External doctor websites (PHP, Make.com, etc.)
 */

const jwt    = require('jsonwebtoken');
const prisma = require('../config/database');
const env    = require('../config/env');
const { unauthorized, forbidden } = require('../utils/response');

// ── JWT Authentication ────────────────────────────────────────────────────────

/**
 * Verifies Bearer JWT and attaches req.user.
 * Also validates tokenVersion — if the DB version is higher than the token's,
 * the token has been explicitly invalidated (password change, account disable, etc.)
 *
 * req.user shape: { id, name, email, role, doctorId, isActive, tokenVersion, permissions }
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res, 'No token provided');
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired');
    return unauthorized(res, 'Invalid token');
  }

  // Fetch fresh user state — catches disabled accounts and token invalidations
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true, name: true, loginId: true, email: true,
      role: true, doctorId: true, isActive: true,
      tokenVersion: true, permissions: true,
    },
  });

  if (!user || !user.isActive) {
    return unauthorized(res, 'Account not found or disabled');
  }

  // Token version check — instantly invalidates tokens after password change,
  // forced logout, or account disable without waiting for JWT expiry.
  if (decoded.tokenVersion !== user.tokenVersion) {
    return unauthorized(res, 'Session expired. Please log in again.');
  }

  req.user = user;
  next();
};

// ── Role-Based Access Control ─────────────────────────────────────────────────

/**
 * Restrict a route to specific roles. Always chain AFTER protect().
 *
 * Usage: router.get('/', protect, allowRoles('SUPER_ADMIN'), ctrl.getAll)
 *        router.get('/', protect, allowRoles('SUPER_ADMIN', 'DOCTOR_ADMIN'), ctrl.list)
 */
const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return forbidden(res, 'You do not have permission to perform this action');
  }
  next();
};

// ── Tenant Isolation ──────────────────────────────────────────────────────────

/**
 * Attaches req.tenantFilter for use in Prisma where clauses.
 *
 * SUPER_ADMIN → {} (no filter — sees all tenants)
 * DOCTOR_ADMIN / STAFF → { doctorId: req.user.doctorId }
 *
 * This middleware is the single enforcement point for tenant isolation.
 * Every service query that fetches tenant data MUST spread this into its where clause.
 *
 * Always chain AFTER protect().
 */
const tenantFilter = (req, _res, next) => {
  if (req.user.role === 'SUPER_ADMIN') {
    req.tenantFilter = {};
  } else {
    if (!req.user.doctorId) {
      // DOCTOR_ADMIN or STAFF without a doctorId is a misconfigured account — block it
      return _res.status(403).json({
        success: false,
        message: 'Account not associated with a practice. Contact MashHealth support.',
      });
    }
    req.tenantFilter = { doctorId: req.user.doctorId };
  }
  next();
};

// ── Granular Permission Check ─────────────────────────────────────────────────

/**
 * Role-level permission defaults.
 * These are the baseline permissions for each role.
 * STAFF permissions can be overridden per-user via the User.permissions JSON column.
 */
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    leads:        { create: true,  read: true, update: true, delete: true  },
    blogs:        { create: true,  read: true, update: true, delete: true, publish: true  },
    appointments: { create: true,  read: true, update: true, delete: true  },
    staff:        { create: true,  read: true, update: true, delete: true  },
  },
  DOCTOR_ADMIN: {
    leads:        { create: true,  read: true, update: true, delete: true  },
    blogs:        { create: true,  read: true, update: true, delete: true, publish: true  },
    appointments: { create: true,  read: true, update: true, delete: true  },
    staff:        { create: true,  read: true, update: true, delete: false }, // cannot permanently delete staff
  },
  STAFF: {
    leads:        { create: true,  read: true, update: true, delete: false },
    blogs:        { create: true,  read: true, update: false, delete: false, publish: false },
    appointments: { create: true,  read: true, update: true, delete: false },
    staff:        { create: false, read: false, update: false, delete: false },
  },
};

/**
 * Middleware factory: checks if the authenticated user can perform action on resource.
 * For STAFF, checks user-level permission overrides before falling back to role defaults.
 *
 * Usage: requirePermission('leads', 'delete')
 *        requirePermission('blogs', 'publish')
 *
 * Chain AFTER protect().
 */
const requirePermission = (resource, action) => (req, res, next) => {
  const role = req.user.role;
  const roleDefault = ROLE_PERMISSIONS[role]?.[resource]?.[action];

  // For STAFF: check per-user override first
  let allowed = roleDefault;
  if (role === 'STAFF' && req.user.permissions) {
    const userOverride = req.user.permissions?.[resource]?.[action];
    if (typeof userOverride === 'boolean') {
      allowed = userOverride;
    }
  }

  if (!allowed) {
    return forbidden(res, `Permission denied: cannot ${action} ${resource}`);
  }
  next();
};

// ── External API Key Authentication ──────────────────────────────────────────

/**
 * Validates external website API key.
 * Used by: PHP doctor websites, Make.com workflows, webhook receivers.
 *
 * Accepts the key from:
 *   1. X-Api-Key header  ← preferred (never appears in server logs)
 *   2. ?apiKey= query param ← convenience for browser testing only
 *
 * Rejects SUSPENDED doctors in addition to INACTIVE — suspended clinics
 * should not have their websites continue serving fresh data.
 *
 * Attaches: req.doctor = { id, name, domain, status, plan }
 */
const apiKeyAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key) {
    return unauthorized(res, 'API key required. Pass X-Api-Key header or ?apiKey= query param.');
  }

  const doctor = await prisma.doctor.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true, domain: true, status: true, plan: true },
  });

  if (!doctor) {
    return unauthorized(res, 'Invalid API key');
  }

  if (doctor.status === 'SUSPENDED') {
    return unauthorized(res, 'Account suspended. Contact MashHealth support.');
  }

  if (doctor.status === 'INACTIVE') {
    return unauthorized(res, 'Account inactive');
  }

  req.doctor = doctor;
  next();
};

module.exports = { protect, allowRoles, tenantFilter, requirePermission, apiKeyAuth };
