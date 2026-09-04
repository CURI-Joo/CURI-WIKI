'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search, Shield, ShieldCheck, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { formatDate, getInitials } from '@/lib/utils';
import type { Profile, ProfileStatus, Role } from '@/types';

const statusLabels: Record<ProfileStatus, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거부됨',
};

const statusVariants: Record<ProfileStatus, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

function roleLabel(role: Role) {
  return role === 'admin' ? '관리자' : '멤버';
}

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '사용자 목록을 불러오지 못했습니다.');
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialUsers() {
      try {
        const res = await fetch('/api/admin/users', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? '사용자 목록을 불러오지 못했습니다.');
        setUsers(data.users ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '사용자 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateUser = async (
    id: string,
    updates: { status?: ProfileStatus; role?: Role }
  ) => {
    setSavingId(id);
    setError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '사용자 상태를 변경하지 못했습니다.');

      setUsers((current) =>
        current.map((user) => (user.id === id ? data.user : user))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 상태를 변경하지 못했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;

    return users.filter((user) =>
      [user.name, user.email, user.role, user.status].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [query, users]);

  const counts = useMemo(() => ({
    pending: users.filter((user) => user.status === 'pending').length,
    approved: users.filter((user) => user.status === 'approved').length,
    rejected: users.filter((user) => user.status === 'rejected').length,
  }), [users]);

  if (profile?.role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <Shield className="mx-auto mb-3 h-10 w-10 text-text-muted" />
        <h1 className="text-lg font-semibold text-text-primary">관리자 권한이 필요합니다</h1>
        <p className="mt-2 text-sm text-text-secondary">
          사용자 승인과 권한 변경은 관리자만 사용할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">사용자 관리</h1>
          <p className="mt-1 text-sm text-text-secondary">
            가입 요청을 승인하고 관리자 권한을 조정합니다.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-text-muted">대기</p>
            <p className="mt-1 font-semibold text-text-primary">{counts.pending}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-text-muted">승인</p>
            <p className="mt-1 font-semibold text-text-primary">{counts.approved}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-text-muted">거부</p>
            <p className="mt-1 font-semibold text-text-primary">{counts.rejected}</p>
          </div>
        </div>
      </div>

      <div className="flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 이메일, 상태 검색"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" onClick={loadUsers} disabled={loading}>
          새로고침
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[minmax(220px,1fr)_120px_120px_130px_260px] gap-4 border-b border-border px-4 py-3 text-xs font-medium text-text-muted max-lg:hidden">
          <span>사용자</span>
          <span>상태</span>
          <span>역할</span>
          <span>가입일</span>
          <span>작업</span>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-text-muted">로딩 중...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-text-muted">사용자가 없습니다.</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredUsers.map((user) => {
              const isSaving = savingId === user.id;
              const isSelf = user.id === profile.id;

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[minmax(220px,1fr)_120px_120px_130px_260px] gap-4 px-4 py-4 max-lg:grid-cols-1 max-lg:gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9">
                      {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                      <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
                      <p className="truncate text-xs text-text-muted">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Badge variant={statusVariants[user.status]}>{statusLabels[user.status]}</Badge>
                  </div>

                  <div className="flex items-center">
                    <Badge variant={user.role === 'admin' ? 'pink' : 'outline'}>
                      {roleLabel(user.role)}
                    </Badge>
                  </div>

                  <div className="flex items-center text-xs text-text-muted">
                    {formatDate(user.created_at)}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {user.status !== 'approved' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateUser(user.id, { status: 'approved' })}
                        disabled={isSaving}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        승인
                      </Button>
                    )}
                    {user.status !== 'rejected' && !isSelf && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => updateUser(user.id, { status: 'rejected' })}
                        disabled={isSaving}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        거부
                      </Button>
                    )}
                    {user.status === 'approved' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          updateUser(user.id, {
                            role: user.role === 'admin' ? 'member' : 'admin',
                          })
                        }
                        disabled={isSaving || isSelf}
                      >
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                        {user.role === 'admin' ? '멤버로' : '관리자로'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
