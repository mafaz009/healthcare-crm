'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/usePermission';
import {
  inviteStaff, disableStaff, enableStaff,
  updateStaffPermissions, resetStaffPassword, forceStaffLogout,
  getStaff,
} from '@/lib/staff';
import Modal          from '@/components/ui/Modal';
import ConfirmModal   from '@/components/ui/ConfirmModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast          from 'react-hot-toast';
import {
  PlusIcon, NoSymbolIcon, CheckCircleIcon, ShieldCheckIcon,
  UsersIcon, KeyIcon, ArrowRightOnRectangleIcon,
  ClipboardDocumentIcon, EyeIcon, EyeSlashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// ── Temp password display modal ───────────────────────────────────────────────
//
// Shown after a password reset or invite. The admin must copy and share it —
// it is NEVER stored after this modal closes.

function TempPasswordModal({ open, onClose, staffName, tempPassword, isInvite }) {
  const [copied, setCopied] = useState(false);
  const [shown,  setShown]  = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isInvite ? 'Staff Account Created' : 'Password Reset'}
    >
      <div className="space-y-4">
        {/* Warning */}
        <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Copy this password now</p>
            <p className="mt-0.5 text-amber-700">
              This temporary password will <strong>not be shown again</strong> after you close this dialog.
              Share it securely with {staffName}.
            </p>
          </div>
        </div>

        {/* Password display */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
            Temporary Password
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <code className="flex-1 text-sm font-mono text-gray-800 tracking-wide">
                {shown ? tempPassword : '•'.repeat(tempPassword.length)}
              </code>
              <button
                onClick={() => setShown((s) => !s)}
                className="text-gray-400 hover:text-gray-600"
                title={shown ? 'Hide' : 'Show'}
              >
                {shown ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
            >
              <ClipboardDocumentIcon className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <ul className="text-sm text-gray-600 space-y-1.5 list-none">
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold mt-0.5">1.</span>
            Share this password with {staffName} via a secure channel (phone, WhatsApp, etc.)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold mt-0.5">2.</span>
            They will be required to create a new password on their first login.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-500 font-bold mt-0.5">3.</span>
            Do not store or email this password.
          </li>
        </ul>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-primary">
            I've copied it — Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Invite staff form ─────────────────────────────────────────────────────────

function InviteStaffModal({ onCreated, onClose, onTempPassword }) {
  const [form, setForm]   = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Omit password → invite flow: backend auto-generates temp password
      const result = await inviteStaff({ name: form.name, email: form.email });
      onCreated();
      onClose();
      // Show the temp password modal after modal closes
      if (result.data?.tempPassword) {
        onTempPassword({
          staffName:    form.name,
          tempPassword: result.data.tempPassword,
          isInvite:     true,
        });
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create staff account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
        A secure temporary password will be generated automatically. The staff member will be
        prompted to change it on their first login.
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input
          type="text" required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Reception staff name"
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
        <p className="mt-1 text-xs text-gray-400">Used for login. Must be unique.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Creating…' : 'Create & Generate Password'}
        </button>
      </div>
    </form>
  );
}

// ── Permission editor ─────────────────────────────────────────────────────────

const PERMISSION_FIELDS = [
  { resource: 'leads',        action: 'delete',  label: 'Delete Leads' },
  { resource: 'blogs',        action: 'create',  label: 'Create Blogs' },
  { resource: 'blogs',        action: 'publish', label: 'Publish Blogs' },
  { resource: 'blogs',        action: 'delete',  label: 'Delete Blogs' },
  { resource: 'appointments', action: 'delete',  label: 'Delete Appointments' },
];

function PermissionEditor({ staffId, currentPermissions, onSaved, onClose }) {
  const [perms,  setPerms]  = useState(currentPermissions || {});
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const toggle = (resource, action) => {
    setPerms((prev) => {
      const next = !(prev?.[resource]?.[action] ?? false);
      return { ...prev, [resource]: { ...(prev?.[resource] || {}), [action]: next } };
    });
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await updateStaffPermissions(staffId, perms);
      toast.success('Permissions updated');
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
        Checked = grant above the STAFF default. Unchecked = use role default (restricted).
      </p>
      <div className="divide-y divide-gray-100">
        {PERMISSION_FIELDS.map(({ resource, action, label }) => (
          <label key={`${resource}.${action}`} className="flex items-center justify-between py-3 cursor-pointer">
            <span className="text-sm text-gray-700">{label}</span>
            <input
              type="checkbox"
              checked={perms?.[resource]?.[action] ?? false}
              onChange={() => toggle(resource, action)}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
          </label>
        ))}
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

// ── Derived user status badge ─────────────────────────────────────────────────

function StatusBadge({ staff }) {
  if (!staff.isActive) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Disabled</span>;
  }
  if (staff.mustChangePassword) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending Setup</span>;
  }
  if (!staff.lastLoginAt) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Invited</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { isAdmin, isDoctor } = useRole();

  const [staff,      setStaff]      = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [page,       setPage]       = useState(1);

  // Modal states
  const [showInvite,    setShowInvite]    = useState(false);
  const [permTarget,    setPermTarget]    = useState(null);   // staff object for permissions
  const [confirmAction, setConfirmAction] = useState(null);   // { type, staff }
  const [tempPwdInfo,   setTempPwdInfo]   = useState(null);   // { staffName, tempPassword, isInvite }

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

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { type, staff: target } = confirmAction;
    setConfirmAction(null);

    try {
      if (type === 'disable') {
        await disableStaff(target.id);
        toast.success(`${target.name}'s account disabled`);
      } else if (type === 'enable') {
        await enableStaff(target.id);
        toast.success(`${target.name}'s account enabled`);
      } else if (type === 'force-logout') {
        await forceStaffLogout(target.id);
        toast.success(`${target.name}'s sessions terminated`);
      } else if (type === 'reset-password') {
        const result = await resetStaffPassword(target.id);
        toast.success('Password reset');
        setTempPwdInfo({ staffName: target.name, tempPassword: result.tempPassword, isInvite: false });
      }
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    }
  };

  // Confirm action config
  const CONFIRM_CONFIG = {
    'disable':        { title: 'Disable Account',    danger: true,  confirmLabel: 'Disable',           body: (s) => `Disable ${s.name}'s account? They will be immediately logged out and unable to login until re-enabled.` },
    'enable':         { title: 'Enable Account',     danger: false, confirmLabel: 'Enable',            body: (s) => `Re-enable ${s.name}'s account? They will be able to log in again.` },
    'force-logout':   { title: 'Force Logout',       danger: true,  confirmLabel: 'Force Logout',      body: (s) => `Terminate all active sessions for ${s.name}? They will be logged out immediately on their next request.` },
    'reset-password': { title: 'Reset Password',     danger: true,  confirmLabel: 'Reset Password',    body: (s) => `Reset ${s.name}'s password? A new temporary password will be generated. Their current sessions will be terminated immediately.` },
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
          onClick={() => setShowInvite(true)}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Invite Staff
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium text-gray-500">No staff accounts yet</p>
          <p className="text-sm mt-1">Invite a staff member to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">Email / Username</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-gray-600">Clinic</th>}
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600">{s.email}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.loginId}</p>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-gray-600">{s.doctor?.name ?? '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    <StatusBadge staff={s} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
                    {s.lastLoginAt
                      ? new Date(s.lastLoginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Permissions */}
                      <ActionBtn
                        icon={<ShieldCheckIcon className="w-4 h-4" />}
                        title="Edit permissions"
                        onClick={() => setPermTarget(s)}
                        color="blue"
                      />
                      {/* Reset password */}
                      <ActionBtn
                        icon={<KeyIcon className="w-4 h-4" />}
                        title="Reset password"
                        onClick={() => setConfirmAction({ type: 'reset-password', staff: s })}
                        color="amber"
                      />
                      {/* Force logout */}
                      {s.isActive && (
                        <ActionBtn
                          icon={<ArrowRightOnRectangleIcon className="w-4 h-4" />}
                          title="Force logout"
                          onClick={() => setConfirmAction({ type: 'force-logout', staff: s })}
                          color="orange"
                        />
                      )}
                      {/* Enable / Disable */}
                      <ActionBtn
                        icon={s.isActive
                          ? <NoSymbolIcon className="w-4 h-4" />
                          : <CheckCircleIcon className="w-4 h-4" />}
                        title={s.isActive ? 'Disable account' : 'Enable account'}
                        onClick={() => setConfirmAction({ type: s.isActive ? 'disable' : 'enable', staff: s })}
                        color={s.isActive ? 'red' : 'green'}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}

      {/* Invite staff */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Staff Member">
        <InviteStaffModal
          onCreated={load}
          onClose={() => setShowInvite(false)}
          onTempPassword={setTempPwdInfo}
        />
      </Modal>

      {/* Temp password display (shown after invite or reset) */}
      {tempPwdInfo && (
        <TempPasswordModal
          open={!!tempPwdInfo}
          onClose={() => setTempPwdInfo(null)}
          staffName={tempPwdInfo.staffName}
          tempPassword={tempPwdInfo.tempPassword}
          isInvite={tempPwdInfo.isInvite}
        />
      )}

      {/* Permission editor */}
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

      {/* Confirmation modal for destructive actions */}
      {confirmAction && (
        <ConfirmModal
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
          title={CONFIRM_CONFIG[confirmAction.type]?.title}
          message={CONFIRM_CONFIG[confirmAction.type]?.body(confirmAction.staff)}
          confirmLabel={CONFIRM_CONFIG[confirmAction.type]?.confirmLabel}
          danger={CONFIRM_CONFIG[confirmAction.type]?.danger}
        />
      )}
    </div>
  );
}

// ── Reusable action button ────────────────────────────────────────────────────

const COLOR_MAP = {
  blue:   'text-gray-400 hover:text-blue-600 hover:bg-blue-50',
  amber:  'text-gray-400 hover:text-amber-600 hover:bg-amber-50',
  orange: 'text-gray-400 hover:text-orange-600 hover:bg-orange-50',
  red:    'text-gray-400 hover:text-red-600 hover:bg-red-50',
  green:  'text-gray-400 hover:text-green-600 hover:bg-green-50',
};

function ActionBtn({ icon, title, onClick, color = 'blue' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${COLOR_MAP[color]}`}
    >
      {icon}
    </button>
  );
}
