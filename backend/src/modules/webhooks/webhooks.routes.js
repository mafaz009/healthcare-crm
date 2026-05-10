const router     = require('express').Router();
const { body }   = require('express-validator');
const leadSvc    = require('../leads/leads.service');
const { ok, error, unauthorized } = require('../../utils/response');
const validate   = require('../../middleware/validate');
const env        = require('../../config/env');
const prisma     = require('../../config/database');

// ── Webhook auth helpers ──────────────────────────────────────────────────────

/**
 * Shared-secret auth — used by Make.com / Zapier scenarios.
 * Pass x-webhook-secret header set to WEBHOOK_SECRET from .env
 */
const webhookAuth = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return unauthorized(res, 'Invalid webhook secret');
  }
  next();
};

/**
 * Per-doctor API-key auth — used by client websites / landing pages.
 * Pass x-api-key header equal to the doctor's apiKey.
 * Rejects SUSPENDED doctors (same guard as existing apiKeyAuth middleware).
 */
const apiKeyAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key) return unauthorized(res, 'API key required');

  const doctor = await prisma.doctor.findUnique({
    where: { apiKey: key },
    select: { id: true, status: true },
  });

  if (!doctor)                       return unauthorized(res, 'Invalid API key');
  if (doctor.status === 'SUSPENDED') return unauthorized(res, 'Account suspended');

  // Attach resolved doctorId — webhook body doesn't need to provide it
  req.doctorId = doctor.id;
  next();
};

