import api from './api';

const BASE = '/api/staff';

export const getStaff = (params = {}) =>
  api.get(BASE, { params }).then((r) => r.data.data);

export const getStaffById = (id) =>
  api.get(`${BASE}/${id}`).then((r) => r.data.data);

/**
 * Invite flow (no password): backend generates secure temp password,
 * sets mustChangePassword = true. Response includes tempPassword — show ONCE.
 */
export const inviteStaff = (data) =>
  api.post(BASE, data).then((r) => r.data);

export const createStaff = inviteStaff;  // alias

export const updateStaff = (id, data) =>
  api.patch(`${BASE}/${id}`, data).then((r) => r.data.data);

export const disableStaff = (id) =>
  api.patch(`${BASE}/${id}/disable`).then((r) => r.data.data);

export const enableStaff = (id) =>
  api.patch(`${BASE}/${id}/enable`).then((r) => r.data.data);

export const updateStaffPermissions = (id, permissions) =>
  api.patch(`${BASE}/${id}/permissions`, { permissions }).then((r) => r.data.data);

/**
 * Reset password — returns { staff, tempPassword }.
 * Show tempPassword to admin ONCE, then discard.
 */
export const resetStaffPassword = (id) =>
  api.post(`${BASE}/${id}/reset-password`).then((r) => r.data.data);

/**
 * Force-logout: all active sessions immediately terminated.
 */
export const forceStaffLogout = (id) =>
  api.post(`${BASE}/${id}/force-logout`).then((r) => r.data.data);
