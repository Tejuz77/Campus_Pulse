import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, notifications } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMe = useCallback(async () => {
    try {
      const res = await auth.me();
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notifications.list({ page: 1 });
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchUnreadCount]);

  const login = async (credentials) => {
    const res = await auth.login(credentials);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
    setUnreadCount(0);
  };

  const register = async (data) => {
    const res = await auth.register(data);
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, unreadCount, refreshUnread: fetchUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
