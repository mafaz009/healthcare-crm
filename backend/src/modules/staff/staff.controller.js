const svc = require('./staff.service');
const { ok, created, error } = require('../../utils/response');

const getAll = async (req, res) => {
  try {
    const result = await svc.getAll(req.tenantFilter, req.query);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getById = async (req, res) => {
  try {
    const staff = await svc.getById(parseInt(req.params.id), req.tenantFilter);
    return ok(res, staff);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const create = async (req, res) => {
  try {
    const staff = await svc.create(req.body, req.user);
    return created(res, staff, 'Staff account created');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const update = async (req, res) => {
  try {
    const staff = await svc.update(parseInt(req.params.id), req.body, req.tenantFilter);
    return ok(res, staff);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const disable = async (req, res) => {
  try {
    const staff = await svc.setActive(parseInt(req.params.id), false, req.tenantFilter);
    return ok(res, staff, 'Staff account disabled');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const enable = async (req, res) => {
  try {
    const staff = await svc.setActive(parseInt(req.params.id), true, req.tenantFilter);
    return ok(res, staff, 'Staff account enabled');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const updatePermissions = async (req, res) => {
  try {
    const staff = await svc.updatePermissions(
      parseInt(req.params.id),
      req.body.permissions,
      req.tenantFilter
    );
    return ok(res, staff, 'Permissions updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getAll, getById, create, update, disable, enable, updatePermissions };
