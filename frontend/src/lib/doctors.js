import api from './api';

const BASE = '/api/doctors';

export const doctorsApi = {
  getAll:          (params) => api.get(BASE, { params }),
  getById:         (id)     => api.get(`${BASE}/${id}`),
  create:          (data)   => api.post(BASE, data),
  update:          (id, data) => api.put(`${BASE}/${id}`, data),
  setStatus:       (id, status) => api.patch(`${BASE}/${id}/status`, { status }),
  regenerateKey:   (id)     => api.post(`${BASE}/${id}/regenerate-key`),
  getStats:        (id)     => api.get(`${BASE}/${id}/stats`),

  // Staff
  getStaff:        (doctorId)         => api.get(`${BASE}/${doctorId}/staff`),
  createStaff:     (doctorId, data)   => api.post(`${BASE}/${doctorId}/staff`, data),
  setStaffStatus:  (doctorId, userId, isActive) =>
    api.patch(`${BASE}/${doctorId}/staff/${userId}/status`, { isActive }),
};
