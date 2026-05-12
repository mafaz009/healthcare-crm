const apptSvc      = require('../appointments/appointments.service');
const blogSvc      = require('../blogs/blogs.service');
const ingestionSvc = require('../ingestion/ingestion.service');
const prisma       = require('../../config/database');
const { ok, created, error } = require('../../utils/response');

// ── Appointments ──────────────────────────────────────────────────────────────

const submitAppointment = async (req, res) => {
  try {
    const appt = await apptSvc.createPublic(req.body, req.doctor.id);
    return created(res, appt, 'Appointment request received. We will confirm shortly.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

// ── Lead Ingestion helpers ────────────────────────────────────────────────────

/**
 * Shared ingestion response handler.
 * Converts the pipeline result into the appropriate HTTP response.
 */
const sendIngestionResult = (res, result, source) => {
  if (result.status === 'duplicate') {
    // 200 (not 4xx) — the webhook caller should not retry on duplicates
    return ok(res, { duplicate: true, existingId: result.existingId },
      'Lead already exists. Skipped to prevent duplicate.');
  }
  return created(res, { leadId: result.lead.id }, `Lead received from ${source}`);
};

// ── POST /api/public/leads  (API key auth) ────────────────────────────────────

const ingestLead = async (req, res) => {
  try {
    // Rate-limit check per API key
    if (!ingestionSvc.checkKeyRateLimit(req.headers['x-api-key'] || '')) {
      return error(res, 'Rate limit exceeded. Max 50 leads per 10 minutes per API key.', 429);
    }

    const result = await ingestionSvc.ingest(
      req.body,
      'site-lead',
      req.doctor.id,     // resolved from X-Api-Key by apiKeyAuth middleware
      req.ip,
    );
    return sendIngestionResult(res, result, 'site-lead');
  } catch (err) {
    // Log the failure before responding
    await ingestionSvc.log({
      source:    'site-lead',
      event:     'validation_failed',
      doctorId:  req.doctor?.id,
      phone:     req.body?.phone,
      ipAddress: req.ip,
      payload:   req.body,
      note:      err.message,
    });
    return error(res, err.message, err.statusCode || 500);
  }
};

// ── POST /api/public/meta-webhook  (shared secret) ───────────────────────────

const ingestMetaWebhook = async (req, res) => {
  const { doctorId, patientName, phone, email, city, campaignName,
          utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
          adSet, adName, landingPage, externalId } = req.body;

  try {
    // Verify the doctor is ACTIVE
    const doctor = await prisma.doctor.findFirst({
      where:  { id: parseInt(doctorId), status: 'ACTIVE' },
      select: { id: true },
    });
    if (!doctor) return error(res, 'Doctor not found or inactive', 404);

    const result = await ingestionSvc.ingest(
      {
        patientName, phone, email, city, campaignName,
        source:      'facebook',
        utmSource:   utmSource   || 'facebook',
        utmMedium:   utmMedium   || 'paid_social',
        utmCampaign: utmCampaign || campaignName || null,
        utmContent, utmTerm, adSet, adName, landingPage, externalId,
      },
      'meta',
      doctor.id,
      req.ip,
    );
    return sendIngestionResult(res, result, 'Meta/Facebook');
  } catch (err) {
    await ingestionSvc.log({
      source: 'meta', event: 'validation_failed',
      doctorId: parseInt(doctorId), phone, ipAddress: req.ip,
      payload: req.body, note: err.message,
    });
    return error(res, err.message, err.statusCode || 500);
  }
};

// ── POST /api/public/google-webhook  (shared secret) ─────────────────────────

const ingestGoogleWebhook = async (req, res) => {
  const { doctorId, patientName, phone, email, city, campaignName,
          utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
          adSet, adName, landingPage, externalId } = req.body;

  try {
    const doctor = await prisma.doctor.findFirst({
      where:  { id: parseInt(doctorId), status: 'ACTIVE' },
      select: { id: true },
    });
    if (!doctor) return error(res, 'Doctor not found or inactive', 404);

    const result = await ingestionSvc.ingest(
      {
        patientName, phone, email, city, campaignName,
        source:      'google',
        utmSource:   utmSource   || 'google',
        utmMedium:   utmMedium   || 'cpc',
        utmCampaign: utmCampaign || campaignName || null,
        utmContent, utmTerm, adSet, adName, landingPage,
        externalId,  // gclid
      },
      'google',
      doctor.id,
      req.ip,
    );
    return sendIngestionResult(res, result, 'Google');
  } catch (err) {
    await ingestionSvc.log({
      source: 'google', event: 'validation_failed',
      doctorId: parseInt(doctorId), phone, ipAddress: req.ip,
      payload: req.body, note: err.message,
    });
    return error(res, err.message, err.statusCode || 500);
  }
};

// ── POST /api/public/generic-webhook  (shared secret) ────────────────────────

const ingestGenericWebhook = async (req, res) => {
  const { doctorId, patientName, phone, email, city, campaignName, source,
          utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
          adSet, adName, landingPage, externalId } = req.body;

  try {
    const doctor = await prisma.doctor.findFirst({
      where:  { id: parseInt(doctorId), status: 'ACTIVE' },
      select: { id: true },
    });
    if (!doctor) return error(res, 'Doctor not found or inactive', 404);

    const result = await ingestionSvc.ingest(
      {
        patientName, phone, email, city, campaignName,
        source:      source || 'website',
        utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
        adSet, adName, landingPage, externalId,
      },
      source || 'generic',
      doctor.id,
      req.ip,
    );
    return sendIngestionResult(res, result, source || 'generic');
  } catch (err) {
    await ingestionSvc.log({
      source: source || 'generic', event: 'validation_failed',
      doctorId: parseInt(doctorId), phone, ipAddress: req.ip,
      payload: req.body, note: err.message,
    });
    return error(res, err.message, err.statusCode || 500);
  }
};

// ── Blogs ─────────────────────────────────────────────────────────────────────

const listBlogs = async (req, res) => {
  try {
    const result = await blogSvc.getPublished(req.doctor.id, req.query);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getBlogBySlug = async (req, res) => {
  try {
    const result = await blogSvc.getPublishedBySlug(req.params.slug, req.doctor.id);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = {
  submitAppointment,
  ingestLead, ingestMetaWebhook, ingestGoogleWebhook, ingestGenericWebhook,
  listBlogs, getBlogBySlug,
};
