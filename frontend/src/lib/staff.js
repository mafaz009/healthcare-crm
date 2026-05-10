import api from './api';

export const getStaff = (params = {}) =>
  api.get('/api/staff', { params }).then((r) => r.data.data);

export const getStaffById = (id) =>
  api.get(`/api/staff/${id}`).then((r) => r.data.data);

export const createStaff = (data) =>
  api.post('/api/staff', data).then((r) => r.data.data);

export const updateStaff = (id, data) =>
  api.patch(`/api/staff/${id}`, data).then((r) => r.data.data);

export const disableStaff = (id) =>
  api.patch(`/api/staff/${id}/disable`).then((r) => r.data.data);

export const enableStaff = (id) =>
  api.patch(`/api/staff/${id}/enable`).then((r) => r.data.data);

export const updateStaffPermissions = (id, permissions) =>
  api.patch(`/api/staff/${id}/permissions`, { permissions }).then((r) => r.data.data);
