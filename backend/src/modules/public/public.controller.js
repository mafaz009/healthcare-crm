const apptSvc = require('../appointments/appointments.service');
const blogSvc = require('../blogs/blogs.service');
const { ok, created, error } = require('../../utils/response');

// ── Appointments ──────────────────────────────────────────────────────────────

const submitAppointment = async (req, res) => {
  try {
    const appt = await apptSvc.createPublic(req.body, req.doctor.id);
    return created(res, appt, 'Appointment request received. We will confirm shortly.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

// ── Blogs ─────────────────────────────────────────────────────────────────────

const listBlogs = async (req, res) => {
  try {
    const result = await blogSvc.getPublished(req.doctor.id, req.query);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getBlogBySlug = async (req, res) => {
  try {
    const result = await blogSvc.getPublishedBySlug(req.params.slug, req.doctor.id);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { submitAppointment, listBlogs, getBlogBySlug };
