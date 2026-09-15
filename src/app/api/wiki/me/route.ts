import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

async function getAuthContext(request: NextRequest) {
  const token = getBearerToken(request);

  if (token) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Supabase client environment variables are required.');
    }

    const supabase = createSupabaseClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    return { supabase, user };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthContext(request);

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role, status')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ authenticated: true, profile: null }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    profile,
  });
}