// ── Shared lead field validators ──────────────────────────────────────────────
const leadBodyValidators = [
  body('patientName').trim().notEmpty().withMessage('patientName is required'),
  body('phone').trim().notEmpty().withMessage('phone is required'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  // UTM params
  body('utmSource').optional().trim(),
  body('utmMedium').optional().trim(),
  body('utmCampaign').optional().trim(),
  body('utmContent').optional().trim(),
  body('utmTerm').optional().trim(),
  // Ads metadata
  body('adSet').optional().trim(),
  body('adName').optional().trim(),
  body('landingPage').optional().trim(),
  body('externalId').optional().trim(),  // Meta lead_id / Google gclid
];

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/meta-webhook
 *
 * Facebook Lead Ads payload forwarded by Make.com.
 *
 * Make.com setup:
 *   Trigger : Facebook Lead Ads → Watch Lead Ads
 *   Action  : HTTP → Make a Request
 *     URL    : https://api.yourdomain.com/api/meta-webhook
 *     Method : POST
 *     Headers: x-webhook-secret = <WEBHOOK_SECRET>
 *     Body   : {
 *       "doctorId"     : 1,
 *       "patientName"  : "{{full_name}}",
 *       "phone"        : "{{phone_number}}",
 *       "email"        : "{{email}}",
 *       "city"         : "{{city}}",
 *       "campaignName" : "{{campaign_name}}",
 *       "adSet"        : "{{ad_set_name}}",
 *       "adName"       : "{{ad_name}}",
 *       "externalId"   : "{{lead_id}}",       <- Facebook lead_id
 *       "utmSource"    : "facebook",
 *       "utmMedium"    : "paid_social",
 *       "utmCampaign"  : "{{campaign_name}}"
 *     }
 */
router.post(
  '/meta-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    ...leadBodyValidators,
  ],
  validate,
  async (req, res) => {
    try {
      const {
        doctorId, patientName, phone, email, city, campaignName, source,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
      } = req.body;

      const doctor = await prisma.doctor.findFirst({
        where: { id: parseInt(doctorId), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!doctor) return error(res, 'Doctor not found or inactive', 404);

      const lead = await leadSvc.create({
        patientName, phone, email, city, campaignName,
        doctorId: doctor.id,
        source:       source       || 'facebook',
        utmSource:    utmSource    || 'facebook',
        utmMedium:    utmMedium    || 'paid_social',
        utmCampaign:  utmCampaign  || campaignName || null,
        utmContent:   utmContent   || null,
        utmTerm:      utmTerm      || null,
        adSet:        adSet        || null,
        adName:       adName       || null,
        landingPage:  landingPage  || null,
        externalId:   externalId   || null,
        status: 'NEW',
      });

      return ok(res, { leadId: lead.id }, 'Lead created from Meta webhook');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/google-webhook
 *
 * Google Ads / Google Lead Form Extension forwarded by Make.com.
 *
 *   Headers: x-webhook-secret = <WEBHOOK_SECRET>
 *   Body: {
 *     "doctorId"    : 1,
 *     "patientName" : "...",
 *     "phone"       : "...",
 *     "email"       : "...",
 *     "city"        : "...",
 *     "campaignName": "...",
 *     "adSet"       : "{{ad_group_name}}",
 *     "adName"      : "{{ad_name}}",
 *     "externalId"  : "{{gclid}}",
 *     "utmSource"   : "google",
 *     "utmMedium"   : "cpc"
 *   }
 */
router.post(
  '/google-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    ...leadBodyValidators,
  ],
  validate,
  async (req, res) => {
    try {
      const {
        doctorId, patientName, phone, email, city, campaignName, source,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
      } = req.body;

      const doctor = await prisma.doctor.findFirst({
        where: { id: parseInt(doctorId), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!doctor) return error(res, 'Doctor not found or inactive', 404);

      const lead = await leadSvc.create({
        patientName, phone, email, city, campaignName,
        doctorId: doctor.id,
        source:       source       || 'google',
        utmSource:    utmSource    || 'google',
        utmMedium:    utmMedium    || 'cpc',
        utmCampaign:  utmCampaign  || campaignName || null,
        utmContent:   utmContent   || null,
        utmTerm:      utmTerm      || null,
        adSet:        adSet        || null,
        adName:       adName       || null,
        landingPage:  landingPage  || null,
        externalId:   externalId   || null,  // gclid
        status: 'NEW',
      });

      return ok(res, { leadId: lead.id }, 'Lead created from Google webhook');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/generic-webhook
 *
 * Generic endpoint for any Make.com scenario (website forms, Justdial, etc.)
 * Uses shared-secret auth.
 */
router.post(
  '/generic-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    ...leadBodyValidators,
  ],
  validate,
  async (req, res) => {
    try {
      const {
        doctorId, patientName, phone, email, city, campaignName, source,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
      } = req.body;

      const doctor = await prisma.doctor.findFirst({
        where: { id: parseInt(doctorId), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!doctor) return error(res, 'Doctor not found or inactive', 404);

      const lead = await leadSvc.create({
        patientName, phone, email, city, campaignName,
        doctorId: doctor.id,
        source:      source      || 'website',
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
        status: 'NEW',
      });

      return ok(res, { leadId: lead.id }, 'Lead created');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/site-lead
 *
 * Called directly by client PHP/HTML websites using their doctor API key.
 * No shared secret needed — authenticated via x-api-key header.
 * doctorId is resolved from the API key, not the body.
 *
 * Usage in PHP:
 *   curl -X POST https://api.yourdomain.com/api/site-lead \
 *        -H "x-api-key: <doctor_api_key>" \
 *        -H "Content-Type: application/json" \
 *        -d '{"patientName":"...","phone":"...","utmSource":"google"}'
 */
router.post(
  '/site-lead',
  apiKeyAuth,
  leadBodyValidators,
  validate,
  async (req, res) => {
    try {
      const {
        patientName, phone, email, city, campaignName, source,
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
      } = req.body;

      const lead = await leadSvc.create({
        patientName, phone, email, city, campaignName,
        doctorId: req.doctorId,  // resolved from API key by apiKeyAuth
        source:      source      || 'website',
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
        status: 'NEW',
      });

      return ok(res, { leadId: lead.id }, 'Lead received');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

module.exports = router;
