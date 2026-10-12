import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { incidents } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { Pagination, LoadingState, EmptyState, ErrorState } from '../../components/UI';
import { timeAgo, extractError } from '../../lib/utils';
import { FileText, Search, Filter, X } from 'lucide-react';

const STATUSES = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'ON_HOLD', 'RESOLVED', 'REJECTED', 'REOPENED'];

export default function StaffTicketsPage() {
  const [data, setData] = useState({ incidents: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', search: '', overdue: '', escalated: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetch(); }, [page, filters]);

  async function fetch() {
    setLoading(true);
    setError('');
    try {
      const params = { page, pageSize: 20, ...filters };
      const res = await incidents.list(params);
      setData(res.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Ticket Queue</h1>
          <p className="page-subtitle">{data.total} total tickets in your department</p>
        </div>
        <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="glass-card mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <div>
            <label className="label">Search</label>
            <input className="input" placeholder="Ticket or description..." value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
              <option value="">All</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Overdue only</label>
            <select className="select" value={filters.overdue} onChange={e => { setFilters(f => ({ ...f, overdue: e.target.value })); setPage(1); }}>
              <option value="">All</option>
              <option value="true">Overdue</option>
            </select>
          </div>
          <div>
            <label className="label">Escalated</label>
            <select className="select" value={filters.escalated} onChange={e => { setFilters(f => ({ ...f, escalated: e.target.value })); setPage(1); }}>
              <option value="">All</option>
              <option value="true">Escalated</option>
            </select>
          </div>
        </div>
      )}

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={fetch} /> : data.incidents.length === 0 ? (
        <EmptyState icon={FileText} title="No tickets found" subtitle="Try adjusting your filters." />
      ) : (
        <>
          <div className="space-y-2">
            {data.incidents.map(inc => (
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
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>📂 {inc.category?.name}</span>
                      <span>·</span>
                      <span>📍 {inc.location?.name}</span>
                      <span>·</span>
                      <span>🕐 {timeAgo(inc.createdAt)}</span>
                    </div>
                  </div>
                  {inc.assignments?.[0] && (
                    <span className="text-xs text-slate-500 flex-shrink-0">→ {inc.assignments[0].assignee?.name}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <Pagination total={data.total} page={page} pageSize={20} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
