const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl   = require('./leads.controller');
const { protect, allowRoles, tenantFilter } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

const VALID_STATUSES = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST'];

// All lead routes require login + tenant scoping
const auth = [protect, tenantFilter];

const idParam    = param('id').isInt({ min: 1 }).withMessage('Invalid lead ID');
const commentId  = param('commentId').isInt({ min: 1 }).withMessage('Invalid comment ID');

// ── GET /api/leads  (list with filters) ──────────────────────────────────────
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid date'),
], validate, ctrl.getAll);

// ── GET /api/leads/status-counts  (pipeline summary) ─────────────────────────
// Must be defined BEFORE /:id to avoid Express treating "status-counts" as an ID
router.get('/status-counts', auth, ctrl.getStatusCounts);

// ── GET /api/leads/:id ────────────────────────────────────────────────────────
router.get('/:id', auth, [idParam], validate, ctrl.getById);

// ── POST /api/leads ───────────────────────────────────────────────────────────
router.post('/', auth, [
  body('patientName').trim().notEmpty().withMessage('Patient name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('doctorId').if((_, { req }) => req.user.role === 'SUPER_ADMIN')
    .notEmpty().withMessage('doctorId is required for admin').isInt({ min: 1 }),
  body('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
], validate, ctrl.create);

// ── PUT /api/leads/:id ────────────────────────────────────────────────────────
router.put('/:id', auth, [
  idParam,
  body('patientName').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
], validate, ctrl.update);

// ── PATCH /api/leads/:id/status ───────────────────────────────────────────────
router.patch('/:id/status', auth, [
  idParam,
  body('status').isIn(VALID_STATUSES).withMessage('Invalid status value'),
], validate, ctrl.updateStatus);

// ── DELETE /api/leads/:id  (admin only) ───────────────────────────────────────
router.delete('/:id', [protect, allowRoles('SUPER_ADMIN'), tenantFilter], [idParam], validate, ctrl.remove);

// ── POST /api/leads/:id/comments ──────────────────────────────────────────────
router.post('/:id/comments', auth, [
  idParam,
  body('comment').trim().notEmpty().withMessage('Comment cannot be empty')
    .isLength({ max: 2000 }).withMessage('Comment must be under 2000 characters'),
], validate, ctrl.addComment);

// ── DELETE /api/leads/:id/comments/:commentId ─────────────────────────────────
router.delete('/:id/comments/:commentId', auth, [idParam, commentId], validate, ctrl.deleteComment);

module.exports = router;
