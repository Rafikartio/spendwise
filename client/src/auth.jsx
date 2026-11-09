import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const h = () => setUser(null);
    window.addEventListener('sw:logout', h);
    return () => window.removeEventListener('sw:logout', h);
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api.post('/auth/login', { email, password });
    setToken(d.token);
    setUser(d.user);
  }, []);
  const register = useCallback(async (name, email, password) => {
    const d = await api.post('/auth/register', { name, email, password });
    setToken(d.token);
    setUser(d.user);
  }, []);
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
