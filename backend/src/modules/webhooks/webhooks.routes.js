const router     = require('express').Router();
const { body }   = require('express-validator');
const leadSvc    = require('../leads/leads.service');
const { ok, error, unauthorized } = require('../../utils/response');
const validate   = require('../../middleware/validate');
const env        = require('../../config/env');
const prisma     = require('../../config/database');

// ── Webhook auth helper ───────────────────────────────────────────────────────
// Make.com passes a secret in the header so random internet traffic can't spam leads
const webhookAuth = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return unauthorized(res, 'Invalid webhook secret');
  }
  next();
};

/**
 * POST /api/meta-webhook
 *
 * Accepts a Facebook Lead Ad payload forwarded by Make.com.
 *
 * Make.com scenario setup:
 *   Trigger : Facebook Lead Ads → Watch Lead Ads
 *   Action  : HTTP → Make a Request
 *             URL    : https://api.youragency.com/api/meta-webhook
 *             Method : POST
 *             Headers: x-webhook-secret = <WEBHOOK_SECRET from .env>
 *             Body   : JSON mapped from the Facebook fields below
 *
 * Expected body:
 * {
 *   "doctorId"     : 1,
 *   "patientName"  : "{{full_name}}",
 *   "phone"        : "{{phone_number}}",
 *   "email"        : "{{email}}",           // optional
 *   "city"         : "{{city}}",            // optional
 *   "campaignName" : "{{campaign_name}}",   // optional
 *   "source"       : "facebook"             // optional, defaults to "facebook"
 * }
 */
router.post(
  '/meta-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    body('patientName').trim().notEmpty().withMessage('patientName is required'),
    body('phone').trim().notEmpty().withMessage('phone is required'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
  ],
  validate,
  async (req, res) => {
    try {
      const { doctorId, patientName, phone, email, city, campaignName, source } = req.body;

      // Verify the doctorId actually exists and is active
      const doctor = await prisma.doctor.findFirst({
        where: { id: parseInt(doctorId), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!doctor) return error(res, 'Doctor not found or inactive', 404);

      const lead = await leadSvc.create({
        patientName, phone, email, city, campaignName,
        doctorId: doctor.id,
        source: source || 'facebook',
        status: 'NEW',
      });

      return ok(res, { leadId: lead.id }, 'Lead created from webhook');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

/**
 * POST /api/generic-webhook
 *
 * Generic endpoint for any other Make.com scenario
 * (Google Ads, website contact forms, Justdial, etc.)
 * Same payload shape as meta-webhook.
 */
router.post(
  '/generic-webhook',
  webhookAuth,
  [
    body('doctorId').isInt({ min: 1 }).withMessage('doctorId is required'),
    body('patientName').trim().notEmpty().withMessage('patientName is required'),
    body('phone').trim().notEmpty().withMessage('phone is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { doctorId, patientName, phone, email, city, campaignName, source } = req.body;

      const doctor = await prisma.doctor.findFirst({
        where: { id: parseInt(doctorId), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!doctor) return error(res, 'Doctor not found or inactive', 404);

      const lead = await leadSvc.create({
        patientName, phone, email, city, campaignName,
        doctorId: doctor.id,
        source: source || 'website',
        status: 'NEW',
      });

      return ok(res, { leadId: lead.id }, 'Lead created');
    } catch (err) {
      return error(res, err.message, err.statusCode || 500);
    }
  }
);

module.exports = router;
