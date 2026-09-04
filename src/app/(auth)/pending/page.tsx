'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function PendingPage() {
  const { session, profile, logout, loading, refreshProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (profile?.status === 'approved') {
      router.replace('/home');
    } else if (profile?.status === 'rejected') {
      router.replace('/rejected');
    }
  }, [session, profile, loading, router]);

  const handleRefresh = async () => {
    await refreshProfile();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image
            src="/curi-logo.png"
            alt="CURI 로고"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0"
            priority
          />
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            CURI <span className="text-curi-pink">WIKI</span>
          </h1>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            관리자 승인 대기 중
          </h2>
          <p className="text-sm text-text-secondary">
            로그인이 확인되었습니다.<br />
            관리자가 승인하면 CURI Wiki를 사용할 수 있습니다.
          </p>
          {profile && (
            <p className="text-xs text-text-muted">
              {profile.email}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-elevated text-text-primary hover:bg-curi-pink-soft transition-colors"
            >
              상태 확인
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm font-medium rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
