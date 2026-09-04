import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    return NextResponse.json(
      { error: `데모 모드 첨부파일은 Storage에 저장되지 않습니다: ${id}` },
      { status: 404 }
    );
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: attachment, error } = await supabaseAdmin
    .from('attachments')
    .select('storage_key, mime_type')
    .eq('id', id)
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (!attachment.mime_type.startsWith('image/')) {
    return NextResponse.json({ error: '이미지 파일만 표시할 수 있습니다.' }, { status: 400 });
  }

  const { data: signedUrl, error: signError } = await supabaseAdmin.storage
    .from('wiki-media')
    .createSignedUrl(attachment.storage_key, 3600);

  if (signError || !signedUrl) {
    return NextResponse.json({ error: 'URL 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
