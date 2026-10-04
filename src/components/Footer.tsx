import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-slate-900 text-teal-400 flex items-center justify-center font-bold text-xs">
                Q
              </div>
              <span className="font-bold text-slate-900 tracking-tight">QueueLess</span>
            </div>
            <p className="text-sm text-slate-600 max-w-sm mb-3">
              Transforming traditional waiting into predictable, flexible, and human-centered queues. Your turn is reserved. Your time is yours.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
              <span>Full-Stack Engine with Real-Time WebSockets & Database Persistence</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Supported Environments
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>Government Hospitals & OPDs</li>
              <li>Retail & Commercial Banks</li>
              <li>Department of Motor Vehicles</li>
              <li>Diagnostic & Pathology Centers</li>
              <li>University Registrar Hall</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
              Security & Architecture
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>Google OAuth 2.0 Identity</li>
              <li>HTTP-Only Signed Sessions</li>
              <li>Dynamic Wait-Time Model</li>
              <li>Real Relational Database</li>
              <li><a href="/health" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">System Health Check</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} QueueLess Smart Systems. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Production Release v1.0.0</span>
            <span aria-hidden="true">·</span>
            <span>WCAG AA Accessible</span>
            <span aria-hidden="true">·</span>
            <span>Zero-Wait Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
