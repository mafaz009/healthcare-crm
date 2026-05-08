const svc = require('./doctors.service');
const { ok, created, error, notFound } = require('../../utils/response');

const getAll = async (req, res) => {
  try {
    const result = await svc.getAll(req.query);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getById = async (req, res) => {
  try {
    const doctor = await svc.getById(parseInt(req.params.id));
    return ok(res, doctor);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const create = async (req, res) => {
  try {
    const result = await svc.create(req.body);
    return created(res, result, 'Doctor created successfully');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const update = async (req, res) => {
  try {
    const doctor = await svc.update(parseInt(req.params.id), req.body);
    return ok(res, doctor, 'Doctor updated successfully');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const setStatus = async (req, res) => {
  try {
    const doctor = await svc.setStatus(parseInt(req.params.id), req.body.status);
    return ok(res, doctor, `Doctor ${req.body.status === 'ACTIVE' ? 'activated' : 'deactivated'}`);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const regenerateApiKey = async (req, res) => {
  try {
    const result = await svc.regenerateApiKey(parseInt(req.params.id));
    return ok(res, result, 'API key regenerated. Update it on the doctor website immediately.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await svc.getStats(parseInt(req.params.id));
    return ok(res, stats);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const createStaff = async (req, res) => {
  try {
    const result = await svc.createStaffUser(parseInt(req.params.id), req.body);
    return created(res, result, 'Staff account created');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getStaff = async (req, res) => {
  try {
    const staff = await svc.getStaff(parseInt(req.params.id));
    return ok(res, staff);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const setStaffStatus = async (req, res) => {
  try {
    const user = await svc.setStaffStatus(
      parseInt(req.params.id),
      parseInt(req.params.userId),
      req.body.isActive
    );
    return ok(res, user, 'Staff status updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getAll, getById, create, update, setStatus, regenerateApiKey, getStats, createStaff, getStaff, setStaffStatus };
