const router  = require('express').Router();
const { body, query, param } = require('express-validator');
const ctrl    = require('./public.controller');
const { apiKeyAuth } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

// ── All public routes require a valid X-Api-Key header ────────────────────────
// The API key identifies WHICH doctor this request belongs to.
// It is set server-side in the PHP/Next.js website — never exposed to the browser.

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS  —  doctor website → CRM
// POST /api/public/appointments
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/appointments',
  apiKeyAuth,
  [
    body('patientName').trim().notEmpty().withMessage('Patient name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('preferredDate').isISO8601().withMessage('preferredDate must be YYYY-MM-DD'),
    body('preferredTime').optional().trim(),
    body('issue').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  ctrl.submitAppointment
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOGS  —  CRM → doctor website
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/public/blogs
// Returns published blog list (no full content — use for listing/archive pages)
// Response shape:
// {
//   blogs: [
//     {
//       id, title, slug, excerpt, featuredImage (absolute URL),
//       seoTitle, metaDescription, keywords, publishedAt, createdAt,
//       author,                           ← doctor.name at top level
//       doctor: { name, specialty, domain }
//     }
//   ],
//   pagination: { page, limit, total, totalPages }
// }
router.get(
  '/blogs',
  apiKeyAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  ctrl.listBlogs
);

// GET /api/public/blogs/:slug
// Returns single published blog with full content + complete SEO package
// Response shape:
// {
//   blog: {
//     id, title, slug, content, excerpt, readingTime,
//     featuredImage (absolute URL), author,
//     seoTitle, metaDescription, keywords,
//     publishedAt, createdAt, updatedAt,
//     doctor: { id, name, specialty, domain, logoUrl }
//   },
//   seo: {
//     title, metaDescription, canonical, keywords,
//     openGraph: { type, title, description, url, image, siteName, publishedAt, modifiedAt },
//     schema: { JSON-LD Article — drop into <script type="application/ld+json"> },
//     breadcrumbSchema: { JSON-LD BreadcrumbList }
//   }
// }
router.get(
  '/blogs/:slug',
  apiKeyAuth,
  [param('slug').trim().notEmpty().withMessage('Slug is required')],
  validate,
  ctrl.getBlogBySlug
);

module.exports = router;
