import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NotificationItem } from '../types';
import { Bell, Check, Trash2, CheckCircle2 } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  };

  const markOne = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
            Notification Center
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Queue Alerts & Updates
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time messages sent as your token advances in the queue.
          </p>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={markAllRead}
            className="px-3.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Check className="w-3.5 h-3.5" />
            Mark All as Read
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
          <Bell className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No alerts yet</h3>
          <p className="text-xs text-slate-500">
            When you join queues or your turn approaches, live alerts will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markOne(n.id)}
              className={`p-4 transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                n.is_read ? 'bg-white opacity-80' : 'bg-teal-50/20 font-medium'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${n.is_read ? 'bg-slate-300' : 'bg-teal-500'}`} />
                  <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-4">{n.message}</p>
              </div>

              <span className="text-[11px] text-slate-400 font-mono tabular-nums whitespace-nowrap">
                {new Date(n.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
