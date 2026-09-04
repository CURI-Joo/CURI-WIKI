'use client';

import { useEffect, useState } from 'react';
import { demoProfiles } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

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
