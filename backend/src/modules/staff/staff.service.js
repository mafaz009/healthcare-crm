const bcrypt  = require('bcryptjs');
const prisma  = require('../../config/database');
const { paginate, paginationMeta } = require('../../utils/pagination');
const { uniqueLoginId } = require('../../utils/loginId');
const { generateTempPassword } = require('../../utils/tempPassword');

const STAFF_SELECT = {
  id: true, name: true, loginId: true, email: true,
  role: true, isActive: true, doctorId: true,
  permissions: true, lastLoginAt: true,
  mustChangePassword: true,
  createdAt: true, updatedAt: true,
  doctor: { select: { id: true, name: true } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolves the doctorId for a new staff account.
 * - SUPER_ADMIN must supply doctorId in the body
 * - DOCTOR_ADMIN is always forced to their own tenant
 */
const resolveDoctorId = (body, requestingUser) => {
  if (requestingUser.role === 'SUPER_ADMIN') {
    const id = parseInt(body.doctorId);
    if (!id) throw { statusCode: 400, message: 'doctorId is required for SUPER_ADMIN staff creation' };
    return id;
  }
  return requestingUser.doctorId;
};

/**
 * Verifies a staff user belongs to the requesting tenant.
 * Throws 404 if not found or belongs to a different tenant.
 * When mustBeActive is true, also throws if the account is already disabled.
 */
const getOwnedStaff = async (id, tenantFilter, { mustBeActive = false } = {}) => {
  const staff = await prisma.user.findFirst({
    where: { id, role: 'STAFF', ...tenantFilter },
    select: STAFF_SELECT,
  });
  if (!staff) throw { statusCode: 404, message: 'Staff member not found' };
  if (mustBeActive && !staff.isActive) {
    throw { statusCode: 400, message: 'Account is already disabled' };
  }
  return staff;
};

/**
 * Write a credential-management audit log entry directly.
 * Used for actions that don't go through the auditLog() middleware.
 */
const writeAuditLog = async (action, actorId, targetUserId, doctorId, metadata = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        resourceId: targetUserId,
        metadata:   metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        userId:     actorId,
        doctorId:   doctorId || null,
      },
    });
  } catch (err) {
    console.error('[AuditLog] Credential action write failed:', err.message);
  }
};

// ── Query ─────────────────────────────────────────────────────────────────────

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

// ── Create (Invite flow) ──────────────────────────────────────────────────────

/**
 * Invite a new staff member.
 *
 * If password is supplied → use it (existing flow, mustChangePassword stays false).
 * If password is omitted  → generate a secure temp password, set mustChangePassword = true.
 *
 * Returns { staff, tempPassword? }
 * tempPassword is only returned when auto-generated — caller must display it ONCE.
 */
const create = async (body, requestingUser) => {
  const { name, email, password: suppliedPassword, permissions } = body;
  const doctorId = resolveDoctorId(body, requestingUser);

  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!doctor) throw { statusCode: 400, message: 'Doctor not found or inactive' };

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  });
  if (existing) throw { statusCode: 409, message: 'An account with this email already exists' };

  const isInvite    = !suppliedPassword;
  const plaintext   = isInvite ? generateTempPassword() : suppliedPassword;
  const hashed      = await bcrypt.hash(plaintext, 12);
  const loginId     = await uniqueLoginId(name);

  const staff = await prisma.user.create({
    data: {
      name:              name.trim(),
      loginId,
      email:             email.toLowerCase().trim(),
      password:          hashed,
      role:              'STAFF',
      doctorId,
      permissions:       permissions || null,
      mustChangePassword: isInvite,   // force change only for auto-generated passwords
    },
    select: STAFF_SELECT,
  });

  // Audit: staff.invite (invite flow) or staff.create (manual password)
  await writeAuditLog(
    isInvite ? 'staff.invite' : 'staff.create',
    requestingUser.id,
    staff.id,
    doctorId,
    { name: staff.name, email: staff.email, loginId: staff.loginId },
  );

  return isInvite
    ? { staff, tempPassword: plaintext }
    : { staff };
};

// ── Update ────────────────────────────────────────────────────────────────────

const update = async (id, { name, isActive, permissions }, tenantFilter) => {
  await getOwnedStaff(id, tenantFilter);

  return prisma.user.update({
    where: { id },
    data: {
      ...(name        !== undefined && { name: name.trim() }),
      ...(isActive    !== undefined && { isActive }),
      ...(permissions !== undefined && { permissions }),
    },
    select: STAFF_SELECT,
  });
};

// ── Enable / Disable ──────────────────────────────────────────────────────────

const setActive = async (id, isActive, tenantFilter, actorId) => {
  const staff = await getOwnedStaff(id, tenantFilter);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      isActive,
      // Instantly invalidate all active sessions when disabling
      ...(isActive === false && { tokenVersion: { increment: 1 } }),
    },
    select: STAFF_SELECT,
  });

  await writeAuditLog(
    isActive ? 'staff.enable' : 'staff.disable',
    actorId,
    id,
    staff.doctorId,
    { name: staff.name, loginId: staff.loginId },
  );

  return updated;
};

// ── Permissions ───────────────────────────────────────────────────────────────

const updatePermissions = async (id, permissions, tenantFilter) => {
  await getOwnedStaff(id, tenantFilter);

  return prisma.user.update({
    where: { id },
    data: { permissions },
    select: STAFF_SELECT,
  });
};

// ── Reset Password ────────────────────────────────────────────────────────────

/**
 * Admin-initiated password reset.
 *
 * 1. Generates a secure temporary password
 * 2. Hashes and stores it
 * 3. Sets mustChangePassword = true  → user must change on next login
 * 4. Increments tokenVersion         → all existing sessions instantly invalidated
 * 5. Writes audit log
 *
 * Returns { staff, tempPassword }
 * tempPassword MUST be shown to the admin ONCE and then discarded.
 * The hash is stored; the plaintext is never persisted.
 */
const resetPassword = async (id, tenantFilter, actorId) => {
  const staff = await getOwnedStaff(id, tenantFilter);

  const plaintext = generateTempPassword();
  const hashed    = await bcrypt.hash(plaintext, 12);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      password:           hashed,
      mustChangePassword: true,
      tokenVersion:       { increment: 1 },  // invalidate all active sessions
    },
    select: STAFF_SELECT,
  });

  await writeAuditLog('staff.password_reset', actorId, id, staff.doctorId, {
    name:    staff.name,
    loginId: staff.loginId,
    resetBy: actorId,
  });

  return { staff: updated, tempPassword: plaintext };
};

// ── Force Logout ──────────────────────────────────────────────────────────────

/**
 * Increment tokenVersion to instantly invalidate all JWT sessions for this user.
 * The user's next API call will receive 401 "Session expired."
 */
const forceLogout = async (id, tenantFilter, actorId) => {
  const staff = await getOwnedStaff(id, tenantFilter);

  const updated = await prisma.user.update({
    where: { id },
    data:  { tokenVersion: { increment: 1 } },
    select: STAFF_SELECT,
  });

  await writeAuditLog('staff.force_logout', actorId, id, staff.doctorId, {
    name:    staff.name,
    loginId: staff.loginId,
  });

  return updated;
};

module.exports = {
  getAll, getById, create, update, setActive, updatePermissions,
  resetPassword, forceLogout,
};
