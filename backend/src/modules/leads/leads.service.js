const prisma = require('../../config/database');
const { paginate, paginationMeta } = require('../../utils/pagination');

// ── Selectors ─────────────────────────────────────────────────────────────────

const ASSIGNED_USER_SELECT = { id: true, name: true, role: true, loginId: true };

const LEAD_SELECT = {
  id: true, patientName: true, phone: true, email: true,
  city: true, source: true, campaignName: true, status: true,
  utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
  adSet: true, adName: true, landingPage: true, externalId: true,
  followUpAt: true,
  assignedUserId: true,                                // scalar FK — needed by frontend picker
  doctorId: true, createdAt: true, updatedAt: true,
  doctor:       { select: { id: true, name: true, specialty: true } },
  assignedUser: { select: ASSIGNED_USER_SELECT },
};

const COMMENT_SELECT = {
  id: true, comment: true, createdAt: true,
  user: { select: { id: true, name: true, role: true } },
};

const FOLLOW_UP_SELECT = {
  id: true, scheduledAt: true, completedAt: true, note: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, role: true } },
};

const STATUS_HISTORY_SELECT = {
  id: true, fromStatus: true, toStatus: true, note: true, createdAt: true,
  changedBy: { select: { id: true, name: true, role: true } },
};

const LEAD_DETAIL_SELECT = {
  ...LEAD_SELECT,
  comments: {
    orderBy: { createdAt: 'asc' },
    select: COMMENT_SELECT,
  },
  followUps: {
    orderBy: { scheduledAt: 'asc' },
    select: FOLLOW_UP_SELECT,
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    select: STATUS_HISTORY_SELECT,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch a lead and verify it belongs to the requesting tenant.
 * Uses findFirst so the tenantFilter (empty for SUPER_ADMIN) applies automatically.
 */
const assertOwnership = async (id, tenantFilter) => {
  const lead = await prisma.lead.findFirst({
    where: { id, ...tenantFilter },
    select: { id: true, status: true, doctorId: true, followUpAt: true },
  });
  if (!lead) throw { statusCode: 404, message: 'Lead not found' };
  return lead;
};

/**
 * Write a status history entry. Fire-and-forget safe (caller awaits).
 */
const recordStatusChange = (leadId, fromStatus, toStatus, changedById, note) =>
  prisma.leadStatusHistory.create({
    data: { leadId, fromStatus: fromStatus || null, toStatus, changedById, note: note || null },
  });

/**
 * Recompute the denormalised followUpAt on the lead from pending follow-up tasks.
 * Sets followUpAt = earliest pending task's scheduledAt (NULL if none).
 */
const syncFollowUpAt = async (leadId) => {
  const next = await prisma.leadFollowUp.findFirst({
    where: { leadId, completedAt: null },
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { followUpAt: next?.scheduledAt ?? null },
  });
};

// ── LIST ──────────────────────────────────────────────────────────────────────

const getAll = async (query, tenantFilter) => {
  const { skip, take, page, limit } = paginate(query);
  const {
    search, status, source, doctorId,
    dateFrom, dateTo, campaignName,
    assignedUserId, hasFollowUp, overdue,
  } = query;

  const now = new Date();

  const where = {
    ...tenantFilter,
    ...(status         && { status }),
    ...(source         && { source: { contains: source } }),
    ...(campaignName   && { campaignName: { contains: campaignName } }),
    ...(assignedUserId && { assignedUserId: parseInt(assignedUserId) }),
    // Super admin can drill into a specific doctor
    ...(doctorId && !tenantFilter.doctorId && { doctorId: parseInt(doctorId) }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo   && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          },
        }
      : {}),
    // hasFollowUp=true → followUpAt is set; false → null
    ...(hasFollowUp === 'true'  && { followUpAt: { not: null } }),
    ...(hasFollowUp === 'false' && { followUpAt: null }),
    // overdue=true → followUpAt is in the past and not null
    ...(overdue === 'true' && { followUpAt: { not: null, lt: now } }),
    ...(search && {
      OR: [
        { patientName: { contains: search } },
        { phone:       { contains: search } },
        { email:       { contains: search } },
        { city:        { contains: search } },
      ],
    }),
  };

  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      select: LEAD_SELECT,
      skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, pagination: paginationMeta(total, page, limit) };
};

