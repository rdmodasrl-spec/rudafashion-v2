import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

export interface StudioUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo?: boolean;
}

interface AuthContextValue {
  user: User | StudioUser | null;
  idToken: string | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInAsDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const DEMO_STORAGE_KEY = 'ruda_demo_session_v1';
const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | StudioUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (nextUser) => {
      if (nextUser) {
        try {
          const token = await nextUser.getIdToken();
          setUser(nextUser);
          setIdToken(token);
        } catch (err) {
          console.error('Failed to retrieve ID token:', err);
          setUser(nextUser);
          setIdToken(null);
        }
        setLoading(false);
        return;
      }

      // Check local demo session fallback if no Firebase user
      try {
        const saved = sessionStorage.getItem(DEMO_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { token: string; user: StudioUser };
          if (parsed?.token && parsed?.user?.uid) {
            setUser({ ...parsed.user, isDemo: true });
            setIdToken(parsed.token);
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore storage errors
      }

      setUser(null);
      setIdToken(null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      sessionStorage.removeItem(DEMO_STORAGE_KEY);
      setUser(cred.user);
      setIdToken(token);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Google 登录失败，请重试。';
      const friendly =
        raw.includes('unauthorized-domain') || raw.includes('popup')
          ? '当前预览域名未在原 Firebase 项目授权白名单中，请点击下方「以本地演示模式进入工作台」直接体验完整功能。'
          : raw;
      setAuthError(friendly);
      throw err;
    }
  }, []);

  const signInAsDemo = useCallback(async () => {
    setAuthError(null);
    try {
      const res = await fetch('/api/v1/auth/demo', { method: 'POST' });
      if (!res.ok) throw new Error('创建本地演示会话失败');
      const data = (await res.json()) as { token: string; user: StudioUser };
      const demoUser: StudioUser = { ...data.user, isDemo: true };
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ token: data.token, user: demoUser }));
      setUser(demoUser);
      setIdToken(data.token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '演示登录失败，请重试。';
      setAuthError(msg);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    sessionStorage.removeItem(DEMO_STORAGE_KEY);
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setIdToken(null);
  }, []);

  const refreshToken = useCallback(async () => {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken(true);
      setIdToken(token);
      return token;
    }
    return idToken;
  }, [idToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        authError,
        signInWithGoogle,
        signInAsDemo,
        signOut,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
