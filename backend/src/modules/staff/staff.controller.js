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

/**
 * POST /api/staff
 *
 * Invite flow (no password): creates account, generates temp password, sets
 * mustChangePassword = true. Returns tempPassword in the response — show once.
 *
 * Explicit flow (with password): creates account with the supplied password.
 */
const create = async (req, res) => {
  try {
    const result = await svc.create(req.body, req.user);
    const msg = result.tempPassword
      ? 'Staff account created. Share the temporary password — it will not be shown again.'
      : 'Staff account created';
    return created(res, result, msg);
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
    const staff = await svc.setActive(
      parseInt(req.params.id), false, req.tenantFilter, req.user.id,
    );
    return ok(res, staff, 'Staff account disabled. Active sessions have been invalidated.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const enable = async (req, res) => {
  try {
    const staff = await svc.setActive(
      parseInt(req.params.id), true, req.tenantFilter, req.user.id,
    );
    return ok(res, staff, 'Staff account re-enabled');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const updatePermissions = async (req, res) => {
  try {
    const staff = await svc.updatePermissions(
      parseInt(req.params.id), req.body.permissions, req.tenantFilter,
    );
    return ok(res, staff, 'Permissions updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

/**
 * POST /api/staff/:id/reset-password
 * Returns { staff, tempPassword } — show tempPassword ONCE to the admin.
 */
const resetPassword = async (req, res) => {
  try {
    const result = await svc.resetPassword(
      parseInt(req.params.id), req.tenantFilter, req.user.id,
    );
    return ok(res, result,
      'Password reset. Share the temporary password — it will not be shown again.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

/**
 * POST /api/staff/:id/force-logout
 * Invalidates all active sessions via tokenVersion increment.
 */
const forceLogout = async (req, res) => {
  try {
    const staff = await svc.forceLogout(
      parseInt(req.params.id), req.tenantFilter, req.user.id,
    );
    return ok(res, staff, 'All active sessions for this staff member have been terminated.');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = {
  getAll, getById, create, update,
  disable, enable, updatePermissions,
  resetPassword, forceLogout,
};
