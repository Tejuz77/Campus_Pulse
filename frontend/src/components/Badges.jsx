import { getStatusBadgeClass, getPriorityBadgeClass, getStatusLabel } from '../lib/utils';
import { AlertTriangle } from 'lucide-react';

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={getStatusBadgeClass(status)}>{getStatusLabel(status)}</span>;
}

export function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={getPriorityBadgeClass(priority)}>
      {priority === 'CRITICAL' && <AlertTriangle size={10} />}
      {priority}
    </span>
  );
}

export function EscalatedBadge() {
  return (
    <span className="badge bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">
      <AlertTriangle size={10} />
      Escalated
    </span>
  );
}
