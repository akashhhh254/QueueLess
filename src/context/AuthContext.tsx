import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { signOutFromFirebase } from '../services/firebase';

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
      const configRes = await fetch('/api/auth/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        setGoogleConfig(configData);
      }

      // 2. Fetch authenticated session
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        setUser(meData.user || null);
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
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Google authentication failed.');
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Registration failed.');
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
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Login failed.');
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
      await fetch('/api/auth/logout', { method: 'POST' });
      await signOutFromFirebase();
    } catch {
      // ignore
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
      }
    } catch {
      // ignore
    }
  };

  const saveCustomClientId = async (clientId: string) => {
    const res = await fetch('/api/auth/save-client-id', {
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
