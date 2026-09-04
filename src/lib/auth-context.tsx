'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import type { Profile } from '@/types';
import { seedProfiles } from '@/data/seed-profiles';

interface AuthContextValue {
  user: Profile | null;
  login: (profileId: string) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  switchUser: (profileId: string) => void;
  isDemo: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function firebaseUserToProfile(fbUser: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Profile {
  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    name: fbUser.displayName ?? fbUser.email ?? 'User',
    avatar_url: fbUser.photoURL,
    role: 'MEMBER',
    title: '멤버',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemo = true;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUser(firebaseUserToProfile(fbUser));
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback((profileId: string) => {
    const profile = seedProfiles.find((p) => p.id === profileId && p.status === 'active');
    if (profile) setUser(profile);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    setUser(firebaseUserToProfile(result.user));
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth).catch(() => {});
    setUser(null);
  }, []);

  const switchUser = useCallback((profileId: string) => {
    if (!isDemo) return;
    const profile = seedProfiles.find((p) => p.id === profileId && p.status === 'active');
    if (profile) setUser(profile);
  }, [isDemo]);

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, switchUser, isDemo, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
