'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { leadsApi, LEAD_STATUSES, LEAD_SOURCES } from '@/lib/leads';
import { doctorsApi } from '@/lib/doctors';
import StatusBadge    from '@/components/ui/StatusBadge';
import Pagination     from '@/components/ui/Pagination';
import EmptyState     from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal          from '@/components/ui/Modal';
import toast          from 'react-hot-toast';
import { useForm }    from 'react-hook-form';
import { format }     from 'date-fns';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [doctors, setDoctors]       = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', doctorId: '', page: 1 });

  // Only send search to API after user stops typing for 350ms
  const debouncedSearch = useDebounce(searchInput, 350);
  useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const { data } = await leadsApi.getAll(params);
      setLeads(data.data.leads);
      setPagination(data.data.pagination);
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      doctorsApi.getAll({ limit: 100 }).then((r) => setDoctors(r.data.data.doctors)).catch(() => {});
    }
  }, [user]);

  const handleFilter = (key, value) => {
    if (key === 'search') { setSearchInput(value); return; }
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track patient enquiries</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <PlusIcon className="w-4 h-4" /> New Lead
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search name, phone, email…"
            value={searchInput}
            onChange={(e) => handleFilter('search', e.target.value)}
          />
        </div>
        <select className="input w-auto" value={filters.status} onChange={(e) => handleFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {user?.role === 'SUPER_ADMIN' && (
          <select className="input w-auto" value={filters.doctorId} onChange={(e) => handleFilter('doctorId', e.target.value)}>
            <option value="">All Doctors</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {(filters.search || filters.status || filters.doctorId) && (
          <button onClick={() => { setSearchInput(''); setFilters({ search: '', status: '', doctorId: '', page: 1 }); }}
            className="btn-secondary gap-1.5">
            <FunnelIcon className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium hidden sm:table-cell">Phone</th>
                    <th className="px-5 py-3 font-medium hidden md:table-cell">Source</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    {user?.role === 'SUPER_ADMIN' && <th className="px-5 py-3 font-medium hidden lg:table-cell">Doctor</th>}
                    <th className="px-5 py-3 font-medium hidden lg:table-cell">Date</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{lead.patientName}</p>
                        {lead.city && <p className="text-xs text-gray-400">{lead.city}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">{lead.phone}</td>
                      <td className="px-5 py-3 text-gray-500 hidden md:table-cell capitalize">{lead.source || '—'}</td>
                      <td className="px-5 py-3"><StatusBadge status={lead.status} /></td>
                      {user?.role === 'SUPER_ADMIN' && (
                        <td className="px-5 py-3 text-gray-500 hidden lg:table-cell">{lead.doctor?.name}</td>
                      )}
                      <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">
                        {format(new Date(lead.createdAt), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/dashboard/leads/${lead.id}`}
                          className="text-brand-600 hover:underline text-xs font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leads.length === 0 && <EmptyState title="No leads found" description="Try adjusting your filters or create a new lead." />}
            <div className="px-5 py-4 border-t border-gray-100">
              <Pagination pagination={pagination} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      <CreateLeadModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchLeads(); }}
        user={user}
        doctors={doctors}
      />
    </div>
  );
}

function CreateLeadModal({ open, onClose, onCreated, user, doctors }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    try {
      await leadsApi.create(data);
      toast.success('Lead created');
      reset();
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create lead');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Lead">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
            <input className="input" {...register('patientName', { required: 'Required' })} />
            {errors.patientName && <p className="text-xs text-red-500 mt-1">{errors.patientName.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input className="input" {...register('phone', { required: 'Required' })} />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input" type="email" {...register('email')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input className="input" {...register('city')} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select className="input" {...register('source')}>
              <option value="">Select source</option>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
            <input className="input" {...register('campaignName')} placeholder="e.g. Summer Health" />
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
              <select className="input" {...register('doctorId', { required: 'Required' })}>
                <option value="">Select doctor</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.doctorId && <p className="text-xs text-red-500 mt-1">{errors.doctorId.message}</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Saving…' : 'Create Lead'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
