const svc = require('./leads.service');
const { ok, created, error } = require('../../utils/response');

const getAll = async (req, res) => {
  try {
    const result = await svc.getAll(req.query, req.tenantFilter);
    return ok(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const getById = async (req, res) => {
  try {
    const lead = await svc.getById(parseInt(req.params.id), req.tenantFilter);
    return ok(res, lead);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const create = async (req, res) => {
  try {
    // Non-admin users can only create leads for their own doctor
    const data = req.user.role === 'SUPER_ADMIN'
      ? req.body
      : { ...req.body, doctorId: req.user.doctorId };

    const lead = await svc.create(data, req.user);
    return created(res, lead, 'Lead created successfully');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const update = async (req, res) => {
  try {
    const lead = await svc.update(parseInt(req.params.id), req.body, req.tenantFilter);
    return ok(res, lead, 'Lead updated successfully');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const updateStatus = async (req, res) => {
  try {
    const lead = await svc.updateStatus(
      parseInt(req.params.id),
      req.body.status,
      req.user.id,
      req.body.note,
      req.tenantFilter
    );
    return ok(res, lead, 'Lead status updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const assign = async (req, res) => {
  try {
    const lead = await svc.assign(
      parseInt(req.params.id),
      req.body.assignedUserId ?? null,
      req.tenantFilter
    );
    return ok(res, lead, 'Lead assignment updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const remove = async (req, res) => {
  try {
    await svc.remove(parseInt(req.params.id), req.tenantFilter);
    return ok(res, {}, 'Lead deleted');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const addComment = async (req, res) => {
  try {
    const comment = await svc.addComment(
      parseInt(req.params.id),
      req.user.id,
      req.body.comment,
      req.tenantFilter
    );
    return created(res, comment, 'Comment added');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const deleteComment = async (req, res) => {
  try {
    await svc.deleteComment(parseInt(req.params.commentId), req.user.id, req.user.role);
    return ok(res, {}, 'Comment deleted');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const createFollowUp = async (req, res) => {
  try {
    const followUp = await svc.createFollowUp(
      parseInt(req.params.id),
      req.user.id,
      { scheduledAt: req.body.scheduledAt, note: req.body.note },
      req.tenantFilter
    );
    return created(res, followUp, 'Follow-up scheduled');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const completeFollowUp = async (req, res) => {
  try {
    const followUp = await svc.completeFollowUp(
      parseInt(req.params.followUpId),
      req.user.id,
      req.body.note,
      req.tenantFilter
    );
    return ok(res, followUp, 'Follow-up marked as complete');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const deleteFollowUp = async (req, res) => {
  try {
    await svc.deleteFollowUp(parseInt(req.params.followUpId), req.user.role, req.tenantFilter);
    return ok(res, {}, 'Follow-up deleted');
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

module.exports = {
  getAll, getById, create, update, updateStatus, assign, remove,
  addComment, deleteComment,
  createFollowUp, completeFollowUp, deleteFollowUp,
  getStatusCounts,
};
