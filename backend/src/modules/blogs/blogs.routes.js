const router   = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl     = require('./blogs.controller');
const { protect, tenantFilter, requirePermission } = require('../../middleware/auth');
const { auditLog } = require('../../middleware/auditLog');
const validate = require('../../middleware/validate');
const upload              = require('../../utils/upload');
const { handleUploadError } = require('../../utils/upload');

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
  // doctorId only required when SUPER_ADMIN creates a blog on behalf of a doctor
  body('doctorId').if((_, { req }) => req.user?.role === 'SUPER_ADMIN')
    .notEmpty().withMessage('doctorId required').isInt({ min: 1 }),
];

// ── GET /api/blogs ────────────────────────────────────────────────────────────
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['DRAFT', 'PUBLISHED']),
  query('doctorId').optional().isInt({ min: 1 }),
], validate, ctrl.getAll);

// ── GET /api/blogs/:id ────────────────────────────────────────────────────────
router.get('/:id', auth, [idParam], validate, ctrl.getById);

// ── POST /api/blogs ───────────────────────────────────────────────────────────
// All roles can create (STAFF creates as DRAFT only — publish button blocked by requirePermission)
router.post(
  '/',
  auth,
  requirePermission('blogs', 'create'),
  createRules, validate,
  ctrl.create
);

// ── PUT /api/blogs/:id ────────────────────────────────────────────────────────
router.put('/:id', auth, [
  idParam,
  body('title').optional().trim().notEmpty()
    .isLength({ max: 300 }),
  body('content').optional().notEmpty(),
  body('seoTitle').optional().trim()
    .isLength({ max: 70 }).withMessage('SEO title must be under 70 characters'),
  body('metaDescription').optional().trim()
    .isLength({ max: 160 }).withMessage('Meta description must be under 160 characters'),
  body('keywords').optional().trim()
    .isLength({ max: 500 }),
], validate, ctrl.update);

// ── POST /api/blogs/:id/image ─────────────────────────────────────────────────
router.post('/:id/image',
  auth,
  [idParam], validate,
  upload.single('image'),
  handleUploadError,   // converts LIMIT_FILE_SIZE / bad MIME → clean JSON 4xx
  ctrl.uploadImage
);

// ── PATCH /api/blogs/:id/status ───────────────────────────────────────────────
// SUPER_ADMIN + DOCTOR_ADMIN: can publish or unpublish
// STAFF: blocked unless User.permissions.blogs.publish = true
router.patch(
  '/:id/status',
  auth,
  requirePermission('blogs', 'publish'),
  [
    idParam,
    body('status').isIn(['DRAFT', 'PUBLISHED']).withMessage('Status must be DRAFT or PUBLISHED'),
  ], validate,
  auditLog('blog.publish', (req) => ({ status: req.body.status })),
  ctrl.setStatus
);

// ── DELETE /api/blogs/:id ─────────────────────────────────────────────────────
// SUPER_ADMIN + DOCTOR_ADMIN: always allowed within their tenant
// STAFF: blocked unless User.permissions.blogs.delete = true
router.delete(
  '/:id',
  auth,
  requirePermission('blogs', 'delete'),
  [idParam], validate,
  auditLog('blog.delete'),
  ctrl.remove
);

module.exports = router;
