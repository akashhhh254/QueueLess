import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole | UserRole[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  currentPath,
  onNavigate,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Verifying authenticated session...</p>
      </div>
    );
  }

  // Not logged in: Strict redirect to login page
  if (!user) {
    onNavigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
    return null;
  }

  // Check role authorization if specified
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const isAuthorized = user.role === 'ADMIN' || roles.includes(user.role);

    if (!isAuthorized) {
      return (
        <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-2xl border border-red-200 shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your current account role is <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold">{user.role}</code>.
            This area requires one of: {roles.join(', ')}.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('/dashboard')}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Customer Dashboard</span>
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
