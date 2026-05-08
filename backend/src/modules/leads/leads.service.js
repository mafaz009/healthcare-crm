const prisma = require('../../config/database');
const { paginate, paginationMeta } = require('../../utils/pagination');

const LEAD_SELECT = {
  id: true, patientName: true, phone: true, email: true,
  city: true, source: true, campaignName: true, status: true,
  doctorId: true, createdAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true, specialty: true } },
};

const LEAD_DETAIL_SELECT = {
  ...LEAD_SELECT,
  comments: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, comment: true, createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  },
};

// ── List ──────────────────────────────────────────────────────────────────────
const getAll = async (query, tenantFilter) => {
  const { skip, take, page, limit } = paginate(query);
  const { search, status, source, doctorId, dateFrom, dateTo, campaignName } = query;

  const where = {
    ...tenantFilter,
    ...(status && { status }),
    ...(source && { source: { contains: source } }),
    ...(campaignName && { campaignName: { contains: campaignName } }),
    // Super admin can further filter by a specific doctor
    ...(doctorId && !tenantFilter.doctorId && { doctorId: parseInt(doctorId) }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo   && { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) }),
          },
        }
      : {}),
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

// ── Single (with comments) ────────────────────────────────────────────────────
const getById = async (id, tenantFilter) => {
  const lead = await prisma.lead.findFirst({
    where: { id, ...tenantFilter },
    select: LEAD_DETAIL_SELECT,
  });
  if (!lead) throw { statusCode: 404, message: 'Lead not found' };
  return lead;
};

// ── Create ────────────────────────────────────────────────────────────────────
const create = async (data) => {
  const { patientName, phone, email, city, source, campaignName, doctorId, status } = data;
  return prisma.lead.create({
    data: {
      patientName, phone, email, city, source, campaignName,
      doctorId: parseInt(doctorId),
      status: status || 'NEW',
    },
    select: LEAD_SELECT,
  });
};

// ── Update ────────────────────────────────────────────────────────────────────
const update = async (id, data, tenantFilter) => {
  const lead = await getById(id, tenantFilter);
  const { patientName, phone, email, city, source, campaignName } = data;

  return prisma.lead.update({
    where: { id: lead.id },
    data: { patientName, phone, email, city, source, campaignName },
    select: LEAD_SELECT,
  });
};

// ── Update status ─────────────────────────────────────────────────────────────
const updateStatus = async (id, status, tenantFilter) => {
  const lead = await getById(id, tenantFilter);
  return prisma.lead.update({
    where: { id: lead.id },
    data: { status },
    select: LEAD_SELECT,
  });
};

// ── Delete ────────────────────────────────────────────────────────────────────
const remove = async (id, tenantFilter) => {
  const lead = await getById(id, tenantFilter);
  await prisma.lead.delete({ where: { id: lead.id } });
};

// ── Add comment ───────────────────────────────────────────────────────────────
const addComment = async (leadId, userId, comment, tenantFilter) => {
  // Verify lead belongs to this tenant
  await getById(leadId, tenantFilter);

  return prisma.leadComment.create({
    data: { leadId, userId, comment },
    select: {
      id: true, comment: true, createdAt: true,
      user: { select: { id: true, name: true, role: true } },
    },
  });
};

// ── Delete comment ────────────────────────────────────────────────────────────
const deleteComment = async (commentId, userId, userRole) => {
  const comment = await prisma.leadComment.findUnique({ where: { id: commentId } });
  if (!comment) throw { statusCode: 404, message: 'Comment not found' };

  // Staff can only delete their own comments; admins can delete any
  if (userRole !== 'SUPER_ADMIN' && comment.userId !== userId) {
    throw { statusCode: 403, message: 'You can only delete your own comments' };
  }

  await prisma.leadComment.delete({ where: { id: commentId } });
};

// ── Status summary counts (for dashboard pipeline view) ───────────────────────
const getStatusCounts = async (tenantFilter) => {
  const statuses = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST'];
  const counts = await Promise.all(
    statuses.map((status) =>
      prisma.lead.count({ where: { ...tenantFilter, status } }).then((count) => ({ status, count }))
    )
  );
  return counts;
};

module.exports = { getAll, getById, create, update, updateStatus, remove, addComment, deleteComment, getStatusCounts };
