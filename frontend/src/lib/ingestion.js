import api from './api';

const BASE = '/api/practice/ingestion-logs';

export const ingestionApi = {
  getLogs: (params) => api.get(BASE, { params }).then((r) => r.data.data),
};

// ── Event config ──────────────────────────────────────────────────────────────

export const INGESTION_EVENTS = [
  { value: 'lead_created',      label: 'Lead Created',      color: 'green'  },
  { value: 'duplicate_skipped', label: 'Duplicate Skipped', color: 'yellow' },
  { value: 'validation_failed', label: 'Validation Failed', color: 'red'    },
  { value: 'spam_blocked',      label: 'Spam Blocked',      color: 'orange' },
];

export const INGESTION_SOURCES = [
  { value: 'meta',      label: 'Meta / Facebook', icon: '📘' },
  { value: 'google',    label: 'Google Ads',       icon: '🔵' },
  { value: 'site-lead', label: 'Website Form',     icon: '🌐' },
  { value: 'generic',   label: 'Generic',          icon: '🔗' },
  { value: 'facebook',  label: 'Facebook',         icon: '📘' },
  { value: 'website',   label: 'Website',          icon: '🌐' },
];

export const EVENT_MAP  = Object.fromEntries(INGESTION_EVENTS.map((e) => [e.value, e]));
export const SOURCE_MAP = Object.fromEntries(INGESTION_SOURCES.map((s) => [s.value, s]));

export const getEventConfig  = (value) => EVENT_MAP[value]  ?? { label: value,  color: 'gray' };
export const getSourceConfig = (value) => SOURCE_MAP[value] ?? { label: value,  icon: '📡' };

// ── Source badge color ─────────────────────────────────────────────────────────
// Used on the leads list page to show where each lead came from

export const SOURCE_BADGE_COLORS = {
  facebook:  'bg-blue-100  text-blue-700',
  meta:      'bg-blue-100  text-blue-700',
  google:    'bg-sky-100   text-sky-700',
  instagram: 'bg-pink-100  text-pink-700',
  website:   'bg-teal-100  text-teal-700',
  'site-lead': 'bg-teal-100 text-teal-700',
  referral:  'bg-purple-100 text-purple-700',
  'walk-in': 'bg-amber-100  text-amber-700',
  justdial:  'bg-orange-100 text-orange-700',
  practo:    'bg-green-100  text-green-700',
  generic:   'bg-gray-100   text-gray-700',
  other:     'bg-gray-100   text-gray-700',
};

export const getSourceBadgeClass = (source) =>
  SOURCE_BADGE_COLORS[source?.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
