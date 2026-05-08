const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const prisma = require('../../config/database');
const env    = require('../../config/env');

const USER_SELECT = {
  id: true, name: true, email: true,
  role: true, doctorId: true, isActive: true,
};

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, doctorId: user.doctorId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { ...USER_SELECT, password: true },
  });

  if (!user) throw { statusCode: 401, message: 'Invalid email or password' };
  if (!user.isActive) throw { statusCode: 403, message: 'Account is disabled. Contact your administrator.' };

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw { statusCode: 401, message: 'Invalid email or password' };

  const token = signToken(user);
  const { password: _pw, ...safeUser } = user;

  return { token, user: safeUser };
};

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...USER_SELECT,
      doctor: {
        select: { id: true, name: true, specialty: true, domain: true, logoUrl: true },
      },
    },
  });
  if (!user) throw { statusCode: 404, message: 'User not found' };
  return user;
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) throw { statusCode: 400, message: 'Current password is incorrect' };

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
};

const updateProfile = async (userId, { name, email }) => {
  if (email) {
    const conflict = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), id: { not: userId } },
      select: { id: true },
    });
    if (conflict) throw { statusCode: 409, message: 'Email is already in use by another account' };
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(name  && { name: name.trim() }),
      ...(email && { email: email.toLowerCase().trim() }),
    },
    select: USER_SELECT,
  });
};

module.exports = { login, getMe, changePassword, updateProfile };
