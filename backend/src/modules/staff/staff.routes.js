/**
 * Staff management routes — /api/staff
 *
 * DOCTOR_ADMIN can manage staff within their own tenant (doctorId enforced server-side).
 * SUPER_ADMIN can manage staff across all tenants (no restriction).
 * STAFF role has no access to any of these routes.
 */

const router  = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl    = require('./staff.controller');
const { protect, allowRoles, tenantFilter } = require('../../middleware/auth');
const { auditLog } = require('../../middleware/auditLog');
const validate = require('../../middleware/validate');

const canManageStaff = [
  protect,
  allowRoles('SUPER_ADMIN', 'DOCTOR_ADMIN'),
  tenantFilter,
];

// ── Params & validators ───────────────────────────────────────────────────────

const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid staff ID');

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  // password is OPTIONAL — if omitted, a temporary password is auto-generated
  // and mustChangePassword is set to true (invite flow).
  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('doctorId').optional().isInt({ min: 1 }).withMessage('Invalid doctorId'),
  body('permissions').optional().isObject().withMessage('permissions must be an object'),
];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  body('permissions').optional().isObject().withMessage('permissions must be an object'),
];

// ── CRUD ──────────────────────────────────────────────────────────────────────

// GET /api/staff
router.get('/', canManageStaff, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('doctorId').optional().isInt({ min: 1 }),
  query('isActive').optional().isBoolean(),
], validate, ctrl.getAll);

// GET /api/staff/:id
router.get('/:id', canManageStaff, [idParam], validate, ctrl.getById);

// POST /api/staff
// Without password: invite flow — auto-generates temp password, sets mustChangePassword
// With password: explicit flow — creates account with supplied password
router.post(
  '/',
  canManageStaff,
  createRules,
  validate,
  ctrl.create
);

// PATCH /api/staff/:id
router.patch(
  '/:id',
  canManageStaff,
  [idParam, ...updateRules],
  validate,
  auditLog('staff.update'),
  ctrl.update
);

// ── Status ────────────────────────────────────────────────────────────────────

router.patch(
  '/:id/disable',
  canManageStaff,
  [idParam], validate,
  ctrl.disable
);

router.patch(
  '/:id/enable',
  canManageStaff,
  [idParam], validate,
  ctrl.enable
);

// ── Permissions ───────────────────────────────────────────────────────────────

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

// ── Credential management ─────────────────────────────────────────────────────

/**
 * POST /api/staff/:id/reset-password
 *
 * Generates a new temporary password, forces the user to change it on next login,
 * and immediately invalidates all active sessions via tokenVersion increment.
 *
 * Response includes `tempPassword` — show it to the admin ONCE, then discard.
 * The plaintext is never stored.
 *
 * DOCTOR_ADMIN: can only reset their own tenant's staff passwords.
 * SUPER_ADMIN: can reset any staff member's password.
 * Security: tenant ownership enforced in the service via getOwnedStaff().
 */
router.post(
  '/:id/reset-password',
  canManageStaff,
  [idParam], validate,
  ctrl.resetPassword
);

/**
 * POST /api/staff/:id/force-logout
 *
 * Increments tokenVersion — every active JWT for this user immediately becomes
 * invalid. The user will receive 401 on their next API request and must re-login.
 *
 * Use cases:
 *   - Staff member left the clinic
 *   - Suspicious activity detected
 *   - Shared device needs to be cleared
 */
router.post(
  '/:id/force-logout',
  canManageStaff,
  [idParam], validate,
  ctrl.forceLogout
);

module.exports = router;
