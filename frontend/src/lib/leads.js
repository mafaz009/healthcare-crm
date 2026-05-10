import api from './api';

const BASE = '/api/leads';

export const leadsApi = {
  // ── Core CRUD ──────────────────────────────────────────────────────────────
  getAll:          (params)           => api.get(BASE, { params }),
  getById:         (id)               => api.get(`${BASE}/${id}`),
  create:          (data)             => api.post(BASE, data),
  update:          (id, data)         => api.put(`${BASE}/${id}`, data),
  updateStatus:    (id, status, note) => api.patch(`${BASE}/${id}/status`, { status, note }),
  assign:          (id, assignedUserId) => api.patch(`${BASE}/${id}/assign`, { assignedUserId }),
  remove:          (id)               => api.delete(`${BASE}/${id}`),
  getStatusCounts: ()                 => api.get(`${BASE}/status-counts`),

  // ── Comments ───────────────────────────────────────────────────────────────
  addComment:    (leadId, comment)   => api.post(`${BASE}/${leadId}/comments`, { comment }),
  deleteComment: (leadId, commentId) => api.delete(`${BASE}/${leadId}/comments/${commentId}`),

  // ── Follow-ups ─────────────────────────────────────────────────────────────
  createFollowUp:   (leadId, data)             => api.post(`${BASE}/${leadId}/follow-ups`, data),
  completeFollowUp: (leadId, followUpId, note) =>
    api.patch(`${BASE}/${leadId}/follow-ups/${followUpId}/complete`, { note }),
  deleteFollowUp:   (leadId, followUpId)       => api.delete(`${BASE}/${leadId}/follow-ups/${followUpId}`),
};

// ── Status config ──────────────────────────────────────────────────────────────

export const LEAD_STATUSES = [
  { value: 'NEW',                label: 'New',            color: 'blue'   },
  { value: 'CONTACTED',          label: 'Contacted',      color: 'yellow' },
  { value: 'FOLLOW_UP',          label: 'Follow-up',      color: 'orange' },
  { value: 'INTERESTED',         label: 'Interested',     color: 'teal'   },
  { value: 'APPOINTMENT_BOOKED', label: 'Appt. Booked',   color: 'purple' },
  { value: 'NO_RESPONSE',        label: 'No Response',    color: 'gray'   },
  { value: 'NOT_INTERESTED',     label: 'Not Interested', color: 'red'    },
  { value: 'CLOSED',             label: 'Closed',         color: 'green'  },
];

export const LEAD_STATUS_MAP = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, s]));

export const getStatusLabel = (value) => LEAD_STATUS_MAP[value]?.label ?? value;

// ── Source config ──────────────────────────────────────────────────────────────

export const LEAD_SOURCES = [
  'facebook', 'google', 'instagram', 'website',
  'referral', 'walk-in', 'justdial', 'practo', 'other',
];
