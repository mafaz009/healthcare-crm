'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setSession, clearSession, getStoredUser, isAuthenticated } from '@/lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // On mount: restore user from localStorage, then verify with server
  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);

    if (isAuthenticated()) {
      api.get('/api/auth/me')
        .then(({ data }) => setUser(data.data))
        .catch(() => {
          clearSession();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // identifier: loginId ("dr.manmeet") or email ("dr@clinic.com") — backend detects which
  const login = async (identifier, password) => {
    const { data } = await api.post('/api/auth/login', { identifier, password });
    setSession(data.data.token, data.data.user);
    setUser(data.data.user);
    return data.data;  // includes mustChangePassword flag
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    clearSession();
    setUser(null);
    router.push('/login');
  };

  /**
   * Refresh the user state from the server.
   * Call after operations that change user data (e.g. password change).
   */
  const refreshUser = async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data.data);
      // Keep localStorage in sync (used for instant load on next mount)
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_user', JSON.stringify(data.data));
      }
      return data.data;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
