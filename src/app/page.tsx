'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootRedirect() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
    } else if (profile?.status === 'approved') {
      router.replace('/home');
    } else if (profile?.status === 'pending') {
      router.replace('/pending');
    } else if (profile?.status === 'rejected') {
      router.replace('/rejected');
    }
  }, [session, profile, loading, router]);

  return null;
}
