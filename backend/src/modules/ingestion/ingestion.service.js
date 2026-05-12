/**
 * ingestion.service.js — Core lead ingestion pipeline
 *
 * Shared by all inbound channels: Meta/Facebook, Google, generic webhooks,
 * site-lead (API key auth), and any future channels (WhatsApp, voice, AI agents).
 *
 * Pipeline per submission:
 *   1. Normalize phone
 *   2. Duplicate check  (same phone + doctor within 30 days → skip)
 *   3. Create lead
 *   4. Log outcome (always — success or skip)
 */

const prisma = require('../../config/database');

// ── In-memory per-key rate limiter ────────────────────────────────────────────
//
// Protects /api/public/leads from burst spam on a single API key.
// Uses a sliding-window counter stored in a Map. Works correctly on a
// single-server deployment; upgrade to Redis if you run multiple instances.

const _keyHits = new Map();      // apiKey → [timestampMs, ...]
const RATE_WINDOW_MS = 10 * 60 * 1000;   // 10 minutes
const RATE_MAX_HITS  = 50;                // max 50 submissions per 10 min per key

const checkKeyRateLimit = (apiKey) => {
  const now  = Date.now();
  const hits = (_keyHits.get(apiKey) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX_HITS) return false;
  hits.push(now);
  _keyHits.set(apiKey, hits);
  return true;
};

// ── Phone normalisation ───────────────────────────────────────────────────────

/**
 * Strip formatting from a phone number and return digits only.
 *
 * Rules (Indian-first, but universally safe):
 *   +91 98765 43210  → 9876543210
 *   0 98765 43210   → 9876543210   (landline-style trunk prefix)
 *   98765-43210     → 9876543210
 *   9876543210      → 9876543210   (already clean)
 *
 * Returns null if raw is falsy.
 */
const normalizePhone = (raw) => {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  // +91 / 91 prefix on 12-digit Indian mobile
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  // Leading 0 trunk prefix on 11-digit number
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d || null;
};

// ── Duplicate detection ───────────────────────────────────────────────────────

/**
 * Returns { isDupe: true, existingId, createdAt } if a lead with the same
 * (normalized) phone already exists for this doctor within windowDays.
 * Returns { isDupe: false } otherwise.
 *
 * Matches against both the raw stored phone and the normalized form so that
 * "+91-98765-43210" and "9876543210" are treated as the same lead.
 */
const isDuplicate = async (phone, doctorId, windowDays = 30) => {
  const norm = normalizePhone(phone);
  if (!norm) return { isDupe: false };

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const lead = await prisma.lead.findFirst({
    where: {
      doctorId,
      createdAt: { gte: since },
      OR: [
        { phone: phone },
        { phone: norm },
        { phone: `+91${norm}` },
        { phone: `91${norm}` },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, createdAt: true },
  });

  return lead
    ? { isDupe: true, existingId: lead.id, createdAt: lead.createdAt }
    : { isDupe: false };
};

// ── Ingestion log ─────────────────────────────────────────────────────────────

/**
 * Append one row to ingestion_logs.
 *
 * Fire-and-forget: never throws. A logging failure must NEVER break the
 * primary lead-creation path.
 */
const log = async ({ source, event, doctorId, leadId, phone, externalId, payload, ipAddress, note }) => {
  try {
    await prisma.ingestionLog.create({
      data: {
        source,
        event,
        doctorId,
        leadId:     leadId     || null,
        phone:      normalizePhone(phone),
        externalId: externalId || null,
        // Scrub any null-prototype objects before storing as JSON
        payload:    payload    ? JSON.parse(JSON.stringify(payload)) : null,
        ipAddress:  ipAddress  || null,
        note:       note?.slice(0, 500) || null,
      },
    });
  } catch (err) {
    console.error('[ingestion] log write failed:', err.message);
  }
};

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Full ingestion pipeline — dedup → create → log.
 *
 * @param {object} data         - Inbound payload fields
 * @param {string} source       - Channel: 'meta' | 'google' | 'generic' | 'site-lead' | 'api'
 * @param {number} doctorId     - Already-resolved from API key or webhook body
 * @param {string} [ipAddress]  - Caller IP for audit trail
 *
 * @returns {{ status: 'created' | 'duplicate', lead?, existingId? }}
 */
const ingest = async (data, source, doctorId, ipAddress) => {
  const {
    patientName, phone, email, city, campaignName,
    utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
    adSet, adName, landingPage, externalId,
  } = data;

  const logBase = { source, doctorId, phone, externalId, ipAddress, payload: data };

  // ── 1. Duplicate check ─────────────────────────────────────────────────────
  const dupeResult = await isDuplicate(phone, doctorId);
  if (dupeResult.isDupe) {
    await log({
      ...logBase,
      event: 'duplicate_skipped',
      note:  `Duplicate of lead #${dupeResult.existingId} (created ${dupeResult.createdAt.toISOString()})`,
    });
    return { status: 'duplicate', existingId: dupeResult.existingId };
  }

  // ── 2. Create lead ─────────────────────────────────────────────────────────
  //
  // We require leads.service here (not at the top of the module) to avoid a
  // circular dependency: leads.service → ingestion is fine; the reverse must
  // be a lazy require so Node.js can resolve the module graph.
  const leadSvc = require('../leads/leads.service');

  const lead = await leadSvc.create(
    {
      patientName, phone,
      email:       email       || null,
      city:        city        || null,
      campaignName: campaignName || null,
      doctorId,
      source:      source,
      utmSource:   utmSource   || null,
      utmMedium:   utmMedium   || null,
      utmCampaign: utmCampaign || null,
      utmContent:  utmContent  || null,
      utmTerm:     utmTerm     || null,
      adSet:       adSet       || null,
      adName:      adName      || null,
      landingPage: landingPage || null,
      externalId:  externalId  || null,
      status:      'NEW',
    },
    null,  // no CRM user — webhook has no user context; status history skipped
  );

  // ── 3. Log success ─────────────────────────────────────────────────────────
  await log({
    ...logBase,
    event:  'lead_created',
    leadId: lead.id,
    note:   `Lead #${lead.id} created from ${source}`,
  });

  return { status: 'created', lead };
};

// ── Ingestion log reader ──────────────────────────────────────────────────────

/**
 * Fetch paginated ingestion logs for a doctor (or all if doctorId is null for SUPER_ADMIN).
 */
const getLogs = async ({ doctorId, event, source, dateFrom, dateTo, page = 1, limit = 50 }) => {
  const take = Math.min(parseInt(limit) || 50, 100);
  const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

  const where = {
    ...(doctorId && { doctorId: parseInt(doctorId) }),
    ...(event    && { event }),
    ...(source   && { source }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo   && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          },
        }
      : {}),
  };

  const [logs, total] = await prisma.$transaction([
    prisma.ingestionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true, source: true, event: true,
        phone: true, externalId: true,
        ipAddress: true, note: true, createdAt: true,
        leadId: true,
        lead: { select: { id: true, patientName: true, status: true } },
        doctor: { select: { id: true, name: true } },
      },
    }),
    prisma.ingestionLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);
  return { logs, pagination: { page: parseInt(page), limit: take, total, totalPages } };
};

module.exports = { normalizePhone, isDuplicate, log, ingest, checkKeyRateLimit, getLogs };
