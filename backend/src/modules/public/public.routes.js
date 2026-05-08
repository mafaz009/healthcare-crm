const router   = require('express').Router();
const { body, query, param } = require('express-validator');
const apptSvc  = require('../appointments/appointments.service');
const blogSvc  = require('../blogs/blogs.service');
const { ok, created, error } = require('../../utils/response');
const { apiKeyAuth } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENTS  (external doctor website → CRM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/public/appointments
 *
 * Doctor website submits a booking form. The doctorId is resolved from
 * the X-Api-Key header — never trust the request body for tenancy.
 *
 * PHP:
 *   curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-Api-Key: <key>']);
 *
 * WordPress:
 *   wp_remote_post(URL, ['headers' => ['X-Api-Key' => API_KEY], ...]);
 *
 * Next.js:
 *   fetch(URL, { headers: { 'X-Api-Key': process.env.DOCTOR_API_KEY }, ... });
 */
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
  async (req, res) => {
    try {
      const appt = await apptSvc.createPublic(req.body, req.doctor.id);
      return created(res, appt, 'Appointment request received. We will confirm shortly.');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOGS  (CRM → doctor website — for SEO server-side rendering)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/public/blogs
 *
 * Returns published blog list for a doctor website.
 * Use for building /blog listing pages server-side.
 *
 * Response: { blogs: [...], pagination: {...} }
 * Each blog: { id, title, slug, featuredImage, seoTitle, metaDescription, publishedAt }
 * No content field in list — fetch /api/public/blogs/:slug for full content.
 *
 * Next.js ISR example:
 *   export async function getStaticProps() {
 *     const res = await fetch(`${API}/api/public/blogs`, {
 *       headers: { 'X-Api-Key': process.env.DOCTOR_API_KEY }
 *     });
 *     const { data } = await res.json();
 *     return { props: { blogs: data.blogs }, revalidate: 3600 };
 *   }
 */
router.get(
  '/blogs',
  apiKeyAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await blogSvc.getPublished(req.doctor.id, req.query);
      return ok(res, result);
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

/**
 * GET /api/public/blogs/:slug
 *
 * Returns a single published blog post with a complete SEO package.
 * Use this in SSR/ISR to render the full blog page on the doctor's domain.
 *
 * Response:
 * {
 *   blog: { title, slug, content, featuredImage, publishedAt, ... },
 *   seo: {
 *     title, metaDescription, canonical, keywords,
 *     openGraph: { title, description, image, url, ... },
 *     schema: { JSON-LD Article },
 *     breadcrumbSchema: { JSON-LD BreadcrumbList }
 *   }
 * }
 *
 * Next.js SSR example — renders full HTML for crawlers:
 *   export async function getServerSideProps({ params }) {
 *     const res  = await fetch(`${API}/api/public/blogs/${params.slug}`, {
 *       headers: { 'X-Api-Key': process.env.DOCTOR_API_KEY }
 *     });
 *     if (!res.ok) return { notFound: true };
 *     const { data } = await res.json();
 *     return { props: data };
 *   }
 *
 * PHP SSR example:
 *   $ch = curl_init("$API/api/public/blogs/$slug");
 *   curl_setopt($ch, CURLOPT_HTTPHEADER, ['X-Api-Key: ' . API_KEY]);
 *   $data = json_decode(curl_exec($ch), true)['data'];
 *   // Then render $data['blog']['content'] and $data['seo'] in PHP template
 *
 * WordPress (functions.php):
 *   $response = wp_remote_get("$api_url/api/public/blogs/$slug", [
 *     'headers' => ['X-Api-Key' => get_option('crm_api_key')]
 *   ]);
 *   $data = json_decode(wp_remote_retrieve_body($response), true)['data'];
 */
router.get(
  '/blogs/:slug',
  apiKeyAuth,
  [param('slug').trim().notEmpty().withMessage('Slug is required')],
  validate,
  async (req, res) => {
    try {
      const result = await blogSvc.getPublishedBySlug(req.params.slug, req.doctor.id);
      return ok(res, result);
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

module.exports = router;
