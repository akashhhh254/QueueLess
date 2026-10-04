import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/firebase';
import { Shield, AlertCircle, CheckCircle2, ArrowRight, UserPlus, Lock, Mail, User, Copy, ExternalLink } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
  redirectTo?: string;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate, redirectTo = '/dashboard' }) => {
  const { user, registerWithPassword, loginWithGoogle, authError, clearAuthError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'PROVIDER'>('CUSTOMER');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDomainError, setIsDomainError] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // If already authenticated, redirect
  React.useEffect(() => {
    if (user) {
      onNavigate(redirectTo);
    }
  }, [user, onNavigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setIsDomainError(false);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match. Please verify your password.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithPassword({
        name,
        email,
        password,
        role,
      });
      onNavigate(redirectTo);
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    clearAuthError();
    setLocalError(null);
    setIsDomainError(false);
    setIsSubmitting(true);

    try {
      const googleResult = await signInWithGoogle();
      await loginWithGoogle(googleResult.idToken);
      onNavigate(redirectTo);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // User closed the popup window voluntarily or clicked away - treat as a normal cancellation
        setLocalError('Google sign-up window was closed. You can try again or use the form below to register instantly.');
      } else if (err?.code === 'auth/popup-blocked') {
        setLocalError('Your browser blocked the popup window. Please enable popups or use the email/password form below.');
      } else if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('auth/unauthorized-domain')) {
        setIsDomainError(true);
      } else if (err?.code === 'auth/configuration-not-found') {
        setLocalError(
          'Firebase Authentication is not yet activated in your Firebase project. Please use the Email & Password registration form below.'
        );
      } else {
        setLocalError(err?.message || 'Google sign-up could not be completed. Please try the email/password form below.');
      }
    } finally {
      setIsSubmitting(false);
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create your QueueLess Account</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Reserve your digital turn and manage real-time queues with a secure personal profile.
          </p>
        </div>

        {/* Domain Authorization Notice Banner */}
        {isDomainError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1">
                <strong className="block font-semibold">Firebase Domain Authorization Required</strong>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Firebase requires you to whitelist your web app domain before Google Popup sign-in is permitted.
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
              <p><strong>To enable Google Sign-In:</strong></p>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                <li>Go to <a href="https://console.firebase.google.com/project/queueless-bc767/authentication/settings" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-amber-900 inline-flex items-center gap-0.5">Firebase Console &rarr; Auth Settings <ExternalLink className="w-2.5 h-2.5" /></a></li>
                <li>Click <strong>Authorized Domains</strong> &rarr; <strong>Add domain</strong></li>
                <li>Paste the copied domain and click Save.</li>
              </ol>
            </div>

            <div className="p-2 rounded bg-amber-100/70 border border-amber-300 text-[11px] text-amber-950 font-medium">
              💡 <strong>Instant Alternative:</strong> You can register immediately using the <strong>Email & Password</strong> form below without waiting for Firebase domain approval!
            </div>
          </div>
        )}

        {/* Standard Error Banner */}
        {(authError || localError) && !isDomainError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 whitespace-pre-line">
              <strong className="block font-semibold">Registration Notice</strong>
              <span>{authError || localError}</span>
            </div>
          </div>
        )}

        {/* Registration Form (Email & Password) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Rajesh Kumar or Priya Sharma"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password (at least 6 characters)
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
              Confirm Password
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Account Role / Purpose
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className={`py-2 px-3 rounded-lg border text-left transition-colors ${
                  role === 'CUSTOMER'
                    ? 'border-teal-600 bg-teal-50/60 text-teal-900 font-semibold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold">Customer</span>
                <span className="text-[10px] text-slate-500 block leading-tight">Join and track queues</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('PROVIDER')}
                className={`py-2 px-3 rounded-lg border text-left transition-colors ${
                  role === 'PROVIDER'
                    ? 'border-teal-600 bg-teal-50/60 text-teal-900 font-semibold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold">Staff / Provider</span>
                <span className="text-[10px] text-slate-500 block leading-tight">Operate service counters</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
          >
            {isSubmitting ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Secure Account (Instant)</span>
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

        {/* Google Sign-Up Option */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
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
          <span>Sign up with Google</span>
        </button>

        {/* Existing Account Link */}
        <div className="pt-2 text-center border-t border-slate-100">
          <p className="text-xs text-slate-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate(`/login?redirect=${encodeURIComponent(redirectTo)}`)}
              className="text-teal-600 font-semibold hover:underline"
            >
              Sign In here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
