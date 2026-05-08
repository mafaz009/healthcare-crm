const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl   = require('./appointments.controller');
const { protect, allowRoles, tenantFilter } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const VALID_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];

const auth   = [protect, tenantFilter];
const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid appointment ID');

const createRules = [
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('preferredDate').isISO8601().withMessage('preferredDate must be a valid date (YYYY-MM-DD)'),
  body('preferredTime').optional().trim(),
  body('issue').optional().trim(),
  body('notes').optional().trim(),
  body('doctorId').if((_, { req }) => req.user?.role === 'SUPER_ADMIN')
    .notEmpty().withMessage('doctorId is required').isInt({ min: 1 }),
];

// ── Fixed-path routes first (before /:id) ─────────────────────────────────────
router.get('/today',          auth, ctrl.getToday);
router.get('/upcoming',       auth, ctrl.getUpcoming);
router.get('/status-counts',  auth, ctrl.getStatusCounts);

// ── Standard CRUD ─────────────────────────────────────────────────────────────
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(VALID_STATUSES),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
], validate, ctrl.getAll);

router.get('/:id',  auth, [idParam], validate, ctrl.getById);
router.post('/',    auth, createRules, validate, ctrl.create);

router.put('/:id',  auth, [
  idParam,
  body('patientName').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('preferredDate').optional().isISO8601(),
  body('preferredTime').optional().trim(),
], validate, ctrl.update);

router.patch('/:id/status', auth, [
  idParam,
  body('status').isIn(VALID_STATUSES).withMessage('Invalid status value'),
  body('notes').optional().trim(),
], validate, ctrl.updateStatus);

router.delete('/:id', [protect, allowRoles('SUPER_ADMIN'), tenantFilter], [idParam], validate, ctrl.remove);

module.exports = router;
