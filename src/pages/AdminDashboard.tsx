import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area
} from 'recharts';
import {
  ShieldCheck, Users, Activity, Clock, Database,
  CheckCircle2, AlertCircle, RefreshCw, Search
} from 'lucide-react';
import { User, AuditLogItem, AnalyticsData } from '../types';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'audit'>('analytics');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchUser, setSearchUser] = useState('');

  const fetchAdminData = async () => {
    try {
      const [analyticsRes, usersRes, auditRes] = await Promise.all([
        fetch('/api/admin/analytics'),
        fetch('/api/admin/users'),
        fetch('/api/admin/audit-logs'),
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (usersRes.ok) setUsersList(await usersRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setRoleUpdating(targetUserId);
    try {
      const res = await fetch(`/api/admin/users/${targetUserId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update role');

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole as any } : u))
      );
      setFeedback(`Role updated to ${newRole}`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRoleUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Aggregating enterprise telemetry from relational database...</p>
      </div>
    );
  }

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
              System Administration
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-teal-400 font-bold">
              AUTHORIZED: ADMIN
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            QueueLess Governance & Analytics Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time audit trails, user role delegation, and footfall analytics.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'analytics'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Operational Analytics
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'users'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          User Roles ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'audit'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: Analytics */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">TOTAL SERVED TODAY</span>
              <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                {analytics.totalServed}
              </span>
              <span className="text-[10px] text-teal-600 font-semibold block">Completed Visits</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">CURRENTLY WAITING</span>
              <span className="text-3xl font-extrabold font-mono text-teal-600 tabular-nums">
                {analytics.totalWaiting}
              </span>
              <span className="text-[10px] text-slate-500 block">Across All Queues</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">AVG WAITING TIME</span>
              <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                ~{analytics.avgWaitMinutes}m
              </span>
              <span className="text-[10px] text-slate-500 block">Dynamic Model Estimate</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-slate-400 block">AVG SERVICE DURATION</span>
              <span className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums">
                {analytics.avgServiceMinutes}m
              </span>
              <span className="text-[10px] text-slate-500 block">Per Customer Counter Turn</span>
            </div>
          </div>

          {/* Hourly Traffic Chart with Recharts */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Today's Peak Hours & Customer Throughput</h3>
                <p className="text-xs text-slate-500">Hourly breakdown of served patrons vs incoming waiting queue</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-teal-700">
                  <span className="w-3 h-3 rounded bg-teal-600" /> Served
                </span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-3 h-3 rounded bg-slate-300" /> Waiting Load
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="served" fill="#0D9488" radius={[4, 4, 0, 0]} name="Served" />
                  <Bar dataKey="waiting" fill="#CBD5E1" radius={[4, 4, 0, 0]} name="Waiting" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Institutional Traffic Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Traffic by Public Service Location</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {analytics.locationBreakdown?.map((loc) => (
                <div key={loc.name} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-xs font-bold text-slate-900 block truncate">{loc.name}</span>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-slate-500">Total Entries:</span>
                    <span className="text-lg font-bold font-mono text-teal-700 tabular-nums">
                      {loc.total_entries}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User Roles Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">User Role Authorization</h3>
              <p className="text-xs text-slate-500">
                Grant PROVIDER or ADMIN capabilities. All updates are verified by backend database queries.
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4 text-right">Assign Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      {u.profile_image ? (
                        <img
                          src={u.profile_image}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">
                          {u.name.charAt(0)}
                        </div>
                      )}
                      <span>{u.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{u.email}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono tabular-nums">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                        u.role === 'ADMIN'
                          ? 'bg-slate-900 text-teal-400'
                          : u.role === 'PROVIDER'
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={roleUpdating === u.id}
                        className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="CUSTOMER">CUSTOMER</option>
                        <option value="PROVIDER">PROVIDER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: System Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Database Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Immutable record of user registrations, logins, token generation, calls, skips, and role adjustments.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Metadata Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors font-mono">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 truncate max-w-[140px]">
                      {log.actor_name || log.actor_user_id || 'System'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {log.entity_type}:{log.entity_id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] truncate max-w-xs font-mono">
                      {log.metadata || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
