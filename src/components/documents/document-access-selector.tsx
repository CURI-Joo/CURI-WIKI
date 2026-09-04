'use client';

import { Check, Eye, ShieldCheck } from 'lucide-react';
import type { Profile, Visibility } from '@/types';
import { cn } from '@/lib/utils';
import { canViewAllDocuments } from '@/lib/permissions';

interface DocumentAccessSelectorProps {
  profiles: Profile[];
  selectedUserIds: string[];
  visibility: Visibility;
  onChange: (userIds: string[]) => void;
}

export function DocumentAccessSelector({
  profiles,
  selectedUserIds,
  visibility,
  onChange,
}: DocumentAccessSelectorProps) {
  const activeProfiles = profiles.filter((profile) => profile.status === 'active');
  const automaticProfiles = activeProfiles.filter(canViewAllDocuments);
  const selectableProfiles = activeProfiles.filter(
    (profile) => !canViewAllDocuments(profile)
  );

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter((id) => id !== userId));
      return;
    }

    onChange([...selectedUserIds, userId]);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Eye className="h-4 w-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">공개 대상</h2>
      </div>

      {visibility === 'COMPANY' ? (
        <p className="text-sm text-text-secondary">
          전체 공개 문서는 회사 인원 5명이 모두 볼 수 있습니다.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {selectableProfiles.map((profile) => {
              const checked = selectedUserIds.includes(profile.id);

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => toggleUser(profile.id)}
                  className={cn(
                    'flex min-h-20 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    checked
                      ? 'border-curi-pink/50 bg-curi-pink-soft'
                      : 'border-border bg-surface-elevated hover:border-text-muted'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                      checked
                        ? 'border-curi-pink bg-curi-pink text-white'
                        : 'border-border bg-surface'
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">
                      {profile.name}
                    </span>
                    <span className="block truncate text-xs text-text-muted">
                      {profile.email}
                    </span>
                    <span className="mt-1 block text-[11px] text-text-secondary">
                      {profile.title}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-surface-elevated px-3 py-2 text-xs text-text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-curi-pink" />
            <span>
              {automaticProfiles.map((profile) => profile.name).join(', ')}는
              관리자/대표 권한으로 모든 글을 볼 수 있습니다.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
