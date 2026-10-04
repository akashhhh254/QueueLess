import React, { useEffect, useState, useCallback } from 'react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import {
  Users, Clock, Play, SkipForward, RotateCcw, Pause,
  CheckCircle2, AlertTriangle, ShieldAlert, Sparkles,
  Radio, Volume2, UserCheck, PhoneCall, AlertCircle
} from 'lucide-react';
import { QueueEntry, QueueStatus } from '../types';

export const ProviderDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addListener, status: socketStatus } = useWebSocket();
  const [queues, setQueues] = useState<any[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/provider/dashboard');
      if (res.ok) {
        const data = await res.json();
        setQueues(data.queues || []);
        if (data.queues && data.queues.length > 0 && !selectedQueueId) {
          setSelectedQueueId(data.queues[0].id);
          if (data.queues[0].counters && data.queues[0].counters.length > 0) {
            setSelectedCounterId(data.queues[0].counters[0].id);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedQueueId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Listen to WebSocket events for real-time updates
  useEffect(() => {
    const unsub = addListener('QUEUE_UPDATED', () => {
      fetchDashboardData();
    });
    return () => unsub();
  }, [addListener, fetchDashboardData]);

  const currentQueue = queues.find((q) => q.id === selectedQueueId);

  // When queue changes, ensure counter is set
  const handleQueueChange = (queueId: string) => {
    setSelectedQueueId(queueId);
    const q = queues.find((item) => item.id === queueId);
    if (q && q.counters && q.counters.length > 0) {
      setSelectedCounterId(q.counters[0].id);
    }
  };

  // Actions
  const handleCallNext = async () => {
    if (!currentQueue || !selectedCounterId) {
      alert('Please select an active service counter.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/queues/${currentQueue.id}/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: selectedCounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Call next failed');
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(null), 4000);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (entryId: string) => {
    if (!currentQueue) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/queues/${currentQueue.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, counterId: selectedCounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Complete service failed');
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(null), 4000);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async (entryId: string) => {
    if (!currentQueue) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/queues/${currentQueue.id}/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Skip token failed');
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(null), 4000);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async (entryId: string) => {
    if (!currentQueue || !selectedCounterId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/queues/${currentQueue.id}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, counterId: selectedCounterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Recall token failed');
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(null), 4000);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status: QueueStatus) => {
    if (!currentQueue) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/queues/${currentQueue.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update status failed');
      setActionMessage(data.message);
      setTimeout(() => setActionMessage(null), 4000);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading provider queue control matrix...</p>
      </div>
    );
  }

  // Active serving at current selected counter
  const servingAtMyCounter = currentQueue?.currentlyServing?.find(
    (s: any) => s.counter_id === selectedCounterId
  ) || currentQueue?.currentlyServing?.[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Queue Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
              Staff Console
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-teal-400 font-bold">
              ROLE: {user?.role}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Service Provider Calling Desk
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time control over token flow, service speed, and counter assignments.
          </p>
        </div>

        {/* Queue and Counter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
              Service Queue:
            </label>
            <select
              value={selectedQueueId}
              onChange={(e) => handleQueueChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name} ({q.location_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
              Operating Counter:
            </label>
            <select
              value={selectedCounterId}
              onChange={(e) => setSelectedCounterId(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {currentQueue?.counters?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {currentQueue && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-400 block">CURRENT TOKEN</span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {servingAtMyCounter ? servingAtMyCounter.token_number : '—'}
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-400 block">WAITING NOW</span>
              <span className="text-2xl font-bold font-mono text-teal-600 tabular-nums">
                {currentQueue.waitingCount ?? 0}
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-400 block">AVG SERVICE TIME</span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {currentQueue.average_service_time}m
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-400 block">EST. QUEUE DURATION</span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                ~{Math.max(1, Math.round(((currentQueue.waitingCount || 0) * currentQueue.average_service_time) / Math.max(1, currentQueue.active_counters_count)))}m
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-400 block">ACTIVE COUNTERS</span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {currentQueue.active_counters_count}
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-[11px] text-slate-400 block">COMPLETED TODAY</span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {currentQueue.completedToday ?? 0}
              </span>
            </div>
          </div>

          {/* Currently Serving Station Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Desk Station
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {currentQueue.counters?.find((c: any) => c.id === selectedCounterId)?.name || 'Desk Counter'}
                </h3>
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium">
                {(['NORMAL', 'BUSY', 'DELAYED', 'PAUSED', 'CLOSED'] as QueueStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={actionLoading}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                      currentQueue.status === st
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Serving Details & Primary Call Next Action */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-6 space-y-2">
                {servingAtMyCounter ? (
                  <div className="p-5 rounded-xl bg-teal-50 border border-teal-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-800">NOW SERVING AT THIS COUNTER</span>
                      <span className="text-xs font-mono text-teal-700">
                        Called at: {new Date(servingAtMyCounter.called_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-4">
                      <span className="text-4xl sm:text-5xl font-extrabold font-mono text-teal-900 tracking-tight">
                        {servingAtMyCounter.token_number}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{servingAtMyCounter.customer_name}</p>
                        {servingAtMyCounter.priority_reason && (
                          <span className="text-xs text-amber-700 font-semibold block">
                            Priority: {servingAtMyCounter.priority_reason}
                          </span>
                        )}
                        {servingAtMyCounter.is_away === 1 && (
                          <span className="text-xs text-teal-700 block">
                            Marked as "Waiting Elsewhere"
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleComplete(servingAtMyCounter.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete Service
                      </button>

                      <button
                        onClick={() => handleSkip(servingAtMyCounter.id)}
                        disabled={actionLoading}
                        className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <SkipForward className="w-4 h-4" />
                        Skip (Not Present)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <p className="text-xs text-slate-500">No token currently called at this counter.</p>
                    <p className="text-xs font-bold text-slate-800">
                      {currentQueue.waitingCount} customer{currentQueue.waitingCount === 1 ? '' : 's'} waiting in line.
                    </p>
                  </div>
                )}
              </div>

              {/* Huge Call Next Button */}
              <div className="md:col-span-6 flex flex-col justify-center">
                <button
                  onClick={handleCallNext}
                  disabled={actionLoading || currentQueue.waitingCount === 0}
                  className={`w-full py-6 rounded-2xl text-base font-bold shadow-md transition-all flex flex-col items-center justify-center gap-1.5 ${
                    currentQueue.waitingCount === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5 fill-teal-400 text-teal-400" />
                    <span>CALL NEXT WAITING TOKEN</span>
                  </div>
                  <span className="text-xs text-slate-400 font-normal">
                    {currentQueue.waitingCount > 0
                      ? `Pulls next customer in line to ${currentQueue.counters?.find((c: any) => c.id === selectedCounterId)?.name || 'Counter'}`
                      : 'Queue is currently empty'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Waiting Queue Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Live Waiting Line</h3>
                <p className="text-xs text-slate-500">Ordered by priority and arrival timestamp</p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                Total: {currentQueue.waitingEntries?.length || 0}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-4">Pos</th>
                    <th className="py-3 px-4">Token</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Arrival</th>
                    <th className="py-3 px-4">Est. Wait</th>
                    <th className="py-3 px-4">Location Mode</th>
                    <th className="py-3 px-4">Priority Tag</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentQueue.waitingEntries?.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        No customers currently waiting in this queue.
                      </td>
                    </tr>
                  ) : (
                    currentQueue.waitingEntries?.map((entry: QueueEntry, index: number) => (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-500 tabular-nums">
                          #{index + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold text-slate-900 text-sm">
                          {entry.token_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {entry.customer_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                          {new Date(entry.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-teal-700 tabular-nums">
                          ~{entry.estimated_wait}m
                        </td>
                        <td className="py-3 px-4">
                          {entry.is_away ? (
                            <span className="text-[11px] text-teal-700 font-medium bg-teal-50 px-2 py-0.5 rounded">
                              Waiting Elsewhere
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">On Site</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {entry.priority_reason ? (
                            <span className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-semibold">
                              {entry.priority_reason}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleSkip(entry.id)}
                            className="text-xs text-slate-500 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-slate-100"
                          >
                            Skip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Skipped / Missed Section with Recall */}
          {currentQueue.skippedEntries && currentQueue.skippedEntries.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Previously Skipped Tokens</h3>
              <p className="text-xs text-slate-500">
                Customers who missed their call but may return to the desk can be recalled immediately.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {currentQueue.skippedEntries.map((item: QueueEntry) => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-mono font-extrabold text-slate-900 block">
                        {item.token_number}
                      </span>
                      <span className="text-xs text-slate-500">{item.customer_name}</span>
                    </div>

                    <button
                      onClick={() => handleRecall(item.id)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Recall
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
