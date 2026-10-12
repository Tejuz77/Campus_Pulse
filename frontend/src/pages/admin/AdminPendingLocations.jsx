import { useState, useEffect } from 'react';
import { adminApi, locations, departments } from '../../lib/api';
import { LoadingState } from '../../components/UI';
import { formatDate, extractError } from '../../lib/utils';
import { CheckCircle, XCircle, Merge } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminPendingLocations() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [depts, setDepts] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const [selectedDept, setSelectedDept] = useState({});
  const [rejectReasons, setRejectReasons] = useState({});

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [pendRes, deptRes] = await Promise.all([
        adminApi.pendingLocations(),
        departments.list(),
      ]);
      setPending(pendRes.data.locations || []);
      setDepts(deptRes.data.departments || []);
    } catch (err) { toast.error(extractError(err)); }
    finally { setLoading(false); }
  }

  async function handleAction(locId, action) {
    setActionLoading(locId + action);
    try {
      await locations.approve(locId, {
        action,
        ownerDepartmentId: selectedDept[locId] || undefined,
        reason: rejectReasons[locId] || 'Rejected by admin',
      });
      toast.success(`Location ${action}d`);
      fetchAll();
    } catch (err) { toast.error(extractError(err)); }
    finally { setActionLoading(''); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Pending Location Proposals</h1>
        <p className="page-subtitle">{pending.length} locations awaiting review</p>
      </div>

      {pending.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="text-slate-400">No pending location proposals. ✅</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(loc => (
            <div key={loc.id} className="glass-card border-l-4 border-yellow-500/50">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-200">{loc.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {loc.block && <span>Block {loc.block}</span>}
                    {loc.floor && <><span>·</span><span>Floor {loc.floor}</span></>}
                    <span>·</span><span>{loc.type}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Proposed by: <strong className="text-slate-300">{loc.proposedBy?.name}</strong> ({loc.proposedBy?.rollNo})</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Approve */}
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs font-semibold text-emerald-300 mb-2">✓ Approve</p>
                  <select className="select mb-2" value={selectedDept[loc.id] || ''} onChange={e => setSelectedDept(d => ({ ...d, [loc.id]: e.target.value }))}>
                    <option value="">Owner dept (optional)</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button className="btn-success btn-sm w-full justify-center" onClick={() => handleAction(loc.id, 'approve')} disabled={actionLoading === loc.id + 'approve'}>
                    {actionLoading === loc.id + 'approve' ? <span className="spinner" /> : <CheckCircle size={14} />} Approve
                  </button>
                </div>

                {/* Reject */}
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                  <p className="text-xs font-semibold text-red-300 mb-2">✗ Reject</p>
                  <input className="input mb-2" placeholder="Reason..." value={rejectReasons[loc.id] || ''} onChange={e => setRejectReasons(r => ({ ...r, [loc.id]: e.target.value }))} />
                  <button className="btn-danger btn-sm w-full justify-center" onClick={() => handleAction(loc.id, 'reject')} disabled={actionLoading === loc.id + 'reject'}>
                    {actionLoading === loc.id + 'reject' ? <span className="spinner" /> : <XCircle size={14} />} Reject
                  </button>
                </div>

                {/* Info */}
                <div className="p-3 rounded-xl bg-slate-800/30">
                  <p className="text-xs text-slate-500">Reports linked to this pending location will be:</p>
                  <ul className="mt-2 text-xs text-slate-400 space-y-1">
                    <li>• On approve → routed & assigned</li>
                    <li>• On reject → student notified</li>
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
