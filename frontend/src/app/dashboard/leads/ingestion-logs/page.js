'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ingestionApi, INGESTION_EVENTS, INGESTION_SOURCES, getEventConfig, getSourceConfig } from '@/lib/ingestion';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  FunnelIcon, ArrowPathIcon, ArrowLeftIcon,
  CheckCircleIcon, ExclamationCircleIcon, NoSymbolIcon, ClockIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';

// ── Event badge ───────────────────────────────────────────────────────────────

const EVENT_STYLES = {
  lead_created:      { cls: 'bg-green-100 text-green-700',  Icon: CheckCircleIcon },
  duplicate_skipped: { cls: 'bg-yellow-100 text-yellow-700', Icon: ClockIcon },
  validation_failed: { cls: 'bg-red-100 text-red-700',      Icon: ExclamationCircleIcon },
  spam_blocked:      { cls: 'bg-orange-100 text-orange-700', Icon: NoSymbolIcon },
};

function EventBadge({ event }) {
  const cfg = getEventConfig(event);
  const style = EVENT_STYLES[event] ?? { cls: 'bg-gray-100 text-gray-600', Icon: ClockIcon };
  const { cls, Icon } = style;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_STYLES = {
  meta:       'bg-blue-100  text-blue-700',
  google:     'bg-sky-100   text-sky-700',
  'site-lead':'bg-teal-100  text-teal-700',
  generic:    'bg-gray-100  text-gray-700',
  facebook:   'bg-blue-100  text-blue-700',
  website:    'bg-teal-100  text-teal-700',
};

function SourceBadge({ source }) {
  const cfg = getSourceConfig(source);
  const cls = SOURCE_STYLES[source] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── Date/time format ──────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

// ── Pagination control ────────────────────────────────────────────────────────

function Pagination({ pagination, onPage }) {
  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{from}–{to}</span> of{' '}
        <span className="font-medium">{total}</span> events
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-600 px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IngestionLogsPage() {
  const router = useRouter();

  const [logs,       setLogs]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [filters, setFilters] = useState({
    event:    '',
    source:   '',
    dateFrom: '',
    dateTo:   '',
    page:     1,
    limit:    50,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.event)    params.event    = filters.event;
      if (filters.source)   params.source   = filters.source;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo)   params.dateTo   = filters.dateTo;
      params.page  = filters.page;
      params.limit = filters.limit;

      const result = await ingestionApi.getLogs(params);
      setLogs(result.logs);
      setPagination(result.pagination);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ingestion logs');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const clearFilters = () =>
    setFilters({ event: '', source: '', dateFrom: '', dateTo: '', page: 1, limit: 50 });

  const hasFilters = filters.event || filters.source || filters.dateFrom || filters.dateTo;

  // ── Stats summary ──────────────────────────────────────────────────────────
  const eventCounts = logs.reduce((acc, l) => {
    acc[l.event] = (acc[l.event] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/leads"
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ingestion Logs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Every inbound lead submission — created, duplicates, and failures
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Quick stats */}
      {pagination && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {INGESTION_EVENTS.map(({ value, label }) => {
            const style = EVENT_STYLES[value] ?? { cls: 'bg-gray-100 text-gray-600', Icon: ClockIcon };
            return (
              <button
                key={value}
                onClick={() => setFilter('event', filters.event === value ? '' : value)}
                className={`rounded-xl p-4 text-left border transition-all ${
                  filters.event === value
                    ? 'border-brand-500 ring-2 ring-brand-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '—' : (eventCounts[value] || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Event</label>
            <select
              value={filters.event}
              onChange={(e) => setFilter('event', e.target.value)}
              className="input py-1.5 text-sm min-w-[160px]"
            >
              <option value="">All events</option>
              {INGESTION_EVENTS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilter('source', e.target.value)}
              className="input py-1.5 text-sm min-w-[150px]"
            >
              <option value="">All sources</option>
              {INGESTION_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter('dateFrom', e.target.value)}
              className="input py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter('dateTo', e.target.value)}
              className="input py-1.5 text-sm"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-sm py-1.5"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <FunnelIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No ingestion events found</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-2 text-brand-600 text-sm hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Event</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Source</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Lead</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        log.event === 'validation_failed' ? 'bg-red-50/30' :
                        log.event === 'duplicate_skipped' ? 'bg-yellow-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {fmt(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <EventBadge event={log.event} />
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={log.source} />
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs">
                        {log.phone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.lead ? (
                          <Link
                            href={`/dashboard/leads/${log.lead.id}`}
                            className="text-brand-600 hover:underline font-medium"
                          >
                            {log.lead.patientName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {log.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <Pagination
                pagination={pagination}
                onPage={(p) => setFilters((f) => ({ ...f, page: p }))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
