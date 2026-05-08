'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadsApi, LEAD_STATUSES } from '@/lib/leads';
import StatusBadge    from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth }    from '@/hooks/useAuth';
import toast          from 'react-hot-toast';
import { format }     from 'date-fns';
import { ArrowLeftIcon, PaperAirplaneIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function LeadDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const { user } = useAuth();
  const [lead, setLead]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const fetchLead = async () => {
    try {
      const { data } = await leadsApi.getById(id);
      setLead(data.data);
    } catch { toast.error('Lead not found'); router.push('/dashboard/leads'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLead(); }, [id]);

  const handleStatusChange = async (status) => {
    try {
      const { data } = await leadsApi.updateStatus(id, status);
      setLead((l) => ({ ...l, status: data.data.status }));
      toast.success('Status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSending(true);
    try {
      const { data } = await leadsApi.addComment(id, comment.trim());
      setLead((l) => ({ ...l, comments: [...(l.comments || []), data.data] }));
      setComment('');
    } catch { toast.error('Failed to add comment'); }
    finally { setSending(false); }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await leadsApi.deleteComment(id, commentId);
      setLead((l) => ({ ...l, comments: l.comments.filter((c) => c.id !== commentId) }));
      toast.success('Comment deleted');
    } catch { toast.error('Failed to delete comment'); }
  };

  if (loading) return <LoadingSpinner />;
  if (!lead)   return null;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Back */}
      <button onClick={() => router.push('/dashboard/leads')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeftIcon className="w-4 h-4" /> Back to Leads
      </button>

      {/* Lead info */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lead.patientName}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{lead.phone}{lead.email && ` · ${lead.email}`}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={lead.status} />
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="input text-sm w-auto"
            >
              {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <InfoRow label="City"     value={lead.city}         />
          <InfoRow label="Source"   value={lead.source}       />
          <InfoRow label="Campaign" value={lead.campaignName} />
          <InfoRow label="Doctor"   value={lead.doctor?.name} />
          <InfoRow label="Created"  value={format(new Date(lead.createdAt), 'dd MMM yyyy')} />
        </div>
      </div>

      {/* Comments */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          Notes & Comments ({lead.comments?.length || 0})
        </h2>

        {/* Timeline */}
        <div className="space-y-4 mb-6">
          {lead.comments?.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No comments yet. Add the first note.</p>
          )}
          {lead.comments?.map((c) => (
            <div key={c.id} className="flex gap-3 group">
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-brand-700 text-xs font-bold">
                  {c.user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{c.user?.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {format(new Date(c.createdAt), 'dd MMM · hh:mm a')}
                    </span>
                    {(user?.id === c.user?.id || user?.role === 'SUPER_ADMIN') && (
                      <button onClick={() => handleDeleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add comment */}
        <form onSubmit={handleComment} className="flex gap-2">
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note…"
            className="input flex-1 resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(e); } }}
          />
          <button type="submit" disabled={sending || !comment.trim()}
            className="btn-primary self-end px-3">
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-1">Press Enter to submit · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-gray-800 font-medium">{value || '—'}</p>
    </div>
  );
}
