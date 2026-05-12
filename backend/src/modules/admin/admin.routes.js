/**
 * Admin routes — /api/admin
 * SUPER_ADMIN only. Global platform management endpoints.
 */

const router  = require('express').Router();
const { query, param, body } = require('express-validator');
const { protect, allowRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const prisma   = require('../../config/database');
const bcrypt   = require('bcryptjs');
const { generateTempPassword } = require('../../utils/tempPassword');
const { ok, error } = require('../../utils/response');
const { paginate, paginationMeta } = require('../../utils/pagination');

const adminOnly = [protect, allowRoles('SUPER_ADMIN')];

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
// Full audit trail with filtering. SUPER_ADMIN only.
router.get('/audit-logs', adminOnly, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('doctorId').optional().isInt({ min: 1 }),
  query('userId').optional().isInt({ min: 1 }),
  query('action').optional().isString().trim(),
  query('from').optional().isISO8601().withMessage('from must be a valid date'),
  query('to').optional().isISO8601().withMessage('to must be a valid date'),
], validate, async (req, res) => {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { doctorId, userId, action, from, to } = req.query;

    const where = {
      ...(doctorId && { doctorId: parseInt(doctorId) }),
      ...(userId   && { userId:   parseInt(userId) }),
      ...(action   && { action:   { contains: action } }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(new Date(to).setHours(23, 59, 59, 999)) }),
        },
      }),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true, action: true, resourceId: true,
          metadata: true, ipAddress: true, createdAt: true,
          user:   { select: { id: true, name: true, loginId: true, email: true, role: true } },
          doctor: { select: { id: true, name: true } },
        },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok(res, { logs, pagination: paginationMeta(total, page, limit) });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
// Platform-wide stats for super admin overview.
router.get('/stats', adminOnly, async (_req, res) => {
  try {
    const [
      totalDoctors, activeDoctors, suspendedDoctors,
      totalUsers, totalLeads, totalAppointments, totalBlogs,
      recentDoctors,
    ] = await Promise.all([
      prisma.doctor.count(),
      prisma.doctor.count({ where: { status: 'ACTIVE' } }),
      prisma.doctor.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count(),
      prisma.lead.count(),
      prisma.appointment.count(),
      prisma.blog.count(),
      prisma.doctor.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, specialty: true, status: true, plan: true, createdAt: true },
      }),
    ]);

    return ok(res, {
      doctors: { total: totalDoctors, active: activeDoctors, suspended: suspendedDoctors },
      users: { total: totalUsers },
      content: { leads: totalLeads, appointments: totalAppointments, blogs: totalBlogs },
      recentDoctors,
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

// ── GET /api/admin/doctors/:id/impersonate ────────────────────────────────────
// Returns a short-lived (1 hour) scoped token for support/debugging.
// The token has impersonating: doctorId set so the frontend can show a warning banner.
const jwt = require('jsonwebtoken');
const env  = require('../../config/env');

router.post('/impersonate/:doctorId',
  adminOnly,
  [param('doctorId').isInt({ min: 1 }).withMessage('Invalid doctorId')],
  validate,
  async (req, res) => {
    try {
      const doctorId = parseInt(req.params.doctorId);

      const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { id: true, name: true, status: true },
      });

      if (!doctor) throw { statusCode: 404, message: 'Doctor not found' };
      if (doctor.status === 'SUSPENDED') throw { statusCode: 400, message: 'Cannot impersonate a suspended account' };

      // Short-lived 1-hour impersonation token
      const token = jwt.sign(
        {
          id:            req.user.id,
          loginId:       req.user.loginId,   // loginId is now the identity field
          role:          'SUPER_ADMIN',
          doctorId,                          // scopes data access to this doctor
          impersonating: doctorId,           // flag for frontend banner
          tokenVersion:  req.user.tokenVersion,
        },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return ok(res, {
        token,
        doctor: { id: doctor.id, name: doctor.name },
        expiresIn: '1h',
        warning: 'This token is valid for 1 hour. All actions are logged under your admin account.',
      });
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// USER CREDENTIAL MANAGEMENT  (SUPER_ADMIN only — for DOCTOR_ADMIN accounts)
//
// The /api/staff routes handle STAFF users (accessible to DOCTOR_ADMIN too).
// These routes handle DOCTOR_ADMIN users, which only SUPER_ADMIN can manage.
// ─────────────────────────────────────────────────────────────────────────────

const USER_SAFE_SELECT = {
  id: true, name: true, loginId: true, email: true,
  role: true, doctorId: true, isActive: true,
  mustChangePassword: true, lastLoginAt: true,
  createdAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true } },
};

/**
 * GET /api/admin/users
 * Returns all DOCTOR_ADMIN (and optionally STAFF) users platform-wide.
 */
router.get(
  '/users',
  adminOnly,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('role').optional().isIn(['DOCTOR_ADMIN', 'STAFF']),
    query('doctorId').optional().isInt({ min: 1 }),
    query('isActive').optional().isIn(['true', 'false']),
  ],
  validate,
  async (req, res) => {
    try {
      const { page = 1, limit = 50, role, doctorId, isActive } = req.query;
      const take = Math.min(parseInt(limit) || 50, 100);
      const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

      const where = {
        role:     { not: 'SUPER_ADMIN' },  // never expose SUPER_ADMIN list
        ...(role     && { role }),
        ...(doctorId && { doctorId: parseInt(doctorId) }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      };

      const [users, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: USER_SAFE_SELECT, skip, take, orderBy: { createdAt: 'desc' } }),
        prisma.user.count({ where }),
      ]);

      const totalPages = Math.ceil(total / take);
      return ok(res, { users, pagination: { page: parseInt(page), limit: take, total, totalPages } });
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
);

/**
 * POST /api/admin/users/:id/reset-password
 *
 * SUPER_ADMIN resets any non-SUPER_ADMIN user's password.
 * Returns { user, tempPassword } — show ONCE.
 */
router.post(
  '/users/:id/reset-password',
  adminOnly,
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  validate,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, loginId: true, doctorId: true, isActive: true },
      });

      if (!target)                       return error(res, 'User not found', 404);
      if (target.role === 'SUPER_ADMIN') return error(res, 'Cannot reset a SUPER_ADMIN password via this endpoint', 403);

      const plaintext = generateTempPassword();
      const hashed    = await bcrypt.hash(plaintext, 12);

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          password:           hashed,
          mustChangePassword: true,
          tokenVersion:       { increment: 1 },
        },
        select: USER_SAFE_SELECT,
      });

      // Audit
      await prisma.auditLog.create({
        data: {
          action:     'user.password_reset',
          resourceId: userId,
          metadata:   { name: target.name, loginId: target.loginId, role: target.role },
          userId:     req.user.id,
          doctorId:   target.doctorId || null,
        },
      }).catch((e) => console.error('[AuditLog] Failed:', e.message));

      return ok(res, { user: updated, tempPassword: plaintext },
        'Password reset. Share the temporary password — it will not be shown again.');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

