const svc = require('./blogs.service');
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
    const blog = await svc.getById(parseInt(req.params.id), req.tenantFilter);
    return ok(res, blog);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const create = async (req, res) => {
  try {
    const data = req.user.role === 'SUPER_ADMIN'
      ? req.body
      : { ...req.body, doctorId: req.user.doctorId };
    const blog = await svc.create(data);
    return created(res, blog, 'Blog post created');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const update = async (req, res) => {
  try {
    const blog = await svc.update(parseInt(req.params.id), req.body, req.tenantFilter);
    return ok(res, blog, 'Blog post updated');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) return error(res, 'No image file provided', 400);
    const blog = await svc.updateImage(parseInt(req.params.id), req.file.path, req.tenantFilter);
    return ok(res, { featuredImage: blog.featuredImage }, 'Image uploaded');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const setStatus = async (req, res) => {
  try {
    const blog = await svc.setStatus(parseInt(req.params.id), req.body.status, req.tenantFilter);
    const msg  = blog.status === 'PUBLISHED' ? 'Blog post published' : 'Blog post unpublished';
    return ok(res, blog, msg);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

const remove = async (req, res) => {
  try {
    await svc.remove(parseInt(req.params.id), req.tenantFilter);
    return ok(res, {}, 'Blog post deleted');
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
};

module.exports = { getAll, getById, create, update, uploadImage, setStatus, remove };
