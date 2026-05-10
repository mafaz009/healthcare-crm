const bcrypt = require('bcryptjs');
const prisma  = require('../../config/database');
const { paginate, paginationMeta } = require('../../utils/pagination');
const { uniqueLoginId } = require('../../utils/loginId');

const STAFF_SELECT = {
  id: true, name: true, loginId: true, email: true,
  role: true, isActive: true, doctorId: true,
  permissions: true, lastLoginAt: true,
  createdAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolves the doctorId for a new staff account.
 *
 * - SUPER_ADMIN must provide doctorId in the request body
 * - DOCTOR_ADMIN always gets their own doctorId (body.doctorId is ignored)
 *
 * This is the critical enforcement point: a DOCTOR_ADMIN can never create
 * a staff account under a different tenant by passing a different doctorId.
 */
const resolveDoctorId = (body, requestingUser) => {
  if (requestingUser.role === 'SUPER_ADMIN') {
    const id = parseInt(body.doctorId);
    if (!id) throw { statusCode: 400, message: 'doctorId is required for SUPER_ADMIN staff creation' };
    return id;
  }
  // DOCTOR_ADMIN: always forced to their own tenant
  return requestingUser.doctorId;
};

/**
 * Verifies a staff user belongs to the requesting tenant before modification.
 * Throws 404 if not found or belongs to a different tenant.
 */
const getOwnedStaff = async (id, tenantFilter) => {
  const staff = await prisma.user.findFirst({
    where: { id, role: 'STAFF', ...tenantFilter },
    select: STAFF_SELECT,
  });
  if (!staff) throw { statusCode: 404, message: 'Staff member not found' };
  return staff;
};

// ── Service Methods ───────────────────────────────────────────────────────────

const getAll = async (tenantFilter, query) => {
  const { skip, take, page, limit } = paginate(query);
  const { isActive } = query;

  const where = {
    role: 'STAFF',
    ...tenantFilter,
    ...(isActive !== undefined && { isActive: isActive === 'true' }),
  };

  const [staff, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: STAFF_SELECT,
      skip, take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { staff, pagination: paginationMeta(total, page, limit) };
};

const getById = async (id, tenantFilter) => getOwnedStaff(id, tenantFilter);

const create = async (body, requestingUser) => {
  const { name, email, password, permissions } = body;
  const doctorId = resolveDoctorId(body, requestingUser);

  // Verify the target doctor exists and is active
  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!doctor) throw { statusCode: 400, message: 'Doctor not found or inactive' };

  // Check for duplicate email
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  });
  if (existing) throw { statusCode: 409, message: 'An account with this email already exists' };

  const hashed  = await bcrypt.hash(password, 12);
  // Auto-generate loginId from staff member's name — unique within the whole users table
  const loginId = await uniqueLoginId(name);

  return prisma.user.create({
    data: {
      name:    name.trim(),
      loginId,
      email:   email.toLowerCase().trim(),
      password: hashed,
      role:    'STAFF',
      doctorId,
      permissions: permissions || null,
    },
    select: STAFF_SELECT,
  });
};

const update = async (id, { name, isActive, permissions }, tenantFilter) => {
  await getOwnedStaff(id, tenantFilter);

  return prisma.user.update({
    where: { id },
    data: {
      ...(name      !== undefined && { name: name.trim() }),
      ...(isActive  !== undefined && { isActive }),
      ...(permissions !== undefined && { permissions }),
    },
    select: STAFF_SELECT,
  });
};

const setActive = async (id, isActive, tenantFilter) => {
  await getOwnedStaff(id, tenantFilter);

  return prisma.user.update({
    where: { id },
    data: {
      isActive,
      // Increment tokenVersion to instantly invalidate active sessions when disabling
      ...(isActive === false && { tokenVersion: { increment: 1 } }),
    },
    select: STAFF_SELECT,
  });
};

const updatePermissions = async (id, permissions, tenantFilter) => {
  await getOwnedStaff(id, tenantFilter);

  return prisma.user.update({
    where: { id },
    data: { permissions },
    select: STAFF_SELECT,
  });
};

module.exports = { getAll, getById, create, update, setActive, updatePermissions };
