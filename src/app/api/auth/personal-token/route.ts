import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { authenticateWikiActor, generatePersonalAccessToken } from '@/lib/wiki-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

interface CreateTokenRequest {
  name?: string;
  expiresInDays?: number;
}

interface RevokeTokenRequest {
  tokenId?: string;
}

const MAX_EXPIRES_IN_DAYS = 365;

export async function GET(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ tokens: [] });
  }

  const actor = await authenticateWikiActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (actor.status !== 'approved') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data, error } = await supabaseAdmin
    .from('personal_access_tokens')
    .select('id, name, last_four, created_at, last_used_at, expires_at, revoked_at')
    .eq('user_id', actor.userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'list_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ tokens: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({
      ok: true,
      token: 'cw_pat_demo_token',
      token_preview: '***demo',
      expires_at: null,
      warning: '데모 모드에서는 실제 토큰이 발급되지 않습니다.',
    });
  }

  const actor = await authenticateWikiActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (actor.status !== 'approved') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CreateTokenRequest;
  try {
    body = (await request.json()) as CreateTokenRequest;
  } catch {
    body = {};
  }

  const name = (body.name ?? '').trim() || 'AI Session Token';
  const expiresInDays = Math.max(0, Math.min(body.expiresInDays ?? 30, MAX_EXPIRES_IN_DAYS));
  const expiresAt = expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const generated = generatePersonalAccessToken();
  const supabaseAdmin = getSupabaseAdmin() as any;

  const { data, error } = await supabaseAdmin
    .from('personal_access_tokens')
    .insert({
      user_id: actor.userId,
      name,
      token_hash: generated.tokenHash,
      last_four: generated.lastFour,
      expires_at: expiresAt,
    })
    .select('id, name, last_four, created_at, expires_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'create_failed', message: error?.message ?? '토큰 생성 실패' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    token: generated.token,
    token_preview: `***${generated.lastFour}`,
    token_id: data.id,
    name: data.name,
    created_at: data.created_at,
    expires_at: data.expires_at,
    usage: {
      header: 'Authorization: Bearer <token>',
      endpoint: '/api/wiki/ai-draft',
    },
    warning: '이 토큰 값은 다시 조회할 수 없으니 지금 안전하게 보관하세요.',
  });
}

export async function DELETE(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ ok: true });
  }

  const actor = await authenticateWikiActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (actor.status !== 'approved') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: RevokeTokenRequest;
  try {
    body = (await request.json()) as RevokeTokenRequest;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tokenId = body.tokenId?.trim();
  if (!tokenId) {
    return NextResponse.json({ error: 'token_id_required' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin() as any;
  const { error } = await supabaseAdmin
    .from('personal_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('user_id', actor.userId)
    .is('revoked_at', null);

  if (error) {
    return NextResponse.json({ error: 'revoke_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token_id: tokenId });
}
