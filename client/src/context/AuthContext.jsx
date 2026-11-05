import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api.js';

// Who is logged in, available to every page through useAuth().
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  // If a token is saved from last time, we must ask the server who it
  // belongs to before showing protected pages.
  const [ready, setReady] = useState(!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    queryClient.clear(); // forget the previous user's cached data
  }, [queryClient]);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  const start = useCallback(
    ({ token, user: loggedIn }) => {
      tokenStore.set(token);
      queryClient.clear();
      setUser(loggedIn);
    },
    [queryClient],
  );

  const login = useCallback((body) => api('/auth/login', { method: 'POST', body }).then(start), [start]);
  const signup = useCallback((body) => api('/auth/signup', { method: 'POST', body }).then(start), [start]);

  const value = useMemo(() => ({ user, ready, login, signup, logout, setUser }), [user, ready, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
