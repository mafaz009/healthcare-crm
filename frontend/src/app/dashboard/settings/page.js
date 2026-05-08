'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import api   from '@/lib/api';
import toast  from 'react-hot-toast';
import { setSession } from '@/lib/auth';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['profile', 'Profile'], ['password', 'Change Password']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileForm user={user} />}
      {tab === 'password' && <PasswordForm />}
    </div>
  );
}

function ProfileForm({ user }) {
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: { name: user?.name || '', email: user?.email || '' },
  });

  const onSubmit = async (data) => {
    try {
      const { data: res } = await api.put('/api/auth/profile', data);
      // Update stored user
      const stored = JSON.parse(localStorage.getItem('crm_user') || '{}');
      localStorage.setItem('crm_user', JSON.stringify({ ...stored, ...res.data }));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    }
  };

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">Profile Information</h2>
        <p className="text-sm text-gray-500 mt-0.5">Update your name and email address.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center">
          <span className="text-white text-2xl font-bold">{user?.name?.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <p className="font-medium text-gray-900">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.role?.replace('_', ' ')}</p>
          {user?.doctor && <p className="text-xs text-gray-400 mt-0.5">{user.doctor.name} · {user.doctor.specialty}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input className="input" {...register('name', { required: 'Name is required' })} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input className="input" type="email" {...register('email', { required: 'Email is required' })} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div className="pt-2">
          <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary">
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PasswordForm() {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
  const newPassword = watch('newPassword');

  const onSubmit = async (data) => {
    try {
      await api.put('/api/auth/change-password', {
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password changed successfully');
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    }
  };

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900">Change Password</h2>
        <p className="text-sm text-gray-500 mt-0.5">Use a strong password with uppercase letters and numbers.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
          <input type="password" className="input" {...register('oldPassword', { required: 'Required' })} />
          {errors.oldPassword && <p className="text-xs text-red-500 mt-1">{errors.oldPassword.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input type="password" className="input" {...register('newPassword', {
            required: 'Required',
            minLength: { value: 8, message: 'Min 8 characters' },
            pattern: { value: /(?=.*[A-Z])(?=.*[0-9])/, message: 'Must include uppercase letter and number' },
          })} />
          {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
          <input type="password" className="input" {...register('confirmPassword', {
            required: 'Required',
            validate: (v) => v === newPassword || 'Passwords do not match',
          })} />
          {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
        </div>
        <div className="pt-2">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
