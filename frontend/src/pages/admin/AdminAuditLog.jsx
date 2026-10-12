import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/api';
import { LoadingState, ErrorState } from '../../components/UI';
import { timeAgo, extractError } from '../../lib/utils';
import { FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminAuditLog() {
  const [data, setData] = useState({ logs: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetch(); }, [page]);

  async function fetch() {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.auditLog({ page, pageSize: 30 });
      setData(res.data);
    } catch (err) { setError(extractError(err)); }
    finally { setLoading(false); }
  }

  const ACTION_COLORS = {
    CREATE: 'text-emerald-400',
    UPDATE: 'text-blue-400',
    DELETE: 'text-red-400',
    TRANSFER: 'text-yellow-400',
    STATUS_TRANSITION: 'text-purple-400',
    APPROVE: 'text-emerald-400',
    REJECT: 'text-red-400',
    REASSIGN: 'text-orange-400',
  };

  const getColor = (action) => {
    const key = Object.keys(ACTION_COLORS).find(k => action.startsWith(k));
    return ACTION_COLORS[key] || 'text-slate-400';
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetch} />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-subtitle">{data.total} total audit entries</p>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          </thead>
          <tbody>
            {data.logs.map(log => (
              <tr key={log.id}>
                <td className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(log.createdAt)}</td>
                <td>
                  <p className="text-sm text-slate-200">{log.actor?.name}</p>
                  <p className="text-xs text-slate-500">{log.actor?.role}</p>
                </td>
                <td>
                  <span className={`text-xs font-mono font-medium ${getColor(log.action)}`}>{log.action}</span>
                </td>
                <td>
                  <p className="text-xs text-slate-400">{log.entity}</p>
                  <p className="text-xs text-slate-600 font-mono">{log.entityId.slice(0, 8)}...</p>
                </td>
                <td>
                  <pre className="text-xs text-slate-500 max-w-xs truncate">{log.metadata}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span className="text-xs text-slate-500">Page {page}</span>
        <button className="btn-secondary btn-sm" disabled={data.logs.length < 30} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
