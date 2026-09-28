'use client';

import { useEffect, useState } from 'react';
import { demoProfiles } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';
import type { Document, Profile } from '@/types';
import { useAuth } from '@/lib/auth-context';

let profilesCache: Profile[] | null = null;

export function useProfiles() {
  const isDemo = isDemoMode();
  const [profiles, setProfiles] = useState<Profile[]>(
    isDemo ? demoProfiles : profilesCache ?? []
  );

  useEffect(() => {
    if (isDemo || profilesCache) {
      return;
    }

    const supabase = createClient();
    supabase
      .from('profiles')
      .select('*')
      .eq('status', 'approved')
      .then(({ data }: { data: Profile[] | null }) => {
        profilesCache = (data ?? []) as Profile[];
        setProfiles(profilesCache);
      });
  }, [isDemo]);

  return profiles;
}

export function getProfileName(
  profiles: Profile[],
  userId: string
): string {
  const profile = profiles.find((p) => p.id === userId);
  return profile?.name ?? userId;
}

export function useDocumentAuthor(document: Pick<Document, 'id' | 'owner_id'> | undefined) {
  const { session, profile, loading } = useAuth();
  const isDemo = isDemoMode();
  const documentId = document?.id;
  const ownerId = document?.owner_id;
  const approved = Boolean(session && profile?.status === 'approved');
  const key = `${documentId ?? ''}:${ownerId ?? ''}:${session?.user.id ?? 'anon'}:${approved}:${profile?.role ?? ''}`;
  const [result, setResult] = useState<{ key: string; author: Pick<Profile, 'id' | 'name'> | null } | null>(null);

  useEffect(() => {
    if (isDemo || loading || !documentId || !ownerId) return;
    let cancelled = false;

    async function loadAuthor() {
      const supabase = createClient();
      const { data, error } = approved
        ? await supabase.from('profiles').select('id, name').eq('id', ownerId!).maybeSingle()
        : await supabase.rpc('get_public_document_author', { document_id: documentId! }).maybeSingle();

      if (!cancelled) setResult({ key, author: error ? null : data });
    }

    void loadAuthor().catch(() => {
      if (!cancelled) setResult({ key, author: null });
    });
    return () => { cancelled = true; };
  }, [isDemo, loading, approved, documentId, ownerId, key]);

  if (isDemo) return demoProfiles.find((author) => author.id === ownerId) ?? null;
  return !loading && result?.key === key ? result.author : null;
}
