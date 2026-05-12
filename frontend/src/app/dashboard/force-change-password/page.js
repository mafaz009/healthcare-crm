'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import {
  ShieldExclamationIcon, EyeIcon, EyeSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

// ── Password strength rules ───────────────────────────────────────────────────

const RULES = [
  { id: 'length',  label: 'At least 8 characters',  test: (p) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter',    test: (p) => /[A-Z]/.test(p) },
  { id: 'digit',   label: 'One number',              test: (p) => /[0-9]/.test(p) },
];

function PasswordStrength({ password }) {
  return (
    <ul className="space-y-1 mt-2">
      {RULES.map(({ id, label, test }) => {
        const ok = test(password);
        return (
          <li key={id} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
            <CheckCircleIcon className={`w-3.5 h-3.5 ${ok ? 'text-green-500' : 'text-gray-300'}`} />
            {label}
          </li>
        );
      })}
    </ul>
  );
}

// ── Password field with show/hide ─────────────────────────────────────────────

function PasswordInput({ label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="input pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ForceChangePasswordPage() {
  const { user, logout, refreshUser } = useAuth();

  const [form, setForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirm:     '',
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const allRulesPassed = RULES.every((r) => r.test(form.newPassword));
  const passwordsMatch = form.newPassword === form.confirm && form.confirm.length > 0;
  const canSubmit = form.oldPassword && allRulesPassed && passwordsMatch && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError('');

    try {
      await api.put('/api/auth/change-password', {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });

      setSuccess(true);

      // Changing password invalidates the current JWT (tokenVersion incremented).
      // We must log out and let the user sign in again with their new password.
      // Short delay so the success message is visible.
      setTimeout(() => logout(), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-start justify-center pt-12">
      <div className="w-full max-w-md">

        {/* Warning banner */}
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <ShieldExclamationIcon className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Password change required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your administrator has set a temporary password. You must create a new password before
              you can access the dashboard.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Create New Password</h1>
          <p className="text-sm text-gray-500 mb-5">
            Signed in as <span className="font-medium text-gray-700">{user?.name}</span>
            {' '}({user?.loginId})
          </p>

          {success ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-base font-semibold text-gray-900">Password changed successfully!</p>
              <p className="text-sm text-gray-500">
                Redirecting you to login so you can sign in with your new password…
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <PasswordInput
                label="Temporary password (current)"
                value={form.oldPassword}
                onChange={(e) => setForm((f) => ({ ...f, oldPassword: e.target.value }))}
                placeholder="Enter the temporary password"
                autoComplete="current-password"
              />

              <div>
                <PasswordInput
                  label="New password"
                  value={form.newPassword}
                  onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <PasswordStrength password={form.newPassword} />
              </div>

              <div>
                <PasswordInput
                  label="Confirm new password"
                  value={form.confirm}
                  onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="Type it again"
                  autoComplete="new-password"
                />
                {form.confirm && !passwordsMatch && (
                  <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                )}
                {form.confirm && passwordsMatch && (
                  <p className="text-xs text-green-600 mt-1">Passwords match</p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary w-full"
              >
                {saving ? 'Changing Password…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          After changing your password you will be redirected to login.
        </p>
      </div>
    </div>
  );
}
