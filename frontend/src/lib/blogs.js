import api from './api';

const BASE = '/api/blogs';

export const blogsApi = {
  getAll:      (params) => api.get(BASE, { params }),
  getById:     (id)     => api.get(`${BASE}/${id}`),
  create:      (data)   => api.post(BASE, data),
  update:      (id, data) => api.put(`${BASE}/${id}`, data),
  setStatus:   (id, status) => api.patch(`${BASE}/${id}/status`, { status }),
  remove:      (id)     => api.delete(`${BASE}/${id}`),

  uploadImage: (id, file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post(`${BASE}/${id}/image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
