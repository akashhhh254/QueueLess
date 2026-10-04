import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { QueueEntry } from '../types';
import { QRCodeModal } from '../components/QRCodeModal';
import {
  Clock, Users, MapPin, AlertCircle, Sparkles, CheckCircle2,
  XCircle, QrCode, RefreshCw, ArrowRight, ShieldCheck,
  ChevronRight, Volume2, Bell
} from 'lucide-react';

interface CustomerDashboardProps {
  onNavigate: (path: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { subscribeQueue, addListener, status: socketStatus } = useWebSocket();
  const [activeEntry, setActiveEntry] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isTogglingAway, setIsTogglingAway] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchActiveEntry = useCallback(async () => {
    try {
      const res = await fetch('/api/queues/active/me');
      if (res.ok) {
        const data = await res.json();
        setActiveEntry(data.activeEntry || null);
        if (data.activeEntry) {
          subscribeQueue(data.activeEntry.queue_id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [subscribeQueue]);

  useEffect(() => {
    fetchActiveEntry();
  }, [fetchActiveEntry]);

  // Real-time WebSocket listener
  useEffect(() => {
    const unsubscribe = addListener('QUEUE_UPDATED', () => {
      fetchActiveEntry();
    });
    return () => unsubscribe();
  }, [addListener, fetchActiveEntry]);

  // Leave / Cancel Queue
  const handleLeaveQueue = async () => {
    if (!activeEntry) return;
    if (!window.confirm(`Are you sure you want to cancel token ${activeEntry.token_number}? You will forfeit your position in line.`)) {
      return;
    }

    setIsLeaving(true);
    try {
      const res = await fetch(`/api/queues/${activeEntry.queue_id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: activeEntry.id }),
      });
      if (res.ok) {
        setActiveEntry(null);
        setFeedbackMessage('You have left the queue.');
        setTimeout(() => setFeedbackMessage(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to leave queue');
    } finally {
      setIsLeaving(false);
    }
  };

  // Toggle "Wait Elsewhere" mode
  const handleToggleAway = async () => {
    if (!activeEntry) return;
    setIsTogglingAway(true);
    const newAwayState = !activeEntry.is_away;

    try {
      const res = await fetch(`/api/queues/entries/${activeEntry.id}/away`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAway: newAwayState }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveEntry((prev) => (prev ? { ...prev, is_away: data.entry.is_away } : null));
        setFeedbackMessage(data.message);
        setTimeout(() => setFeedbackMessage(null), 5000);
      }
    } catch (err: any) {
      alert(err.message || 'Unable to update status');
    } finally {
      setIsTogglingAway(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Retrieving real-time queue position from database...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
            Customer Dashboard
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome, {user?.name || 'Customer'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your live token updates automatically via server WebSockets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchActiveEntry()}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm"
            title="Refresh state from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => onNavigate('/join')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
          >
            Browse All Queues
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-800 flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Main Active Token Card or Empty State */}
      {activeEntry ? (
        <div className="space-y-6">
          {/* Urgent Status Banner if CALLED or SERVING */}
          {(activeEntry.status === 'CALLED' || activeEntry.status === 'SERVING') && (
            <div className="p-4 rounded-2xl bg-teal-600 text-white shadow-lg space-y-2 animate-bounce-short">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span>IT'S YOUR TURN — PLEASE PROCEED TO COUNTER!</span>
              </div>
              <p className="text-xs text-teal-50 leading-relaxed">
                Token <strong className="font-mono text-white text-sm">{activeEntry.token_number}</strong> is now called to{' '}
                <strong className="text-white underline">{activeEntry.counter_name || 'Assigned Counter'}</strong>. Please proceed immediately.
              </p>
            </div>
          )}

          {/* Turn Approaching Banner */}
          {activeEntry.status === 'WAITING' && (activeEntry.peopleAhead || 0) <= 2 && (activeEntry.peopleAhead || 0) > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500 text-white shadow-md space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Bell className="w-4 h-4 animate-ping" />
                <span>YOUR TURN IS APPROACHING!</span>
              </div>
              <p className="text-xs text-amber-50">
                Only {activeEntry.peopleAhead} {activeEntry.peopleAhead === 1 ? 'person is' : 'people are'} ahead of you. If you stepped away, please begin heading toward the service counter.
              </p>
            </div>
          )}

          {/* Primary Hero Token Display */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header info */}
            <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Service Station
                </span>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {activeEntry.service_name || activeEntry.queue_name}
                </h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{activeEntry.location_name}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQRModal(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 shadow-sm"
                  title="Show QR Code"
                >
                  <QrCode className="w-3.5 h-3.5 text-slate-600" />
                  <span>Queue QR</span>
                </button>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                    activeEntry.status === 'CALLED' || activeEntry.status === 'SERVING'
                      ? 'bg-teal-100 text-teal-800 animate-pulse'
                      : activeEntry.queue_status === 'DELAYED'
                      ? 'bg-amber-100 text-amber-800'
                      : activeEntry.queue_status === 'PAUSED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  STATUS: {activeEntry.status}
                </span>
              </div>
            </div>

            {/* Huge Metrics Grid */}
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {/* Your Token */}
                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-1 shadow-sm">
                  <span className="text-[11px] font-medium text-slate-400 block tracking-wider">
                    YOUR TOKEN
                  </span>
                  <span className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight text-teal-400 tabular-nums">
                    {activeEntry.token_number}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Seq #{activeEntry.raw_sequence}
                  </span>
                </div>

                {/* Now Serving */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-medium text-slate-500 block tracking-wider">
                    NOW SERVING
                  </span>
                  <span className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 tracking-tight tabular-nums">
                    {activeEntry.nowServingToken || '—'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {activeEntry.counter_name || 'Active Station'}
                  </span>
                </div>

                {/* People Ahead */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-medium text-slate-500 block tracking-wider">
                    PEOPLE AHEAD
                  </span>
                  <span className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-900 tracking-tight tabular-nums">
                    {activeEntry.peopleAhead !== undefined ? activeEntry.peopleAhead : '0'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    In Waiting Line
                  </span>
                </div>

                {/* Estimated Wait */}
                <div className="p-4 rounded-xl bg-teal-50/50 border border-teal-200 space-y-1">
                  <span className="text-[11px] font-medium text-teal-800 block tracking-wider">
                    ESTIMATED WAIT
                  </span>
                  <span className="text-4xl sm:text-5xl font-extrabold font-mono text-teal-700 tracking-tight tabular-nums">
                    ~{activeEntry.estimated_wait}
                  </span>
                  <span className="text-[10px] text-teal-700 block font-semibold">
                    Minutes (Dynamic)
                  </span>
                </div>
              </div>

              {/* Progress Stepper: JOINED -> WAITING -> ALMOST YOUR TURN -> YOUR TURN -> COMPLETED */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-700 block mb-3">
                  Queue Journey Progress
                </span>
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-medium">
                  {[
                    { label: 'Joined', done: true },
                    { label: 'Waiting', done: true },
                    {
                      label: 'Near Turn',
                      done: (activeEntry.peopleAhead || 0) <= 2,
                    },
                    {
                      label: 'Your Turn',
                      done: activeEntry.status === 'CALLED' || activeEntry.status === 'SERVING',
                    },
                    { label: 'Completed', done: activeEntry.status === 'COMPLETED' },
                  ].map((step, idx) => (
                    <div key={step.label} className="space-y-1.5">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          step.done ? 'bg-teal-600' : 'bg-slate-200'
                        }`}
                      />
                      <span className={`text-[11px] block truncate ${step.done ? 'text-teal-900 font-semibold' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wait Elsewhere Feature Panel */}
              <div className="mt-8 p-5 rounded-xl border border-teal-200 bg-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <strong className="text-sm font-bold text-slate-900">
                      "Wait Elsewhere" Mode
                    </strong>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      activeEntry.is_away ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {activeEntry.is_away ? 'ACTIVE (Away from Hall)' : 'ON SITE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                    You can safely leave the waiting hall to grab a beverage or work. Your token remains securely reserved in the database.
                  </p>
                </div>

                <button
                  onClick={handleToggleAway}
                  disabled={isTogglingAway}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shadow-sm ${
                    activeEntry.is_away
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                >
                  {isTogglingAway
                    ? 'Updating...'
                    : activeEntry.is_away
                    ? "I'm Back On-Site"
                    : "I'll Wait Elsewhere"}
                </button>
              </div>

              {/* Secondary Details & Cancellation */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                <div className="space-y-0.5">
                  <p>
                    Joined at:{' '}
                    <span className="font-mono text-slate-700">
                      {new Date(activeEntry.joined_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                  {activeEntry.priority_reason && (
                    <p className="text-teal-700 font-semibold">
                      Priority Registered: {activeEntry.priority_reason}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleLeaveQueue}
                  disabled={isLeaving}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
                >
                  {isLeaving ? 'Cancelling...' : 'Cancel & Leave Queue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State: No active token */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900">You are not currently in any queue</h3>
            <p className="text-xs text-slate-500">
              Select a hospital clinic, bank counter, or government office to generate your digital token and start tracking your turn.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('/join')}
              className="px-6 py-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-md inline-flex items-center gap-2"
            >
              <span>Find a Service & Get Token</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && activeEntry && (
        <QRCodeModal
          queueId={activeEntry.queue_id}
          queueName={activeEntry.service_name || activeEntry.queue_name || 'Service Queue'}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
};
