'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth }  from '@/hooks/useAuth';
import { appointmentsApi, APPOINTMENT_STATUSES } from '@/lib/appointments';
import { doctorsApi } from '@/lib/doctors';
import StatusBadge    from '@/components/ui/StatusBadge';
import Pagination     from '@/components/ui/Pagination';
import EmptyState     from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal          from '@/components/ui/Modal';
import toast          from 'react-hot-toast';
import { useForm }    from 'react-hook-form';
import { format }     from 'date-fns';
import { PlusIcon, MagnifyingGlassIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [today, setToday]               = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [showCreate, setShowCreate]     = useState(false);
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const [list, td] = await Promise.all([
        appointmentsApi.getAll(params),
        appointmentsApi.getToday(),
      ]);
      setAppointments(list.data.data.appointments);
      setPagination(list.data.data.pagination);
      setToday(td.data.data);
    } catch { toast.error('Failed to load appointments'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      doctorsApi.getAll({ limit: 100 }).then((r) => setDoctors(r.data.data.doctors)).catch(() => {});
    }
  }, [user]);

  const handleStatusUpdate = async (id, status) => {
    try {
      await appointmentsApi.updateStatus(id, status);
      toast.success('Status updated');
      fetchAll();
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage patient bookings</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <PlusIcon className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* Today's appointments */}
      {today.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDaysIcon className="w-5 h-5 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Today ({today.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {today.map((appt) => (
              <div key={appt.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-700 text-sm font-bold">
                    {appt.preferredTime?.split(':')[0] || '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 text-sm truncate">{appt.patientName}</p>
                  <p className="text-xs text-gray-500">{appt.preferredTime || 'Time TBD'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={appt.status} />
                    {appt.status === 'PENDING' && (
                      <button onClick={() => handleStatusUpdate(appt.id, 'CONFIRMED')}
                        className="text-xs text-brand-600 hover:underline">Confirm</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search patient name or phone…"
            value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <select className="input w-auto" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
          <option value="">All Statuses</option>
          {APPOINTMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="date" className="input w-auto" onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))} />
        <input type="date" className="input w-auto" onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))} />
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
                    <th className="px-5 py-3 font-medium hidden sm:table-cell">Date & Time</th>
                    <th className="px-5 py-3 font-medium hidden md:table-cell">Issue</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    {user?.role === 'SUPER_ADMIN' && <th className="px-5 py-3 font-medium hidden lg:table-cell">Doctor</th>}
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{appt.patientName}</p>
                        <p className="text-xs text-gray-400">{appt.phone}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-600 hidden sm:table-cell">
                        <p>{format(new Date(appt.preferredDate), 'dd MMM yyyy')}</p>
                        {appt.preferredTime && <p className="text-xs text-gray-400">{appt.preferredTime}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-500 hidden md:table-cell max-w-[180px] truncate">
                        {appt.issue || '—'}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={appt.status} /></td>
                      {user?.role === 'SUPER_ADMIN' && (
                        <td className="px-5 py-3 text-gray-500 hidden lg:table-cell">{appt.doctor?.name}</td>
                      )}
                      <td className="px-5 py-3">
                        <select
                          value={appt.status}
                          onChange={(e) => handleStatusUpdate(appt.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {APPOINTMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {appointments.length === 0 && <EmptyState title="No appointments found" />}
            <div className="px-5 py-4 border-t border-gray-100">
              <Pagination pagination={pagination} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
            </div>
          </>
        )}
      </div>

      <CreateAppointmentModal
        open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchAll(); }}
        user={user} doctors={doctors}
      />
    </div>
  );
}

function CreateAppointmentModal({ open, onClose, onCreated, user, doctors }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    try {
      await appointmentsApi.create(data);
      toast.success('Appointment created');
      reset(); onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Appointment">
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
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date *</label>
            <input type="date" className="input" {...register('preferredDate', { required: 'Required' })} />
            {errors.preferredDate && <p className="text-xs text-red-500 mt-1">{errors.preferredDate.message}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
            <input type="time" className="input" {...register('preferredTime')} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue / Complaint</label>
            <textarea rows={2} className="input resize-none" {...register('issue')} placeholder="e.g. Chest pain, routine checkup…" />
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
              <select className="input" {...register('doctorId', { required: 'Required' })}>
                <option value="">Select doctor</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Saving…' : 'Create Appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
