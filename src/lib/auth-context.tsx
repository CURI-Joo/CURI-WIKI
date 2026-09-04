'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { demoProfiles } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import type { Session } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const demoProfile = demoProfiles[0];

function createDemoSession(profile: Profile): Session {
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    expires_in: 60 * 60,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    token_type: 'bearer',
    user: {
      id: profile.id,
      app_metadata: {},
      user_metadata: {
        avatar_url: profile.avatar_url,
        email: profile.email,
        full_name: profile.name,
        name: profile.name,
      },
      aud: 'authenticated',
      created_at: profile.created_at,
      email: profile.email,
    },
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isDemo = isDemoMode();
  const demoSession = useMemo(() => createDemoSession(demoProfile), []);
  const supabase = useMemo(() => (isDemo ? null : createClient()), [isDemo]);

  const [session, setSession] = useState<Session | null>(() =>
    isDemo ? demoSession : null
  );
  const [profile, setProfile] = useState<Profile | null>(() =>
    isDemo ? demoProfile : null
  );
  const [loading, setLoading] = useState(!isDemo);

  const fetchProfile = useCallback(async (userId: string) => {
    if (isDemo) {
      const found = demoProfiles.find((p) => p.id === userId) ?? demoProfile;
      setProfile(found);
      return found;
    }
    if (!supabase) return null;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data as Profile);
    }
    return data;
  }, [isDemo, supabase]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    if (!supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: Session | null } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, s: Session | null) => {
        setSession(s);
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isDemo, supabase, fetchProfile]);

  const loginWithGoogle = useCallback(async () => {
    if (isDemo) {
      setSession(demoSession);
      setProfile(demoProfile);
      return;
    }

    if (!supabase) return;

    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : '/auth/callback';

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }, [isDemo, supabase, demoSession]);

  const logout = useCallback(async () => {
    if (isDemo) {
      setSession(null);
      setProfile(null);
      return;
    }

    if (!supabase) return;

    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, [isDemo, supabase]);

  const refreshProfile = useCallback(async () => {
    if (isDemo) {
      setProfile(demoProfile);
      return;
    }

    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  }, [isDemo, session, fetchProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, loginWithGoogle, logout, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
