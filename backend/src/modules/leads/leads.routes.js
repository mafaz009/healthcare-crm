const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl   = require('./leads.controller');
const { protect, tenantFilter, requirePermission } = require('../../middleware/auth');
const { auditLog } = require('../../middleware/auditLog');
const validate = require('../../middleware/validate');

const VALID_STATUSES = [
  'NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED',
  'APPOINTMENT_BOOKED', 'NO_RESPONSE', 'NOT_INTERESTED', 'CLOSED',
];

// Base auth: verify JWT + attach tenantFilter. Applied to every lead route.
const auth = [protect, tenantFilter];

const idParam       = param('id').isInt({ min: 1 }).withMessage('Invalid lead ID');
const commentIdPrm  = param('commentId').isInt({ min: 1 }).withMessage('Invalid comment ID');
const followUpIdPrm = param('followUpId').isInt({ min: 1 }).withMessage('Invalid follow-up ID');

// ── GET /api/leads ────────────────────────────────────────────────────────────
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(VALID_STATUSES).withMessage('Invalid status'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid date'),
  query('doctorId').optional().isInt({ min: 1 }),
  query('assignedUserId').optional().isInt({ min: 1 }),
  query('hasFollowUp').optional().isIn(['true', 'false']),
  query('overdue').optional().isIn(['true', 'false']),
], validate, ctrl.getAll);

// ── GET /api/leads/status-counts ──────────────────────────────────────────────
// Must be BEFORE /:id to prevent "status-counts" being parsed as an ID
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
  body('source').optional().trim(),
  body('city').optional().trim(),
  body('campaignName').optional().trim(),
  // UTM params
  body('utmSource').optional().trim(),
  body('utmMedium').optional().trim(),
  body('utmCampaign').optional().trim(),
  body('utmContent').optional().trim(),
  body('utmTerm').optional().trim(),
  // Ads metadata
  body('adSet').optional().trim(),
  body('adName').optional().trim(),
  body('landingPage').optional().trim(),
  body('externalId').optional().trim(),
  // Assignment
  body('assignedUserId').optional({ checkFalsy: true }).isInt({ min: 1 }),
], validate, ctrl.create);

// ── PUT /api/leads/:id ────────────────────────────────────────────────────────
router.put('/:id', auth, [
  idParam,
  body('patientName').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('city').optional().trim(),
  body('source').optional().trim(),
  body('campaignName').optional().trim(),
  body('utmSource').optional().trim(),
  body('utmMedium').optional().trim(),
  body('utmCampaign').optional().trim(),
  body('utmContent').optional().trim(),
  body('utmTerm').optional().trim(),
  body('adSet').optional().trim(),
  body('adName').optional().trim(),
  body('landingPage').optional().trim(),
  body('externalId').optional().trim(),
], validate, ctrl.update);

// ── PATCH /api/leads/:id/status ───────────────────────────────────────────────
router.patch('/:id/status', auth, [
  idParam,
  body('status').isIn(VALID_STATUSES).withMessage('Invalid status value'),
  body('note').optional().trim().isLength({ max: 500 }),
], validate, ctrl.updateStatus);

// ── PATCH /api/leads/:id/assign ───────────────────────────────────────────────
// Assign or un-assign a staff member to this lead.
// Pass null/empty assignedUserId to un-assign.
router.patch('/:id/assign', auth, [
  idParam,
  body('assignedUserId').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid user ID'),
], validate, ctrl.assign);

// ── DELETE /api/leads/:id ─────────────────────────────────────────────────────
router.delete(
  '/:id',
  auth,
  requirePermission('leads', 'delete'),
  [idParam], validate,
  auditLog('lead.delete', (req) => ({ leadId: req.params.id })),
  ctrl.remove
);

// ── POST /api/leads/:id/comments ──────────────────────────────────────────────
router.post('/:id/comments', auth, [
  idParam,
  body('comment').trim().notEmpty().withMessage('Comment cannot be empty')
    .isLength({ max: 2000 }).withMessage('Comment must be under 2000 characters'),
], validate, ctrl.addComment);

// ── DELETE /api/leads/:id/comments/:commentId ─────────────────────────────────
router.delete('/:id/comments/:commentId', auth, [idParam, commentIdPrm], validate, ctrl.deleteComment);

// ── POST /api/leads/:id/follow-ups ────────────────────────────────────────────
// Schedule a follow-up call / callback reminder.
router.post('/:id/follow-ups', auth, [
  idParam,
  body('scheduledAt').isISO8601().withMessage('scheduledAt must be a valid ISO date'),
  body('note').optional().trim().isLength({ max: 1000 }),
], validate, ctrl.createFollowUp);

// ── PATCH /api/leads/:id/follow-ups/:followUpId/complete ──────────────────────
// Mark a follow-up as done (sets completedAt = now).
router.patch('/:id/follow-ups/:followUpId/complete', auth, [
  idParam, followUpIdPrm,
  body('note').optional().trim().isLength({ max: 1000 }),
], validate, ctrl.completeFollowUp);

// ── DELETE /api/leads/:id/follow-ups/:followUpId ──────────────────────────────
router.delete('/:id/follow-ups/:followUpId', auth, [idParam, followUpIdPrm], validate, ctrl.deleteFollowUp);

module.exports = router;
