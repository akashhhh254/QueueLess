import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock, ShieldCheck, Users, Sparkles, Building2,
  Hospital, Landmark, FileText, Activity, GraduationCap,
  ArrowRight, CheckCircle2, ChevronRight, Bell, Smartphone, Radio
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'traditional' | 'queueless'>('queueless');

  const handleJoinClick = () => {
    if (user) {
      onNavigate('/join');
    } else {
      onNavigate('/login?redirect=/join');
    }
  };

  const handleManageClick = () => {
    if (user) {
      onNavigate('/provider');
    } else {
      onNavigate('/login?redirect=/provider');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-slate-100/70 via-white to-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/60 text-xs font-semibold text-teal-800">
                <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                Smart Queue & Intelligent Waiting Management
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] text-balance">
                Your turn is reserved.{' '}
                <span className="text-teal-600">Your time is yours.</span>
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl text-balance">
                Join a queue digitally, track your position in real time with dynamic wait estimation, and leave the crowded physical waiting room. Return only when your turn is near.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={handleJoinClick}
                  className="px-6 py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 group"
                >
                  <span>Join a Digital Queue</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={handleManageClick}
                  className="px-6 py-3.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Manage Counters & Queues
                </button>
              </div>

              {/* Trust & Compliance Markers */}
              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Real Google OAuth 2.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>Dynamic Wait Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-teal-600" />
                  <span>Sub-second WebSockets</span>
                </div>
              </div>
            </div>

            {/* Right Hero Live Interactive Queue Visualization */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 relative">
                {/* Header of Simulated Card */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Live Queue Monitor
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">General OPD & Triage</h3>
                    <p className="text-xs text-slate-500">Metropolitan Government Hospital</p>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-teal-50 text-teal-700 text-xs font-mono font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping" />
                    Counter 2 Active
                  </div>
                </div>

                {/* Main Metrics Box */}
                <div className="my-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="border-r border-slate-200 pr-2">
                      <span className="text-xs text-slate-500 block mb-1">YOUR TOKEN</span>
                      <span className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight tabular-nums">
                        A027
                      </span>
                    </div>
                    <div className="pl-2">
                      <span className="text-xs text-slate-500 block mb-1">NOW SERVING</span>
                      <span className="text-3xl font-extrabold text-teal-600 font-mono tracking-tight tabular-nums">
                        A018
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-center text-xs">
                    <div>
                      <span className="text-slate-500">People Ahead: </span>
                      <span className="font-bold text-slate-800 font-mono">8 people</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Estimated Wait: </span>
                      <span className="font-bold text-slate-800 font-mono">~24 minutes</span>
                    </div>
                  </div>
                </div>

                {/* "Wait Elsewhere" Banner */}
                <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">"Wait Elsewhere" Mode Active</strong>
                    <span>Your position is locked in the relational database. Grab coffee or walk safely; we'll notify your phone when 2 turns remain.</span>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>A018 (Serving)</span>
                    <span className="text-teal-700 font-bold">A027 (You)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-teal-600 rounded-full transition-all duration-500" style={{ width: '68%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Core Innovation: Traditional vs QueueLess */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              A queue should reserve your turn, not imprison your time.
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Traditional physical queues force citizens to remain stuck in cramped hospital corridors and bank halls. QueueLess organizes waiting around people, not rooms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* The Old Way */}
            <div className="p-6 rounded-2xl border border-red-200 bg-red-50/20 space-y-4">
              <div className="flex items-center gap-2 text-red-700 font-bold text-base">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                The Traditional Physical Queue
              </div>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Unpredictable Duration:</strong> Patients have no idea if the wait is 15 minutes or 3 hours.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Premises Imprisonment:</strong> If you leave to use the restroom or buy medicine, you forfeit your turn.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Hallway Congestion:</strong> Overcrowded waiting halls cause health risks and elevated stress levels.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">✕</span>
                  <span><strong>Static Paper Slips:</strong> Paper tokens tear, get lost, and provide zero real-time status visibility.</span>
                </li>
              </ul>
            </div>

            {/* The QueueLess Way */}
            <div className="p-6 rounded-2xl border border-teal-300 bg-teal-50/30 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-teal-800 font-bold text-base">
                <span className="w-3 h-3 rounded-full bg-teal-500" />
                The QueueLess Experience
              </div>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                  <span><strong>Dynamic Time Engine:</strong> Algorithmic calculation based on active counters and actual completion speeds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                  <span><strong>Wait Anywhere Safely:</strong> Grab lunch or sit in an open garden. Your token remains secure in the database.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                  <span><strong>Approaching-Turn Alerts:</strong> In-app push notifications alert you when 2 people remain so you return calmly.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                  <span><strong>Real Multi-Counter Routing:</strong> Automatically balances customer load across available staff stations.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7-Step Journey */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block mb-1">
              End-to-End Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              How QueueLess Works in 7 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Sign in with Google',
                desc: 'Secure identity verification prevents token theft and ensures private notifications.',
                icon: ShieldCheck,
              },
              {
                step: '02',
                title: 'Choose Service',
                desc: 'Select hospital OPD, banking teller, DMV licensing, or university registrar.',
                icon: Building2,
              },
              {
                step: '03',
                title: 'Get Digital Token',
                desc: 'Receive unique sequence number (e.g. A027) generated transactional by the server.',
                icon: Smartphone,
              },
              {
                step: '04',
                title: 'Leave Waiting Area',
                desc: 'Step outside or wait elsewhere with peace of mind. Your position is reserved.',
                icon: Sparkles,
              },
              {
                step: '05',
                title: 'Live Tracking',
                desc: 'Watch real-time WebSocket updates of the current serving token and dynamic wait time.',
                icon: Radio,
              },
              {
                step: '06',
                title: 'Return on Alert',
                desc: 'Receive "Your Turn is Approaching" alert when 2 customers remain. Proceed to counter.',
                icon: Bell,
              },
              {
                step: '07',
                title: 'Get Served Swiftly',
                desc: 'Provider calls your token, completes consultation, and logs efficiency metrics.',
                icon: CheckCircle2,
              },
            ].map((item, idx) => (
              <div
                key={item.step}
                className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                    {item.step}
                  </span>
                  <item.icon className="w-4 h-4 text-slate-400" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 pt-1">{item.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Environments Grid */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Built for High-Footfall Public Services
            </h2>
            <p className="text-slate-600 mt-2 text-sm">
              Deployable across mission-critical facilities with immediate customer impact.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Hospital className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Hospitals & Health Clinics</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                General OPD, pediatric consultations, specialty clinics, and triage screening. Protects sick patients from crowded infectious waiting rooms.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Banks & Financial Branches</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cash counters, foreign exchange, new accounts, and commercial credit consultations. Multi-counter load balancing across active tellers.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Government Offices & DMVs</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Driver licenses, civil registrations, land deeds, and passport verification counters. Transform painful civic visits into dignified experiences.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Diagnostic & Lab Centers</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Phlebotomy blood draws, radiology scans, and specimen drop-offs. Patients maintain fasting comfort without standing in line.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Colleges & Universities</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Registrar desk, transcript clearance, course enrollment, and student financial aid counters during peak semester rushes.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Priority & Accessible Access</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Built-in priority tagging for seniors, pregnant mothers, and citizens requiring mobility assistance with transparent audit logging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-14 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to end traditional queue imprisonment?
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Experience real-time queue tracking backed by persistent relational database architecture and live WebSocket updates.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleJoinClick}
              className="px-6 py-3 text-sm font-semibold text-slate-900 bg-teal-400 rounded-xl hover:bg-teal-300 transition-colors shadow-md"
            >
              Get Your Digital Token Now
            </button>
            <button
              onClick={handleManageClick}
              className="px-6 py-3 text-sm font-semibold text-white bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Open Provider Station
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
