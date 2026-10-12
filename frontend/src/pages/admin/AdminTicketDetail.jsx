import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { incidents, departments, users } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { LoadingState, ErrorState } from '../../components/UI';
import { formatDate, timeAgo, extractError } from '../../lib/utils';
import { ArrowLeft, CheckCircle, User, ArrowRight, Clock, Paperclip } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ALL_TRANSITIONS = ['ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'RESOLVED', 'ON_HOLD', 'REJECTED', 'REOPENED'];

export default function AdminTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allDepts, setAllDepts] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [transferDept, setTransferDept] = useState('');
  const [transferReason, setTransferReason] = useState('');

  useEffect(() => { fetchIncident(); departments.list().then(r => setAllDepts(r.data.departments || [])); }, [id]);

  async function fetchIncident() {
    setLoading(true);
    try {
      const res = await incidents.get(id);
      setIncident(res.data.incident);
      // Get all staff for reassignment
      const usersRes = await users.list({ role: 'STAFF' });
      setAllStaff(usersRes.data.users || []);
    } catch (err) { setError(extractError(err)); }
    finally { setLoading(false); }
  }

  async function handleStatus(e) {
    e.preventDefault();
    if (!newStatus) return;
    if (!reason) { toast.error('Admin override requires a reason'); return; }
    setActionLoading('status');
    try {
      await incidents.updateStatus(id, { newStatus, note, reason, version: incident.version });
      toast.success('Status updated');
      setNewStatus(''); setNote(''); setReason('');
      fetchIncident();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function handleAssign() {
    if (!assignTo || !reason) { toast.error('Staff and reason required'); return; }
    setActionLoading('assign');
    try {
      await incidents.assign(id, { assignedTo: assignTo, reason });
      toast.success('Assigned'); setReason(''); fetchIncident();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  async function handleTransfer() {
    if (!transferDept || !transferReason) { toast.error('Department and reason required'); return; }
    setActionLoading('transfer');
    try {
      await incidents.transfer(id, { toDepartmentId: transferDept, reason: transferReason });
      toast.success('Transferred'); fetchIncident();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchIncident} />;
  if (!incident) return null;

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm p-2"><ArrowLeft size={16} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-mono text-lg font-bold text-indigo-400">{incident.reports?.[0]?.ticketNumber || incident.id}</h1>
            <StatusBadge status={incident.status} />
            <PriorityBadge priority={incident.priority} />
            {incident.escalated && <EscalatedBadge />}
            <span className="badge bg-purple-500/20 text-purple-300">Admin View</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Created {formatDate(incident.createdAt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Details */}
          <div className="glass-card">
            <h2 className="font-semibold text-slate-200 mb-4">Incident Details</h2>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><p className="text-slate-500 text-xs mb-1">Category</p><p className="text-slate-200">{incident.category?.name}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Location</p><p className="text-slate-200">{incident.location?.name}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Department</p><p className="text-slate-200">{incident.department?.name || <span className="text-orange-400">Unassigned</span>}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Assigned to</p><p className="text-slate-200">{incident.assignments?.[0]?.assignee?.name || '—'}</p></div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50">
              <p className="text-xs text-slate-500 mb-1">Summary</p>
              <p className="text-sm text-slate-300">{incident.summary}</p>
            </div>
            {incident.reports?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Reporters ({incident.reports.length})</p>
                {incident.reports.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 mb-1">
                    <span className="text-sm text-slate-300">{r.reporter?.name} <span className="text-slate-500">({r.reporter?.rollNo})</span></span>
                    {r.attachments?.length > 0 && <span className="text-xs text-indigo-400"><Paperclip size={12} /> {r.attachments.length} files</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin actions */}
          <div className="glass-card">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><CheckCircle size={16} /> Admin Override</h2>
            <form onSubmit={handleStatus} className="space-y-3">
              <div>
                <label className="label">New Status</label>
                <select className="select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="">Select status...</option>
                  {ALL_TRANSITIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Note</label>
                <textarea className="textarea" rows={2} placeholder="Optional note..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div>
                <label className="label">Override Reason * <span className="text-red-400">(required for audit)</span></label>
                <input className="input" placeholder="Reason for admin override..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" disabled={!newStatus || actionLoading === 'status'}>
                {actionLoading === 'status' ? <span className="spinner" /> : null} Update Status
              </button>
            </form>
          </div>

          {/* Reassign */}
          <div className="glass-card">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><User size={16} /> Assign to Staff</h2>
            <div className="space-y-3">
              <select className="select" value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                <option value="">Select any staff...</option>
                {allStaff.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.department?.name} {s.onLeave ? '(on leave)' : ''}</option>
                ))}
              </select>
              <input className="input" placeholder="Reason (required)..." value={reason} onChange={e => setReason(e.target.value)} />
              <button className="btn-primary btn-sm" onClick={handleAssign} disabled={actionLoading === 'assign'}>
                {actionLoading === 'assign' ? <span className="spinner" /> : null} Assign
              </button>
            </div>
          </div>

          {/* Transfer */}
          <div className="glass-card">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><ArrowRight size={16} /> Transfer Department</h2>
            <div className="space-y-3">
              <select className="select" value={transferDept} onChange={e => setTransferDept(e.target.value)}>
                <option value="">Select department...</option>
                {allDepts.filter(d => d.id !== incident.departmentId && d.isActive).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <textarea className="textarea" rows={2} placeholder="Transfer reason (required)..." value={transferReason} onChange={e => setTransferReason(e.target.value)} />
              <button className="btn-warning btn-sm" onClick={handleTransfer} disabled={actionLoading === 'transfer'}>
                {actionLoading === 'transfer' ? <span className="spinner" /> : null} Transfer
              </button>
            </div>
          </div>
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
                  {update.oldStatus && <p className="text-xs font-medium text-slate-300">{update.oldStatus} → {update.newStatus}</p>}
                  {update.note && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{update.note}</p>}
                  <p className="text-xs text-slate-600 mt-1">{timeAgo(update.createdAt)} · {update.updater?.name} <span className="text-slate-700">({update.updater?.role})</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
