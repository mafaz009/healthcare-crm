'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth }   from '@/hooks/useAuth';
import { doctorsApi } from '@/lib/doctors';
import StatusBadge    from '@/components/ui/StatusBadge';
import Pagination     from '@/components/ui/Pagination';
import EmptyState     from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal          from '@/components/ui/Modal';
import toast          from 'react-hot-toast';
import { useForm }    from 'react-hook-form';
import { PlusIcon, MagnifyingGlassIcon, KeyIcon, ClipboardIcon } from '@heroicons/react/24/outline';

export default function DoctorsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [doctors, setDoctors]       = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newDoctor, setNewDoctor]   = useState(null); // holds temp password result
  const [filters, setFilters]       = useState({ search: '', status: '', page: 1 });

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') router.replace('/dashboard');
  }, [user, router]);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await doctorsApi.getAll(params);
      setDoctors(data.data.doctors);
      setPagination(data.data.pagination);
    } catch { toast.error('Failed to load doctors'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleToggleStatus = async (doctor) => {
    const status = doctor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await doctorsApi.setStatus(doctor.id, status);
      toast.success(`Doctor ${status === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      fetchDoctors();
    } catch { toast.error('Failed to update'); }
  };

  const handleRegenerateKey = async (id) => {
    if (!confirm('Regenerate API key? The old key will stop working immediately. Update the doctor website right after.')) return;
    try {
      const { data } = await doctorsApi.regenerateKey(id);
      await navigator.clipboard.writeText(data.data.apiKey);
      toast.success('New API key copied to clipboard');
    } catch { toast.error('Failed to regenerate key'); }
  };

  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  };

  if (user?.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your doctor clients and their access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <PlusIcon className="w-4 h-4" /> Add Doctor
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, specialty, domain…"
            value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <select className="input w-auto" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Doctor</th>
                    <th className="px-5 py-3 font-medium hidden md:table-cell">Domain</th>
                    <th className="px-5 py-3 font-medium hidden lg:table-cell">API Key</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {doctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-400">{doc.specialty}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{doc.domain}</td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {doc.apiKey?.slice(0, 12)}…
                          </code>
                          <button onClick={() => copyToClipboard(doc.apiKey, 'API key')}
                            className="text-gray-400 hover:text-brand-600">
                            <ClipboardIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={doc.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleToggleStatus(doc)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${doc.status === 'ACTIVE' ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                            {doc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => handleRegenerateKey(doc.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50"
                            title="Regenerate API Key">
                            <KeyIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {doctors.length === 0 && <EmptyState title="No doctors yet" description="Add your first doctor client to get started." />}
            <div className="px-5 py-4 border-t border-gray-100">
              <Pagination pagination={pagination} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateDoctorModal
          open={showCreate}
          onClose={() => { setShowCreate(false); setNewDoctor(null); }}
          onCreated={(result) => { setNewDoctor(result); setShowCreate(false); fetchDoctors(); }}
        />
      )}

      {/* Temp password reveal */}
      {newDoctor && (
        <Modal open={!!newDoctor} onClose={() => setNewDoctor(null)} title="Doctor Created Successfully">
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-medium text-green-800 mb-1">Account created for {newDoctor.doctor.name}</p>
              <p className="text-xs text-green-600">Share these credentials securely — the password is shown only once.</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded-lg">{newDoctor.doctor.email}</code>
                  <button onClick={() => copyToClipboard(newDoctor.doctor.email, 'Email')} className="btn-secondary px-3">Copy</button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg font-bold tracking-wider">{newDoctor.tempPassword}</code>
                  <button onClick={() => copyToClipboard(newDoctor.tempPassword, 'Password')} className="btn-secondary px-3">Copy</button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">API Key (for the doctor website)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 px-3 py-2 rounded-lg font-mono truncate">{newDoctor.doctor.apiKey}</code>
                  <button onClick={() => copyToClipboard(newDoctor.doctor.apiKey, 'API Key')} className="btn-secondary px-3">Copy</button>
                </div>
              </div>
            </div>
            <button onClick={() => setNewDoctor(null)} className="btn-primary w-full">Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateDoctorModal({ open, onClose, onCreated }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    try {
      const { data: res } = await doctorsApi.create(data);
      toast.success('Doctor added');
      reset();
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create doctor');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New Doctor" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input className="input" placeholder="Dr. Sarah Ali" {...register('name', { required: 'Required' })} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialty *</label>
            <input className="input" placeholder="Cardiologist" {...register('specialty', { required: 'Required' })} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input className="input" type="email" {...register('email', { required: 'Required' })} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input" placeholder="+91-9876543210" {...register('phone')} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Website Domain *</label>
            <input className="input" placeholder="drsmith.com" {...register('domain', { required: 'Required' })} />
            {errors.domain && <p className="text-xs text-red-500 mt-1">{errors.domain.message}</p>}
            <p className="text-xs text-gray-400 mt-1">Without https:// · e.g. drsmith.com</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Creating…' : 'Create Doctor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
