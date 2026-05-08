const router     = require('express').Router();
const { body }   = require('express-validator');
const controller = require('./auth.controller');
const { protect } = require('../../middleware/auth');
const validate   = require('../../middleware/validate');

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  controller.login
);

// GET /api/auth/me  — requires valid JWT
router.get('/me', protect, controller.getMe);

// POST /api/auth/logout  — requires valid JWT
router.post('/logout', protect, controller.logout);

// PUT /api/auth/profile  — update name / email
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
    body('email').optional().isEmail().withMessage('Enter a valid email').normalizeEmail(),
  ],
  validate,
  controller.updateProfile
);

// PUT /api/auth/change-password  — requires valid JWT
router.put(
  '/change-password',
  protect,
  [
    body('oldPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Must contain a number'),
  ],
  validate,
  controller.changePassword
);

module.exports = router;
