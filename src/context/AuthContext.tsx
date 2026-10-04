import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { signOutFromFirebase } from '../services/firebase';

const SESSION_STORAGE_KEY = 'queueless_session_token';

/**
 * Safe fetch wrapper that automatically attaches the Bearer token for /api requests.
 * Does NOT mutate the read-only window.fetch getter, ensuring full compatibility across all browsers & iframes.
 */
export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
  const requestInit = { ...(init || {}) };
  const headers = new Headers(requestInit.headers || {});

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
      throw new Error(`Server temporarily unavailable (${res.status}). Please try again in a few moments.`);
    }
    throw new Error('Unexpected response received from server.');
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
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
  loginWithGoogle: (credential: string) => Promise<User>;
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
    fetchAuthStatus();
  }, []);

  const loginWithGoogle = async (credential: string): Promise<User> => {
    setAuthError(null);
    try {
      const res = await apiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await safeParseResponse(res);
      if (data.sessionToken) {
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken);
      }
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      setAuthError(err.message);
      throw err;
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
      setAuthError(err.message);
      throw err;
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
      setAuthError(err.message);
      throw err;
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
      setAuthError(err.message);
      throw err;
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
      throw new Error(data.error || 'Failed to save Google Client ID');
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
