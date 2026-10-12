import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { StatusBadge, PriorityBadge, EscalatedBadge } from '../../components/Badges';
import { LoadingState, EmptyState } from '../../components/UI';
import { timeAgo } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

export default function AdminEscalated() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.escalated()
      .then(r => setIncidents(r.data.incidents || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><AlertTriangle size={22} className="text-red-400" /> Escalated Tickets</h1>
        <p className="page-subtitle">{incidents.length} tickets requiring immediate attention</p>
      </div>

      {incidents.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No escalated tickets" subtitle="All tickets are within response thresholds. 🎉" />
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => (
            <Link key={inc.id} to={`/admin/tickets/${inc.id}`} className="ticket-card block border-l-4 border-red-500/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-indigo-400">{inc.reports?.[0]?.ticketNumber}</span>
                    <StatusBadge status={inc.status} />
                    <PriorityBadge priority={inc.priority} />
                    <EscalatedBadge />
                  </div>
                  <p className="text-sm text-slate-200 truncate">{inc.summary}</p>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    <span>📂 {inc.category?.name}</span>
                    <span>·</span>
                    <span>📍 {inc.location?.name}</span>
                    <span>·</span>
                    <span>🏢 {inc.department?.name || 'Unassigned'}</span>
                    <span>·</span>
                    <span>🕐 {timeAgo(inc.createdAt)}</span>
                  </div>
                </div>
                {inc.assignments?.[0] && (
                  <span className="text-xs text-slate-500">→ {inc.assignments[0].assignee?.name}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
