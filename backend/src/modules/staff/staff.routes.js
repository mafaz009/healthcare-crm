/**
 * Staff management routes — /api/staff
 *
 * DOCTOR_ADMIN can manage staff within their own tenant (doctorId enforced server-side).
 * SUPER_ADMIN can manage staff across all tenants (no restriction).
 * STAFF role has no access to any of these routes.
 *
 * This module replaces the /api/doctors/:id/staff sub-routes which required SUPER_ADMIN.
 * Those sub-routes remain for backwards compatibility but delegate here.
 */

const router  = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl    = require('./staff.controller');
const { protect, allowRoles, tenantFilter } = require('../../middleware/auth');
const { auditLog } = require('../../middleware/auditLog');
const validate = require('../../middleware/validate');

// Both DOCTOR_ADMIN and SUPER_ADMIN can access these routes
const canManageStaff = [
  protect,
  allowRoles('SUPER_ADMIN', 'DOCTOR_ADMIN'),
  tenantFilter,
];

// ── Validation ────────────────────────────────────────────────────────────────

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  // DOCTOR_ADMIN cannot assign staff to a different doctorId — enforced in controller.
  // SUPER_ADMIN can specify doctorId explicitly.
  body('doctorId').optional().isInt({ min: 1 }).withMessage('Invalid doctorId'),
  body('permissions').optional().isObject().withMessage('permissions must be an object'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  body('permissions').optional().isObject().withMessage('permissions must be an object'),
];

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid staff ID');

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/staff
// SUPER_ADMIN: returns all staff (can filter by ?doctorId=X)
// DOCTOR_ADMIN: returns only their own staff
router.get('/', canManageStaff, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('doctorId').optional().isInt({ min: 1 }),
  query('isActive').optional().isBoolean(),
], validate, ctrl.getAll);

// GET /api/staff/:id
router.get('/:id', canManageStaff, [idParam], validate, ctrl.getById);

// POST /api/staff
// Creates a staff user under the requesting DOCTOR_ADMIN's tenant.
// SUPER_ADMIN must supply doctorId in body.
router.post(
  '/',
  canManageStaff,
  createRules,
  validate,
  auditLog('staff.create', (req) => ({ email: req.body.email, name: req.body.name })),
  ctrl.create
);

// PATCH /api/staff/:id — update name, isActive, permissions
router.patch(
  '/:id',
  canManageStaff,
  [idParam, ...updateRules],
  validate,
  auditLog('staff.update'),
  ctrl.update
);

// PATCH /api/staff/:id/enable  |  /api/staff/:id/disable
// Separate disable route to enforce audit logging on security-sensitive action
router.patch(
  '/:id/disable',
  canManageStaff,
  [idParam],
  validate,
  auditLog('staff.disable'),
  ctrl.disable
);

router.patch(
  '/:id/enable',
  canManageStaff,
  [idParam],
  validate,
  auditLog('staff.enable'),
  ctrl.enable
);

// PATCH /api/staff/:id/permissions — set granular permission overrides
router.patch(
  '/:id/permissions',
  canManageStaff,
  [
    idParam,
    body('permissions').isObject().withMessage('permissions must be an object'),
  ],
  validate,
  auditLog('staff.permissions'),
  ctrl.updatePermissions
);

module.exports = router;
