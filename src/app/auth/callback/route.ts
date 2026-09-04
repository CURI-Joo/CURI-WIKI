import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (isDemoMode()) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this user should be auto-approved as admin
      const { data: { user } } = await supabase.auth.getUser();
      const adminEmail = process.env.ADMIN_EMAIL;

      if (user && adminEmail && user.email === adminEmail) {
        const supabaseAdmin = getSupabaseAdmin();
        await supabaseAdmin
          .from('profiles')
          .update({ status: 'approved', role: 'admin' })
          .eq('id', user.id);
      }

      // Check profile status to redirect appropriately
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user!.id)
        .single();

      if (profile?.status === 'approved') {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (profile?.status === 'rejected') {
        return NextResponse.redirect(`${origin}/rejected`);
      } else {
        return NextResponse.redirect(`${origin}/pending`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
