const router     = require('express').Router();
const { body }   = require('express-validator');
const controller = require('./auth.controller');
const { protect } = require('../../middleware/auth');
const validate   = require('../../middleware/validate');

// loginId format constraint — must match utils/loginId.js LOGIN_ID_REGEX
const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]$/;

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Accepts either a loginId ("dr.manmeet") or an email ("dr@clinic.com").
// The service layer detects which by checking for the presence of '@'.
router.post(
  '/login',
  [
    body('identifier')
      .trim()
      .notEmpty().withMessage('Username or email is required')
      .isLength({ min: 2, max: 255 }).withMessage('Enter a valid username or email'),
    body('password')
      .notEmpty().withMessage('Password is required'),
  ],
  validate,
  controller.login
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, controller.getMe);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', protect, controller.logout);

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
// Updates name, contact email, and/or loginId (auth username).
router.put(
  '/profile',
  protect,
  [
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Name cannot be blank'),

    body('email')
      .optional()
      .isEmail().withMessage('Enter a valid email address')
      .normalizeEmail(),

    // loginId: optional; if provided, must pass format rules
    body('loginId')
      .optional()
      .trim()
      .toLowerCase()
      .notEmpty().withMessage('Username cannot be blank')
      .matches(LOGIN_ID_PATTERN)
      .withMessage(
        'Username must be 3–50 lowercase characters. ' +
        'Allowed: letters, numbers, dots, hyphens, underscores. ' +
        'Must start and end with a letter or number.'
      )
      .custom((value) => {
        // Reject consecutive separators ("..","--","__",".-" etc.)
        if (/[._-]{2,}/.test(value)) {
          throw new Error('Username cannot contain consecutive dots, hyphens, or underscores');
        }
        return true;
      }),
  ],
  validate,
  controller.updateProfile
);

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
router.put(
  '/change-password',
  protect,
  [
    body('oldPassword')
      .notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Must contain a number'),
  ],
  validate,
  controller.changePassword
);

module.exports = router;