/**
 * POST /api/admin/users/:id/force-logout
 * Increments tokenVersion — all active sessions immediately invalidated.
 */
router.post(
  '/users/:id/force-logout',
  adminOnly,
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  validate,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true, loginId: true, doctorId: true },
      });

      if (!target)                       return error(res, 'User not found', 404);
      if (target.role === 'SUPER_ADMIN') return error(res, 'Cannot force-logout a SUPER_ADMIN', 403);

      const updated = await prisma.user.update({
        where: { id: userId },
        data:  { tokenVersion: { increment: 1 } },
        select: USER_SAFE_SELECT,
      });

      await prisma.auditLog.create({
        data: {
          action:     'user.force_logout',
          resourceId: userId,
          metadata:   { name: target.name, loginId: target.loginId, role: target.role },
          userId:     req.user.id,
          doctorId:   target.doctorId || null,
        },
      }).catch((e) => console.error('[AuditLog] Failed:', e.message));

      return ok(res, updated, 'All active sessions for this user have been terminated.');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

/**
 * PATCH /api/admin/users/:id/disable
 * PATCH /api/admin/users/:id/enable
 */
const toggleUserActive = (isActive) => async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, loginId: true, doctorId: true },
    });

    if (!target)                       return error(res, 'User not found', 404);
    if (target.role === 'SUPER_ADMIN') return error(res, 'Cannot disable a SUPER_ADMIN account', 403);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        ...(isActive === false && { tokenVersion: { increment: 1 } }),
      },
      select: USER_SAFE_SELECT,
    });

    await prisma.auditLog.create({
      data: {
        action:     isActive ? 'user.enable' : 'user.disable',
        resourceId: userId,
        metadata:   { name: target.name, loginId: target.loginId, role: target.role },
        userId:     req.user.id,
        doctorId:   target.doctorId || null,
      },
    }).catch((e) => console.error('[AuditLog] Failed:', e.message));

    return ok(res, updated, isActive ? 'Account enabled' : 'Account disabled. Active sessions invalidated.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

router.patch(
  '/users/:id/disable',
  adminOnly,
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  validate,
  toggleUserActive(false),
);

router.patch(
  '/users/:id/enable',
  adminOnly,
  [param('id').isInt({ min: 1 }).withMessage('Invalid user ID')],
  validate,
  toggleUserActive(true),
);

module.exports = router;
