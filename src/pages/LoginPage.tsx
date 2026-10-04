import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/firebase';
import { getErrorMessage, normalizeError } from '../utils/errorHelper';
import { AlertCircle, CheckCircle2, Lock, Mail, LogIn, KeyRound, ArrowLeft, Copy, ExternalLink } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
  redirectTo?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, redirectTo = '/dashboard' }) => {
  const { user, loginWithPassword, loginWithGoogle, resetPassword, authError, clearAuthError } = useAuth();
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

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setLocalError(null);
    setSuccessMessage(null);
    setIsDomainError(false);
    setIsAuthenticating(true);

    try {
      const googleResult = await signInWithGoogle();
      if (!googleResult?.idToken) {
        return;
      }
      await loginWithGoogle(googleResult.idToken);
      onNavigate(redirectTo);
    } catch (err: any) {
      const normalized = normalizeError(err, 'Google authentication could not be completed. Please try again.');
      const isDomainIssue =
        err?.code === 'auth/unauthorized-domain' ||
        normalized.code === 'auth/unauthorized-domain' ||
        normalized.message.toLowerCase().includes('authorized domain') ||
        normalized.message.toLowerCase().includes('not authorized in firebase console') ||
        normalized.message.toLowerCase().includes('unauthorized-domain');

      if (isDomainIssue) {
        setIsDomainError(true);
      } else {
        setLocalError(normalized.message);
      }
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

  const copyDomain = () => {
    navigator.clipboard.writeText(currentHostname);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 3000);
  };

  const displayedError = localError || (authError ? getErrorMessage(authError, 'Sign-in failed. Please try again.') : null);

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

        {/* Domain Authorization Notice for project queue-69233 */}
        {isDomainError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-semibold text-amber-900">Firebase Domain Authorization Required</strong>
                <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                  Your Firebase project <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-[11px]">queue-69233</code> needs this hosting domain added to allow Google Sign-In.
                </p>
              </div>
            </div>

            <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 space-y-1.5">
              <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wider block">Your App Domain</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800 bg-slate-100 p-1.5 rounded select-all break-all">
                <span className="flex-1">{currentHostname}</span>
                <button
                  type="button"
                  onClick={copyDomain}
                  className="px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  {copiedDomain ? <CheckCircle2 className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-amber-800 space-y-1">
              <p><strong>To authorize Google Sign-In:</strong></p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                <li>Open <a href="https://console.firebase.google.com/project/queue-69233/authentication/settings" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-amber-900 inline-flex items-center gap-0.5">Firebase Console &rarr; Auth Settings <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Click <strong>Authorized Domains</strong> &rarr; <strong>Add domain</strong></li>
                <li>Paste <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">{currentHostname}</code> and save.</li>
              </ol>
            </div>

            <div className="p-2 rounded bg-amber-100/70 border border-amber-300 text-[11px] text-amber-950 font-medium">
              💡 <strong>Instant Sign-In:</strong> You can sign in immediately using your <strong>Email & Password</strong> below!
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {displayedError && !isDomainError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 whitespace-pre-line space-y-1">
              <span className="font-medium text-red-800">{displayedError}</span>
              {displayedError.toLowerCase().includes('invalid') && mode === 'LOGIN' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthError();
                      setLocalError(null);
                      setMode('RESET_PASSWORD');
                    }}
                    className="text-xs font-bold text-teal-700 underline hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Forgot your password? Click here to reset it</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode: Standard Email/Password Sign-In */}
        {mode === 'LOGIN' ? (
          <>
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (displayedError) setLocalError(null);
                    }}
                    placeholder="name@organization.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthError();
                      setLocalError(null);
                      setMode('RESET_PASSWORD');
                    }}
                    className="text-[11px] text-teal-600 hover:underline cursor-pointer"
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (displayedError) setLocalError(null);
                    }}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer mt-2"
              >
                {isAuthenticating ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In Option using queue-69233 */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 cursor-pointer"
            >
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
          </>
        ) : (
          /* Mode: Reset Password */
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (displayedError) setLocalError(null);
                  }}
                  placeholder="name@organization.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (displayedError) setLocalError(null);
                  }}
                  placeholder="•••••••• (min 6 characters)"
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
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (displayedError) setLocalError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  setLocalError(null);
                  setMode('LOGIN');
                }}
                className="py-2.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isAuthenticating ? <span>Updating Password...</span> : <span>Save New Password</span>}
              </button>
            </div>
          </form>
        )}

        {/* Create Account Link */}
        <div className="pt-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate(`/register?redirect=${encodeURIComponent(redirectTo)}`)}
              className="text-teal-600 font-semibold hover:underline cursor-pointer"
            >
              Register here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
