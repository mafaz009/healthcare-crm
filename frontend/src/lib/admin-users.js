import api from './api';

const BASE = '/api/admin/users';

/**
 * Admin user management — SUPER_ADMIN only.
 * Manages DOCTOR_ADMIN and STAFF accounts platform-wide.
 */
export const adminUsersApi = {
  getAll: (params = {}) =>
    api.get(BASE, { params }).then((r) => r.data.data),

  resetPassword: (id) =>
    api.post(`${BASE}/${id}/reset-password`).then((r) => r.data.data),

  forceLogout: (id) =>
    api.post(`${BASE}/${id}/force-logout`).then((r) => r.data.data),

  disable: (id) =>
    api.patch(`${BASE}/${id}/disable`).then((r) => r.data.data),

  enable: (id) =>
    api.patch(`${BASE}/${id}/enable`).then((r) => r.data.data),
};
