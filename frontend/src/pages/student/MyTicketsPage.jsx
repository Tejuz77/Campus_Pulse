import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reports } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { Pagination, LoadingState, EmptyState, ErrorState } from '../../components/UI';
import { formatDate, timeAgo, extractError } from '../../lib/utils';
import { FileText, Search, Filter, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const STATUSES = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'RESOLVED', 'ON_HOLD', 'REJECTED', 'REOPENED'];

export default function MyTicketsPage() {
  const [data, setData] = useState({ reports: [], total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { fetchReports(); }, [page, filters]);

  async function fetchReports() {
    setLoading(true);
    setError('');
    try {
      const params = { page, pageSize: 20, ...filters };
      const res = await reports.list(params);
      setData(res.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setFilters({ status: '', search: '' });
    setPage(1);
  }

  const hasFilters = filters.status || filters.search;

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">{data.total} total reports submitted</p>
        </div>
        <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} />
          Filters
          {hasFilters && <span className="w-2 h-2 bg-indigo-400 rounded-full" />}
        </button>
      </div>

      {showFilters && (
        <div className="glass-card mb-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Ticket number or description..."
                  value={filters.search}
                  onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
                />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
                <option value="">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          {hasFilters && (
            <button className="btn-sm btn-secondary mt-3" onClick={clearFilters}>
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReports} />
      ) : data.reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No tickets found"
          subtitle={hasFilters ? 'Try clearing your filters.' : 'Submit your first report!'}
          action={!hasFilters && <Link to="/student/report" className="btn-primary">Report an Issue</Link>}
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.reports.map(report => (
              <Link
                key={report.id}
                to={`/student/tickets/${report.ticketNumber}`}
                className="ticket-card block animate-fade-in"
                style={report.incident?.status === 'AWAITING_CONFIRMATION' ? {
                  border: '1.5px solid rgba(168,85,247,0.6)',
                  background: 'rgba(109,40,217,0.15)',
                  boxShadow: '0 0 20px rgba(139,92,246,0.2)'
                } : {}}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-indigo-400 font-medium">{report.ticketNumber}</span>
                      <StatusBadge status={report.incident?.status} />
                      <PriorityBadge priority={report.priority} />
                      {report.incident?.escalated && <EscalatedBadge />}
                    </div>
                    <p className="text-sm text-slate-200 font-medium line-clamp-1">{report.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">📂 {report.category?.name}</span>
                      <span>·</span>
                      <span>📍 {report.location?.name}{report.location?.block ? ` (Block ${report.location.block})` : ''}</span>
                      <span>·</span>
                      <span>🕐 {timeAgo(report.createdAt)}</span>
                    </div>
                    {report.incident?.department && (
                      <p className="text-xs text-slate-600 mt-1">Handled by: {report.incident.department.name}</p>
                    )}
                  </div>
                  {report.incident?.status === 'AWAITING_CONFIRMATION' && (
                    <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0 animate-pulse">
                      Action needed!
                    </span>
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
