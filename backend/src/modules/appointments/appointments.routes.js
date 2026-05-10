const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl   = require('./appointments.controller');
const { protect, tenantFilter, requirePermission } = require('../../middleware/auth');
const { auditLog } = require('../../middleware/auditLog');
const validate = require('../../middleware/validate');

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];

const auth    = [protect, tenantFilter];
const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid appointment ID');

const createRules = [
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('preferredDate').isISO8601().withMessage('preferredDate must be a valid date (YYYY-MM-DD)'),
  body('preferredTime').optional().trim(),
  body('issue').optional().trim(),
  body('notes').optional().trim(),
  body('source').optional().trim(),
  // doctorId only required when SUPER_ADMIN creates on behalf of a doctor
  body('doctorId').if((_, { req }) => req.user?.role === 'SUPER_ADMIN')
    .notEmpty().withMessage('doctorId is required').isInt({ min: 1 }),
];

// ── Fixed-path routes (must be BEFORE /:id) ───────────────────────────────────
router.get('/today',         auth, ctrl.getToday);
router.get('/upcoming',      auth, ctrl.getUpcoming);
router.get('/status-counts', auth, ctrl.getStatusCounts);

// ── GET /api/appointments ─────────────────────────────────────────────────────
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(VALID_STATUSES),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('doctorId').optional().isInt({ min: 1 }),
], validate, ctrl.getAll);

// ── GET /api/appointments/:id ─────────────────────────────────────────────────
router.get('/:id', auth, [idParam], validate, ctrl.getById);

// ── POST /api/appointments ────────────────────────────────────────────────────
router.post('/', auth, createRules, validate, ctrl.create);

// ── PUT /api/appointments/:id ─────────────────────────────────────────────────
router.put('/:id', auth, [
  idParam,
  body('patientName').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('preferredDate').optional().isISO8601(),
  body('preferredTime').optional().trim(),
  body('issue').optional().trim(),
  body('notes').optional().trim(),
], validate, ctrl.update);

// ── PATCH /api/appointments/:id/status ───────────────────────────────────────
router.patch('/:id/status', auth, [
  idParam,
  body('status').isIn(VALID_STATUSES).withMessage('Invalid status value'),
  body('notes').optional().trim(),
], validate, ctrl.updateStatus);

// ── DELETE /api/appointments/:id ──────────────────────────────────────────────
// SUPER_ADMIN + DOCTOR_ADMIN: allowed
// STAFF: blocked by default (requirePermission checks permissions JSON)
router.delete(
  '/:id',
  auth,
  requirePermission('appointments', 'delete'),
  [idParam], validate,
  auditLog('appointment.delete'),
  ctrl.remove
);

module.exports = router;
