const router   = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl     = require('./blogs.controller');
const { protect, allowRoles, tenantFilter } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const upload   = require('../../utils/upload');

const auth    = [protect, tenantFilter];
const idParam = param('id').isInt({ min: 1 }).withMessage('Invalid blog ID');

const createRules = [
  body('title').trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 300 }).withMessage('Title must be under 300 characters'),
  body('content').notEmpty().withMessage('Content is required'),
  body('seoTitle').optional().trim()
    .isLength({ max: 70 }).withMessage('SEO title must be under 70 characters'),
  body('metaDescription').optional().trim()
    .isLength({ max: 160 }).withMessage('Meta description must be under 160 characters'),
  body('keywords').optional().trim()
    .isLength({ max: 500 }).withMessage('Keywords must be under 500 characters'),
  body('doctorId').if((_, { req }) => req.user?.role === 'SUPER_ADMIN')
    .notEmpty().withMessage('doctorId required').isInt({ min: 1 }),
];

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['DRAFT', 'PUBLISHED']),
], validate, ctrl.getAll);

router.get('/:id', auth, [idParam], validate, ctrl.getById);

router.post('/', auth, createRules, validate, ctrl.create);

router.put('/:id', auth, [
  idParam,
  body('title').optional().trim().notEmpty()
    .isLength({ max: 300 }),
  body('seoTitle').optional().trim()
    .isLength({ max: 70 }).withMessage('SEO title must be under 70 characters'),
  body('metaDescription').optional().trim()
    .isLength({ max: 160 }).withMessage('Meta description must be under 160 characters'),
  body('keywords').optional().trim()
    .isLength({ max: 500 }),
], validate, ctrl.update);

// POST /api/blogs/:id/image  — multipart/form-data, field name: "image"
router.post('/:id/image',
  auth,
  [idParam], validate,
  upload.single('image'),
  ctrl.uploadImage
);

// PATCH /api/blogs/:id/status
router.patch('/:id/status', auth, [
  idParam,
  body('status').isIn(['DRAFT', 'PUBLISHED']).withMessage('Status must be DRAFT or PUBLISHED'),
], validate, ctrl.setStatus);

// DELETE — only admin or the doctor who owns the blog
router.delete('/:id', auth, [idParam], validate, ctrl.remove);

module.exports = router;
