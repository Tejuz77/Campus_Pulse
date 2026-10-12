import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { LoadingState, ErrorState } from '../../components/UI';
import { extractError } from '../../lib/utils';
import { FileText, Users, AlertTriangle, MapPin, Clock, CheckCircle, Building, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.overview();
      setData(res.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    try {
      const res = await adminApi.exportCsv();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `campuspulse-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch (err) {
      toast.error(extractError(err));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetch} />;
  if (!data) return null;

  const stats = [
    { label: 'Total Tickets', value: data.totalTickets, icon: FileText, color: 'text-indigo-400 bg-indigo-500/10', to: '/admin/tickets' },
    { label: 'Open Tickets', value: data.openTickets, icon: Clock, color: 'text-yellow-400 bg-yellow-500/10', to: '/admin/tickets' },
    { label: 'Resolved', value: data.resolvedTickets, icon: CheckCircle, color: 'text-emerald-400 bg-emerald-500/10', to: '/admin/tickets?status=RESOLVED' },
    { label: 'Escalated', value: data.escalatedTickets, icon: AlertTriangle, color: 'text-red-400 bg-red-500/10', to: '/admin/escalated' },
    { label: 'Unassigned', value: data.unassignedTickets, icon: Users, color: 'text-orange-400 bg-orange-500/10', to: '/admin/unassigned' },
    { label: 'Pending Places', value: data.pendingLocations, icon: MapPin, color: 'text-purple-400 bg-purple-500/10', to: '/admin/pending-locations' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Admin Overview</h1>
          <p className="page-subtitle">CampusPulse system at a glance</p>
        </div>
        <button className="btn-secondary" onClick={exportCsv}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} to={s.to} className={`glass rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all hover:-translate-y-1 ${s.value === 0 ? 'opacity-60' : ''}`}>
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-2`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Dept workload */}
      <div className="glass-card">
        <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><Building size={16} /> Department Workload</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.departments?.map(dept => (
            <Link key={dept.id} to={`/admin/tickets?departmentId=${dept.id}`} className="p-3 rounded-xl glass border border-white/5 hover:border-indigo-500/20 transition-all group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-400 group-hover:text-slate-300 truncate">{dept.name}</p>
                <span className={`badge text-xs ${dept.type === 'academic' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{dept.type}</span>
              </div>
              <p className={`text-2xl font-bold ${dept.openTickets > 10 ? 'text-red-400' : dept.openTickets > 5 ? 'text-yellow-400' : 'text-slate-100'}`}>{dept.openTickets}</p>
              <p className="text-xs text-slate-500">open tickets</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
