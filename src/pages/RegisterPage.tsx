import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle } from '../services/firebase';
import { getErrorMessage, normalizeError } from '../utils/errorHelper';
import { AlertCircle, UserPlus, Lock, Mail, User, Copy, ExternalLink, CheckCircle2 } from 'lucide-react';

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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setLocalError('Please enter your full name (minimum 2 characters).');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

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
        name: trimmedName,
        email: trimmedEmail,
        password,
        role,
      });
      onNavigate(redirectTo);
    } catch (err: any) {
      setLocalError(getErrorMessage(err, 'Unable to create account. Please check your details and try again.'));
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
      if (!googleResult?.idToken) {
        return;
      }
      await loginWithGoogle(googleResult.idToken, role);
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
      setIsSubmitting(false);
    }
  };

  const copyDomain = () => {
    navigator.clipboard.writeText(currentHostname);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 3000);
  };

  const displayedError = localError || (authError ? getErrorMessage(authError, 'Unable to complete registration.') : null);

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-teal-400 mx-auto flex items-center justify-center font-bold text-xl shadow-md">
            Q
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create your Account</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Sign up to reserve turns, track your position in line, and manage queues in real time.
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
              💡 <strong>Instant Sign-Up:</strong> You can register right now using the <strong>Email & Password</strong> form below!
            </div>
          </div>
        )}

        {/* Error Banner */}
        {displayedError && !isDomainError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1 whitespace-pre-line space-y-1">
              <span className="font-medium text-red-800">{displayedError}</span>
              {displayedError.toLowerCase().includes('already exists') && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/login?redirect=${encodeURIComponent(redirectTo)}`)}
                    className="text-xs font-bold text-teal-700 underline hover:text-teal-900 inline-flex items-center gap-1"
                  >
                    <span>Click here to Sign In</span>
                  </button>
                </div>
              )}
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
                onChange={(e) => {
                  setName(e.target.value);
                  if (displayedError) setLocalError(null);
                }}
                placeholder="e.g. Akash Thakare"
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (displayedError) setLocalError(null);
                }}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Create Password
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
                placeholder="•••••••• (at least 6 characters)"
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
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (displayedError) setLocalError(null);
                }}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRole('CUSTOMER')}
                className={`py-2 px-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  role === 'CUSTOMER'
                    ? 'border-teal-600 bg-teal-50/60 text-teal-900 font-semibold shadow-xs ring-1 ring-teal-500'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="block font-bold">Customer</span>
                <span className="text-[10px] text-slate-500 block leading-tight">Join queues & get tokens</span>
              </button>

              <button
                type="button"
                onClick={() => setRole('PROVIDER')}
                className={`py-2 px-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  role === 'PROVIDER'
                    ? 'border-teal-600 bg-teal-50/60 text-teal-900 font-semibold shadow-xs ring-1 ring-teal-500'
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
            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
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

        {/* Google Sign-Up Option using queue-69233 */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isSubmitting}
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

        {/* Existing Account Link */}
        <div className="pt-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onNavigate(`/login?redirect=${encodeURIComponent(redirectTo)}`)}
              className="text-teal-600 font-semibold hover:underline cursor-pointer"
            >
              Sign In here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
