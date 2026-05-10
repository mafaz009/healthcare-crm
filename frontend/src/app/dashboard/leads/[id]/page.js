'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter }  from 'next/navigation';
import { leadsApi, LEAD_STATUSES, getStatusLabel } from '@/lib/leads';
import StatusBadge    from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal          from '@/components/ui/Modal';
import { useAuth }    from '@/hooks/useAuth';
import api            from '@/lib/api';
import toast          from 'react-hot-toast';
import { useForm }    from 'react-hook-form';
import { format, isPast, isToday, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeftIcon, PaperAirplaneIcon, TrashIcon,
  CalendarDaysIcon, CheckCircleIcon, ClockIcon,
  UserCircleIcon, BellAlertIcon, PlusIcon,
  TagIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

export default function LeadDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const { user } = useAuth();
  const [lead, setLead]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [staffList, setStaff]     = useState([]);
  const [activeTab, setActiveTab] = useState('timeline');

  const fetchLead = useCallback(async () => {
    try {
      const { data } = await leadsApi.getById(id);
      setLead(data.data);
    } catch {
      toast.error('Lead not found');
      router.push('/dashboard/leads');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/staff', { params: { limit: 100, isActive: 'true' } })
      .then((r) => setStaff(r.data.data.staff || []))
      .catch(() => {});
  }, [user]);

  const patchLead     = (partial)  => setLead((l) => ({ ...l, ...partial }));
  const patchFollowUps = (updater) => setLead((l) => ({ ...l, followUps: updater(l.followUps || []) }));

  const handleStatusChange = async (status) => {
    try {
      const { data } = await leadsApi.updateStatus(id, status);
      const histEntry = {
        id: Date.now(), fromStatus: lead.status, toStatus: status,
        note: null, createdAt: new Date().toISOString(),
        changedBy: { id: user.id, name: user.name, role: user.role },
      };
      setLead((l) => ({
        ...l,
        status: data.data.status,
        statusHistory: [...(l.statusHistory || []), histEntry],
      }));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const handleAssign = async (assignedUserId) => {
    try {
      const { data } = await leadsApi.assign(id, assignedUserId || null);
      patchLead({ assignedUser: data.data.assignedUser, assignedUserId: data.data.assignedUserId });
      toast.success(assignedUserId ? 'Lead assigned' : 'Assignment removed');
    } catch { toast.error('Failed to update assignment'); }
  };

  const handleAddComment = async (comment) => {
    const { data } = await leadsApi.addComment(id, comment);
    setLead((l) => ({ ...l, comments: [...(l.comments || []), data.data] }));
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await leadsApi.deleteComment(id, commentId);
      setLead((l) => ({ ...l, comments: l.comments.filter((c) => c.id !== commentId) }));
      toast.success('Comment deleted');
    } catch { toast.error('Failed to delete comment'); }
  };

  const handleAddFollowUp = async (data) => {
    const res = await leadsApi.createFollowUp(id, data);
    patchFollowUps((prev) => [...prev, res.data.data]);
    patchLead({ followUpAt: res.data.data.scheduledAt });
  };

  const handleCompleteFollowUp = async (followUpId, note) => {
    try {
      const { data } = await leadsApi.completeFollowUp(id, followUpId, note);
      patchFollowUps((prev) => prev.map((f) => (f.id === followUpId ? data.data : f)));
      const { data: refreshed } = await leadsApi.getById(id);
      patchLead({ followUpAt: refreshed.data.followUpAt });
      toast.success('Follow-up completed');
    } catch { toast.error('Failed to complete follow-up'); }
  };

  const handleDeleteFollowUp = async (followUpId) => {
    if (!confirm('Delete this follow-up?')) return;
    try {
      await leadsApi.deleteFollowUp(id, followUpId);
      patchFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
      toast.success('Follow-up deleted');
    } catch { toast.error('Failed to delete follow-up'); }
  };

  if (loading) return <LoadingSpinner />;
  if (!lead)   return null;

  const pendingFollowUps = (lead.followUps || []).filter((f) => !f.completedAt);
  const doneFollowUps    = (lead.followUps || []).filter((f) =>  f.completedAt);
  const overdueCount     = pendingFollowUps.filter(
    (f) => isPast(new Date(f.scheduledAt)) && !isToday(new Date(f.scheduledAt))
  ).length;

  return (
    <div className="max-w-5xl space-y-5">
      <button onClick={() => router.push('/dashboard/leads')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Leads
      </button>

      {/* ── Header card ──────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lead.patientName}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {lead.phone}
              {lead.email && <> · <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a></>}
              {lead.city  && <> · {lead.city}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input text-sm w-auto"
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {/* Follow-up pill */}
          {lead.followUpAt ? (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              isPast(new Date(lead.followUpAt)) && !isToday(new Date(lead.followUpAt))
                ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                : isToday(new Date(lead.followUpAt))
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                  : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
            }`}>
              <ClockIcon className="w-3.5 h-3.5" />
              {isPast(new Date(lead.followUpAt)) && !isToday(new Date(lead.followUpAt))
                ? `Overdue · ${format(new Date(lead.followUpAt), 'dd MMM')}`
                : isToday(new Date(lead.followUpAt))
                  ? 'Follow-up today'
                  : `Follow-up ${format(new Date(lead.followUpAt), 'dd MMM')}`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <ClockIcon className="w-3.5 h-3.5" /> No follow-up scheduled
            </span>
          )}

          {/* Assignment picker */}
          <AssignmentPicker
            lead={lead}
            staffList={staffList}
            onAssign={handleAssign}
            canEdit={user?.role !== 'STAFF'}
          />

          {/* Source */}
          {lead.source && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 capitalize">
              <GlobeAltIcon className="w-3.5 h-3.5 text-gray-400" />
              {lead.source}
              {lead.campaignName && <> · <span className="font-medium">{lead.campaignName}</span></>}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <TagIcon className="w-3.5 h-3.5" />
            {format(new Date(lead.createdAt), 'dd MMM yyyy · hh:mm a')}
          </span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          ['timeline', 'Timeline', (lead.comments?.length || 0) + (lead.statusHistory?.length || 0), false],
          ['followups', 'Follow-ups', pendingFollowUps.length, overdueCount > 0],
          ['info', 'Lead Info', null, false],
        ].map(([key, label, count, warn]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
            {count != null && count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                warn ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' && (
        <TimelineTab lead={lead} user={user}
          onAddComment={handleAddComment} onDeleteComment={handleDeleteComment} />
      )}
      {activeTab === 'followups' && (
        <FollowUpsTab lead={lead} user={user}
          pendingFollowUps={pendingFollowUps} doneFollowUps={doneFollowUps}
          onAdd={handleAddFollowUp} onComplete={handleCompleteFollowUp} onDelete={handleDeleteFollowUp} />
      )}
      {activeTab === 'info' && <LeadInfoTab lead={lead} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function AssignmentPicker({ lead, staffList, onAssign, canEdit }) {
  if (!canEdit) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <UserCircleIcon className="w-3.5 h-3.5 text-gray-400" />
        {lead.assignedUser ? lead.assignedUser.name : 'Unassigned'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <UserCircleIcon className="w-3.5 h-3.5 text-gray-400" />
      <select
        value={lead.assignedUserId || ''}
        onChange={(e) => onAssign(e.target.value || null)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">Unassigned</option>
        {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function TimelineTab({ lead, user, onAddComment, onDeleteComment }) {
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const events = [
    ...(lead.comments || []).map((c) => ({ ...c, _type: 'comment' })),
    ...(lead.statusHistory || []).map((h) => ({ ...h, _type: 'status' })),
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try { await onAddComment(comment.trim()); setComment(''); }
    catch { toast.error('Failed to add comment'); }
    finally { setSending(false); }
  };

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-semibold text-gray-900">Activity Timeline</h2>
      <div className="relative">
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
        <div className="space-y-4">
          {events.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No activity yet. Add the first note below.</p>
          )}
          {events.map((evt) =>
            evt._type === 'comment'
              ? <CommentEvent key={`c-${evt.id}`} comment={evt} user={user} onDelete={onDeleteComment} />
              : <StatusEvent  key={`s-${evt.id}`} entry={evt} />
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-gray-100">
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
          placeholder="Add a note or remark…" className="input flex-1 resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} />
        <button type="submit" disabled={sending || !comment.trim()}
          className="btn-primary self-end px-3 disabled:opacity-50">
          <PaperAirplaneIcon className="w-4 h-4" />
        </button>
      </form>
      <p className="text-xs text-gray-400 -mt-3">Press Enter to submit · Shift+Enter for new line</p>
    </div>
  );
}

function CommentEvent({ comment, user, onDelete }) {
  return (
    <div className="flex gap-3 group relative pl-8">
      <div className="absolute left-0 w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
        <span className="text-brand-700 text-xs font-bold">{comment.user?.name?.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700">{comment.user?.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{format(new Date(comment.createdAt), 'dd MMM · hh:mm a')}</span>
            {(user?.id === comment.user?.id || user?.role === 'SUPER_ADMIN') && (
              <button onClick={() => onDelete(comment.id)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
      </div>
    </div>
  );
}

function StatusEvent({ entry }) {
  return (
    <div className="flex gap-3 relative pl-8">
      <div className="absolute left-0 w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-brand-500" />
      </div>
      <div className="flex-1 pt-1">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">{entry.changedBy?.name}</span>
          {entry.fromStatus ? (
            <> changed status from <span className="font-medium">{getStatusLabel(entry.fromStatus)}</span> to <span className="font-medium text-brand-700">{getStatusLabel(entry.toStatus)}</span></>
          ) : (
            <> created lead as <span className="font-medium text-brand-700">{getStatusLabel(entry.toStatus)}</span></>
          )}
        </p>
        {entry.note && <p className="text-xs text-gray-400 mt-0.5 italic">{entry.note}</p>}
        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(entry.createdAt), 'dd MMM yyyy · hh:mm a')}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function FollowUpsTab({ lead, user, pendingFollowUps, doneFollowUps, onAdd, onComplete, onDelete }) {
  const [showSchedule, setShowSchedule] = useState(false);

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            Pending Follow-ups
            {pendingFollowUps.length > 0 && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
                {pendingFollowUps.length}
              </span>
            )}
          </h2>
          <button onClick={() => setShowSchedule(true)} className="btn-primary gap-1.5 text-sm">
            <PlusIcon className="w-4 h-4" /> Schedule
          </button>
        </div>

        {pendingFollowUps.length === 0 ? (
          <div className="text-center py-6">
            <BellAlertIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No pending follow-ups.</p>
            <p className="text-xs text-gray-400 mt-1">Schedule a callback to keep track of this lead.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingFollowUps.map((f) => (
              <FollowUpCard key={f.id} followUp={f} leadId={lead.id}
                user={user} onComplete={onComplete} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {doneFollowUps.length > 0 && (
        <div className="card p-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
            <CheckCircleIcon className="w-4 h-4" /> Completed ({doneFollowUps.length})
          </h3>
          <div className="space-y-2">
            {doneFollowUps.map((f) => (
              <div key={f.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl opacity-70">
                <CheckCircleSolid className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600">
                    Scheduled for <span className="font-medium">{format(new Date(f.scheduledAt), 'dd MMM yyyy · hh:mm a')}</span>
                  </p>
                  {f.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{f.note}</p>}
                  <p className="text-xs text-gray-400">
                    Completed {f.completedAt && formatDistanceToNow(new Date(f.completedAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScheduleFollowUpModal open={showSchedule} onClose={() => setShowSchedule(false)}
        onSave={async (data) => { await onAdd(data); setShowSchedule(false); }} />
    </div>
  );
}

function FollowUpCard({ followUp, onComplete, onDelete }) {
  const [completing, setCompleting] = useState(false);
  const [note, setNote]             = useState('');
  const isOverdue = isPast(new Date(followUp.scheduledAt)) && !isToday(new Date(followUp.scheduledAt));
  const isTodayF  = isToday(new Date(followUp.scheduledAt));

  return (
    <div className={`rounded-xl border p-4 ${
      isOverdue ? 'border-red-200 bg-red-50' :
      isTodayF  ? 'border-amber-200 bg-amber-50' :
                  'border-gray-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDaysIcon className={`w-4 h-4 ${isOverdue ? 'text-red-500' : isTodayF ? 'text-amber-600' : 'text-brand-600'}`} />
            <span className={`text-sm font-medium ${isOverdue ? 'text-red-700' : isTodayF ? 'text-amber-800' : 'text-gray-800'}`}>
              {isOverdue ? 'Overdue · ' : isTodayF ? 'Today · ' : ''}
              {format(new Date(followUp.scheduledAt), 'EEE, dd MMM yyyy · hh:mm a')}
            </span>
          </div>
          {followUp.note && <p className="text-sm text-gray-600 mb-2">{followUp.note}</p>}
          <p className="text-xs text-gray-400">Scheduled by {followUp.user?.name}</p>
        </div>
        <button onClick={() => onDelete(followUp.id)} className="text-gray-300 hover:text-red-500 transition-colors">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {completing ? (
        <div className="mt-3 space-y-2">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Outcome / call notes (optional)…"
            className="input w-full resize-none text-sm" />
          <div className="flex gap-2">
            <button onClick={() => onComplete(followUp.id, note || undefined)}
              className="btn-primary text-sm gap-1.5">
              <CheckCircleIcon className="w-4 h-4" /> Mark Done
            </button>
            <button onClick={() => setCompleting(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCompleting(true)}
          className="mt-3 text-sm text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1">
          <CheckCircleIcon className="w-4 h-4" /> Mark as completed
        </button>
      )}
    </div>
  );
}

function ScheduleFollowUpModal({ open, onClose, onSave }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    try {
      await onSave({ scheduledAt: data.scheduledAt, note: data.note || undefined });
      toast.success('Follow-up scheduled');
      reset();
    } catch { toast.error('Failed to schedule follow-up'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule Follow-up">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
          <input type="datetime-local"
            className={`input ${errors.scheduledAt ? 'border-red-500' : ''}`}
            {...register('scheduledAt', { required: 'Date & time is required' })} />
          {errors.scheduledAt && <p className="text-xs text-red-500 mt-1">{errors.scheduledAt.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note / Instructions</label>
          <textarea rows={3} className="input resize-none"
            placeholder="e.g. Call to confirm appointment, discuss pricing…"
            {...register('note')} />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Scheduling…' : 'Schedule Follow-up'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function LeadInfoTab({ lead }) {
  const hasUtm = lead.utmSource || lead.utmMedium || lead.utmCampaign;
  const hasAds = lead.adSet || lead.adName || lead.landingPage || lead.externalId;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Patient Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Full Name"   value={lead.patientName} />
          <InfoRow label="Phone"       value={lead.phone} />
          <InfoRow label="Email"       value={lead.email} />
          <InfoRow label="City"        value={lead.city} />
          <InfoRow label="Source"      value={lead.source} />
          <InfoRow label="Campaign"    value={lead.campaignName} />
          <InfoRow label="Doctor"      value={lead.doctor?.name} />
          <InfoRow label="Assigned To" value={lead.assignedUser?.name} />
          <InfoRow label="Status"      value={getStatusLabel(lead.status)} />
        </div>
      </div>

      {hasUtm && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <GlobeAltIcon className="w-4 h-4 text-gray-400" /> UTM Attribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoRow label="utm_source"   value={lead.utmSource} />
            <InfoRow label="utm_medium"   value={lead.utmMedium} />
            <InfoRow label="utm_campaign" value={lead.utmCampaign} />
            <InfoRow label="utm_content"  value={lead.utmContent} />
            <InfoRow label="utm_term"     value={lead.utmTerm} />
          </div>
        </div>
      )}

      {hasAds && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-gray-400" /> Ads Metadata
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoRow label="Ad Set"       value={lead.adSet} />
            <InfoRow label="Ad Name"      value={lead.adName} />
            <InfoRow label="Landing Page" value={lead.landingPage} />
            <InfoRow label="External ID"  value={lead.externalId} />
          </div>
        </div>
      )}

      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Timestamps</h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Created"      value={format(new Date(lead.createdAt), 'dd MMM yyyy · hh:mm a')} />
          <InfoRow label="Last Updated" value={format(new Date(lead.updatedAt), 'dd MMM yyyy · hh:mm a')} />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-gray-800 font-medium text-sm break-words">{value || '—'}</p>
    </div>
  );
}
