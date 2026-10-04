import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ServiceLocation, ServiceItem, QueueItem } from '../types';
import {
  Building2, Hospital, Landmark, FileText, Activity,
  GraduationCap, Clock, Users, ArrowRight, ShieldCheck,
  AlertCircle, CheckCircle2, ChevronRight, Sparkles
} from 'lucide-react';

interface JoinQueuePageProps {
  onNavigate: (path: string) => void;
  preselectedQueueId?: string;
}

export const JoinQueuePage: React.FC<JoinQueuePageProps> = ({ onNavigate, preselectedQueueId }) => {
  const { user } = useAuth();
  const [locations, setLocations] = useState<ServiceLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedQueue, setSelectedQueue] = useState<QueueItem | null>(null);

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [priorityReason, setPriorityReason] = useState('');

  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations');
        if (res.ok) {
          const data = await res.json();
          setLocations(data);
          if (data.length > 0 && !selectedLocationId) {
            setSelectedLocationId(data[0].id);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  // When location changes, fetch services & queues for that location
  useEffect(() => {
    if (!selectedLocationId) return;

    const fetchLocationDetails = async () => {
      try {
        const res = await fetch(`/api/locations/${selectedLocationId}`);
        if (res.ok) {
          const data = await res.json();
          setServices(data.services || []);
          if (data.services && data.services.length > 0) {
            setSelectedServiceId(data.services[0].id);
            if (data.services[0].queues && data.services[0].queues.length > 0) {
              setSelectedQueue(data.services[0].queues[0]);
            }
          }
        }
      } catch {
        // ignore
      }
    };
    fetchLocationDetails();
  }, [selectedLocationId]);

  // Handle service change
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const service = services.find((s) => s.id === serviceId);
    if (service && service.queues && service.queues.length > 0) {
      setSelectedQueue(service.queues[0]);
    } else {
      setSelectedQueue(null);
    }
  };

  const handleJoinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedQueue) {
      setErrorMessage('Please select an active service queue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/queues/${selectedQueue.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerName,
          phone: customerPhone,
          priorityReason: priorityReason || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to join queue');
      }

      // Navigate to live customer dashboard to track
      onNavigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLocations = filterType === 'ALL'
    ? locations
    : locations.filter((loc) => loc.type === filterType);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <span className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Queue Registration
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Join a Digital Queue
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Select your institution, confirm your details, and receive an authentic database-backed token.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold">Unable to Join Queue</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Filter Tabs for Locations */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto text-xs font-medium">
        {[
          { label: 'All Sectors', value: 'ALL' },
          { label: 'Hospitals', value: 'HOSPITAL' },
          { label: 'Banks', value: 'BANK' },
          { label: 'Government', value: 'GOVERNMENT_OFFICE' },
          { label: 'Diagnostics', value: 'DIAGNOSTIC_CENTER' },
          { label: 'Colleges', value: 'COLLEGE' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterType(tab.value)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              filterType === tab.value
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Form Column */}
        <div className="md:col-span-7 space-y-6">
          <form onSubmit={handleJoinQueue} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            {/* 1. Location Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                1. Select Service Location
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                disabled={loadingLocations}
              >
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.city})
                  </option>
                ))}
              </select>
              {selectedLocation && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {selectedLocation.address}, {selectedLocation.city}
                </p>
              )}
            </div>

            {/* 2. Service Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                2. Select Service Desk
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} (~{srv.average_service_time} min/person)
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder="Full Name"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* 4. Phone Number (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number (Optional, for SMS alerts)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* 5. Accessibility Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Accessibility / Priority Request (Optional)
              </label>
              <select
                value={priorityReason}
                onChange={(e) => setPriorityReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="">None (Standard General Line)</option>
                <option value="Senior Citizen (65+)">Senior Citizen (65+)</option>
                <option value="Mobility / Wheelchair Assistance">Mobility / Wheelchair Assistance</option>
                <option value="Expectant Mother / Infant Care">Expectant Mother / Infant Care</option>
                <option value="Urgent Medical Triage Need">Urgent Medical Triage Need</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Priority requests are audited by the service provider to ensure fairness.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !selectedQueue}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group"
              >
                {submitting ? (
                  <span>Generating Secure Token...</span>
                ) : (
                  <>
                    <span>GET DIGITAL TOKEN</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Queue Snapshot */}
        <div className="md:col-span-5 space-y-4">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Live Station Status
            </span>

            {selectedQueue ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedQueue.name}</h3>
                  <p className="text-xs text-slate-500">
                    Queue Prefix: <span className="font-mono font-bold text-slate-800">{selectedQueue.prefix}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-0.5">NOW SERVING</span>
                    <span className="text-xl font-extrabold font-mono text-teal-600 tabular-nums">
                      {selectedQueue.nowServing || 'None'}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-400 block mb-0.5">WAITING NOW</span>
                    <span className="text-xl font-extrabold font-mono text-slate-900 tabular-nums">
                      {selectedQueue.waitingCount ?? 0}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Active Service Counters:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedQueue.active_counters_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average Service Duration:</span>
                    <span className="font-mono font-bold text-slate-900">~{selectedQueue.average_service_time} min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Estimated Wait for New Entry:</span>
                    <span className="font-mono font-bold text-teal-700">
                      ~{Math.max(1, Math.round(((selectedQueue.waitingCount || 0) * selectedQueue.average_service_time) / Math.max(1, selectedQueue.active_counters_count)))} min
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-[11px]">
                    Once you join, you will be free to wait elsewhere. The system will alert you when your turn approaches.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Select a service to view queue metrics.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
