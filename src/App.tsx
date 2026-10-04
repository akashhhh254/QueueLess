import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { JoinQueuePage } from './pages/JoinQueuePage';
import { ProviderDashboard } from './pages/ProviderDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { NotificationsPage } from './pages/NotificationsPage';

function MainRouter() {
  const [currentPath, setCurrentPath] = useState<string>(
    window.location.pathname + window.location.search || '/'
  );

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname + window.location.search || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pathname = currentPath.split('?')[0];
  const searchParams = new URLSearchParams(currentPath.includes('?') ? currentPath.split('?')[1] : '');
  const redirectTarget = searchParams.get('redirect') || '/dashboard';
  const preselectedQueue = searchParams.get('queue') || undefined;

  const renderCurrentView = () => {
    switch (pathname) {
      case '/':
        return <LandingPage onNavigate={navigate} />;

      case '/login':
        return <LoginPage onNavigate={navigate} redirectTo={redirectTarget} />;

      case '/register':
        return <RegisterPage onNavigate={navigate} redirectTo={redirectTarget} />;

      case '/dashboard':
        return (
          <ProtectedRoute currentPath={currentPath} onNavigate={navigate}>
            <CustomerDashboard onNavigate={navigate} />
          </ProtectedRoute>
        );

      case '/join':
        return (
          <ProtectedRoute currentPath={currentPath} onNavigate={navigate}>
            <JoinQueuePage onNavigate={navigate} preselectedQueueId={preselectedQueue} />
          </ProtectedRoute>
        );

      case '/provider':
        return (
          <ProtectedRoute
            currentPath={currentPath}
            onNavigate={navigate}
            requiredRole={['PROVIDER', 'ADMIN']}
          >
            <ProviderDashboard />
          </ProtectedRoute>
        );

      case '/admin':
        return (
          <ProtectedRoute
            currentPath={currentPath}
            onNavigate={navigate}
            requiredRole="ADMIN"
          >
            <AdminDashboard />
          </ProtectedRoute>
        );

      case '/notifications':
        return (
          <ProtectedRoute currentPath={currentPath} onNavigate={navigate}>
            <NotificationsPage />
          </ProtectedRoute>
        );

      default:
        return (
          <div className="max-w-md mx-auto my-20 p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-slate-900">404 — Page Not Found</h2>
            <p className="text-xs text-slate-500">The destination route does not exist.</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              Return to Homepage
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar currentPath={pathname} onNavigate={navigate} />
      <main className="flex-1">{renderCurrentView()}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <MainRouter />
      </WebSocketProvider>
    </AuthProvider>
  );
}
