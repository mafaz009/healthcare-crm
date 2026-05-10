const router     = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl       = require('./doctors.controller');
const { protect, allowRoles, tenantFilter } = require('../../middleware/auth');
const { auditLog } = require('../../middleware/auditLog');
const validate   = require('../../middleware/validate');

// All doctor management routes require SUPER_ADMIN
const adminOnly = [protect, allowRoles('SUPER_ADMIN')];

// ── Validation rules ──────────────────────────────────────────────────────────

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('specialty').trim().notEmpty().withMessage('Specialty is required'),
  body('domain').trim().notEmpty().withMessage('Domain is required')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/)
    .withMessage('Enter a valid domain (e.g. drsmith.com)'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional().isMobilePhone().withMessage('Enter a valid phone number'),
  body('loginPassword').optional().isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
  body('specialty').optional().trim().notEmpty(),
  body('domain').optional().trim()
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/)
    .withMessage('Enter a valid domain'),
  body('phone').optional().isMobilePhone().withMessage('Enter a valid phone number'),
  body('address').optional().isString(),
  body('plan').optional().isIn(['BASIC', 'PROFESSIONAL', 'ENTERPRISE']),
];

const staffRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('loginPassword').optional().isLength({ min: 8 }),
];

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid ID');

// ── Doctor CRUD (SUPER_ADMIN only) ────────────────────────────────────────────

// GET /api/doctors
router.get('/', adminOnly, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  query('plan').optional().isIn(['BASIC', 'PROFESSIONAL', 'ENTERPRISE']),
], validate, ctrl.getAll);

// GET /api/doctors/:id
router.get('/:id', adminOnly, [idParam], validate, ctrl.getById);

// POST /api/doctors
router.post(
  '/',
  adminOnly,
  createRules, validate,
  auditLog('doctor.create', (req) => ({ name: req.body.name, email: req.body.email })),
  ctrl.create
);

// PUT /api/doctors/:id
router.put('/:id', adminOnly, [idParam, ...updateRules], validate, ctrl.update);

// PATCH /api/doctors/:id/status
router.patch(
  '/:id/status',
  adminOnly,
  [
    idParam,
    body('status').isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
      .withMessage('Status must be ACTIVE, INACTIVE, or SUSPENDED'),
  ], validate,
  auditLog('doctor.status_change', (req) => ({ status: req.body.status })),
  ctrl.setStatus
);

// POST /api/doctors/:id/regenerate-key
router.post(
  '/:id/regenerate-key',
  adminOnly,
  [idParam], validate,
  auditLog('doctor.apikey.regenerate'),
  ctrl.regenerateApiKey
);

// GET /api/doctors/:id/stats
// FIXED: was protect-only (any user could see any doctor's stats). Now adminOnly.
router.get('/:id/stats', adminOnly, [idParam], validate, ctrl.getStats);

// ── Staff sub-routes under /api/doctors/:id/staff ─────────────────────────────
// Kept for SUPER_ADMIN use. DOCTOR_ADMIN uses /api/staff instead.

// GET /api/doctors/:id/staff
router.get('/:id/staff', adminOnly, [idParam], validate, ctrl.getStaff);

// POST /api/doctors/:id/staff
router.post(
  '/:id/staff',
  adminOnly,
  [idParam, ...staffRules], validate,
  auditLog('staff.create', (req) => ({ email: req.body.email, doctorId: req.params.id })),
  ctrl.createStaff
);

// PATCH /api/doctors/:id/staff/:userId/status
router.patch(
  '/:id/staff/:userId/status',
  adminOnly,
  [
    idParam,
    param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
    body('isActive').isBoolean().withMessage('isActive must be true or false'),
  ], validate,
  auditLog('staff.status_change', (req) => ({ isActive: req.body.isActive, userId: req.params.userId })),
  ctrl.setStaffStatus
);

module.exports = router;
