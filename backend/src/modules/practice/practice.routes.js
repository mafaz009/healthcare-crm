/**
 * My Practice routes — /api/practice
 *
 * Allows DOCTOR_ADMIN to view and update their own clinic/practice profile
 * without needing SUPER_ADMIN access.
 *
 * Writable fields: name, specialty, phone, address, logoUrl
 * Locked fields (require SUPER_ADMIN): email, domain, apiKey, status, plan
 *
 * The "my" pattern (acting on req.user.doctorId) means no :id param needed —
 * you can never accidentally update a different tenant's data.
 */

const router  = require('express').Router();
const { body, query } = require('express-validator');
const ctrl    = require('./practice.controller');
const { protect, allowRoles } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { uploadLogo, handleUploadError } = require('../../utils/upload');

const doctorOnly = [protect, allowRoles('DOCTOR_ADMIN', 'SUPER_ADMIN')];

const updateRules = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
  body('specialty').optional().trim().notEmpty().withMessage('Specialty cannot be blank'),
  body('phone').optional().isMobilePhone().withMessage('Enter a valid phone number'),
  body('address').optional().isString(),
];

// GET  /api/practice — get own practice profile
router.get('/', doctorOnly, ctrl.get);

// PUT  /api/practice — update own practice profile
router.put('/', doctorOnly, updateRules, validate, ctrl.update);

// POST /api/practice/logo — upload practice logo
router.post('/logo', doctorOnly, uploadLogo.single('logo'), handleUploadError, ctrl.uploadLogo);

// POST /api/practice/regenerate-key — regenerate own API key
// DOCTOR_ADMIN can rotate their own key without needing super admin
router.post('/regenerate-key', doctorOnly, ctrl.regenerateApiKey);

// GET /api/practice/ingestion-logs — paginated ingestion event log for this practice
router.get(
  '/ingestion-logs',
  doctorOnly,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('event').optional().isIn(['lead_created', 'duplicate_skipped', 'validation_failed', 'spam_blocked']),
    query('source').optional().trim(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
  ],
  validate,
  ctrl.getIngestionLogs,
);

module.exports = router;
