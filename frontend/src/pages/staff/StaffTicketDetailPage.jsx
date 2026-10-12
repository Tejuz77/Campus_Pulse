import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { incidents, departments, users } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { LoadingState, ErrorState } from '../../components/UI';
import { formatDate, timeAgo, extractError } from '../../lib/utils';
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, PauseCircle,
  User, MapPin, Tag, Building, ArrowRight, Paperclip
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const STAFF_TRANSITIONS = {
  SUBMITTED: ['ASSIGNED', 'REJECTED', 'ON_HOLD'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'REJECTED'],
  IN_PROGRESS: ['AWAITING_CONFIRMATION', 'ON_HOLD'],
  ON_HOLD: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'],
};

export default function StaffTicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Status update form
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');
  const [holdReason, setHoldReason] = useState('');

  // Reassign form
  const [deptStaff, setDeptStaff] = useState([]);
  const [assignTo, setAssignTo] = useState('');
  const [showReassign, setShowReassign] = useState(false);

  // Transfer form
  const [allDepts, setAllDepts] = useState([]);
  const [transferToDept, setTransferToDept] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => { fetchIncident(); }, [id]);
  useEffect(() => {
    if (incident) {
      departments.get(incident.departmentId || user.departmentId).then(r => setDeptStaff(r.data.department.users || [])).catch(() => {});
      departments.list().then(r => setAllDepts(r.data.departments || [])).catch(() => {});
    }
  }, [incident]);

  async function fetchIncident() {
    setLoading(true);
    setError('');
    try {
      const res = await incidents.get(id);
      setIncident(res.data.incident);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(e) {
    e.preventDefault();
    if (!newStatus) { toast.error('Select a new status'); return; }
    if (newStatus === 'AWAITING_CONFIRMATION' && !note) { toast.error('Resolution note is required'); return; }
    if (newStatus === 'ON_HOLD' && !holdReason) { toast.error('Hold reason is required'); return; }

    setActionLoading('status');
    try {
      await incidents.updateStatus(id, { newStatus, note, holdReason, version: incident.version });
      toast.success(`Status updated to ${newStatus}`);
      setNewStatus(''); setNote(''); setHoldReason('');
      fetchIncident();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setActionLoading('');
    }
  }

  async function handleReassign() {
    if (!assignTo) { toast.error('Select a staff member'); return; }
    setActionLoading('reassign');
    try {
      await incidents.assign(id, { assignedTo: assignTo, reason: 'Manual reassignment' });
      toast.success('Ticket reassigned');
      setShowReassign(false);
      fetchIncident();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setActionLoading('');
    }
  }

  async function handleTransfer() {
    if (!transferToDept || !transferReason) { toast.error('Department and reason are required'); return; }
    setActionLoading('transfer');
    try {
      await incidents.transfer(id, { toDepartmentId: transferToDept, reason: transferReason });
      toast.success('Ticket transferred');
      navigate('/staff/tickets');
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setActionLoading('');
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchIncident} />;
  if (!incident) return null;

  const allowedTransitions = STAFF_TRANSITIONS[incident.status] || [];
  const currentAssignment = incident.assignments?.[0];
  const isMyTicket = incident.departmentId === user.departmentId;

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm p-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono text-lg font-bold text-indigo-400">{incident.reports?.[0]?.ticketNumber || incident.id}</h1>
            <StatusBadge status={incident.status} />
            <PriorityBadge priority={incident.priority} />
            {incident.escalated && <EscalatedBadge />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Created {formatDate(incident.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Details card */}
          <div className="glass-card">
            <h2 className="font-semibold text-slate-200 mb-4">Incident Details</h2>
            <div className="space-y-3 mb-4">
              <InfoRow icon={Tag} label="Category" value={incident.category?.name} />
              <InfoRow icon={MapPin} label="Location" value={`${incident.location?.name}${incident.location?.block ? ` — Block ${incident.location.block}` : ''}`} />
              <InfoRow icon={Building} label="Department" value={incident.department?.name || 'Unassigned'} />
              <InfoRow icon={User} label="Assigned to" value={currentAssignment?.assignee?.name || 'Not assigned'} />
            </div>
            {/* Reports */}
            {incident.reports?.map(report => (
              <div key={report.id} className="p-3 rounded-xl bg-slate-800/50 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs text-indigo-400">{report.reporter?.name}</span>
                  {report.reporter?.rollNo && <span className="text-xs text-slate-500">({report.reporter.rollNo})</span>}
                </div>
                {incident.reports.length > 1 && <p className="text-xs text-emerald-400 mb-1">+{incident.reports.length - 1} more students reported this issue</p>}
                {report.attachments?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {report.attachments.map(a => (
                      <a key={a.id} href={`/api/attachments/file/${a.filePath}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-slate-700/50 px-2 py-1 rounded-lg">
                        <Paperclip size={12} /> {a.kind}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Status update */}
          {isMyTicket && allowedTransitions.length > 0 && (
            <div className="glass-card">
              <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><CheckCircle size={16} /> Update Status</h2>
              <form onSubmit={handleStatusUpdate} className="space-y-3">
                <div>
                  <label className="label">New Status</label>
                  <select className="select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                    <option value="">Select status...</option>
                    {allowedTransitions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                {newStatus === 'AWAITING_CONFIRMATION' && (
                  <div>
                    <label className="label">Resolution Note * <span className="text-red-400">(required)</span></label>
                    <textarea className="textarea" rows={3} placeholder="Describe what was done to resolve this issue..." value={note} onChange={e => setNote(e.target.value)} />
                  </div>
                )}
                {newStatus === 'ON_HOLD' && (
                  <div>
                    <label className="label">Hold Reason * <span className="text-red-400">(required)</span></label>
                    <textarea className="textarea" rows={2} placeholder="Why is this on hold?" value={holdReason} onChange={e => setHoldReason(e.target.value)} />
                  </div>
                )}
                {newStatus && newStatus !== 'AWAITING_CONFIRMATION' && newStatus !== 'ON_HOLD' && (
                  <div>
                    <label className="label">Note (optional)</label>
                    <textarea className="textarea" rows={2} placeholder="Additional note..." value={note} onChange={e => setNote(e.target.value)} />
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={!newStatus || actionLoading === 'status'}>
                  {actionLoading === 'status' ? <span className="spinner" /> : <CheckCircle size={16} />}
                  Update Status
                </button>
              </form>
            </div>
          )}

          {/* Reassign */}
          {isMyTicket && deptStaff.length > 1 && (
            <div className="glass-card">
              <button className="font-semibold text-slate-200 flex items-center gap-2 w-full" onClick={() => setShowReassign(!showReassign)}>
                <User size={16} /> Reassign to Colleague
              </button>
              {showReassign && (
                <div className="mt-3 space-y-3">
                  <select className="select" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                    <option value="">Select staff member...</option>
                    {deptStaff.filter(s => s.id !== currentAssignment?.assignee?.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.onLeave ? '(on leave)' : ''}</option>
                    ))}
                  </select>
                  <button className="btn-secondary btn-sm" onClick={handleReassign} disabled={actionLoading === 'reassign'}>
                    {actionLoading === 'reassign' ? <span className="spinner" /> : null} Reassign
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Transfer */}
          {isMyTicket && (
            <div className="glass-card">
              <button className="font-semibold text-slate-200 flex items-center gap-2 w-full" onClick={() => setShowTransfer(!showTransfer)}>
                <ArrowRight size={16} /> Transfer to Another Department
              </button>
              {showTransfer && (
                <div className="mt-3 space-y-3">
                  <select className="select" value={transferToDept} onChange={e => setTransferToDept(e.target.value)}>
                    <option value="">Select department...</option>
                    {allDepts.filter(d => d.id !== incident.departmentId && d.isActive).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <textarea className="textarea" rows={2} placeholder="Reason for transfer (required)..." value={transferReason} onChange={e => setTransferReason(e.target.value)} />
                  <button className="btn-warning btn-sm" onClick={handleTransfer} disabled={actionLoading === 'transfer'}>
                    {actionLoading === 'transfer' ? <span className="spinner" /> : null} Transfer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="glass-card h-fit">
          <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><Clock size={16} /> Timeline</h2>
          <div className="space-y-3">
            {incident.issueUpdates?.map((update, idx) => (
              <div key={update.id} className="timeline-item">
                <div className={`timeline-dot border-slate-600 ${idx === incident.issueUpdates.length - 1 ? 'bg-indigo-500/20 border-indigo-500/40' : 'bg-slate-800'}`}>
                  <span className="text-xs">📋</span>
                </div>
                <div className="flex-1 pb-3">
                  {update.oldStatus && update.newStatus && (
                    <p className="text-xs font-medium text-slate-300">{update.oldStatus} → {update.newStatus}</p>
                  )}
                  {update.note && <p className="text-xs text-slate-400 mt-0.5 line-clamp-3">{update.note}</p>}
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
