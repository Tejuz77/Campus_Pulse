import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { incidents, users, departments } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { LoadingState, EmptyState } from '../../components/UI';
import { timeAgo, extractError } from '../../lib/utils';
import { LayoutDashboard, Clock, AlertTriangle, PauseCircle, User, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [myIncidents, setMyIncidents] = useState([]);
  const [onHold, setOnHold] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnLeave, setIsOnLeave] = useState(user?.onLeave || false);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [activeRes, holdRes, overdueRes, wlRes] = await Promise.all([
        incidents.list({ pageSize: 10, status: 'ASSIGNED' }),
        incidents.list({ pageSize: 10, status: 'ON_HOLD' }),
        incidents.list({ pageSize: 10, overdue: 'true' }),
        departments.workload(user.departmentId),
      ]);
      setMyIncidents(activeRes.data.incidents || []);
      setOnHold(holdRes.data.incidents || []);
      setOverdue(overdueRes.data.incidents || []);
      setWorkload(wlRes.data.workload || []);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggleLeave() {
    setToggleLoading(true);
    try {
      const res = await users.setLeave(!isOnLeave);
      setIsOnLeave(res.data.user.onLeave);
      toast.success(res.data.user.onLeave ? 'On-leave mode activated. Your tickets will be reassigned.' : 'Welcome back! On-leave mode deactivated.');
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setToggleLoading(false);
    }
  }

  const stats = [
    { label: 'Active Tickets', value: myIncidents.length, icon: Clock, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'On Hold', value: onHold.length, icon: PauseCircle, color: 'text-orange-400 bg-orange-500/10' },
    { label: 'Overdue', value: overdue.length, icon: AlertTriangle, color: 'text-red-400 bg-red-500/10' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Staff Dashboard</h1>
          <p className="page-subtitle">{user?.department?.name} Department</p>
        </div>
        <button
          onClick={toggleLeave}
          disabled={toggleLoading}
          className={`btn flex items-center gap-2 ${isOnLeave ? 'btn-success' : 'btn-secondary'}`}
        >
          {toggleLoading ? <span className="spinner" /> : (isOnLeave ? <Wifi size={16} /> : <WifiOff size={16} />)}
          {isOnLeave ? 'Return from Leave' : 'Go On Leave'}
        </button>
      </div>

      {isOnLeave && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm mb-6 flex items-center gap-2">
          <WifiOff size={16} /> You are on leave. New tickets are being assigned to your colleague.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className="glass-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dept workload */}
      {workload.length > 0 && (
        <div className="glass-card mb-6">
          <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2"><User size={16} /> Department Workload</h2>
          <div className="grid grid-cols-2 gap-3">
            {workload.map(w => (
              <div key={w.id} className={`p-3 rounded-xl ${w.id === user.id ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-slate-800/40'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{w.name} {w.id === user.id ? '(You)' : ''}</p>
                    {w.onLeave && <p className="text-xs text-yellow-400">On leave</p>}
                  </div>
                  <span className="text-2xl font-bold text-slate-100">{w.openTickets}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">open tickets</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active tickets */}
      {loading ? <LoadingState /> : (
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Active Queue</h2>
            <Link to="/staff/tickets" className="text-sm text-indigo-400 hover:text-indigo-300">View all →</Link>
          </div>
          {myIncidents.length === 0 ? (
            <EmptyState icon={LayoutDashboard} title="Queue is empty" subtitle="No active tickets assigned to you." />
          ) : (
            <div className="space-y-2">
              {myIncidents.map(inc => (
                <Link key={inc.id} to={`/staff/tickets/${inc.id}`} className="ticket-card block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-xs text-indigo-400">{inc.reports?.[0]?.ticketNumber}</span>
                        <StatusBadge status={inc.status} />
                        <PriorityBadge priority={inc.priority} />
                        {inc.escalated && <EscalatedBadge />}
                      </div>
                      <p className="text-sm text-slate-200 truncate">{inc.summary}</p>
                      <p className="text-xs text-slate-500 mt-1">📍 {inc.location?.name} · {timeAgo(inc.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
