'use client';
import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '@/lib/admin';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { ShieldCheckIcon, FunnelIcon } from '@heroicons/react/24/outline';

// Map action strings to human-readable labels and colour
const ACTION_META = {
  'lead.delete':              { label: 'Lead Deleted',           color: 'text-red-600 bg-red-50' },
  'blog.delete':              { label: 'Blog Deleted',           color: 'text-red-600 bg-red-50' },
  'blog.publish':             { label: 'Blog Status Changed',    color: 'text-blue-600 bg-blue-50' },
  'appointment.delete':       { label: 'Appointment Deleted',    color: 'text-red-600 bg-red-50' },
  'staff.create':             { label: 'Staff Created',          color: 'text-green-600 bg-green-50' },
  'staff.disable':            { label: 'Staff Disabled',         color: 'text-orange-600 bg-orange-50' },
  'staff.enable':             { label: 'Staff Enabled',          color: 'text-green-600 bg-green-50' },
  'staff.permissions':        { label: 'Permissions Updated',    color: 'text-purple-600 bg-purple-50' },
  'staff.status_change':      { label: 'Staff Status Changed',   color: 'text-orange-600 bg-orange-50' },
  'doctor.create':            { label: 'Doctor Created',         color: 'text-green-600 bg-green-50' },
  'doctor.status_change':     { label: 'Doctor Status Changed',  color: 'text-orange-600 bg-orange-50' },
  'doctor.apikey.regenerate': { label: 'API Key Regenerated',    color: 'text-red-600 bg-red-50' },
  'auth.login':               { label: 'Login',                  color: 'text-gray-600 bg-gray-50' },
  'auth.password_change':     { label: 'Password Changed',       color: 'text-purple-600 bg-purple-50' },
};

function ActionBadge({ action }) {
  const meta = ACTION_META[action] || { label: action, color: 'text-gray-600 bg-gray-50' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [page, setPage]           = useState(1);

  // Filters
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const [applied, setApplied] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 25, ...applied };
      // Remove empty filter values
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const result = await getAuditLogs(params);
      setLogs(result.logs);
      setPagination(result.pagination);
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => { load(); }, [load]);

  const applyFilters = () => {
    setApplied({ ...filters });
    setPage(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({ action: '', from: '', to: '' });
    setApplied({});
    setPage(1);
    setShowFilters(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheckIcon className="w-7 h-7 text-brand-600" />
            Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Immutable record of all sensitive platform actions.
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <FunnelIcon className="w-4 h-4" />
          Filter
          {Object.values(applied).some(Boolean) && (
            <span className="w-2 h-2 bg-brand-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action type</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
              className="input text-sm"
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_META).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
              className="input text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="btn-primary text-sm">Apply</button>
            <button onClick={clearFilters} className="btn-secondary text-sm">Clear</button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldCheckIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-gray-500">No audit log entries</p>
          <p className="text-sm">Sensitive actions will appear here when performed.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">When</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Performed By</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Clinic</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Details</th>
                  <th className="px-4 py-3 font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{log.user?.name}</p>
                      <p className="text-xs text-gray-400">{log.user?.role?.replace('_', ' ')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.doctor?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px]">
                      {log.metadata
                        ? <code className="bg-gray-50 px-1 rounded text-xs break-all">
                            {JSON.stringify(log.metadata)}
                          </code>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      {log.ipAddress ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination
                page={page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
