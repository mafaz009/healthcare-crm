'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import StatsCard    from '@/components/ui/StatsCard';
import StatusBadge  from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  ClipboardDocumentListIcon, CalendarDaysIcon,
  DocumentTextIcon, UserGroupIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/summary')
      .then((r) => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const c = data?.counts || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Here's what's happening today.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Leads"   value={c.leads}        icon={ClipboardDocumentListIcon} color="blue"
          sub={`${c.newLeads || 0} new`} />
        <StatsCard label="Appointments"  value={c.appointments} icon={CalendarDaysIcon}          color="purple"
          sub={`${c.todayAppointments || 0} today`} />
        <StatsCard label="Published Blogs" value={c.publishedBlogs} icon={DocumentTextIcon}     color="green"
          sub={`${c.blogs || 0} total`} />
        {user?.role === 'SUPER_ADMIN' ? (
          <StatsCard label="Active Doctors" value={c.activeDoctors} icon={UserGroupIcon}         color="yellow"
            sub={`${c.doctors || 0} total`} />
        ) : (
          <StatsCard label="Pending Appointments" value={c.pendingAppointments} icon={SparklesIcon} color="yellow" />
        )}
      </div>

      {/* Pipeline + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Lead pipeline */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Lead Pipeline</h2>
          {data?.pipeline?.leads?.length ? (
            <div className="space-y-3">
              {data.pipeline.leads.map(({ status, count }) => (
                <PipelineRow key={status} status={status} count={count} total={c.leads} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No leads yet</p>
          )}
          <Link href="/dashboard/leads" className="text-sm text-brand-600 hover:underline mt-4 inline-block">
            View all leads →
          </Link>
        </div>

        {/* This week */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">This Week</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{data?.thisWeek?.leads || 0}</p>
              <p className="text-sm text-blue-600 mt-1">New Leads</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">{data?.thisWeek?.appointments || 0}</p>
              <p className="text-sm text-purple-600 mt-1">Appointments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Leads</h2>
          <Link href="/dashboard/leads" className="text-sm text-brand-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Phone</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {user?.role === 'SUPER_ADMIN' && <th className="px-5 py-3 font-medium hidden md:table-cell">Doctor</th>}
                <th className="px-5 py-3 font-medium hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.recent?.leads?.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{lead.patientName}</td>
                  <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{lead.phone}</td>
                  <td className="px-5 py-3"><StatusBadge status={lead.status} /></td>
                  {user?.role === 'SUPER_ADMIN' && (
                    <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{lead.doctor?.name}</td>
                  )}
                  <td className="px-5 py-3 text-gray-400 hidden lg:table-cell">
                    {format(new Date(lead.createdAt), 'dd MMM')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.recent?.leads?.length && (
            <p className="text-sm text-gray-400 text-center py-8">No leads yet</p>
          )}
        </div>
      </div>

      {/* Recent appointments */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Appointments</h2>
          <Link href="/dashboard/appointments" className="text-sm text-brand-600 hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {user?.role === 'SUPER_ADMIN' && <th className="px-5 py-3 font-medium hidden md:table-cell">Doctor</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.recent?.appointments?.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{appt.patientName}</td>
                  <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">
                    {format(new Date(appt.preferredDate), 'dd MMM yyyy')}
                    {appt.preferredTime && ` · ${appt.preferredTime}`}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={appt.status} /></td>
                  {user?.role === 'SUPER_ADMIN' && (
                    <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{appt.doctor?.name}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.recent?.appointments?.length && (
            <p className="text-sm text-gray-400 text-center py-8">No appointments yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineRow({ status, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColors = {
    NEW: 'bg-blue-500', CONTACTED: 'bg-yellow-500', FOLLOW_UP: 'bg-orange-500',
    APPOINTMENT_BOOKED: 'bg-purple-500', CONVERTED: 'bg-green-500', LOST: 'bg-red-400',
  };
  const labels = {
    NEW: 'New', CONTACTED: 'Contacted', FOLLOW_UP: 'Follow-up',
    APPOINTMENT_BOOKED: 'Appt. Booked', CONVERTED: 'Converted', LOST: 'Lost',
  };
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{labels[status]}</span>
        <span className="font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColors[status]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
