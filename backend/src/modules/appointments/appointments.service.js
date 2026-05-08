const prisma = require('../../config/database');
const { paginate, paginationMeta } = require('../../utils/pagination');

const APPT_SELECT = {
  id: true, patientName: true, phone: true, email: true,
  issue: true, preferredDate: true, preferredTime: true,
  status: true, notes: true, source: true,
  doctorId: true, createdAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true, specialty: true } },
};

// ── List ──────────────────────────────────────────────────────────────────────
const getAll = async (query, tenantFilter) => {
  const { skip, take, page, limit } = paginate(query);
  const { search, status, dateFrom, dateTo, doctorId } = query;

  const where = {
    ...tenantFilter,
    ...(status && { status }),
    ...(doctorId && !tenantFilter.doctorId && { doctorId: parseInt(doctorId) }),
    ...(dateFrom || dateTo
      ? {
          preferredDate: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo   && { lte: new Date(dateTo) }),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { patientName: { contains: search } },
        { phone:       { contains: search } },
        { email:       { contains: search } },
      ],
    }),
  };

  const [appointments, total] = await prisma.$transaction([
    prisma.appointment.findMany({
      where, select: APPT_SELECT, skip, take,
      orderBy: [{ preferredDate: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.appointment.count({ where }),
  ]);

  return { appointments, pagination: paginationMeta(total, page, limit) };
};

// ── Today's appointments (dashboard quick view) ───────────────────────────────
const getToday = async (tenantFilter) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  return prisma.appointment.findMany({
    where: {
      ...tenantFilter,
      preferredDate: { gte: start, lte: end },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: APPT_SELECT,
    orderBy: { preferredDate: 'asc' },
  });
};

// ── Upcoming (next 7 days, excluding today) ───────────────────────────────────
const getUpcoming = async (tenantFilter) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(start); end.setDate(end.getDate() + 7);

  return prisma.appointment.findMany({
    where: {
      ...tenantFilter,
      preferredDate: { gte: start, lte: end },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: APPT_SELECT,
    orderBy: { preferredDate: 'asc' },
    take: 20,
  });
};

// ── Single ────────────────────────────────────────────────────────────────────
const getById = async (id, tenantFilter) => {
  const appt = await prisma.appointment.findFirst({
    where: { id, ...tenantFilter },
    select: APPT_SELECT,
  });
  if (!appt) throw { statusCode: 404, message: 'Appointment not found' };
  return appt;
};

// ── Create (internal CRM) ─────────────────────────────────────────────────────
const create = async (data) => {
  const { patientName, phone, email, issue, preferredDate, preferredTime, notes, doctorId, source } = data;
  return prisma.appointment.create({
    data: {
      patientName, phone, email, issue, notes,
      preferredDate: new Date(preferredDate),
      preferredTime: preferredTime || null,
      doctorId: parseInt(doctorId),
      source: source || 'crm',
      status: 'PENDING',
    },
    select: APPT_SELECT,
  });
};

// ── Create from external website (public API) ─────────────────────────────────
// doctorId comes from the validated API key, not the request body
const createPublic = async (data, doctorId) => {
  const { patientName, phone, email, issue, preferredDate, preferredTime } = data;
  return prisma.appointment.create({
    data: {
      patientName, phone, email, issue,
      preferredDate: new Date(preferredDate),
      preferredTime: preferredTime || null,
      doctorId,
      source: 'website',
      status: 'PENDING',
    },
    // Return minimal data — this goes back to the doctor's website
    select: { id: true, patientName: true, status: true, preferredDate: true },
  });
};

// ── Update ────────────────────────────────────────────────────────────────────
const update = async (id, data, tenantFilter) => {
  await getById(id, tenantFilter);
  const { patientName, phone, email, issue, preferredDate, preferredTime, notes } = data;
  return prisma.appointment.update({
    where: { id },
    data: {
      patientName, phone, email, issue, notes,
      ...(preferredDate && { preferredDate: new Date(preferredDate) }),
      ...(preferredTime !== undefined && { preferredTime }),
    },
    select: APPT_SELECT,
  });
};

// ── Update status ─────────────────────────────────────────────────────────────
const updateStatus = async (id, status, notes, tenantFilter) => {
  await getById(id, tenantFilter);
  return prisma.appointment.update({
    where: { id },
    data: { status, ...(notes !== undefined && { notes }) },
    select: APPT_SELECT,
  });
};

// ── Delete ────────────────────────────────────────────────────────────────────
const remove = async (id, tenantFilter) => {
  await getById(id, tenantFilter);
  await prisma.appointment.delete({ where: { id } });
};

// ── Status summary counts ─────────────────────────────────────────────────────
const getStatusCounts = async (tenantFilter) => {
  const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];
  const counts = await Promise.all(
    statuses.map((status) =>
      prisma.appointment.count({ where: { ...tenantFilter, status } })
        .then((count) => ({ status, count }))
    )
  );
  return counts;
};

module.exports = { getAll, getToday, getUpcoming, getById, create, createPublic, update, updateStatus, remove, getStatusCounts };
