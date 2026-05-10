import api from './api';

export const getAuditLogs = (params = {}) =>
  api.get('/api/admin/audit-logs', { params }).then((r) => r.data.data);

export const getPlatformStats = () =>
  api.get('/api/admin/stats').then((r) => r.data.data);

export const impersonateDoctor = (doctorId) =>
  api.post(`/api/admin/impersonate/${doctorId}`).then((r) => r.data.data);
