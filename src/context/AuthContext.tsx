import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { auth, signOutFromFirebase, checkRedirectAuthResult } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getErrorMessage } from '../utils/errorHelper';

const SESSION_STORAGE_KEY = 'queueless_session_token';

/**
 * Safe fetch wrapper that automatically attaches the Bearer token for /api requests.
 * Uses the fresh session token or Firebase Auth ID token.
 * Does NOT mutate the read-only window.fetch getter, ensuring full compatibility across all browsers & iframes.
 */
export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let token = typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;

  // If Firebase has an active user and no local token is present, get an ID token
  if (!token && auth?.currentUser) {
    try {
      const fbToken = await auth.currentUser.getIdToken();
      if (fbToken) {
        token = fbToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, fbToken);
        }
      }
    } catch {
      // Fall back
    }
  }

  const requestInit = { ...(init || {}) };
  const headers = new Headers(requestInit.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  requestInit.headers = headers;

  return fetch(input, requestInit);
};

async function safeParseResponse(res: Response): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Authentication server error (${res.status}). Please try again.`);
    }
    throw new Error('Received unexpected response format from server.');
  }

  if (!res.ok) {
    const errorMsg = getErrorMessage(data, `Request failed (${res.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleConfig: {
    configured: boolean;
    clientId: string;
    appUrl: string;
  };
  loginWithGoogle: (credential: string, role?: 'CUSTOMER' | 'PROVIDER') => Promise<User>;
  registerWithPassword: (params: { name: string; email: string; password: string; role?: 'CUSTOMER' | 'PROVIDER' }) => Promise<User>;
  loginWithPassword: (email: string, password: string) => Promise<User>;
  resetPassword: (email: string, newPassword: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  saveCustomClientId: (id: string) => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level in-flight promise tracker to deduplicate concurrent Google auth requests
let inFlightGoogleAuth: Promise<User> | null = null;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleConfig, setGoogleConfig] = useState<{
    configured: boolean;
    clientId: string;
    appUrl: string;
  }>({
    configured: false,
    clientId: '',
    appUrl: '',
  });

  const fetchAuthStatus = async () => {
    try {
      // 1. Fetch Google Client configuration status
      const configRes = await apiFetch('/api/auth/config');
      if (configRes.ok) {
        try {
          const configData = await configRes.json();
          setGoogleConfig(configData);
        } catch {}
      }

      // 2. Fetch authenticated session
      const meRes = await apiFetch('/api/auth/me');
      if (meRes.ok) {
        try {
          const meData = await meRes.json();
          setUser(meData.user || null);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Check for mobile Google redirect login result on mount
    const checkRedirect = async () => {
      try {
        const redirectUser = await checkRedirectAuthResult();
        if (redirectUser?.idToken && isMounted) {
          await loginWithGoogle(redirectUser.idToken);
        }
      } catch (err: any) {
        if (isMounted) {
          setAuthError(getErrorMessage(err, 'Google authentication redirect failed. Please try again.'));
        }
      }
    };
    checkRedirect();

    // Listen to Firebase Auth state for seamless persistence
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          // Synchronize with backend SQLite user record via deduplicated helper
          const syncedUser = await performBackendGoogleAuth(idToken);
          if (syncedUser && isMounted) {
            setUser(syncedUser);
          }
        } catch (err) {
          console.error('Failed to sync Firebase auth state:', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      } else {
        // Fallback to SQLite cookie/token session check
        fetchAuthStatus();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const performBackendGoogleAuth = async (credential: string, role?: 'CUSTOMER' | 'PROVIDER'): Promise<User> => {
    if (inFlightGoogleAuth) {
      return inFlightGoogleAuth;
    }

    inFlightGoogleAuth = (async () => {
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ credential, role }),
        });

        const data = await safeParseResponse(res);
        if (data.sessionToken && typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
        }
        setUser(data.user);
        return data.user;
      } finally {
        inFlightGoogleAuth = null;
      }
    })();

    return inFlightGoogleAuth;
  };

  const loginWithGoogle = async (credential: string, role?: 'CUSTOMER' | 'PROVIDER'): Promise<User> => {
    setAuthError(null);
    try {
      return await performBackendGoogleAuth(credential, role);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Google authentication failed. Please try again.');
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const registerWithPassword = async (params: {
    name: string;
    email: string;
    password: string;
    role?: 'CUSTOMER' | 'PROVIDER';
  }): Promise<User> => {
    setAuthError(null);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await safeParseResponse(res);
      if (data.sessionToken) {
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
      }
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Registration failed. Please try again.');
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const loginWithPassword = async (email: string, password: string): Promise<User> => {
    setAuthError(null);
    try {
      const res = await apiFetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeParseResponse(res);
      if (data.sessionToken) {
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
      }
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Login failed. Please check your credentials.');
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string, newPassword: string): Promise<User> => {
    setAuthError(null);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await safeParseResponse(res);
      if (data.sessionToken) {
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
      }
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Unable to reset password.');
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      await signOutFromFirebase();
    } catch {
      // ignore
    } finally {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem('queueless_google_redirect_in_progress');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      }
    } catch {
      // ignore
    }
  };

  const saveCustomClientId = async (clientId: string) => {
    const res = await apiFetch('/api/auth/save-client-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(getErrorMessage(data, 'Failed to save Google Client ID'));
    }
    setGoogleConfig((prev) => ({ ...prev, configured: true, clientId }));
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        googleConfig,
        loginWithGoogle,
        registerWithPassword,
        loginWithPassword,
        resetPassword,
        logout,
        refreshUser,
        saveCustomClientId,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
