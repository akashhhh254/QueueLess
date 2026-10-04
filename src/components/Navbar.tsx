import React, { useState, useEffect, useRef } from 'react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Bell, CheckCircle2, ChevronDown, LogOut, Shield, User, Radio, RefreshCw, X } from 'lucide-react';
import { NotificationItem } from '../types';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();
  const { status, statusMessage } = useWebSocket();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 12000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  };

  const markSingleAsRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single element brand wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 text-left focus:outline-none group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-teal-400 flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-slate-800 transition-colors">
              Q
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              QueueLess
            </span>
          </button>

          {/* Connection status indicator */}
          <div
            title={statusMessage}
            className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono text-slate-500 bg-slate-100"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-teal-500 animate-pulse'
                  : status === 'reconnecting'
                  ? 'bg-amber-500 animate-bounce'
                  : 'bg-red-400'
              }`}
            />
            <span className="capitalize">{status === 'connected' ? 'Live' : status}</span>
          </div>
        </div>

        {/* Zone 2: 4-6 text links, single-line */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onNavigate('/')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
              currentPath === '/' ? 'text-teal-600 font-semibold' : ''
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onNavigate(user ? '/dashboard' : '/login')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
              currentPath === '/dashboard' ? 'text-teal-600 font-semibold' : ''
            }`}
          >
            My Queue
          </button>
          <button
            onClick={() => onNavigate(user ? '/join' : '/login')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
              currentPath === '/join' ? 'text-teal-600 font-semibold' : ''
            }`}
          >
            Find & Join
          </button>

          {(user?.role === 'PROVIDER' || user?.role === 'ADMIN') && (
            <button
              onClick={() => onNavigate('/provider')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
                currentPath.startsWith('/provider') ? 'text-teal-600 font-semibold' : ''
              }`}
            >
              Provider Station
            </button>
          )}

          {user?.role === 'ADMIN' && (
            <button
              onClick={() => onNavigate('/admin')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap ${
                currentPath.startsWith('/admin') ? 'text-teal-600 font-semibold' : ''
              }`}
            >
              Admin & Analytics
            </button>
          )}
        </nav>

        {/* Zone 3: 1-2 primary actions / User profile / Notifications */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Notification Popover */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">
                          No notifications yet. You'll receive real-time queue updates here.
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markSingleAsRead(n.id)}
                            className={`p-3 text-left hover:bg-slate-50 transition-colors cursor-pointer ${
                              n.is_read ? 'opacity-70' : 'bg-teal-50/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {n.title}
                              </span>
                              <span className="text-[10px] text-slate-400 tabular-nums">
                                {new Date(n.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 py-2 border-t border-slate-100 text-center">
                      <button
                        onClick={() => {
                          setShowNotifDropdown(false);
                          onNavigate('/notifications');
                        }}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors focus:outline-none"
                >
                  {user.profile_image ? (
                    <img
                      src={user.profile_image}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-800 max-w-[120px] truncate hidden sm:inline">
                    {user.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-400">Signed in as</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          ROLE: {user.role}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        onNavigate('/dashboard');
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      My Active Queue
                    </button>

                    {(user.role === 'PROVIDER' || user.role === 'ADMIN') && (
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          onNavigate('/provider');
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Radio className="w-3.5 h-3.5 text-slate-400" />
                        Provider Calling Desk
                      </button>
                    )}

                    {user.role === 'ADMIN' && (
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          onNavigate('/admin');
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                        Administrator Console
                      </button>
                    )}

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        logout();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('/login')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap"
              >
                Sign In
              </button>
              <button
                onClick={() => onNavigate('/register')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
