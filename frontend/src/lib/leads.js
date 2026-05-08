import api from './api';

const BASE = '/api/leads';

export const leadsApi = {
  getAll:         (params) => api.get(BASE, { params }),
  getById:        (id)     => api.get(`${BASE}/${id}`),
  create:         (data)   => api.post(BASE, data),
  update:         (id, data) => api.put(`${BASE}/${id}`, data),
  updateStatus:   (id, status) => api.patch(`${BASE}/${id}/status`, { status }),
  remove:         (id)     => api.delete(`${BASE}/${id}`),
  getStatusCounts: ()      => api.get(`${BASE}/status-counts`),

  // Comments
  addComment:    (leadId, comment) => api.post(`${BASE}/${leadId}/comments`, { comment }),
  deleteComment: (leadId, commentId) => api.delete(`${BASE}/${leadId}/comments/${commentId}`),
};

export const LEAD_STATUSES = [
  { value: 'NEW',               label: 'New',               color: 'blue'   },
  { value: 'CONTACTED',         label: 'Contacted',         color: 'yellow' },
  { value: 'FOLLOW_UP',         label: 'Follow-up',         color: 'orange' },
  { value: 'APPOINTMENT_BOOKED',label: 'Appt. Booked',      color: 'purple' },
  { value: 'CONVERTED',         label: 'Converted',         color: 'green'  },
  { value: 'LOST',              label: 'Lost',              color: 'red'    },
];

export const LEAD_SOURCES = [
  'facebook', 'google', 'instagram', 'website',
  'referral', 'walk-in', 'justdial', 'other',
];