// ── SINGLE (full detail) ──────────────────────────────────────────────────────

const getById = async (id, tenantFilter) => {
  const lead = await prisma.lead.findFirst({
    where: { id, ...tenantFilter },
    select: LEAD_DETAIL_SELECT,
  });
  if (!lead) throw { statusCode: 404, message: 'Lead not found' };
  return lead;
};

// ── CREATE ────────────────────────────────────────────────────────────────────

const create = async (data, createdByUser) => {
  const {
    patientName, phone, email, city, source, campaignName, doctorId, status,
    utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
    adSet, adName, landingPage, externalId,
    assignedUserId,
  } = data;

  const initialStatus = status || 'NEW';

  const lead = await prisma.lead.create({
    data: {
      patientName, phone,
      email:        email        || null,
      city:         city         || null,
      source:       source       || null,
      campaignName: campaignName || null,
      utmSource:    utmSource    || null,
      utmMedium:    utmMedium    || null,
      utmCampaign:  utmCampaign  || null,
      utmContent:   utmContent   || null,
      utmTerm:      utmTerm      || null,
      adSet:        adSet        || null,
      adName:       adName       || null,
      landingPage:  landingPage  || null,
      externalId:   externalId   || null,
      doctorId: parseInt(doctorId),
      status:   initialStatus,
      ...(assignedUserId && { assignedUserId: parseInt(assignedUserId) }),
    },
    select: LEAD_SELECT,
  });

  // Record initial status in history (fromStatus = null)
  if (createdByUser) {
    await recordStatusChange(lead.id, null, initialStatus, createdByUser.id, 'Lead created');
  }

  return lead;
};

// ── UPDATE ────────────────────────────────────────────────────────────────────

const update = async (id, data, tenantFilter) => {
  await assertOwnership(id, tenantFilter);

  const {
    patientName, phone, email, city, source, campaignName,
    utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
    adSet, adName, landingPage, externalId,
  } = data;

  return prisma.lead.update({
    where: { id },
    data: {
      ...(patientName  !== undefined && { patientName }),
      ...(phone        !== undefined && { phone }),
      ...(email        !== undefined && { email }),
      ...(city         !== undefined && { city }),
      ...(source       !== undefined && { source }),
      ...(campaignName !== undefined && { campaignName }),
      ...(utmSource    !== undefined && { utmSource }),
      ...(utmMedium    !== undefined && { utmMedium }),
      ...(utmCampaign  !== undefined && { utmCampaign }),
      ...(utmContent   !== undefined && { utmContent }),
      ...(utmTerm      !== undefined && { utmTerm }),
      ...(adSet        !== undefined && { adSet }),
      ...(adName       !== undefined && { adName }),
      ...(landingPage  !== undefined && { landingPage }),
      ...(externalId   !== undefined && { externalId }),
    },
    select: LEAD_SELECT,
  });
};

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────

const updateStatus = async (id, status, userId, note, tenantFilter) => {
  const lead = await assertOwnership(id, tenantFilter);

  const [updated] = await prisma.$transaction([
    prisma.lead.update({ where: { id }, data: { status }, select: LEAD_SELECT }),
    prisma.leadStatusHistory.create({
      data: {
        leadId:      id,
        fromStatus:  lead.status,
        toStatus:    status,
        changedById: userId,
        note:        note || null,
      },
    }),
  ]);

  return updated;
};

// ── ASSIGN ────────────────────────────────────────────────────────────────────

