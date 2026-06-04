'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authApi } from '@/lib/api';

interface User {
  id: number;
  username: string;
  role: string;
  must_change_password: number;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const { data, error } = await authApi.me();
      if (data && !error) {
        setUser(data.user);
        setMustChangePassword(data.mustChangePassword === true);
      } else {
        setUser(null);
        setMustChangePassword(false);
      }
    } catch {
      setUser(null);
      setMustChangePassword(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username: string, password: string) => {
    const { data, error } = await authApi.login(username, password);
    if (data && !error) {
      setUser(data.user);
      setMustChangePassword(data.mustChangePassword === true);
      return { success: true };
    }
    return { success: false, error: error || 'Login failed' };
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        mustChangePassword,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
