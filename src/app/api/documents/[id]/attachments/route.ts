import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/** 문서에 연결된 첨부파일 목록 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    return NextResponse.json({ attachments: [] });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: documentData } = await supabaseAdmin
    .from('documents')
    .select('category_id')
    .eq('id', id)
    .single();

  const document = documentData as { category_id: string | null } | null;

  if (document?.category_id === 'cat-secret' && profile.role !== 'admin') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from('attachments')
    .select('id, document_id, issue_id, file_name, mime_type, file_size, uploaded_by, created_at, storage_key')
    .eq('document_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `첨부파일을 불러오지 못했습니다: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ attachments: data ?? [] });
}
