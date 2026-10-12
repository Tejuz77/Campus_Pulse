import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Kolkata';

export function formatDate(date) {
  if (!date) return '—';
  try {
    const d = toZonedTime(new Date(date), TZ);
    return format(d, 'dd MMM yyyy, hh:mm a');
  } catch {
    return String(date);
  }
}

export function formatDateShort(date) {
  if (!date) return '—';
  try {
    const d = toZonedTime(new Date(date), TZ);
    return format(d, 'dd MMM yyyy');
  } catch {
    return String(date);
  }
}

export function timeAgo(date) {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return String(date);
  }
}

export function getStatusBadgeClass(status) {
  const map = {
    SUBMITTED: 'badge-submitted',
    ASSIGNED: 'badge-assigned',
    IN_PROGRESS: 'badge-in_progress',
    AWAITING_CONFIRMATION: 'badge-awaiting_confirmation',
    RESOLVED: 'badge-resolved',
    ON_HOLD: 'badge-on_hold',
    REJECTED: 'badge-rejected',
    REOPENED: 'badge-reopened',
  };
  return map[status] || 'badge-submitted';
}

export function getPriorityBadgeClass(priority) {
  const map = {
    LOW: 'priority-low',
    MEDIUM: 'priority-medium',
    HIGH: 'priority-high',
    CRITICAL: 'priority-critical',
  };
  return map[priority] || 'priority-medium';
}

export function getStatusLabel(status) {
  const map = {
    SUBMITTED: 'Submitted',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    AWAITING_CONFIRMATION: 'Awaiting Confirmation',
    RESOLVED: 'Resolved',
    ON_HOLD: 'On Hold',
    REJECTED: 'Rejected',
    REOPENED: 'Reopened',
  };
  return map[status] || status;
}

export function extractError(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong';
}

export function saveFormDraft(key, data) {
  try {
    localStorage.setItem(`draft_${key}`, JSON.stringify(data));
  } catch {}
}

export function loadFormDraft(key) {
  try {
    const raw = localStorage.getItem(`draft_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearFormDraft(key) {
  try {
    localStorage.removeItem(`draft_${key}`);
  } catch {}
}

export function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
