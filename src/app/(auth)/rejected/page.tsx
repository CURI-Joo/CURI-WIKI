'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect } from 'react';
import { ShieldX } from 'lucide-react';

export default function RejectedPage() {
  const { session, profile, logout, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (profile?.status === 'approved') {
      router.replace('/home');
    }
  }, [session, profile, loading, router]);

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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <ShieldX className="h-6 w-6 text-red-500" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            접근이 거부되었습니다
          </h2>
          <p className="text-sm text-text-secondary">
            관리자가 접근을 거부했습니다.<br />
            문의가 필요하면 관리자에게 연락해주세요.
          </p>
          {profile && (
            <p className="text-xs text-text-muted">
              {profile.email}
            </p>
          )}
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