const assign = async (id, assignedUserId, tenantFilter) => {
  await assertOwnership(id, tenantFilter);

  // When un-assigning pass null
  const val = assignedUserId ? parseInt(assignedUserId) : null;

  return prisma.lead.update({
    where: { id },
    data: { assignedUserId: val },
    select: LEAD_SELECT,
  });
};

// ── DELETE ────────────────────────────────────────────────────────────────────

const remove = async (id, tenantFilter) => {
  await assertOwnership(id, tenantFilter);
  await prisma.lead.delete({ where: { id } });
};

// ── COMMENTS ─────────────────────────────────────────────────────────────────

const addComment = async (leadId, userId, comment, tenantFilter) => {
  await assertOwnership(leadId, tenantFilter);

  return prisma.leadComment.create({
    data: { leadId, userId, comment },
    select: COMMENT_SELECT,
  });
};

const deleteComment = async (commentId, userId, userRole) => {
  const comment = await prisma.leadComment.findUnique({ where: { id: commentId } });
  if (!comment) throw { statusCode: 404, message: 'Comment not found' };

  if (userRole !== 'SUPER_ADMIN' && comment.userId !== userId) {
    throw { statusCode: 403, message: 'You can only delete your own comments' };
  }

  await prisma.leadComment.delete({ where: { id: commentId } });
};

// ── FOLLOW-UPS ────────────────────────────────────────────────────────────────

const createFollowUp = async (leadId, userId, { scheduledAt, note }, tenantFilter) => {
  await assertOwnership(leadId, tenantFilter);

  const followUp = await prisma.leadFollowUp.create({
    data: { leadId, userId, scheduledAt: new Date(scheduledAt), note: note || null },
    select: FOLLOW_UP_SELECT,
  });

  // Keep denormalised followUpAt in sync
  await syncFollowUpAt(leadId);

  return followUp;
};

const completeFollowUp = async (followUpId, userId, note, tenantFilter) => {
  const followUp = await prisma.leadFollowUp.findUnique({
    where: { id: followUpId },
    select: { id: true, leadId: true, completedAt: true },
  });
  if (!followUp) throw { statusCode: 404, message: 'Follow-up not found' };

  // Verify tenant ownership via the parent lead
  await assertOwnership(followUp.leadId, tenantFilter);

  if (followUp.completedAt) throw { statusCode: 400, message: 'Follow-up already completed' };

  const updated = await prisma.leadFollowUp.update({
    where: { id: followUpId },
    data: { completedAt: new Date(), ...(note !== undefined && { note }) },
    select: FOLLOW_UP_SELECT,
  });

  await syncFollowUpAt(followUp.leadId);

  return updated;
};

const deleteFollowUp = async (followUpId, userRole, tenantFilter) => {
  const followUp = await prisma.leadFollowUp.findUnique({
    where: { id: followUpId },
    select: { id: true, leadId: true },
  });
  if (!followUp) throw { statusCode: 404, message: 'Follow-up not found' };

  await assertOwnership(followUp.leadId, tenantFilter);

  await prisma.leadFollowUp.delete({ where: { id: followUpId } });
  await syncFollowUpAt(followUp.leadId);
};

// ── STATUS COUNTS ─────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  'NEW', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED',
  'APPOINTMENT_BOOKED', 'NO_RESPONSE', 'NOT_INTERESTED', 'CLOSED',
];

const getStatusCounts = async (tenantFilter) => {
  const rows = await prisma.lead.groupBy({
    by: ['status'],
    where: tenantFilter,
    _count: { status: true },
  });

  const map = Object.fromEntries(rows.map((r) => [r.status, r._count.status]));
  return VALID_STATUSES.map((status) => ({ status, count: map[status] || 0 }));
};

module.exports = {
  getAll, getById, create, update, updateStatus, assign, remove,
  addComment, deleteComment,
  createFollowUp, completeFollowUp, deleteFollowUp,
  getStatusCounts,
};
