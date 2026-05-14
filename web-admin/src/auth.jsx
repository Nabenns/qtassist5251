import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'unauthenticated' | 'authenticated'
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setAdmin(data.admin);
      setStatus('authenticated');
      setError(null);
    } catch (err) {
      setAdmin(null);
      if (err instanceof ApiError && err.status === 401) {
        setStatus('unauthenticated');
      } else {
        setStatus('unauthenticated');
        setError(err);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (username, password) => {
      const data = await api.post('/api/auth/login', { username, password });
      setAdmin(data.admin);
      setStatus('authenticated');
      setError(null);
      return data.admin;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setAdmin(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = { admin, status, error, login, logout, refresh };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
