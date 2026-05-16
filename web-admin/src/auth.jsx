import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from './api.js';

const AuthContext = createContext(null);

/**
 * Auth context for the dashboard.
 *
 * Identity comes entirely from Discord OAuth. The flow:
 *   1. User clicks "Login with Discord" → browser hits `/api/auth/discord/login`
 *      which 302s to discord.com/oauth2/authorize.
 *   2. Discord redirects back to `/api/auth/discord/callback?code=...` which
 *      sets the session cookie and 302s into the SPA.
 *   3. SPA boots, calls `/api/auth/me` to discover the current user.
 *
 * We expose:
 *   - `status`        : 'loading' | 'unauthenticated' | 'authenticated'
 *   - `user`          : { id, discordId, username, isAdmin, ... } | null
 *   - `loginWithDiscord(returnTo?)` : redirects browser to backend login URL
 *   - `logout()`                    : clears cookie + flips state
 *   - `refresh()`                   : re-fetch /api/auth/me
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user);
      setStatus('authenticated');
      setError(null);
    } catch (err) {
      setUser(null);
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

  const loginWithDiscord = useCallback((returnTo = null) => {
    const target = returnTo || window.location.pathname + window.location.search;
    const url = `/api/auth/discord/login?returnTo=${encodeURIComponent(target)}`;
    window.location.assign(url);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = {
    user,
    status,
    error,
    isAdmin: Boolean(user?.isAdmin),
    loginWithDiscord,
    logout,
    refresh
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
