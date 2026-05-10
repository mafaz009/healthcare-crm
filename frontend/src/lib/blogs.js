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
    // Do NOT set Content-Type manually — the browser must set it automatically
    // so it includes the multipart boundary string (e.g. boundary=----WebKit...).
    // Setting it explicitly strips the boundary and multer cannot parse the body.
    // Setting to `undefined` removes the axios instance-level default entirely.
    return api.post(`${BASE}/${id}/image`, form, {
      headers: { 'Content-Type': undefined },
      timeout: 60000, // 60 s — file uploads need more headroom than API calls
    });
  },
};
