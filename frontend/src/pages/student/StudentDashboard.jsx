import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { reports, notifications } from '../../lib/api';
import { StatusBadge, PriorityBadge } from '../../components/Badges';
import { LoadingState, EmptyState } from '../../components/UI';
import { formatDate, timeAgo, extractError } from '../../lib/utils';
import { FileText, Plus, Bell, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [myReports, setMyReports] = useState([]);
  const [awaitingReports, setAwaitingReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, awaiting: 0 });

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const [allRes, awaitRes] = await Promise.all([
        reports.list({ pageSize: 5, page: 1 }),
        reports.list({ pageSize: 10, page: 1, status: 'AWAITING_CONFIRMATION' }),
      ]);
      const all = allRes.data.reports || [];
      setMyReports(all);
      setAwaitingReports(awaitRes.data.reports || []);
      setStats({
        total: allRes.data.total || 0,
        open: all.filter(r => !['RESOLVED', 'REJECTED'].includes(r.incident?.status)).length,
        resolved: all.filter(r => r.incident?.status === 'RESOLVED').length,
        awaiting: awaitRes.data.total || 0,
      });
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Reports', value: stats.total, icon: FileText, color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20', iconColor: 'text-indigo-400' },
    { label: 'Open Tickets', value: stats.open, icon: Clock, color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20', iconColor: 'text-yellow-400' },
    { label: 'Awaiting Your Confirmation', value: stats.awaiting, icon: AlertTriangle, color: 'from-purple-500/20 to-purple-600/10 border-purple-500/20', iconColor: 'text-purple-400' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20', iconColor: 'text-emerald-400' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">
            Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="page-subtitle">Roll No: {user?.rollNo} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
        </div>
        <Link to="/student/report" className="btn-primary btn-lg">
          <Plus size={18} />
          Report Issue
        </Link>
      </div>

      {/* Safety banner */}
      <div className="safety-banner mb-4">
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
        <p className="text-xs">
          <strong>CampusPulse is NOT an emergency service.</strong> For immediate danger, contact college security or emergency personnel immediately.
        </p>
      </div>

      {/* ── ACTION REQUIRED BANNER ── shown when tickets await confirmation */}
      {awaitingReports.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(126,34,206,0.25) 0%, rgba(109,40,217,0.15) 100%)',
          border: '1px solid rgba(168,85,247,0.5)',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          animation: 'fade-in 0.4s ease-out'
        }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{
              width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
              background: 'rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'pulse 2s infinite'
            }}>
              <CheckCircle size={20} style={{ color: '#c084fc' }} />
            </div>
            <div>
              <h2 style={{ color: '#e9d5ff', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                ⚡ Action Required — {awaitingReports.length} ticket{awaitingReports.length > 1 ? 's' : ''} need{awaitingReports.length === 1 ? 's' : ''} your confirmation!
              </h2>
              <p style={{ color: '#a78bfa', fontSize: '0.8rem', margin: '0.2rem 0 0' }}>
                Staff has resolved {awaitingReports.length === 1 ? 'an issue' : 'issues'}. Please confirm or dispute within 72 hours — otherwise it auto-resolves.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {awaitingReports.map(r => (
              <Link
                key={r.id}
                to={`/student/tickets/${r.ticketNumber}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: '0.75rem', padding: '0.75rem 1rem', textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
              >
                <div>
                  <span style={{ fontFamily: 'monospace', color: '#c084fc', fontSize: '0.8rem', fontWeight: 600 }}>{r.ticketNumber}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{r.description?.slice(0, 60)}{r.description?.length > 60 ? '...' : ''}</span>
                </div>
                <span style={{
                  background: '#7c3aed', color: 'white', borderRadius: '0.5rem',
                  padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
                  flexShrink: 0, marginLeft: '1rem'
                }}>
                  Confirm / Dispute →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className={`glass rounded-2xl p-4 bg-gradient-to-br ${card.color} border transition-all duration-300 hover:-translate-y-1`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${card.iconColor}`}>
                <card.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{card.value}</p>
                <p className="text-xs text-slate-400">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent tickets */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Recent Tickets</h2>
          <Link to="/student/tickets" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            View all <TrendingUp size={14} />
          </Link>
        </div>

        {loading ? (
          <LoadingState />
        ) : myReports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No tickets yet"
            subtitle="Report your first campus issue and track it here."
            action={<Link to="/student/report" className="btn-primary">Report an Issue</Link>}
          />
        ) : (
          <div className="space-y-3">
            {myReports.map((report) => (
              <Link key={report.id} to={`/student/tickets/${report.ticketNumber}`} className="ticket-card block">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-indigo-400">{report.ticketNumber}</span>
                      <StatusBadge status={report.incident?.status} />
                      <PriorityBadge priority={report.priority} />
                    </div>
                    <p className="text-sm text-slate-200 font-medium truncate">{report.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{report.category?.name}</span>
                      <span>·</span>
                      <span>{report.location?.name}</span>
                      <span>·</span>
                      <span>{timeAgo(report.createdAt)}</span>
                    </div>
                  </div>
                  {report.incident?.status === 'AWAITING_CONFIRMATION' && (
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0">
                      Action needed
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
