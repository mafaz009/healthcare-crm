/**
 * Admin routes — /api/admin
 * SUPER_ADMIN only. Global platform management endpoints.
 */

const router  = require('express').Router();
const { query, param } = require('express-validator');
const { protect, allowRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const prisma   = require('../../config/database');
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

module.exports = router;
