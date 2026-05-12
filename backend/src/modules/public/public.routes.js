const router  = require('express').Router();
const { body, query, param } = require('express-validator');
const ctrl    = require('./public.controller');
const { apiKeyAuth } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const env     = require('../../config/env');
const prisma  = require('../../config/database');
const { unauthorized } = require('../../utils/response');

// ── Webhook secret auth (Make.com / Zapier) ───────────────────────────────────
//
// For Make.com scenarios that cannot set X-Api-Key per doctor:
//   Pass x-webhook-secret header = WEBHOOK_SECRET (single shared secret).
//   doctorId MUST be in the request body — it is safe here because the shared
//   secret ensures only trusted automation can call this endpoint.

const webhookAuth = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return unauthorized(res, 'Invalid webhook secret');
  }
  next();
};

// ── Shared lead field validators ──────────────────────────────────────────────

const leadBodyValidators = [
  body('patientName').trim().notEmpty().withMessage('patientName is required'),
  body('phone').trim().notEmpty().withMessage('phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  body('city').optional().trim(),
  body('campaignName').optional().trim(),
  body('utmSource').optional().trim(),
  body('utmMedium').optional().trim(),
  body('utmCampaign').optional().trim(),
  body('utmContent').optional().trim(),
  body('utmTerm').optional().trim(),
  body('adSet').optional().trim(),
  body('adName').optional().trim(),
  body('landingPage').optional().trim(),
  body('externalId').optional().trim(),
];

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
// LEAD INGESTION (API Key auth)  —  doctor websites / landing pages
//
// POST /api/public/leads
//
// Called by: doctor PHP/HTML websites, landing pages.
// Auth: X-Api-Key header (per-doctor, resolved server-side — doctorId never in body).
// Rate limit: 50 submissions per 10 minutes per API key (in-memory, ingestion.service.js).
//
// PHP example:
//   curl -X POST https://api.yourdomain.com/api/public/leads \
//        -H "x-api-key: <doctor_api_key>" \
//        -H "Content-Type: application/json" \
//        -d '{"patientName":"Ravi Kumar","phone":"9876543210","utmSource":"google"}'
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/leads',
  apiKeyAuth,
  leadBodyValidators,
  validate,
  ctrl.ingestLead
);

// ─────────────────────────────────────────────────────────────────────────────
// LEAD INGESTION (Meta/Facebook) — Make.com forwarded webhook
//
// POST /api/public/meta-webhook
//
// Make.com setup:
//   Trigger : Facebook Lead Ads → Watch Lead Ads
//   Action  : HTTP → Make a Request
//     URL    : https://api.yourdomain.com/api/public/meta-webhook
//     Method : POST
//     Headers: x-webhook-secret = <WEBHOOK_SECRET>
//     Body:
//     {
//       "doctorId"    : 1,                      ← resolved by Make.com scenario
//       "patientName" : "{{full_name}}",
//       "phone"       : "{{phone_number}}",
//       "email"       : "{{email}}",
//       "city"        : "{{city}}",
//       "campaignName": "{{campaign_name}}",
//       "adSet"       : "{{ad_set_name}}",
//       "adName"      : "{{ad_name}}",
//       "externalId"  : "{{lead_id}}"
//     }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/meta-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    ...leadBodyValidators,
  ],
  validate,
  ctrl.ingestMetaWebhook
);

// ─────────────────────────────────────────────────────────────────────────────
// LEAD INGESTION (Google Ads)  —  Make.com forwarded webhook
//
// POST /api/public/google-webhook
//
// Make.com setup:
//   Trigger : Google Lead Form Extension
//   Action  : HTTP → Make a Request
//     URL    : https://api.yourdomain.com/api/public/google-webhook
//     Method : POST
//     Headers: x-webhook-secret = <WEBHOOK_SECRET>
//     Body:
//     {
//       "doctorId"    : 1,
//       "patientName" : "...",
//       "phone"       : "...",
//       "email"       : "...",
//       "campaignName": "...",
//       "adSet"       : "{{ad_group_name}}",
//       "adName"      : "{{ad_name}}",
//       "externalId"  : "{{gclid}}"
//     }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/google-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    ...leadBodyValidators,
  ],
  validate,
  ctrl.ingestGoogleWebhook
);

// ─────────────────────────────────────────────────────────────────────────────
// LEAD INGESTION (Generic)  —  Make.com or any other automation
//
// POST /api/public/generic-webhook
//
// Use for: website contact forms via Make.com, Justdial, Practo, WhatsApp,
//          voice-bot callbacks, or any future channel.
//          Pass source in body to identify the channel.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/generic-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    body('source').optional().trim(),
    ...leadBodyValidators,
  ],
  validate,
  ctrl.ingestGenericWebhook
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOGS  —  CRM → doctor website
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/public/blogs
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
router.get(
  '/blogs/:slug',
  apiKeyAuth,
  [param('slug').trim().notEmpty().withMessage('Slug is required')],
  validate,
  ctrl.getBlogBySlug
);

module.exports = router;
