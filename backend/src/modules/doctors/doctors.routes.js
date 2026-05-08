const router     = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl       = require('./doctors.controller');
const { protect, allowRoles } = require('../../middleware/auth');
const validate   = require('../../middleware/validate');

// All doctor routes require a logged-in Super Admin
const adminOnly = [protect, allowRoles('SUPER_ADMIN')];

// ── Validation rule sets ──────────────────────────────────────────────────────
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
];

const staffRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('loginPassword').optional().isLength({ min: 8 }),
];

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid ID');

// ── Routes ────────────────────────────────────────────────────────────────────

// GET  /api/doctors
router.get('/', adminOnly, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE']),
], validate, ctrl.getAll);

// GET  /api/doctors/:id
router.get('/:id', adminOnly, [idParam], validate, ctrl.getById);

// POST /api/doctors
router.post('/', adminOnly, createRules, validate, ctrl.create);

// PUT  /api/doctors/:id
router.put('/:id', adminOnly, [idParam, ...updateRules], validate, ctrl.update);

// PATCH /api/doctors/:id/status
router.patch('/:id/status', adminOnly, [
  idParam,
  body('status').isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be ACTIVE or INACTIVE'),
], validate, ctrl.setStatus);

// POST /api/doctors/:id/regenerate-key
router.post('/:id/regenerate-key', adminOnly, [idParam], validate, ctrl.regenerateApiKey);

// GET  /api/doctors/:id/stats
router.get('/:id/stats', protect, [idParam], validate, ctrl.getStats);

// ── Staff sub-routes ──────────────────────────────────────────────────────────

// GET  /api/doctors/:id/staff
router.get('/:id/staff', adminOnly, [idParam], validate, ctrl.getStaff);

// POST /api/doctors/:id/staff
router.post('/:id/staff', adminOnly, [idParam, ...staffRules], validate, ctrl.createStaff);

// PATCH /api/doctors/:id/staff/:userId/status
router.patch('/:id/staff/:userId/status', adminOnly, [
  idParam,
  param('userId').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('isActive').isBoolean().withMessage('isActive must be true or false'),
], validate, ctrl.setStaffStatus);

module.exports = router;
