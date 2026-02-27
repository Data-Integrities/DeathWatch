import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { api, setAuthToken, setOnUnauthorized } from '../services/api/client';
import type { UserProfile, LoginResponse } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (email: string, password: string, passwordConfirm: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'obitnote_token_v3';

function getStoredToken(): string | null {
  if (Platform.OS === 'web') {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
    } catch { return null; }
  }
  return null;
}

function storeToken(token: string | null, remember?: boolean) {
  if (Platform.OS === 'web') {
    try {
      if (token) {
        if (remember) {
          localStorage.setItem(TOKEN_KEY, token);
          sessionStorage.removeItem(TOKEN_KEY);
        } else {
          sessionStorage.setItem(TOKEN_KEY, token);
          localStorage.removeItem(TOKEN_KEY);
        }
      } else {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // In development, always start at login. In production, restore session.
  useEffect(() => {
    if (__DEV__) {
      storeToken(null);
      setIsLoading(false);
      return;
    }
    const token = getStoredToken();
    if (token) {
      setAuthToken(token);
      api.get<{ user: UserProfile }>('/api/auth/me')
        .then(({ user }) => setUser(user))
        .catch(() => {
          setAuthToken(null);
          storeToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember?: boolean) => {
    const res = await api.post<LoginResponse>('/api/auth/login', { email, password });
    setAuthToken(res.token);
    storeToken(res.token, remember);
    setUser(res.user);
    if (Platform.OS === 'web') {
      try { localStorage.setItem('obitnote_returning', '1'); } catch {}
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, passwordConfirm: string, firstName: string, lastName: string) => {
    const res = await api.post<LoginResponse>('/api/auth/register', { email, password, passwordConfirm, firstName, lastName });
    setAuthToken(res.token);
    storeToken(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    storeToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user } = await api.get<{ user: UserProfile }>('/api/auth/me');
    setUser(user);
  }, []);

  useEffect(() => {
    setOnUnauthorized(signOut);
    return () => setOnUnauthorized(null);
  }, [signOut]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
