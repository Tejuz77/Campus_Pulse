import { useState, useEffect } from 'react';
import { notifications } from '../../lib/api';
import { LoadingState, EmptyState } from '../../components/UI';
import { timeAgo } from '../../lib/utils';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function NotificationsPage() {
  const { refreshUnread } = useAuth();
  const [data, setData] = useState({ notifications: [], total: 0, unreadCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    setLoading(true);
    try {
      const res = await notifications.list({ page: 1 });
      setData(res.data);
    } catch {} finally { setLoading(false); }
  }

  async function markAllRead() {
    await notifications.markAllRead();
    refreshUnread();
    fetch();
    toast.success('All marked as read');
  }

  async function markOne(id) {
    await notifications.markRead(id);
    refreshUnread();
    setData(d => ({
      ...d,
      notifications: d.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
      unreadCount: Math.max(0, d.unreadCount - 1),
    }));
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{data.unreadCount} unread</p>
        </div>
        {data.unreadCount > 0 && (
          <button className="btn-secondary btn-sm" onClick={markAllRead}>
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {loading ? <LoadingState /> : data.notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" subtitle="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {data.notifications.map(n => (
            <div key={n.id} className={`glass rounded-xl p-4 cursor-pointer transition-all hover:bg-white/6 ${!n.isRead ? 'border-l-2 border-indigo-500' : ''}`} onClick={() => !n.isRead && markOne(n.id)}>
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.isRead ? 'bg-slate-600' : 'bg-indigo-400'}`} />
                <div className="flex-1">
                  <p className={`text-sm ${n.isRead ? 'text-slate-400' : 'text-slate-200'}`}>{n.message}</p>
                  <p className="text-xs text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {n.link && <Link to={n.link} className="text-xs text-indigo-400 hover:text-indigo-300 flex-shrink-0">View →</Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
