import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { incidents, departments } from '../../lib/api';
import { PriorityBadge } from '../../components/Badges';
import { LoadingState, EmptyState } from '../../components/UI';
import { timeAgo, extractError } from '../../lib/utils';
import { Users, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminUnassigned() {
  const [unassigned, setUnassigned] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignDept, setAssignDept] = useState({});
  const [assigning, setAssigning] = useState('');

  useEffect(() => {
    Promise.all([incidents.unassigned(), departments.list()])
      .then(([incRes, deptRes]) => {
        setUnassigned(incRes.data.incidents || []);
        setDepts(deptRes.data.departments || []);
      })
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleAssign(incId) {
    const deptId = assignDept[incId];
    if (!deptId) { toast.error('Select a department'); return; }
    setAssigning(incId);
    try {
      await incidents.transfer(incId, { toDepartmentId: deptId, reason: 'Admin manual assignment from unassigned queue' });
      toast.success('Ticket assigned to department');
      setUnassigned(u => u.filter(i => i.id !== incId));
    } catch (err) { toast.error(extractError(err)); }
    finally { setAssigning(''); }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Users size={22} className="text-orange-400" /> Unassigned Queue</h1>
        <p className="page-subtitle">{unassigned.length} tickets awaiting department assignment</p>
      </div>

      {unassigned.length === 0 ? (
        <EmptyState icon={Users} title="No unassigned tickets" subtitle="All tickets are assigned. ✅" />
      ) : (
        <div className="space-y-3">
          {unassigned.map(inc => (
            <div key={inc.id} className="glass-card border-l-4 border-orange-500/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-indigo-400">{inc.reports?.[0]?.ticketNumber}</span>
                    <PriorityBadge priority={inc.priority} />
                  </div>
                  <p className="text-sm text-slate-200 truncate">{inc.summary}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    <span>📂 {inc.category?.name}</span>
                    <span>·</span>
                    <span>📍 {inc.location?.name}</span>
                    <span>·</span>
                    <span>🕐 {timeAgo(inc.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select className="select text-xs" value={assignDept[inc.id] || ''} onChange={e => setAssignDept(d => ({ ...d, [inc.id]: e.target.value }))}>
                    <option value="">Select dept...</option>
                    {depts.filter(d => d.isActive).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button className="btn-primary btn-sm" onClick={() => handleAssign(inc.id)} disabled={assigning === inc.id}>
                    {assigning === inc.id ? <span className="spinner" /> : <ArrowRight size={14} />}
                  </button>
                  <Link to={`/admin/tickets/${inc.id}`} className="btn-secondary btn-sm">View</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
