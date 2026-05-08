const svc = require('./appointments.service');
const { ok, created, error } = require('../../utils/response');

const getAll = async (req, res) => {
  try {
    const result = await svc.getAll(req.query, req.tenantFilter);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getToday = async (req, res) => {
  try {
    const appointments = await svc.getToday(req.tenantFilter);
    return ok(res, appointments);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getUpcoming = async (req, res) => {
  try {
    const appointments = await svc.getUpcoming(req.tenantFilter);
    return ok(res, appointments);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getById = async (req, res) => {
  try {
    const appt = await svc.getById(parseInt(req.params.id), req.tenantFilter);
    return ok(res, appt);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const create = async (req, res) => {
  try {
    const data = req.user.role === 'SUPER_ADMIN'
      ? req.body
      : { ...req.body, doctorId: req.user.doctorId };
    const appt = await svc.create(data);
    return created(res, appt, 'Appointment created');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const update = async (req, res) => {
  try {
    const appt = await svc.update(parseInt(req.params.id), req.body, req.tenantFilter);
    return ok(res, appt, 'Appointment updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const updateStatus = async (req, res) => {
  try {
    const appt = await svc.updateStatus(
      parseInt(req.params.id),
      req.body.status,
      req.body.notes,
      req.tenantFilter
    );
    return ok(res, appt, 'Status updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const remove = async (req, res) => {
  try {
    await svc.remove(parseInt(req.params.id), req.tenantFilter);
    return ok(res, {}, 'Appointment deleted');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getStatusCounts = async (req, res) => {
  try {
    const counts = await svc.getStatusCounts(req.tenantFilter);
    return ok(res, counts);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getAll, getToday, getUpcoming, getById, create, update, updateStatus, remove, getStatusCounts };
