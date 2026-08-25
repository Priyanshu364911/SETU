import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import api from '../api';
import type { UserProfile, TokenPayload, Role } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem('setu_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('setu_token');
  });

  // Check token expiry on mount
  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      if (!decoded || decoded.exp * 1000 < Date.now()) {
        logout();
      }
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('setu_token', newToken);
    localStorage.setItem('setu_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('setu_token');
    localStorage.removeItem('setu_user');
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback((...roles: Role[]) => {
    return user ? roles.includes(user.role) : false;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      role: user?.role || null,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      hasRole,
    }}>
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
