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

  // Check approved status
  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  // Get attachment record
  const supabaseAdmin = getSupabaseAdmin();
  const { data: attachment, error } = await supabaseAdmin
    .from('attachments')
    .select('storage_key, file_name, mime_type, document_id')
    .eq('id', id)
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (attachment.document_id) {
    const { data: documentData } = await supabaseAdmin
      .from('documents')
      .select('category_id')
      .eq('id', attachment.document_id)
      .single();

    const document = documentData as { category_id: string | null } | null;

    if (document?.category_id === 'cat-secret' && profile.role !== 'admin') {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }
  }

  // Create signed URL (1 hour expiry)
  const { data: signedUrl, error: signError } = await supabaseAdmin.storage
    .from('wiki-media')
    .createSignedUrl(attachment.storage_key, 3600);

  if (signError || !signedUrl) {
    return NextResponse.json({ error: 'URL 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    url: signedUrl.signedUrl,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    return NextResponse.json({ ok: true });
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
  const { data: attachment, error } = await supabaseAdmin
    .from('attachments')
    .select('storage_key, uploaded_by')
    .eq('id', id)
    .single();

  if (error || !attachment) {
    return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 업로더 본인 또는 관리자만 삭제할 수 있습니다.
  if (attachment.uploaded_by !== user.id && profile.role !== 'admin') {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
  }

  await supabaseAdmin.storage.from('wiki-media').remove([attachment.storage_key]);

  const { error: deleteError } = await supabaseAdmin
    .from('attachments')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: `첨부파일 삭제 실패: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
