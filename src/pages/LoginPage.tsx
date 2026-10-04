import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/firebase';
import { getErrorMessage } from '../utils/errorHelper';
import { Shield, AlertCircle, CheckCircle2, ArrowRight, Lock, Mail, LogIn, Copy, ExternalLink, KeyRound, ArrowLeft } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  redirectTo?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, redirectTo = '/dashboard' }) => {
  const { user, loginWithGoogle, loginWithPassword, resetPassword, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mode: 'LOGIN' or 'RESET_PASSWORD'
  const [mode, setMode] = useState<'LOGIN' | 'RESET_PASSWORD'>('LOGIN');

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDomainError, setIsDomainError] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // If already authenticated, redirect
  React.useEffect(() => {
    if (user) {
      onNavigate(redirectTo);
    }
  }, [user, onNavigate, redirectTo]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setSuccessMessage(null);
    setIsDomainError(false);
    setIsAuthenticating(true);

    try {
      await loginWithPassword(email, password);
      onNavigate(redirectTo);
    } catch (err: any) {
      setLocalError(getErrorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setLocalError('New passwords do not match. Please verify.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    setIsAuthenticating(true);
    try {
      await resetPassword(email, password);
      setSuccessMessage('Password reset successfully! Redirecting...');
      setTimeout(() => {
        onNavigate(redirectTo);
      }, 500);
    } catch (err: any) {
      setLocalError(getErrorMessage(err, 'Unable to reset password.'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setLocalError(null);
    setSuccessMessage(null);
    setIsDomainError(false);
    setIsAuthenticating(true);

    try {
      // Trigger official Google Authentication via Firebase SDK
      const googleResult = await signInWithGoogle();
      if (!googleResult?.idToken) {
        return;
      }
      await loginWithGoogle(googleResult.idToken);
      onNavigate(redirectTo);
    } catch (err: any) {
      const friendlyMsg = getErrorMessage(err, 'Google authentication could not be completed. Please try again or use email/password.');
      if (
        err?.code === 'auth/unauthorized-domain' ||
        friendlyMsg.toLowerCase().includes('not authorized in firebase console') ||
        friendlyMsg.toLowerCase().includes('auth/unauthorized-domain')
      ) {
        setIsDomainError(true);
      } else {
        setLocalError(friendlyMsg);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const copyDomainToClipboard = () => {
    navigator.clipboard.writeText(currentHostname);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 3000);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 mx-auto flex items-center justify-center font-bold text-xl shadow-md">
            Q
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'LOGIN' ? 'Sign in to QueueLess' : 'Reset Account Password'}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {mode === 'LOGIN'
              ? 'Access your tokens, live position in line, and customer dashboard.'
              : 'Enter your registered email and choose a new secure password.'}
          </p>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Domain Authorization Notice Banner */}
        {isDomainError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1">
                <strong className="block font-semibold">Firebase Domain Authorization Required</strong>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Firebase requires you to whitelist this preview domain before Google Sign-In is allowed.
                </p>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-amber-200 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-600">Your App Domain:</div>
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono bg-slate-100 px-2 py-1 rounded flex-1 truncate text-slate-800 border border-slate-200">
                  {currentHostname}
                </code>
                <button
                  type="button"
                  onClick={copyDomainToClipboard}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded flex items-center gap-1 transition-colors shrink-0"
                >
                  {copiedDomain ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDomain ? 'Copied!' : 'Copy Domain'}</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-amber-800 space-y-1">
              <p><strong>To authorize Google Sign-In:</strong></p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                <li>Open <a href="https://console.firebase.google.com/project/queueless-bc767/authentication/settings" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-amber-900 inline-flex items-center gap-0.5">Firebase Console &rarr; Auth Settings <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Click <strong>Authorized Domains</strong> &rarr; <strong>Add domain</strong></li>
                <li>Paste the copied domain and click Save.</li>
              </ol>
            </div>

            <div className="p-2 rounded bg-amber-100/70 border border-amber-300 text-[11px] text-amber-950 font-medium">
              💡 <strong>Instant Sign-In:</strong> You can sign in immediately using your <strong>Email & Password</strong> below!
            </div>
          </div>
        )}

        {/* Error Banners */}
        {(authError || localError) && !isDomainError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 whitespace-pre-line space-y-1">
              <strong className="block font-semibold">Sign-In Notice</strong>
              <span>{getErrorMessage(authError || localError, 'Sign-in failed. Please check your credentials.')}</span>
              {getErrorMessage(authError || localError)?.toLowerCase().includes('invalid') && mode === 'LOGIN' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthError();
                      setLocalError(null);
                      setMode('RESET_PASSWORD');
                    }}
                    className="text-xs font-bold text-teal-700 underline hover:text-teal-900 inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Forgot your password? Click here to reset it</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isAuthenticating && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-teal-900">
              Verifying credentials with database...
            </p>
          </div>
        )}

        {/* MODE: LOGIN FORM */}
        {mode === 'LOGIN' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setLocalError(null);
                    setMode('RESET_PASSWORD');
                  }}
                  className="text-[11px] text-teal-600 hover:text-teal-800 font-medium hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Dashboard</span>
            </button>
          </form>
        ) : (
          /* MODE: RESET PASSWORD FORM */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (at least 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              <span>Save New Password & Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                clearAuthError();
                setLocalError(null);
                setMode('LOGIN');
              }}
              className="w-full py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </form>
        )}

        {/* Divider */}
        {mode === 'LOGIN' && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In Action */}
            <div className="space-y-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
              >
                {/* Google SVG Logo */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Link to Register */}
            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-600">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate(`/register?redirect=${encodeURIComponent(redirectTo)}`)}
                  className="text-teal-600 font-semibold hover:underline"
                >
                  Create Account / Register here
                </button>
              </p>
            </div>
          </>
        )}

        {/* Security Notice */}
        <div className="pt-2 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span>Role-Based Access Control Enforced by Backend</span>
          </div>
        </div>
      </div>
    </div>
  );
};
