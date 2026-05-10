'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/usePermission';
import {
  getStaff, createStaff, disableStaff, enableStaff, updateStaffPermissions,
} from '@/lib/staff';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  PlusIcon, PencilSquareIcon, NoSymbolIcon, CheckCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// ── Permission editor sub-component ──────────────────────────────────────────

const PERMISSION_FIELDS = [
  { resource: 'leads',        action: 'delete',  label: 'Delete Leads' },
  { resource: 'blogs',        action: 'create',  label: 'Create Blogs' },
  { resource: 'blogs',        action: 'publish', label: 'Publish Blogs' },
  { resource: 'blogs',        action: 'delete',  label: 'Delete Blogs' },
  { resource: 'appointments', action: 'delete',  label: 'Delete Appointments' },
];

function PermissionEditor({ staffId, currentPermissions, onSaved, onClose }) {
  const [perms, setPerms] = useState(currentPermissions || {});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const toggle = (resource, action) => {
    setPerms((prev) => {
      const current = prev?.[resource]?.[action];
      // Default for action (if not overridden): use role default (false for staff deletes)
      const next = !(current ?? false);
      return { ...prev, [resource]: { ...(prev?.[resource] || {}), [action]: next } };
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateStaffPermissions(staffId, perms);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Check to grant a permission above the staff default. Leave unchecked to use the role default (restricted).
      </p>
      <div className="divide-y divide-gray-100">
        {PERMISSION_FIELDS.map(({ resource, action, label }) => {
          const checked = perms?.[resource]?.[action] ?? false;
          return (
            <label key={`${resource}.${action}`} className="flex items-center justify-between py-3 cursor-pointer">
              <span className="text-sm text-gray-700">{label}</span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(resource, action)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
}

// ── Create staff form ─────────────────────────────────────────────────────────

function CreateStaffModal({ onCreated, onClose }) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [form, setForm]   = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createStaff({
        ...form,
        // DOCTOR_ADMIN: backend forces their own doctorId, no need to send it
        // SUPER_ADMIN: would need doctorId — handled in admin panel via /api/doctors/:id/staff
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create staff account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input
          type="text" required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Dr. Receptionist Name"
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
        <input
          type="email" required
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          placeholder="staff@clinic.com"
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Initial password</label>
        <input
          type="password" required minLength={8}
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          placeholder="Min. 8 characters"
          className="input"
        />
        <p className="mt-1 text-xs text-gray-400">Staff member should change this on first login.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Creating…' : 'Create Staff Account'}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { isAdmin, isDoctor } = useRole();

  const [staff, setStaff]               = useState([]);
  const [pagination, setPagination]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [page, setPage]                 = useState(1);

  // Modal states
  const [showCreate, setShowCreate]     = useState(false);
  const [permTarget, setPermTarget]     = useState(null); // { id, name, permissions }
  const [confirmTarget, setConfirmTarget] = useState(null); // { id, name, isActive }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getStaff({ page, limit: 20 });
      setStaff(result.staff);
      setPagination(result.pagination);
    } catch {
      setError('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget.isActive) {
        await disableStaff(confirmTarget.id);
      } else {
        await enableStaff(confirmTarget.id);
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Action failed');
    } finally {
      setConfirmTarget(null);
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'All staff across all clinics' : 'Staff accounts for your clinic'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium text-gray-500">No staff accounts yet</p>
          <p className="text-sm mt-1">Add a staff member to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-gray-600">Clinic</th>}
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.email}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-gray-600">
                      {s.doctor?.name ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {s.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Permissions */}
                      <button
                        onClick={() => setPermTarget(s)}
                        title="Edit permissions"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                      >
                        <ShieldCheckIcon className="w-4 h-4" />
                      </button>
                      {/* Enable / Disable */}
                      <button
                        onClick={() => setConfirmTarget(s)}
                        title={s.isActive ? 'Disable account' : 'Enable account'}
                        className={`p-1.5 rounded-lg ${
                          s.isActive
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {s.isActive
                          ? <NoSymbolIcon className="w-4 h-4" />
                          : <CheckCircleIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create staff modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Staff Member">
        <CreateStaffModal
          onCreated={load}
          onClose={() => setShowCreate(false)}
        />
      </Modal>

      {/* Permission editor modal */}
      {permTarget && (
        <Modal
          open={!!permTarget}
          onClose={() => setPermTarget(null)}
          title={`Permissions — ${permTarget.name}`}
          size="sm"
        >
          <PermissionEditor
            staffId={permTarget.id}
            currentPermissions={permTarget.permissions}
            onSaved={load}
            onClose={() => setPermTarget(null)}
          />
        </Modal>
      )}

      {/* Confirm enable/disable */}
      {confirmTarget && (
        <ConfirmModal
          open={!!confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleToggle}
          title={confirmTarget.isActive ? 'Disable Staff Account' : 'Enable Staff Account'}
          message={
            confirmTarget.isActive
              ? `Disable ${confirmTarget.name}'s account? They will be immediately logged out and cannot log in until re-enabled.`
              : `Re-enable ${confirmTarget.name}'s account? They will be able to log in again.`
          }
          confirmLabel={confirmTarget.isActive ? 'Disable' : 'Enable'}
          danger={confirmTarget.isActive}
        />
      )}
    </div>
  );
}
