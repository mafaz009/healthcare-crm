const bcrypt  = require('bcryptjs');
const prisma  = require('../../config/database');
const { generate: generateApiKey } = require('../../utils/apiKey');
const { paginate, paginationMeta } = require('../../utils/pagination');
const { uniqueLoginId } = require('../../utils/loginId');

const DOCTOR_SELECT = {
  id: true, name: true, specialty: true, domain: true,
  email: true, phone: true, status: true, logoUrl: true,
  address: true, apiKey: true, plan: true, createdAt: true, updatedAt: true,
};

// ── List ──────────────────────────────────────────────────────────────────────
const getAll = async (query) => {
  const { skip, take, page, limit } = paginate(query);
  const { search, status } = query;

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { name:      { contains: search } },
        { specialty: { contains: search } },
        { email:     { contains: search } },
        { domain:    { contains: search } },
      ],
    }),
  };

  const [doctors, total] = await prisma.$transaction([
    prisma.doctor.findMany({ where, select: DOCTOR_SELECT, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.doctor.count({ where }),
  ]);

  return { doctors, pagination: paginationMeta(total, page, limit) };
};

// ── Single ────────────────────────────────────────────────────────────────────
const getById = async (id) => {
  const doctor = await prisma.doctor.findUnique({ where: { id }, select: DOCTOR_SELECT });
  if (!doctor) throw { statusCode: 404, message: 'Doctor not found' };
  return doctor;
};

// ── Create doctor + their login account ───────────────────────────────────────
const create = async (data) => {
  const { name, specialty, domain, email, phone, address, logoUrl, loginPassword } = data;

  const existing = await prisma.doctor.findUnique({ where: { email } });
  if (existing) throw { statusCode: 409, message: 'A doctor with this email already exists' };

  const password = loginPassword || generateTempPassword();
  const hashed   = await bcrypt.hash(password, 12);
  const apiKey   = generateApiKey();

  // Generate a unique loginId for the doctor's user account.
  // Derived from the doctor's name: "Dr. Manmeet Singh" → "dr.manmeet.singh"
  // Appends ".2", ".3", … if the derived name is already taken.
  const loginId = await uniqueLoginId(name);

  // Create doctor and their user account in one transaction
  const doctor = await prisma.$transaction(async (tx) => {
    const doc = await tx.doctor.create({
      data: { name, specialty, domain, email, phone, address, logoUrl, apiKey },
      select: DOCTOR_SELECT,
    });

    await tx.user.create({
      data: {
        name, loginId, email, password: hashed,
        role: 'DOCTOR_ADMIN',
        doctorId: doc.id,
      },
    });

    return doc;
  });

  // Return the plain-text password and loginId once — never stored, not repeatable
  return { doctor, tempPassword: password, loginId };
};

// ── Update ────────────────────────────────────────────────────────────────────
const update = async (id, data) => {
  await getById(id); // throws 404 if not found

  const { name, specialty, domain, phone, address, logoUrl } = data;
  return prisma.doctor.update({
    where: { id },
    data: { name, specialty, domain, phone, address, logoUrl },
    select: DOCTOR_SELECT,
  });
};

// ── Activate / Deactivate ─────────────────────────────────────────────────────
const setStatus = async (id, status) => {
  await getById(id);
  return prisma.doctor.update({ where: { id }, data: { status }, select: DOCTOR_SELECT });
};

// ── Regenerate API key ────────────────────────────────────────────────────────
const regenerateApiKey = async (id) => {
  await getById(id);
  const apiKey = generateApiKey();
  await prisma.doctor.update({ where: { id }, data: { apiKey } });
  return { apiKey };
};

// ── Stats (counts for dashboard cards) ───────────────────────────────────────
const getStats = async (id) => {
  await getById(id);

  const [leads, appointments, blogs, staff] = await prisma.$transaction([
    prisma.lead.count({ where: { doctorId: id } }),
    prisma.appointment.count({ where: { doctorId: id } }),
    prisma.blog.count({ where: { doctorId: id } }),
    prisma.user.count({ where: { doctorId: id, role: 'STAFF' } }),
  ]);

  const [newLeads, pendingAppts] = await prisma.$transaction([
    prisma.lead.count({ where: { doctorId: id, status: 'NEW' } }),
    prisma.appointment.count({ where: { doctorId: id, status: 'PENDING' } }),
  ]);

  return { leads, appointments, blogs, staff, newLeads, pendingAppts };
};

// ── Add staff user for a doctor ───────────────────────────────────────────────
const createStaffUser = async (doctorId, { name, email, loginPassword }) => {
  await getById(doctorId);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw { statusCode: 409, message: 'A user with this email already exists' };

  const password = loginPassword || generateTempPassword();
  const hashed   = await bcrypt.hash(password, 12);
  const loginId  = await uniqueLoginId(name);

  const user = await prisma.user.create({
    data: { name, loginId, email, password: hashed, role: 'STAFF', doctorId },
    select: { id: true, name: true, loginId: true, email: true, role: true, doctorId: true, createdAt: true },
  });

  return { user, tempPassword: password, loginId };
};

// ── List staff for a doctor ───────────────────────────────────────────────────
const getStaff = async (doctorId) => {
  await getById(doctorId);
  return prisma.user.findMany({
    where: { doctorId, role: 'STAFF' },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
};

// ── Toggle staff active/inactive ──────────────────────────────────────────────
const setStaffStatus = async (doctorId, userId, isActive) => {
  const user = await prisma.user.findFirst({ where: { id: userId, doctorId, role: 'STAFF' } });
  if (!user) throw { statusCode: 404, message: 'Staff member not found' };
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });
};

// ── Internal helper ───────────────────────────────────────────────────────────
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = 'Tmp@';
  for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
};

module.exports = { getAll, getById, create, update, setStatus, regenerateApiKey, getStats, createStaffUser, getStaff, setStaffStatus };
