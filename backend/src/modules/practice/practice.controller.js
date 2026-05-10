const prisma  = require('../../config/database');
const path    = require('path');
const fs      = require('fs');
const env     = require('../../config/env');
const { generateApiKey } = require('../../utils/apiKey');
const { ok, error } = require('../../utils/response');

const PRACTICE_SELECT = {
  id: true, name: true, specialty: true, domain: true,
  email: true, phone: true, status: true, logoUrl: true,
  address: true, plan: true, createdAt: true, updatedAt: true,
  // API key is shown (doctor manages own key)
  apiKey: true,
};

/**
 * Resolves the doctorId to operate on:
 * - DOCTOR_ADMIN: always their own doctorId (cannot access other practices)
 * - SUPER_ADMIN: also uses their doctorId (they manage via /api/doctors for others)
 */
const getDoctorId = (req) => {
  if (!req.user.doctorId) {
    throw { statusCode: 400, message: 'SUPER_ADMIN has no practice. Use /api/doctors instead.' };
  }
  return req.user.doctorId;
};

const get = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const practice = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: PRACTICE_SELECT,
    });
    if (!practice) throw { statusCode: 404, message: 'Practice not found' };
    return ok(res, practice);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const update = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const { name, specialty, phone, address } = req.body;

    const practice = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        ...(name      && { name: name.trim() }),
        ...(specialty && { specialty: specialty.trim() }),
        ...(phone     !== undefined && { phone: phone || null }),
        ...(address   !== undefined && { address: address || null }),
      },
      select: PRACTICE_SELECT,
    });
    return ok(res, practice, 'Practice profile updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const uploadLogo = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    if (!req.file) throw { statusCode: 400, message: 'No image file uploaded' };

    // Delete old logo file if it exists
    const current = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { logoUrl: true },
    });
    if (current?.logoUrl) {
      const oldPath = path.join(__dirname, '..', '..', '..', env.UPLOAD_DIR,
        path.basename(current.logoUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const practice = await prisma.doctor.update({
      where: { id: doctorId },
      data: { logoUrl: `/uploads/${path.basename(req.file.path)}` },
      select: PRACTICE_SELECT,
    });
    return ok(res, practice, 'Logo uploaded');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const regenerateApiKey = async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const newKey = generateApiKey();

    const practice = await prisma.doctor.update({
      where: { id: doctorId },
      data: { apiKey: newKey },
      select: PRACTICE_SELECT,
    });

    return ok(res, practice, 'API key regenerated. Update your website integration immediately.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { get, update, uploadLogo, regenerateApiKey };
