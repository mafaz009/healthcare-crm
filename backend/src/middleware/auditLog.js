/**
 * auditLog.js — Immutable audit trail for sensitive operations
 *
 * Usage (in route files):
 *   const { auditLog } = require('../../middleware/auditLog');
 *
 *   router.delete('/:id', protect, auditLog('lead.delete'), ctrl.remove);
 *   router.patch('/:id/status', protect, auditLog('blog.publish'), ctrl.setStatus);
 *
 * The middleware writes asynchronously — it never blocks the response.
 * A write failure is logged to stderr but does NOT fail the request.
 *
 * Covered actions (convention: "resource.verb"):
 *   lead.create        lead.update        lead.delete
 *   blog.create        blog.publish       blog.delete
 *   appointment.create appointment.update appointment.delete
 *   staff.create       staff.disable      staff.enable
 *   doctor.create      doctor.suspend     doctor.apikey.regenerate
 *   auth.login         auth.password_change
 */

const prisma = require('../config/database');

/**
 * Returns the client IP, accounting for Nginx/proxy forwarding.
 */
const getIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || req.socket?.remoteAddress
  || null;

/**
 * Middleware factory.
 *
 * @param {string} action  - e.g. "lead.delete"
 * @param {function} [getMeta] - optional: (req, res) => object with extra context
 */
const auditLog = (action, getMeta = null) => (req, res, next) => {
  // Store original json() so we can intercept the response
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Only log if the operation succeeded (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const resourceId = parseInt(req.params?.id) || null;
      const doctorId   = req.user.doctorId || req.body?.doctorId || null;
      const metadata   = getMeta ? getMeta(req, body) : null;

      // Fire-and-forget — never block the response
      prisma.auditLog.create({
        data: {
          action,
          resourceId,
          metadata,
          ipAddress: getIp(req),
          userId:    req.user.id,
          doctorId:  doctorId ? parseInt(doctorId) : null,
        },
      }).catch((err) => {
        console.error('[AuditLog] Write failed:', err.message);
      });
    }

    return originalJson(body);
  };

  next();
};

module.exports = { auditLog };
