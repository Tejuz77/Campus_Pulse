import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { incidents, departments, categories } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { Pagination, LoadingState, EmptyState, ErrorState } from '../../components/UI';
import { timeAgo, extractError } from '../../lib/utils';
import { FileText, Filter, X, Search } from 'lucide-react';

const STATUSES = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'RESOLVED', 'ON_HOLD', 'REJECTED', 'REOPENED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function AdminTickets() {
  const [data, setData] = useState({ incidents: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depts, setDepts] = useState([]);
  const [cats, setCats] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '', departmentId: '', categoryId: '', priority: '',
    escalated: '', overdue: '', search: '', dateFrom: '', dateTo: '', block: '',
  });

  useEffect(() => {
    departments.list().then(r => setDepts(r.data.departments || []));
    categories.list().then(r => setCats(r.data.categories || []));
  }, []);

  useEffect(() => { fetch(); }, [page, filters]);

  async function fetch() {
    setLoading(true);
    setError('');
    try {
      const params = { page, pageSize: 20, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const res = await incidents.list(params);
      setData(res.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function setFilter(key, val) { setFilters(f => ({ ...f, [key]: val })); setPage(1); }
  function clearFilters() { setFilters({ status: '', departmentId: '', categoryId: '', priority: '', escalated: '', overdue: '', search: '', dateFrom: '', dateTo: '', block: '' }); setPage(1); }
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">All Tickets</h1>
          <p className="page-subtitle">{data.total} total incidents</p>
        </div>
        <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters {hasFilters && <span className="w-2 h-2 bg-indigo-400 rounded-full" />}
        </button>
      </div>

      {showFilters && (
        <div className="glass-card mb-4 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="label">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-8" placeholder="Ticket # or keyword..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
              </div>
            </div>
            <div><label className="label">Status</label>
              <select className="select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                <option value="">All</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select></div>
            <div><label className="label">Department</label>
              <select className="select" value={filters.departmentId} onChange={e => setFilter('departmentId', e.target.value)}>
                <option value="">All</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className="label">Category</label>
              <select className="select" value={filters.categoryId} onChange={e => setFilter('categoryId', e.target.value)}>
                <option value="">All</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="label">Priority</label>
              <select className="select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
                <option value="">All</option>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label className="label">Block</label>
              <input className="input" placeholder="A, B, C, D..." value={filters.block} onChange={e => setFilter('block', e.target.value)} /></div>
            <div><label className="label">Escalated</label>
              <select className="select" value={filters.escalated} onChange={e => setFilter('escalated', e.target.value)}>
                <option value="">All</option><option value="true">Escalated only</option>
              </select></div>
            <div><label className="label">Overdue</label>
              <select className="select" value={filters.overdue} onChange={e => setFilter('overdue', e.target.value)}>
                <option value="">All</option><option value="true">Overdue only</option>
              </select></div>
            <div><label className="label">From date</label><input type="date" className="input" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} /></div>
            <div><label className="label">To date</label><input type="date" className="input" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} /></div>
          </div>
          {hasFilters && <button className="btn-sm btn-secondary mt-3" onClick={clearFilters}><X size={14} /> Clear</button>}
        </div>
      )}

      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={fetch} /> : data.incidents.length === 0 ? (
        <EmptyState icon={FileText} title="No tickets found" subtitle="Try adjusting filters." />
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th><th>Summary</th><th>Category</th><th>Location</th><th>Dept</th><th>Status</th><th>Priority</th><th>Age</th>
                </tr>
              </thead>
              <tbody>
                {data.incidents.map(inc => (
                  <tr key={inc.id} className="cursor-pointer" onClick={() => window.location.href = `/admin/tickets/${inc.id}`}>
                    <td className="font-mono text-xs text-indigo-400">{inc.reports?.[0]?.ticketNumber || '—'}</td>
                    <td className="max-w-xs">
                      <p className="truncate text-slate-200">{inc.summary}</p>
                      {inc.escalated && <EscalatedBadge />}
                    </td>
                    <td className="text-xs">{inc.category?.name}</td>
                    <td className="text-xs">{inc.location?.name}</td>
                    <td className="text-xs">{inc.department?.name || <span className="text-orange-400">Unassigned</span>}</td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td><PriorityBadge priority={inc.priority} /></td>
                    <td className="text-xs text-slate-500">{timeAgo(inc.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={data.total} page={page} pageSize={20} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
