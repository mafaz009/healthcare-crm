import api from './api';

const BASE = '/api/appointments';

export const appointmentsApi = {
  getAll:          (params) => api.get(BASE, { params }),
  getToday:        ()       => api.get(`${BASE}/today`),
  getUpcoming:     ()       => api.get(`${BASE}/upcoming`),
  getStatusCounts: ()       => api.get(`${BASE}/status-counts`),
  getById:         (id)     => api.get(`${BASE}/${id}`),
  create:          (data)   => api.post(BASE, data),
  update:          (id, data) => api.put(`${BASE}/${id}`, data),
  updateStatus:    (id, status, notes) =>
    api.patch(`${BASE}/${id}/status`, { status, notes }),
  remove:          (id)     => api.delete(`${BASE}/${id}`),
};

export const APPOINTMENT_STATUSES = [
  { value: 'PENDING',     label: 'Pending',     color: 'yellow' },
  { value: 'CONFIRMED',   label: 'Confirmed',   color: 'blue'   },
  { value: 'COMPLETED',   label: 'Completed',   color: 'green'  },
  { value: 'CANCELLED',   label: 'Cancelled',   color: 'red'    },
  { value: 'RESCHEDULED', label: 'Rescheduled', color: 'purple' },
];
