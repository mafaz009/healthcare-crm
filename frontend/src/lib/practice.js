import api from './api';

export const getPractice = () =>
  api.get('/api/practice').then((r) => r.data.data);

export const updatePractice = (data) =>
  api.put('/api/practice', data).then((r) => r.data.data);

export const uploadPracticeLogo = (file) => {
  const form = new FormData();
  form.append('logo', file);
  // Same rule as blog image upload: never set Content-Type manually on FormData.
  // The browser sets multipart/form-data; boundary=... automatically.
  return api.post('/api/practice/logo', form, {
    headers: { 'Content-Type': undefined },
    timeout: 60000,
  }).then((r) => r.data.data);
};

export const regenerateApiKey = () =>
  api.post('/api/practice/regenerate-key').then((r) => r.data.data);
