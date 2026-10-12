import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { reports } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { LoadingState, ErrorState } from '../../components/UI';
import { formatDate, timeAgo, extractError } from '../../lib/utils';
import {
  ArrowLeft, CheckCircle, XCircle, RotateCcw, Star, Clock,
  MapPin, Tag, Building, User, Paperclip, MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function TicketDetailPage() {
  const { ticketNumber } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => { fetchReport(); }, [ticketNumber]);

  async function fetchReport() {
    setLoading(true);
    setError('');
    try {
      const res = await reports.get(ticketNumber);
      setReport(res.data.report);
      const existingFeedback = res.data.report.incident?.feedbacks?.find(f => f.reporterId === user?.id);
      if (existingFeedback) { setRating(existingFeedback.rating); setFeedbackSent(true); }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setActionLoading('confirm');
    try {
      await reports.confirm(report.id);
      toast.success('Resolution confirmed! Thank you for your feedback.');
      fetchReport();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function handleDispute() {
    if (!disputeReason) { toast.error('Please provide a reason'); return; }
    setActionLoading('dispute');
    try {
      await reports.dispute(report.id, disputeReason);
      toast.success('Dispute registered. The team will review.');
      setShowDispute(false);
      fetchReport();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function handleReopen() {
    setActionLoading('reopen');
    try {
      await reports.reopen(report.id, reopenReason);
      toast.success('Ticket reopened!');
      setShowReopen(false);
      fetchReport();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function handleFeedback() {
    if (!rating) { toast.error('Please select a rating'); return; }
    setActionLoading('feedback');
    try {
      await reports.feedback(report.id, { rating, comment: feedbackComment });
      toast.success('Feedback submitted! Thank you.');
      setFeedbackSent(true);
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchReport} />;
  if (!report) return null;

  const incident = report.incident;
  const isAwaitingConfirmation = incident?.status === 'AWAITING_CONFIRMATION';
  const isResolved = incident?.status === 'RESOLVED';
  const canReopen = isResolved && incident.closedAt && (Date.now() - new Date(incident.closedAt)) < 7 * 24 * 60 * 60 * 1000;
  const currentAssignment = incident?.assignments?.[0];

  return (
    <div className="animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm p-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono text-lg font-bold text-indigo-400">{report.ticketNumber}</h1>
            <StatusBadge status={incident?.status} />
            <PriorityBadge priority={report.priority} />
            {incident?.escalated && <EscalatedBadge />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Submitted {formatDate(report.createdAt)}</p>
        </div>
      </div>

      {/* ══ AWAITING CONFIRMATION — UNMISSABLE BANNER ══ */}
      {isAwaitingConfirmation && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(109,40,217,0.35) 0%, rgba(79,46,220,0.2) 100%)',
          border: '2px solid rgba(168,85,247,0.6)',
          borderRadius: '1.25rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 0 40px rgba(139,92,246,0.25), 0 0 0 4px rgba(139,92,246,0.08)',
          animation: 'fade-in 0.4s ease-out',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* pulsing ring accent */}
          <div style={{
            position: 'absolute', top: '-20px', right: '-20px',
            width: '120px', height: '120px', borderRadius: '50%',
            background: 'rgba(168,85,247,0.1)',
            animation: 'pulse 2s infinite'
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', position: 'relative' }}>
            {/* Icon */}
            <div style={{
              width: '3rem', height: '3rem', borderRadius: '1rem', flexShrink: 0,
              background: 'rgba(168,85,247,0.25)',
              border: '1px solid rgba(168,85,247,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 2s infinite'
            }}>
              <CheckCircle size={24} style={{ color: '#c084fc' }} />
            </div>

            <div style={{ flex: 1 }}>
              <h3 style={{ color: '#f3e8ff', fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.35rem' }}>
                🔔 Staff marked this as resolved — was it actually fixed?
              </h3>
              <p style={{ color: '#c4b5fd', fontSize: '0.85rem', margin: '0 0 1rem', lineHeight: 1.5 }}>
                You have <strong style={{ color: '#e9d5ff' }}>72 hours</strong> to confirm or dispute. After that, it auto-resolves. Please check the issue before responding.
              </p>

              {/* Resolution note from staff */}
              {incident?.issueUpdates?.find(u => u.note && u.newStatus === 'AWAITING_CONFIRMATION') && (
                <div style={{
                  background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem'
                }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Staff's resolution note:</p>
                  <p style={{ color: '#e2e8f0', fontSize: '0.875rem', margin: 0 }}>
                    {incident.issueUpdates.find(u => u.note && u.newStatus === 'AWAITING_CONFIRMATION')?.note}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleConfirm}
                  disabled={actionLoading === 'confirm'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    background: '#059669', color: 'white', border: 'none',
                    borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
                    transition: 'all 0.2s ease', opacity: actionLoading === 'confirm' ? 0.7 : 1
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#10b981'}
                  onMouseLeave={e => e.currentTarget.style.background = '#059669'}
                >
                  {actionLoading === 'confirm' ? <span className="spinner" /> : <CheckCircle size={18} />}
                  ✅ Yes — Issue is fixed!
                </button>

                <button
                  onClick={() => setShowDispute(!showDispute)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    background: showDispute ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)',
                    color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)',
                    borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = showDispute ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)'}
                >
                  <XCircle size={18} />
                  ❌ No — Still not fixed
                </button>
              </div>

              {/* Dispute form */}
              {showDispute && (
                <div style={{ marginTop: '1rem', animation: 'fade-in 0.2s ease-out' }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                    What's still wrong? (required)
                  </p>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Describe what issue persists, so staff can revisit..."
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    style={{ marginBottom: '0.75rem' }}
                  />
                  <button
                    onClick={handleDispute}
                    disabled={actionLoading === 'dispute' || !disputeReason.trim()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      background: '#dc2626', color: 'white', border: 'none',
                      borderRadius: '0.75rem', padding: '0.625rem 1.25rem',
                      fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                      opacity: !disputeReason.trim() || actionLoading === 'dispute' ? 0.5 : 1
                    }}
                  >
                    {actionLoading === 'dispute' ? <span className="spinner" /> : null}
                    Submit Dispute
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Reopen */}
      {canReopen && (
        <div className="glass-card mb-4 bg-yellow-500/5 border-yellow-500/20">
          <button className="btn-warning btn-sm" onClick={() => setShowReopen(!showReopen)}>
            <RotateCcw size={14} /> Reopen Ticket
          </button>
          {showReopen && (
            <div className="mt-3 space-y-2">
              <textarea className="textarea" rows={2} placeholder="Reason for reopening (optional)" value={reopenReason} onChange={e => setReopenReason(e.target.value)} />
              <button className="btn-warning btn-sm" onClick={handleReopen} disabled={actionLoading === 'reopen'}>
                {actionLoading === 'reopen' ? <span className="spinner" /> : null} Confirm Reopen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {isResolved && (
        <div className="glass-card mb-4 bg-emerald-500/5 border-emerald-500/20">
          <h3 className="text-emerald-300 font-semibold mb-3 flex items-center gap-2"><Star size={16} /> Rate the resolution</h3>
          {feedbackSent ? (
            <p className="text-sm text-slate-400">You rated: {'⭐'.repeat(rating)} — Thank you!</p>
          ) : (
            <div>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)} className={`text-2xl transition-transform hover:scale-110 ${n <= rating ? 'text-yellow-400' : 'text-slate-600'}`}>⭐</button>
                ))}
              </div>
              <textarea className="textarea mb-2" rows={2} placeholder="Optional comment..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} />
              <button className="btn-primary btn-sm" onClick={handleFeedback} disabled={actionLoading === 'feedback'}>
                {actionLoading === 'feedback' ? <span className="spinner" /> : null} Submit Feedback
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Details */}
        <div className="md:col-span-2 glass-card">
          <h2 className="font-semibold text-slate-200 mb-4">Issue Details</h2>
          <div className="space-y-3">
            <InfoRow icon={Tag} label="Category" value={report.category?.name} />
            <InfoRow icon={MapPin} label="Location" value={`${report.location?.name}${report.location?.block ? ` — Block ${report.location.block}` : ''}`} />
            {report.systemNumber && <InfoRow icon={Tag} label="System No." value={`System ${report.systemNumber}`} />}
            <InfoRow icon={Building} label="Department" value={incident?.department?.name || 'Unassigned'} />
            {currentAssignment && <InfoRow icon={User} label="Assigned to" value={currentAssignment.assignee?.name} />}
          </div>
          <div className="mt-4 p-3 rounded-xl bg-slate-800/50">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><MessageSquare size={12} /> Description</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{report.description}</p>
          </div>
          {report.attachments?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Paperclip size={12} /> Attachments</p>
              <div className="flex gap-2 flex-wrap">
                {report.attachments.map(a => (
                  <a key={a.id} href={`/api/attachments/file/${a.filePath}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 bg-slate-800 px-3 py-1.5 rounded-lg">
                    📎 {a.kind}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="glass-card">
          <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><Clock size={16} /> Timeline</h2>
          <div className="space-y-3">
            {incident?.issueUpdates?.map((update, idx) => (
              <div key={update.id} className="timeline-item">
                <div className={`timeline-dot border-indigo-500/40 ${idx === 0 ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                  <span className="text-indigo-400 text-xs">📋</span>
                </div>
                <div className="flex-1 pb-3">
                  {update.oldStatus && update.newStatus && (
                    <p className="text-xs font-medium text-slate-300">
                      {update.oldStatus} → {update.newStatus}
                    </p>
                  )}
                  {update.note && <p className="text-xs text-slate-400 mt-0.5">{update.note}</p>}
                  <p className="text-xs text-slate-600 mt-1">{timeAgo(update.createdAt)} · {update.updater?.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon size={14} className="text-slate-500 flex-shrink-0" />
      <span className="text-slate-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-slate-200">{value || '—'}</span>
    </div>
  );
}
