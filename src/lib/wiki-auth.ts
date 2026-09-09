import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Role } from '@/types';

export type WikiAuthMethod = 'session' | 'token';

export interface WikiActor {
  userId: string;
  role: Role;
  status: 'pending' | 'approved' | 'rejected';
  authMethod: WikiAuthMethod;
  tokenId?: string;
}

interface ProfileRow {
  id: string;
  role: Role;
  status: 'pending' | 'approved' | 'rejected';
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

async function getProfile(userId: string) {
  const supabaseAdmin = getSupabaseAdmin() as any;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status')
    .eq('id', userId)
    .single();

  return (data ?? null) as ProfileRow | null;
}

export function generatePersonalAccessToken() {
  const raw = `cw_pat_${randomBytes(24).toString('base64url')}`;
  return {
    token: raw,
    tokenHash: sha256(raw),
    lastFour: raw.slice(-4),
  };
}

export async function authenticateWikiActor(request: NextRequest): Promise<WikiActor | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await getProfile(user.id);
    if (!profile) return null;

    return {
      userId: profile.id,
      role: profile.role,
      status: profile.status,
      authMethod: 'session',
    };
  }

  const bearerToken = getBearerToken(request);
  if (!bearerToken) return null;

  const tokenHash = sha256(bearerToken);
  const nowIso = new Date().toISOString();
  const supabaseAdmin = getSupabaseAdmin() as any;

  const { data: pat } = await supabaseAdmin
    .from('personal_access_tokens')
    .select('id, user_id, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (!pat) return null;

  if (pat.expires_at && new Date(pat.expires_at).getTime() <= Date.now()) {
    return null;
  }

  await supabaseAdmin
    .from('personal_access_tokens')
    .update({ last_used_at: nowIso })
    .eq('id', pat.id);

  const profile = await getProfile(pat.user_id);
  if (!profile) return null;

  return {
    userId: profile.id,
    role: profile.role,
    status: profile.status,
    authMethod: 'token',
    tokenId: pat.id,
  };
}
