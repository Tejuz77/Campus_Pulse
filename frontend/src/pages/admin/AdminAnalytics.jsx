import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/api';
import { LoadingState } from '../../components/UI';
import { extractError } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { toast } from 'react-hot-toast';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.analytics()
      .then(r => setData(r.data))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const statusData = Object.entries(data.statusBreakdown || {}).map(([status, count]) => ({ status: status.replace('_', ' '), count }));
  const priorityData = Object.entries(data.priorityBreakdown || {}).map(([priority, count]) => ({ priority, count }));

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Real-time computed statistics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Resolution Rate" value={`${data.resolutionRate}%`} color="text-emerald-400" />
        <KpiCard label="Avg Resolution" value={`${data.avgResolutionHours}h`} color="text-blue-400" />
        <KpiCard label="Avg Satisfaction" value={data.avgSatisfaction ? `${Number(data.avgSatisfaction).toFixed(1)} ⭐` : 'N/A'} color="text-yellow-400" />
        <KpiCard label="Total Feedback" value={data.totalFeedbackCount || 0} color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status breakdown */}
        <div className="glass-card">
          <h3 className="font-semibold text-slate-200 mb-4">Tickets by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="status" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority breakdown */}
        <div className="glass-card">
          <h3 className="font-semibold text-slate-200 mb-4">Tickets by Priority</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={priorityData} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={90} label={({ priority, percent }) => `${priority} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#475569' }}>
                {priorityData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top recurring locations */}
      {data.topRecurringLocations?.length > 0 && (
        <div className="glass-card">
          <h3 className="font-semibold text-slate-200 mb-4">Top Recurring Locations</h3>
          <div className="space-y-2">
            {data.topRecurringLocations.map((loc, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-slate-200">{loc.name} {loc.block && <span className="text-slate-500">(Block {loc.block})</span>}</p>
                    <span className="text-sm font-bold text-slate-300">{loc.count} tickets</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-700/50">
                    <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${(loc.count / data.topRecurringLocations[0].count) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className="glass-card text-center">
      <p className={`text-3xl font-bold ${color} mb-1`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
