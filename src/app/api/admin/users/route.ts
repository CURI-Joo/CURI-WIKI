import { NextRequest, NextResponse } from 'next/server';
import { demoProfiles } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProfileStatus, Role } from '@/types';

const demoUsers: Profile[] = [...demoProfiles];
const validStatuses = new Set<ProfileStatus>(['pending', 'approved', 'rejected']);
const validRoles = new Set<Role>(['admin', 'member']);

async function getAdminActorId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, role, status')
    .eq('id', user.id)
    .single();

  if (error || !profile || profile.role !== 'admin' || profile.status !== 'approved') {
    return { error: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }) };
  }

  return { actorId: user.id };
}

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({
      users: [...demoUsers].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    });
  }

  const actor = await getAdminActorId();
  if (actor.error) return actor.error;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('id, email, name, avatar_url, role, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  let body: { id?: string; status?: ProfileStatus; role?: Role };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { id, status, role } = body;

  if (!id) {
    return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
  }
  if (status && !validStatuses.has(status)) {
    return NextResponse.json({ error: '잘못된 사용자 상태입니다.' }, { status: 400 });
  }
  if (role && !validRoles.has(role)) {
    return NextResponse.json({ error: '잘못된 사용자 역할입니다.' }, { status: 400 });
  }
  if (!status && !role) {
    return NextResponse.json({ error: '변경할 값이 필요합니다.' }, { status: 400 });
  }

  if (isDemoMode()) {
    const user = demoUsers.find((profile) => profile.id === id);
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (status) user.status = status;
    if (role) user.role = role;
    user.updated_at = new Date().toISOString();

    return NextResponse.json({ user });
  }

  const actor = await getAdminActorId();
  if (actor.error) return actor.error;

  if (
    actor.actorId === id &&
    ((status && status !== 'approved') || role === 'member')
  ) {
    return NextResponse.json(
      { error: '자기 자신의 관리자 권한은 해제할 수 없습니다.' },
      { status: 400 }
    );
  }

  const updates: Partial<Pick<Profile, 'status' | 'role' | 'updated_at'>> = {
    updated_at: new Date().toISOString(),
  };
  if (status) updates.status = status;
  if (role) updates.role = role;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select('id, email, name, avatar_url, role, status, created_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
