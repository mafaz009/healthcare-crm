const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../../config/database');
const env    = require('../../config/env');
const { isValidLoginId } = require('../../utils/loginId');

// Fields returned to callers — never includes password
const USER_SELECT = {
  id: true, name: true, loginId: true, email: true,
  role: true, doctorId: true, isActive: true,
  tokenVersion: true, permissions: true,
};

// ── JWT ───────────────────────────────────────────────────────────────────────

/**
 * Signs a JWT with loginId as the identity field (not email).
 * tokenVersion is included so protect() can invalidate tokens on
 * password change / account disable without waiting for expiry.
 */
const signToken = (user) =>
  jwt.sign(
    {
      id:           user.id,
      loginId:      user.loginId,   // primary identity in token
      role:         user.role,
      doctorId:     user.doctorId,
      tokenVersion: user.tokenVersion,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Accepts either loginId OR email as the identifier.
 *
 * Detection rule: if the identifier contains '@' it is treated as an email.
 * Otherwise it is treated as a loginId.
 *
 * This keeps full backward compatibility — users who have only ever typed
 * their email continue to work unchanged. New users can type their loginId.
 *
 * Error messages deliberately do not distinguish "user not found" from
 * "wrong password" to avoid user-enumeration attacks.
 */
const login = async (identifier, password) => {
  const cleaned = identifier.toLowerCase().trim();
  const isEmail = cleaned.includes('@');

  const user = await prisma.user.findUnique({
    where: isEmail ? { email: cleaned } : { loginId: cleaned },
    select: { ...USER_SELECT, password: true },
  });

  if (!user)          throw { statusCode: 401, message: 'Invalid credentials' };
  if (!user.isActive) throw { statusCode: 403, message: 'Account is disabled. Contact your administrator.' };

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw { statusCode: 401, message: 'Invalid credentials' };

  // Fire-and-forget: never let a lastLoginAt write failure block the response
  prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  }).catch((err) => console.error('[Auth] lastLoginAt update failed:', err.message));

  const token = signToken(user);
  const { password: _pw, ...safeUser } = user;
  return { token, user: safeUser };
};

// ── Get current user ──────────────────────────────────────────────────────────

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...USER_SELECT,
      lastLoginAt: true,
      doctor: {
        select: { id: true, name: true, specialty: true, domain: true, logoUrl: true, plan: true },
      },
    },
  });
  if (!user) throw { statusCode: 404, message: 'User not found' };
  return user;
};

// ── Change password ───────────────────────────────────────────────────────────

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, tokenVersion: true },
  });

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) throw { statusCode: 400, message: 'Current password is incorrect' };

  const hashed = await bcrypt.hash(newPassword, 12);

  // Increment tokenVersion — instantly invalidates all existing JWT sessions.
  // The user must log in again on every device after a password change.
  await prisma.user.update({
    where: { id: userId },
    data: {
      password:     hashed,
      tokenVersion: { increment: 1 },
    },
  });
};

// ── Update profile ────────────────────────────────────────────────────────────

/**
 * Updatable fields: name, email (contact only), loginId (auth username)
 *
 * loginId uniqueness and format are validated here.
 * Email uniqueness is validated here.
 */
const updateProfile = async (userId, { name, email, loginId }) => {

  // ── Email uniqueness ──
  if (email) {
    const conflict = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), id: { not: userId } },
      select: { id: true },
    });
    if (conflict) throw { statusCode: 409, message: 'Email is already in use by another account' };
  }

  // ── loginId format + uniqueness ──
  if (loginId) {
    const cleaned = loginId.toLowerCase().trim();

    if (!isValidLoginId(cleaned)) {
      throw {
        statusCode: 400,
        message:
          'Username must be 3–50 characters. ' +
          'Allowed: lowercase letters, numbers, dots, hyphens, underscores. ' +
          'Must start and end with a letter or number. ' +
          'No consecutive separators (e.g. ".." or "--").',
      };
    }

    const conflict = await prisma.user.findFirst({
      where: { loginId: cleaned, id: { not: userId } },
      select: { id: true },
    });
    if (conflict) throw { statusCode: 409, message: 'That username is already taken' };
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name    && { name:    name.trim() }),
      ...(email   && { email:   email.toLowerCase().trim() }),
      ...(loginId && { loginId: loginId.toLowerCase().trim() }),
    },
    select: USER_SELECT,
  });
};

module.exports = { login, getMe, changePassword, updateProfile };
